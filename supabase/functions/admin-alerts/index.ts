// admin-alerts
// Called every 10 min by pg_cron. Sends three tiers of Resend emails:
//   T1 immediate : one email per brand-new quarantine_events row
//   T2 hourly    : one digest when a user crosses the rate-violation or security-event threshold
//   T3 daily     : one rollup email at 09:00 CST (Γëê15:00 UTC) summarizing the day
//
// Dedup: every notification path stamps `notified_at` or `alert_state.last_alert_at`
// so a cron re-run never re-sends. A 60-min cooldown applies to T2.

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ΓöÇΓöÇ Config ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')   || ''
const RESEND_FROM      = Deno.env.get('RESEND_FROM')      || 'PasteCraft Alerts <alerts@pastecraft.com>'
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')     || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET      = Deno.env.get('ADMIN_ALERTS_CRON_SECRET') || ''

// Tier-2 thresholds (in the last 60 minutes, same user)
const T2_RATE_VIOLATION_THRESHOLD = 5
const T2_SECURITY_EVENT_THRESHOLD = 3
const T2_COOLDOWN_MINUTES         = 60

// Tier-3 daily summary send-window. 09:00 CST Γëê 15:00 UTC (standard time).
// Non-DST by design ΓÇö we check HOUR >= 15 AND HOUR < 16 to fire once per day.
const T3_DAILY_UTC_HOUR = 15

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ΓöÇΓöÇ Handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const cronOk = token && (
    (CRON_SECRET && token === CRON_SECRET) ||
    (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY)
  )
  if (!cronOk) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  try {
    if (!RESEND_API_KEY) return json({ ok: false, error: 'RESEND_API_KEY not set' }, 500)
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: 'SUPABASE env missing' }, 500)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const recipients = await loadRecipients(supabase)
    if (recipients.length === 0) return json({ ok: true, message: 'No enabled recipients' })

    const t1 = await sendTier1Quarantine(supabase, recipients)
    const t2 = await sendTier2Digests(supabase, recipients)
    const t3 = await maybeSendTier3DailySummary(supabase, recipients)

    return json({ ok: true, tier1: t1, tier2: t2, tier3: t3 })
  } catch (err) {
    console.error('[admin-alerts]', err)
    return json({ ok: false, error: String((err as any)?.message ?? err) }, 500)
  }
})

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Tier 1 ΓÇö Immediate: brand-new quarantine events
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function sendTier1Quarantine(supabase: any, recipients: string[]) {
  const { data: events, error } = await supabase
    .from('quarantine_events')
    .select('id,user_id,table_name,row_count,window_minutes,reason,created_at')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) throw new Error('T1 load: ' + error.message)
  if (!events || events.length === 0) return { sent: 0 }

  const emails = await emailMapForUsers(supabase, events.map((e: any) => e.user_id))

  let sent = 0
  for (const ev of events) {
    const email = emails.get(ev.user_id) || ev.user_id
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px">
        <h2 style="margin:0 0 8px;color:#b91c1c">Quarantine triggered</h2>
        <p style="color:#444;margin:0 0 16px">A user exceeded the burst-flood threshold and their rows were auto-quarantined.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">User</td><td><b>${esc(email)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Table</td><td>${esc(ev.table_name)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Rows</td><td>${ev.row_count}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Window</td><td>${ev.window_minutes} min</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Reason</td><td>${esc(ev.reason)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">When</td><td>${fmt(ev.created_at)}</td></tr>
        </table>
        <p style="margin:16px 0 0;color:#444">Rows remain recoverable for 48 h. Review in the admin Quarantine tab.</p>
      </div>`
    const ok = await resendSend({
      to:      recipients,
      subject: `[PasteCraft] Quarantine ΓÇö ${email} / ${ev.table_name} (${ev.row_count} rows)`,
      html,
    })
    if (ok) {
      await supabase.from('quarantine_events').update({ notified_at: new Date().toISOString() }).eq('id', ev.id)
      sent++
    }
  }
  return { sent, total: events.length }
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Tier 2 ΓÇö Hourly digest: threshold-crossed rate violations + security events
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function sendTier2Digests(supabase: any, recipients: string[]) {
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  let sent = 0

  // Rate violations grouped by user.
  const { data: rvRows } = await supabase
    .from('rate_limit_violations')
    .select('user_id,table_name,attempted_at,daily_count,limit_value')
    .gte('attempted_at', sinceIso)
    .limit(2000)

  const rvByUser = groupBy<any>((rvRows || []) as any[], (r) => r.user_id)
  for (const [userId, rows] of rvByUser) {
    if (rows.length < T2_RATE_VIOLATION_THRESHOLD) continue
    if (await inCooldown(supabase, userId, 'rate_violation')) continue
    const email = (await emailMapForUsers(supabase, [userId])).get(userId) || userId
    const html = buildDigestHtml('Rate-limit digest', email, rows.map((r: any) =>
      `${fmt(r.attempted_at)} ΓÇö <code>${esc(r.table_name)}</code> ┬╖ ${r.daily_count}/${r.limit_value}`))
    const ok = await resendSend({
      to: recipients,
      subject: `[PasteCraft] ${rows.length} rate violations ΓÇö ${email} (last 1h)`,
      html,
    })
    if (ok) { await stampCooldown(supabase, userId, 'rate_violation', rows.length); sent++ }
  }

  // Security events grouped by user.
  const { data: seRows } = await supabase
    .from('security_events')
    .select('user_id,event_type,severity,triggered_at,details')
    .gte('triggered_at', sinceIso)
    .eq('resolved', false)
    .limit(2000)

  const seByUser = groupBy<any>((seRows || []) as any[], (r) => r.user_id)
  for (const [userId, rows] of seByUser) {
    if (rows.length < T2_SECURITY_EVENT_THRESHOLD) continue
    if (await inCooldown(supabase, userId, 'security_event')) continue
    const email = (await emailMapForUsers(supabase, [userId])).get(userId) || userId
    const html = buildDigestHtml('Security events digest', email, rows.map((r: any) =>
      `${fmt(r.triggered_at)} ΓÇö <b>${esc(r.event_type)}</b> (${esc(r.severity || 'ΓÇö')})`))
    const ok = await resendSend({
      to: recipients,
      subject: `[PasteCraft] ${rows.length} security events ΓÇö ${email} (last 1h)`,
      html,
    })
    if (ok) { await stampCooldown(supabase, userId, 'security_event', rows.length); sent++ }
  }

  return { sent }
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Tier 3 ΓÇö Daily summary at 09:00 CST (~15:00 UTC)
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function maybeSendTier3DailySummary(supabase: any, recipients: string[]) {
  const now = new Date()
  if (now.getUTCHours() !== T3_DAILY_UTC_HOUR) return { sent: 0, reason: 'out-of-window' }

  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const { data: already } = await supabase
    .from('daily_summary_state').select('summary_date').eq('summary_date', today).maybeSingle()
  if (already) return { sent: 0, reason: 'already-sent-today' }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Pull counts in parallel.
  const [qCount, rCount, sCount, newUsers] = await Promise.all([
    countSince(supabase, 'quarantine_events',    'created_at',   since24h),
    countSince(supabase, 'rate_limit_violations', 'attempted_at', since24h),
    countSince(supabase, 'security_events',      'triggered_at', since24h),
    countSinceAuth(supabase, since24h),
  ])

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 8px">PasteCraft daily summary</h2>
      <p style="color:#666;margin:0 0 16px">Last 24 hours ┬╖ generated ${fmt(now.toISOString())}</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 16px 4px 0;color:#666">New signups</td><td><b>${newUsers}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Quarantine events</td><td><b>${qCount}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Rate violations</td><td><b>${rCount}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Security events</td><td><b>${sCount}</b></td></tr>
      </table>
      <p style="margin:16px 0 0;color:#444">Open the admin dashboard for details.</p>
    </div>`
  const ok = await resendSend({
    to: recipients,
    subject: `[PasteCraft] Daily summary ΓÇö ${today}`,
    html,
  })
  if (ok) {
    await supabase.from('daily_summary_state').insert({ summary_date: today })
    return { sent: 1 }
  }
  return { sent: 0, reason: 'resend-failed' }
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Helpers
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function loadRecipients(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('alert_recipients').select('email').eq('enabled', true)
  return (data || []).map((r: any) => r.email).filter(Boolean)
}

async function emailMapForUsers(supabase: any, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return map
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of users || []) if (ids.includes(u.id)) map.set(u.id, u.email || '')
  } catch (_) { /* best effort */ }
  return map
}

async function inCooldown(supabase: any, userId: string, eventType: string): Promise<boolean> {
  const { data } = await supabase
    .from('alert_state').select('last_alert_at')
    .eq('user_id', userId).eq('event_type', eventType).maybeSingle()
  if (!data?.last_alert_at) return false
  return (Date.now() - new Date(data.last_alert_at).getTime()) < T2_COOLDOWN_MINUTES * 60 * 1000
}

async function stampCooldown(supabase: any, userId: string, eventType: string, count: number) {
  await supabase.from('alert_state').upsert({
    user_id:       userId,
    event_type:    eventType,
    last_alert_at: new Date().toISOString(),
    count_since:   count,
  }, { onConflict: 'user_id,event_type' })
}

async function countSince(supabase: any, table: string, col: string, iso: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte(col, iso)
  return count || 0
}

async function countSinceAuth(supabase: any, iso: string): Promise<number> {
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const thresh = new Date(iso).getTime()
    return (users || []).filter((u: any) => new Date(u.created_at).getTime() >= thresh).length
  } catch (_) { return 0 }
}

async function resendSend({ to, subject, html }: { to: string[]; subject: string; html: string }): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[resend]', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[resend] fetch failed', err)
    return false
  }
}

function buildDigestHtml(title: string, subject: string, lines: string[]) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 8px">${esc(title)}</h2>
      <p style="color:#666;margin:0 0 16px">User: <b>${esc(subject)}</b></p>
      <ul style="padding-left:18px;color:#333;font-size:14px">
        ${lines.slice(0, 20).map((l) => `<li style="margin:4px 0">${l}</li>`).join('')}
      </ul>
      ${lines.length > 20 ? `<p style="color:#888;font-size:12px">ΓÇªand ${lines.length - 20} more</p>` : ''}
      <p style="margin:16px 0 0;color:#444">Open the admin dashboard to review.</p>
    </div>`
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const item of arr) {
    const k = keyFn(item)
    if (!k) continue
    const list = m.get(k)
    if (list) list.push(item); else m.set(k, [item])
  }
  return m
}

function fmt(iso: string) {
  try { return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' }
  catch (_) { return String(iso) }
}

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status,
  })
}
