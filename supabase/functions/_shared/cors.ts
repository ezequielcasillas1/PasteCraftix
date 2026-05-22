/**
 * CORS helpers for Supabase Edge Functions.
 * admin-api: localhost only. Others: pastecraft + chrome-extension origins.
 */

const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i
const PASTECRAFT_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*pastecraft\.com$/i
const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\//

export function isLocalhostAdminOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN_RE.test(String(origin || ''))
}

export function isAllowedAppOrigin(origin: string): boolean {
  const o = String(origin || '')
  if (!o) return false
  if (PASTECRAFT_ORIGIN_RE.test(o)) return true
  if (o === 'https://auth.pastecraft.com') return true
  if (CHROME_EXT_ORIGIN_RE.test(o)) return true
  return isLocalhostAdminOrigin(o)
}

export function corsHeadersForOrigin(origin: string | null, mode: 'admin' | 'app' | 'open' = 'app'): Record<string, string> {
  const base = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (mode === 'open') {
    return { ...base, 'Access-Control-Allow-Origin': '*' }
  }

  const o = String(origin || '')
  if (mode === 'admin') {
    if (isLocalhostAdminOrigin(o)) {
      return { ...base, 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' }
    }
    return { ...base, 'Access-Control-Allow-Origin': 'null' }
  }

  if (isAllowedAppOrigin(o)) {
    return { ...base, 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' }
  }

  return { ...base, 'Access-Control-Allow-Origin': 'null' }
}

export function preflightResponse(origin: string | null, mode: 'admin' | 'app' | 'open' = 'app'): Response {
  return new Response(null, { headers: corsHeadersForOrigin(origin, mode) })
}

export function jsonWithCors(
  data: unknown,
  origin: string | null,
  mode: 'admin' | 'app' | 'open' = 'app',
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeadersForOrigin(origin, mode), 'Content-Type': 'application/json' },
  })
}
