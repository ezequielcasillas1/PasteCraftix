import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logUsage } from '../_shared/usage-log.ts'
import { corsHeadersForOrigin, preflightResponse, isLocalhostAdminOrigin } from '../_shared/cors.ts'

function respond(data: unknown, origin: string | null, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeadersForOrigin(origin, 'admin'), 'Content-Type': 'application/json' },
    status,
  })
}

async function logAdminAction(supabase: any, adminUserId: string, action: string, targetUserId: string | null, payload: Record<string, unknown> = {}) {
  try {
    await supabase.from('admin_actions').insert({
      admin_user_id: adminUserId,
      action,
      target_user_id: targetUserId,
      payload,
    })
  } catch (err) {
    console.error('[admin-api] audit log failed', action, err)
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return preflightResponse(origin, 'admin')

  if (origin && !isLocalhostAdminOrigin(origin)) {
    return respond({ ok: false, error: 'Forbidden: admin-api is localhost-only' }, origin, 403)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) {
      return respond({ ok: false, error: 'Server env not configured' }, origin, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Auth: extract + verify Bearer token
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return respond({ ok: false, error: 'Unauthorized' }, origin, 401)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return respond({ ok: false, error: 'Unauthorized' }, origin, 401)

    // Admin gate: user must be in admin_users table
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminRow) return respond({ ok: false, error: 'Forbidden: not an admin' }, origin, 403)

    const body = await req.json().catch(() => ({}))
    const { action, payload = {} } = body

    logUsage('admin-api', String(action || 'unknown'), user.id)

    switch (action) {
      case 'list_users':      return respond({ ok: true, data: await listUsers(supabase) }, origin)
      case 'list_events':     return respond({ ok: true, data: await listEvents(supabase, payload) }, origin)
      case 'list_violations': return respond({ ok: true, data: await listViolations(supabase) }, origin)
      case 'get_user':        return respond({ ok: true, data: await getUserDetail(supabase, payload.user_id) }, origin)
      case 'ban_user':        return respond({ ok: true, data: await doBanUser(supabase, payload, user.id) }, origin)
      case 'unban_user':      return respond({ ok: true, data: await doUnbanUser(supabase, payload.user_id, user.id) }, origin)
      case 'adjust_limit':    return respond({ ok: true, data: await doAdjustLimit(supabase, payload, user.id) }, origin)
      case 'resolve_event':   return respond({ ok: true, data: await doResolveEvent(supabase, payload.event_id, user.id) }, origin)
      case 'delete_user':     return respond({ ok: true, data: await doDeleteUser(supabase, payload.user_id, user.id) }, origin)
      case 'get_stats':       return respond({ ok: true, data: await getStats(supabase) }, origin)
      case 'get_usage':       return respond({ ok: true, data: await getUsage(supabase, payload) }, origin)
      case 'list_quarantine': return respond({ ok: true, data: await listQuarantine(supabase) }, origin)
      case 'restore_quarantine':
        return respond({ ok: true, data: await restoreQuarantine(supabase, payload.user_id, user.id) }, origin)
      case 'confirm_delete_quarantine':
        return respond({ ok: true, data: await confirmDeleteQuarantine(supabase, payload.user_id, user.id) }, origin)
      case 'list_refactor_tickets':
        return respond({ ok: true, data: await listRefactorTickets(supabase, payload) }, origin)
      case 'get_refactor_ticket':
        return respond({ ok: true, data: await getRefactorTicket(supabase, payload.ticket_id, user.id) }, origin)
      case 'resolve_refactor_ticket':
        return respond({ ok: true, data: await resolveRefactorTicket(supabase, payload.ticket_id, user.id) }, origin)
      default: return respond({ ok: false, error: `Unknown action: ${action}` }, origin, 400)
    }
  } catch (err) {
    console.error('[admin-api]', err)
    return respond({ ok: false, error: String(err instanceof Error ? err.message : err) }, origin, 500)
  }
})

// ── List all users ─────────────────────────────────────────────────────────────
// Source of truth: auth.users (every signed-up account). Left-joins user_profiles
// and user_subscriptions so users without extension activity still appear.
async function listUsers(supabase: any) {
  const authUsers = await listAllAuthUsers(supabase)

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, auth_user_id, user_name, is_banned, ban_reason, banned_at, ban_expires_at, warning_count, daily_clip_limit, created_at')

  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, email, subscription_tier, subscription_status, stripe_customer_id')

  const { data: clips } = await supabase
    .from('clips')
    .select('user_id')
    .is('deleted_at', null)

  // Profiles can be keyed by auth UUID or extension user_id — index by both.
  const profileByAuth: Record<string, any> = {}
  const profileByUid:  Record<string, any> = {}
  for (const p of profiles || []) {
    if (p.auth_user_id) profileByAuth[String(p.auth_user_id)] = p
    if (p.user_id)      profileByUid[String(p.user_id)]      = p
  }

  const subByAuth: Record<string, any> = {}
  const subByUid:  Record<string, any> = {}
  const subByEmail: Record<string, any> = {}
  for (const s of subs || []) {
    if (s.user_id) {
      subByUid[String(s.user_id)] = s
      subByAuth[String(s.user_id)] = s
    }
    if (s.email) subByEmail[String(s.email).toLowerCase()] = s
  }

  const clipCounts: Record<string, number> = {}
  for (const c of clips || []) clipCounts[c.user_id] = (clipCounts[c.user_id] || 0) + 1

  return authUsers.map((au: any) => {
    const authId = String(au.id)
    const email  = au.email || au.user_metadata?.email || '—'
    const profile =
      profileByAuth[authId] ||
      profileByUid[authId] ||
      (email ? Object.values(profileByUid).find((p: any) => p?.email === email) : null) ||
      {}
    const sub =
      subByAuth[authId] ||
      subByUid[authId] ||
      (email ? subByEmail[String(email).toLowerCase()] : null) ||
      {}
    const uid = profile.user_id || authId

    return {
      user_id:             uid,
      auth_user_id:        authId,
      email:               email,
      user_name:           profile.user_name || au.user_metadata?.full_name || au.user_metadata?.name || '—',
      subscription_tier:   sub.subscription_tier   || 'free',
      subscription_status: sub.subscription_status || 'active',
      stripe_customer_id:  sub.stripe_customer_id  || null,
      is_banned:           !!profile.is_banned,
      ban_reason:          profile.ban_reason      || null,
      banned_at:           profile.banned_at       || null,
      ban_expires_at:      profile.ban_expires_at  || null,
      warning_count:       profile.warning_count   ?? 0,
      daily_clip_limit:    profile.daily_clip_limit ?? 700,
      clip_count:          clipCounts[uid] || 0,
      created_at:          profile.created_at || au.created_at,
      last_sign_in_at:     au.last_sign_in_at || null,
      has_profile:         !!profile.user_id,
    }
  })
}

// Paginate through Supabase Auth to fetch every account (max 1000 per page).
async function listAllAuthUsers(supabase: any) {
  const all: any[] = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('listAuthUsers: ' + error.message)
    const users = data?.users || []
    all.push(...users)
    if (users.length < perPage) break
    page++
    if (page > 50) break
  }
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all
}

// ── List security events (with optional filters) ───────────────────────────────
async function listEvents(supabase: any, filters: any) {
  let q = supabase
    .from('security_events')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(300)

  if (filters.user_id) q = q.eq('user_id', filters.user_id)
  if (filters.event_type) q = q.eq('event_type', filters.event_type)
  if (filters.resolved !== undefined && filters.resolved !== '') {
    q = q.eq('resolved', filters.resolved === 'true' || filters.resolved === true)
  }
  if (filters.since) q = q.gte('triggered_at', filters.since)

  const { data, error } = await q
  if (error) throw new Error('listEvents: ' + error.message)
  return data || []
}

// ── List rate limit violations ─────────────────────────────────────────────────
async function listViolations(supabase: any) {
  const { data, error } = await supabase
    .from('rate_limit_violations')
    .select('*')
    .order('attempted_at', { ascending: false })
    .limit(300)
  if (error) throw new Error('listViolations: ' + error.message)
  return data || []
}

// ── Get single user detail ──────────────────────────────────────────────────────
async function getUserDetail(supabase: any, userId: string) {
  if (!userId) throw new Error('user_id required')

  const [profileRes, subRes, eventsRes, violationsRes, devicesRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('security_events').select('*').eq('user_id', userId).order('triggered_at', { ascending: false }).limit(25),
    supabase.from('rate_limit_violations').select('*').eq('user_id', userId).order('attempted_at', { ascending: false }).limit(15),
    supabase.from('pastecraft_devices').select('device_id, display_name, last_seen_at').eq('user_id', userId),
  ])

  return {
    profile: profileRes.data,
    subscription: subRes.data,
    events: eventsRes.data || [],
    violations: violationsRes.data || [],
    devices: devicesRes.data || [],
  }
}

// ── Ban a user ─────────────────────────────────────────────────────────────────
async function doBanUser(supabase: any, payload: any, adminUserId: string) {
  const { user_id, reason, ban_expires_at } = payload
  if (!user_id || !reason) throw new Error('user_id and reason are required')

  const update: any = {
    is_banned: true,
    ban_reason: reason,
    banned_at: new Date().toISOString(),
    ban_expires_at: ban_expires_at || null,
    warning_count: null,
  }

  // Increment warning_count using current value
  const { data: current } = await supabase
    .from('user_profiles')
    .select('warning_count')
    .eq('user_id', user_id)
    .maybeSingle()
  update.warning_count = ((current?.warning_count || 0) + 1)

  const { error } = await supabase.from('user_profiles').update(update).eq('user_id', user_id)
  if (error) throw new Error('doBanUser: ' + error.message)

  await supabase.from('security_events').insert({
    user_id,
    event_type: 'manual_ban',
    severity: 'high',
    details: { reason, ban_expires_at: ban_expires_at || null, banned_by: adminUserId },
    auto_banned: false,
  })

  await logAdminAction(supabase, adminUserId, 'ban_user', user_id, { reason, ban_expires_at: ban_expires_at || null })

  return { banned: true }
}

// ── Unban a user ───────────────────────────────────────────────────────────────
async function doUnbanUser(supabase: any, userId: string, adminUserId: string) {
  if (!userId) throw new Error('user_id required')
  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_banned: false,
      ban_lifted_at: new Date().toISOString(),
      ban_reason: null,
      banned_at: null,
      ban_expires_at: null,
    })
    .eq('user_id', userId)
  if (error) throw new Error('doUnbanUser: ' + error.message)
  await logAdminAction(supabase, adminUserId, 'unban_user', userId, {})
  return { unbanned: true }
}

// ── Adjust daily clip limit ────────────────────────────────────────────────────
async function doAdjustLimit(supabase: any, payload: any, adminUserId: string) {
  const { user_id, daily_clip_limit } = payload
  if (!user_id || daily_clip_limit === undefined) throw new Error('user_id and daily_clip_limit required')
  const limit = Number(daily_clip_limit)
  if (!Number.isFinite(limit) || limit < 1 || limit > 99999) throw new Error('Limit must be between 1 and 99999')
  const { error } = await supabase
    .from('user_profiles')
    .update({ daily_clip_limit: limit })
    .eq('user_id', user_id)
  if (error) throw new Error('doAdjustLimit: ' + error.message)
  await logAdminAction(supabase, adminUserId, 'adjust_limit', user_id, { daily_clip_limit: limit })
  return { daily_clip_limit: limit }
}

// ── Mark a security event as resolved ─────────────────────────────────────────
async function doResolveEvent(supabase: any, eventId: string, adminUserId: string) {
  if (!eventId) throw new Error('event_id required')
  const { error } = await supabase
    .from('security_events')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', eventId)
  if (error) throw new Error('doResolveEvent: ' + error.message)
  return { resolved: true }
}

// ── Aggregate stats for dashboard overview ────────────────────────────────────
async function getStats(supabase: any) {
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 24 * 60 * 60 * 1000))

  const authUsers = await listAllAuthUsers(supabase)

  const [
    bannedUsersRes,
    subsRes,
    pv24Res,
    pv7Res,
    pv30Res,
    uniq24Res,
    uniq7Res,
    uniq30Res,
    topPathsRes,
  ] = await Promise.all([
    supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }).eq('is_banned', true),
    supabase.from('user_subscriptions').select('user_id, email, subscription_tier, subscription_status'),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', daysAgo(1)),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', daysAgo(7)),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', daysAgo(30)),
    supabase.from('page_views').select('visitor_id').gte('created_at', daysAgo(1)),
    supabase.from('page_views').select('visitor_id').gte('created_at', daysAgo(7)),
    supabase.from('page_views').select('visitor_id').gte('created_at', daysAgo(30)),
    supabase.from('page_views').select('path').gte('created_at', daysAgo(30)).limit(5000),
  ])

  // Build sub-tier map keyed by both auth id and email so every auth user gets a tier.
  const subByAuthId: Record<string, any> = {}
  const subByEmail:  Record<string, any> = {}
  for (const s of subsRes.data || []) {
    if (s.user_id) subByAuthId[String(s.user_id)] = s
    if (s.email)   subByEmail[String(s.email).toLowerCase()] = s
  }

  // Every auth user gets bucketed by tier (default = free if no subscription row).
  const tiers = { free: 0, basic: 0, premium: 0, other: 0 }
  let activeSubs = 0
  let canceledSubs = 0
  for (const au of authUsers) {
    const email = String(au.email || '').toLowerCase()
    const sub = subByAuthId[String(au.id)] || subByEmail[email] || null
    const tier = String(sub?.subscription_tier || 'free').toLowerCase()
    if (tier in tiers) tiers[tier as keyof typeof tiers]++
    else tiers.other++
    const status = String(sub?.subscription_status || '').toLowerCase()
    if (status === 'active' || status === 'trialing') activeSubs++
    if (status === 'canceled' || status === 'cancelled') canceledSubs++
  }

  const uniq = (rows: any[] | null | undefined) => {
    const set = new Set<string>()
    for (const r of rows || []) if (r.visitor_id) set.add(r.visitor_id)
    return set.size
  }

  const pathCounts: Record<string, number> = {}
  for (const r of topPathsRes.data || []) {
    const p = r.path || '/'
    pathCounts[p] = (pathCounts[p] || 0) + 1
  }
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({ path, count }))

  return {
    users: {
      total: authUsers.length,
      banned: bannedUsersRes.count || 0,
      free: tiers.free,
      basic: tiers.basic,
      premium: tiers.premium,
      active_subscribers: activeSubs,
      canceled_subscribers: canceledSubs,
    },
    traffic: {
      views_24h: pv24Res.count || 0,
      views_7d: pv7Res.count || 0,
      views_30d: pv30Res.count || 0,
      visitors_24h: uniq(uniq24Res.data),
      visitors_7d: uniq(uniq7Res.data),
      visitors_30d: uniq(uniq30Res.data),
      top_paths: topPaths,
    },
  }
}

// ── Delete a user account ──────────────────────────────────────────────────────
async function doDeleteUser(supabase: any, userId: string, adminUserId: string) {
  if (!userId) throw new Error('user_id required')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('auth_user_id')
    .eq('user_id', userId)
    .maybeSingle()

  const authUserId = String(profile?.auth_user_id || userId)
  const { error } = await supabase.auth.admin.deleteUser(authUserId)
  if (error) throw new Error('doDeleteUser: ' + error.message)
  await logAdminAction(supabase, adminUserId, 'delete_user', userId, { auth_user_id: authUserId })
  return { deleted: true, deleted_user_id: userId }
}

// ── Logflare usage attribution ────────────────────────────────────────────────
// Queries Supabase Management API (Logflare) to attribute Edge Function
// invocations to users. Requires env: SUPABASE_MGMT_TOKEN, SUPABASE_PROJECT_REF.
// Falls back to a "not configured" response when token is missing.
async function getUsage(supabase: any, payload: any) {
  // NOTE: Supabase CLI reserves the `SUPABASE_` prefix for its own secrets.
  // Custom secrets must use a different prefix, hence MGMT_API_TOKEN / PROJECT_REF.
  const token = Deno.env.get('MGMT_API_TOKEN') || ''
  const projectRef = Deno.env.get('PROJECT_REF') || ''
  const windowHours = mapWindowHours(String(payload?.window || '24h'))

  if (!token || !projectRef) {
    return {
      configured: false,
      message: 'Set MGMT_API_TOKEN and PROJECT_REF as Edge Function secrets to enable Logflare usage queries.',
      window: payload?.window || '24h',
      top_users: [],
      per_function: [],
      realtime: [],
    }
  }

  // ── Query function-edge-logs for PC_USAGE lines ────────────────────────────
  // event_message contains 'PC_USAGE {json}' — extract via SQL.
  const fnSql = `
    SELECT event_message, timestamp
    FROM function_edge_logs
    WHERE REGEXP_CONTAINS(event_message, r'^PC_USAGE ')
      AND timestamp > timestamp_sub(current_timestamp(), interval ${windowHours} hour)
    ORDER BY timestamp DESC
    LIMIT 5000
  `

  // Serialize the two Logflare calls with a small gap. The Management API has
  // a low rate limit; firing both in parallel triggered 429s.
  let fnRows: any[] = []
  let fnError: string | null = null
  try {
    fnRows = await queryLogflare(token, projectRef, 'functions', fnSql)
  } catch (err) {
    fnError = err instanceof Error ? err.message : String(err)
  }
  await new Promise((r) => setTimeout(r, 1500))

  // Aggregate: user_id → { count, by_function: { fn: count } }
  const byUser: Record<string, { count: number; actions: Record<string, number>; functions: Record<string, number> }> = {}
  for (const row of fnRows) {
    const msg: string = String(row.event_message || '')
    const jsonStart = msg.indexOf('{')
    if (jsonStart < 0) continue
    try {
      const parsed = JSON.parse(msg.slice(jsonStart))
      const uid = parsed?.user_id ? String(parsed.user_id) : 'anonymous'
      const fn  = String(parsed?.fn || 'unknown')
      const act = String(parsed?.action || 'unknown')
      if (!byUser[uid]) byUser[uid] = { count: 0, actions: {}, functions: {} }
      byUser[uid].count++
      byUser[uid].actions[act]  = (byUser[uid].actions[act]  || 0) + 1
      byUser[uid].functions[fn] = (byUser[uid].functions[fn] || 0) + 1
    } catch {
      /* skip malformed */
    }
  }

  // Enrich with email from auth.users
  const authIds = Object.keys(byUser).filter((id) => id !== 'anonymous')
  const emailMap: Record<string, string> = {}
  if (authIds.length) {
    const pageUsers = await listAllAuthUsers(supabase)
    for (const u of pageUsers) emailMap[String(u.id)] = u.email || ''
  }

  const topUsers = Object.entries(byUser)
    .map(([uid, data]) => ({
      user_id: uid,
      email:   emailMap[uid] || (uid === 'anonymous' ? '(unauthenticated)' : '(unknown)'),
      total:   data.count,
      top_action:   topEntry(data.actions),
      top_function: topEntry(data.functions),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  // ── Query realtime-logs for per-user connection counts ─────────────────────
  const rtSql = `
    SELECT timestamp, event_message, metadata
    FROM realtime_logs
    WHERE timestamp > timestamp_sub(current_timestamp(), interval ${windowHours} hour)
    ORDER BY timestamp DESC
    LIMIT 2000
  `

  let rtRows: any[] = []
  let rtError: string | null = null
  try {
    rtRows = await queryLogflare(token, projectRef, 'realtime', rtSql)
  } catch (err) {
    rtError = err instanceof Error ? err.message : String(err)
  }

  // Realtime rows are less structured — best-effort: count events grouped by a user-id field when present.
  const rtByUser: Record<string, number> = {}
  for (const row of rtRows) {
    const blob = JSON.stringify(row)
    const match = blob.match(/"user_id"\s*:\s*"([^"]+)"/) || blob.match(/"sub"\s*:\s*"([^"]+)"/)
    const uid = match ? match[1] : 'anonymous'
    rtByUser[uid] = (rtByUser[uid] || 0) + 1
  }

  const realtime = Object.entries(rtByUser)
    .map(([uid, count]) => ({
      user_id: uid,
      email:   emailMap[uid] || (uid === 'anonymous' ? '(unauthenticated)' : '(unknown)'),
      events:  count,
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 20)

  return {
    configured: true,
    window: payload?.window || '24h',
    sample_size: fnRows.length,
    realtime_sample_size: rtRows.length,
    top_users:   topUsers,
    realtime,
    errors: {
      function_logs: fnError,
      realtime_logs: rtError,
    },
  }
}

function mapWindowHours(w: string): number {
  if (w === '1h')  return 1
  if (w === '7d')  return 24 * 7
  if (w === '30d') return 24 * 30
  return 24
}

function topEntry(map: Record<string, number>): { name: string; count: number } {
  let best = { name: '—', count: 0 }
  for (const [k, v] of Object.entries(map)) {
    if (v > best.count) best = { name: k, count: v }
  }
  return best
}

// In-memory cache for Logflare responses. Management API is heavily throttled,
// so we share responses across admin page loads within a short TTL.
const LOGFLARE_CACHE = new Map<string, { at: number; rows: any[] }>()
const LOGFLARE_TTL_MS = 60_000

async function queryLogflare(
  token: string,
  projectRef: string,
  kind: 'functions' | 'realtime',
  sql: string
): Promise<any[]> {
  const cacheKey = kind + '|' + sql
  const cached = LOGFLARE_CACHE.get(cacheKey)
  if (cached && (Date.now() - cached.at) < LOGFLARE_TTL_MS) {
    return cached.rows
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`

  // Retry once on 429 after a short backoff.
  let res = await fetch(url, {
    method:  'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2500))
    res = await fetch(url, {
      method:  'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
  }

  if (!res.ok) {
    if (res.status === 429 && cached) return cached.rows
    const text = await res.text().catch(() => '')
    throw new Error(`Logflare ${kind} ${res.status}: ${text.slice(0, 200)}`)
  }

  const body = await res.json().catch(() => ({}))
  const rows = body?.result || []
  LOGFLARE_CACHE.set(cacheKey, { at: Date.now(), rows })
  return rows
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 3: Quarantine management
// ────────────────────────────────────────────────────────────────────────────

async function listQuarantine(supabase: any) {
  // Pull the last 90 days of quarantine events; the admin UI paginates visually.
  const { data: events, error } = await supabase
    .from('quarantine_events')
    .select('id,user_id,table_name,row_count,window_minutes,reason,created_at,restored_at,purged_at')
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(`list_quarantine: ${error.message}`)

  // Enrich with the user's email (best effort — ignore failures).
  const userIds = Array.from(new Set((events || []).map((e: any) => e.user_id).filter(Boolean)))
  const emailMap = new Map<string, string>()
  if (userIds.length) {
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const u of users || []) if (userIds.includes(u.id)) emailMap.set(u.id, u.email || '')
    } catch (_) { /* best effort */ }
  }

  return (events || []).map((e: any) => ({
    ...e,
    email: emailMap.get(e.user_id) || null,
    status: e.purged_at ? 'purged' : e.restored_at ? 'restored' : 'quarantined',
  }))
}

async function restoreQuarantine(supabase: any, userId: string, adminUserId: string) {
  if (!userId) throw new Error('user_id required')
  const { data, error } = await supabase.rpc('pc_restore_quarantined_user', { target_user: userId })
  if (error) throw new Error(`restore_quarantine: ${error.message}`)
  await logAdminAction(supabase, adminUserId, 'restore_quarantine', userId, { restored: data ?? 0 })
  return { restored: data ?? 0, user_id: userId }
}

async function confirmDeleteQuarantine(supabase: any, userId: string, adminUserId: string) {
  if (!userId) throw new Error('user_id required')
  const { data, error } = await supabase.rpc('pc_confirm_delete_quarantined_user', { target_user: userId })
  if (error) throw new Error(`confirm_delete_quarantine: ${error.message}`)
  await logAdminAction(supabase, adminUserId, 'confirm_delete_quarantine', userId, { deleted: data ?? 0 })
  return { deleted: data ?? 0, user_id: userId }
}

const REFACTOR_TICKET_LIST_COLUMNS = [
  'id', 'user_id', 'status', 'level', 'outcome', 'created_at', 'reviewed_at', 'reviewed_by',
].join(',')

async function listRefactorTickets(supabase: any, payload: any) {
  const status = payload?.status ? String(payload.status) : ''
  let query = supabase
    .from('refactor_tickets')
    .select(REFACTOR_TICKET_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && ['open', 'reviewed', 'resolved'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw new Error(`list_refactor_tickets: ${error.message}`)

  const userIds = Array.from(new Set((data || []).map((t: any) => t.user_id).filter(Boolean)))
  const emailByUser: Record<string, string> = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, auth_user_id')
      .in('user_id', userIds)

    const authIds = (profiles || []).map((p: any) => p.auth_user_id).filter(Boolean)
    if (authIds.length) {
      try {
        const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const authEmail: Record<string, string> = {}
        for (const u of users || []) authEmail[String(u.id)] = u.email || ''
        for (const p of profiles || []) {
          if (p.auth_user_id) emailByUser[p.user_id] = authEmail[String(p.auth_user_id)] || ''
        }
      } catch (_) { /* best effort */ }
    }
  }

  return (data || []).map((t: any) => ({
    ...t,
    email: emailByUser[t.user_id] || null,
  }))
}

async function getRefactorTicket(supabase: any, ticketId: string, adminUserId: string) {
  if (!ticketId) throw new Error('ticket_id required')
  const { data, error } = await supabase
    .from('refactor_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle()
  if (error) throw new Error(`get_refactor_ticket: ${error.message}`)
  if (!data) throw new Error('Ticket not found')
  await logAdminAction(supabase, adminUserId, 'get_refactor_ticket', data.user_id || null, { ticket_id: ticketId })
  return data
}

async function resolveRefactorTicket(supabase: any, ticketId: string, adminUserId: string) {
  if (!ticketId) throw new Error('ticket_id required')
  const { data, error } = await supabase
    .from('refactor_tickets')
    .update({
      status: 'resolved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', ticketId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`resolve_refactor_ticket: ${error.message}`)
  if (!data) throw new Error('Ticket not found')
  return data
}
