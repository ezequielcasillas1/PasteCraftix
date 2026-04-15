import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) {
      return respond({ ok: false, error: 'Server env not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Auth: extract + verify Bearer token
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return respond({ ok: false, error: 'Unauthorized' }, 401)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return respond({ ok: false, error: 'Unauthorized' }, 401)

    // Admin gate: user must be in admin_users table
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminRow) return respond({ ok: false, error: 'Forbidden: not an admin' }, 403)

    const body = await req.json().catch(() => ({}))
    const { action, payload = {} } = body

    switch (action) {
      case 'list_users':      return respond({ ok: true, data: await listUsers(supabase) })
      case 'list_events':     return respond({ ok: true, data: await listEvents(supabase, payload) })
      case 'list_violations': return respond({ ok: true, data: await listViolations(supabase) })
      case 'get_user':        return respond({ ok: true, data: await getUserDetail(supabase, payload.user_id) })
      case 'ban_user':        return respond({ ok: true, data: await doBanUser(supabase, payload, user.id) })
      case 'unban_user':      return respond({ ok: true, data: await doUnbanUser(supabase, payload.user_id) })
      case 'adjust_limit':    return respond({ ok: true, data: await doAdjustLimit(supabase, payload) })
      case 'resolve_event':   return respond({ ok: true, data: await doResolveEvent(supabase, payload.event_id, user.id) })
      case 'delete_user':     return respond({ ok: true, data: await doDeleteUser(supabase, payload.user_id) })
      default: return respond({ ok: false, error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('[admin-api]', err)
    return respond({ ok: false, error: String(err?.message ?? err) }, 500)
  }
})

// ── List all users ─────────────────────────────────────────────────────────────
async function listUsers(supabase: any) {
  const { data: profiles, error: pErr } = await supabase
    .from('user_profiles')
    .select('user_id, user_name, is_banned, ban_reason, banned_at, ban_expires_at, warning_count, daily_clip_limit, created_at')
    .order('created_at', { ascending: false })
  if (pErr) throw new Error('listUsers profiles: ' + pErr.message)

  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, email, subscription_tier, subscription_status')

  const { data: clips } = await supabase
    .from('clips')
    .select('user_id')
    .is('deleted_at', null)

  // Build lookup maps
  const subMap: Record<string, any> = {}
  for (const s of subs || []) subMap[String(s.user_id)] = s

  const clipCounts: Record<string, number> = {}
  for (const c of clips || []) clipCounts[c.user_id] = (clipCounts[c.user_id] || 0) + 1

  return (profiles || []).map((p: any) => {
    const s = subMap[p.user_id] || {}
    return {
      ...p,
      email: s.email || '—',
      subscription_tier: s.subscription_tier || 'free',
      subscription_status: s.subscription_status || 'active',
      stripe_customer_id: s.stripe_customer_id || null,
      clip_count: clipCounts[p.user_id] || 0,
    }
  })
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

  return { banned: true }
}

// ── Unban a user ───────────────────────────────────────────────────────────────
async function doUnbanUser(supabase: any, userId: string) {
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
  return { unbanned: true }
}

// ── Adjust daily clip limit ────────────────────────────────────────────────────
async function doAdjustLimit(supabase: any, payload: any) {
  const { user_id, daily_clip_limit } = payload
  if (!user_id || daily_clip_limit === undefined) throw new Error('user_id and daily_clip_limit required')
  const limit = Number(daily_clip_limit)
  if (!Number.isFinite(limit) || limit < 1 || limit > 99999) throw new Error('Limit must be between 1 and 99999')
  const { error } = await supabase
    .from('user_profiles')
    .update({ daily_clip_limit: limit })
    .eq('user_id', user_id)
  if (error) throw new Error('doAdjustLimit: ' + error.message)
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

// ── Delete a user account ──────────────────────────────────────────────────────
async function doDeleteUser(supabase: any, userId: string) {
  if (!userId) throw new Error('user_id required')

  // Fetch auth_user_id (UUID) from profile — used for auth.admin.deleteUser
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('auth_user_id')
    .eq('user_id', userId)
    .maybeSingle()

  const authUserId = String(profile?.auth_user_id || userId)
  const { error } = await supabase.auth.admin.deleteUser(authUserId)
  if (error) throw new Error('doDeleteUser: ' + error.message)
  return { deleted: true, deleted_user_id: userId }
}
