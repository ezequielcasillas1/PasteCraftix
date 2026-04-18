// usage-beacon
// Accepts lightweight usage events from any authenticated user (website/extension)
// and emits a PC_USAGE log line. Admin Usage tab aggregates these via Logflare.
//
// Expected body: { event: string, meta?: object }
// Allowed events (strict allow-list to prevent log spam):
//   profile_view, profile_update, account_page_open,
//   subscription_view, upgrade_click, clip_export, clip_import

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logUsage } from '../_shared/usage-log.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_EVENTS = new Set([
  'profile_view',
  'profile_update',
  'account_page_open',
  'subscription_view',
  'upgrade_click',
  'clip_export',
  'clip_import',
  'settings_change',
])

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return respond({ ok: false, error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!url || !serviceRoleKey) return respond({ ok: false, error: 'Server env not configured' }, 500)

    const supabase = createClient(url, serviceRoleKey)

    // Auth is OPTIONAL here — anonymous account-page views should also count.
    // When present, we attribute the event to the user.
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) userId = user.id
    }

    const body = await req.json().catch(() => ({}))
    const event = String(body?.event || '').toLowerCase().slice(0, 32)
    const meta  = (body?.meta && typeof body.meta === 'object') ? body.meta : {}

    if (!ALLOWED_EVENTS.has(event)) {
      return respond({ ok: false, error: `Event not allowed: ${event}` }, 400)
    }

    // Trim meta to 5 keys, stringify small values only.
    const trimmedMeta: Record<string, unknown> = {}
    let i = 0
    for (const [k, v] of Object.entries(meta)) {
      if (i >= 5) break
      const s = typeof v === 'string' ? v.slice(0, 100) : v
      trimmedMeta[String(k).slice(0, 32)] = s as unknown
      i++
    }

    logUsage('usage-beacon', event, userId, trimmedMeta)

    return respond({ ok: true })
  } catch (err) {
    console.error('[usage-beacon]', err)
    return respond({ ok: false, error: String((err as any)?.message ?? err) }, 500)
  }
})
