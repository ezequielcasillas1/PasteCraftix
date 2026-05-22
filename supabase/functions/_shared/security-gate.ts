/**
 * Fail-closed by default. Pass { failOpen: true } for usage-beacon only.
 */
export async function requireNotBanned(
  userId: string,
  supabase: any,
  options: { failOpen?: boolean; cors?: Record<string, string> } = {},
): Promise<Response | null> {
  const failOpen = options.failOpen === true
  const CORS = options.cors || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  const blocked = (reason = 'Account suspended', extra: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({ error: reason, ...extra }),
      { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 403 },
    )

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_banned, ban_reason, ban_expires_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return failOpen ? null : blocked('Unable to verify account status')
    }

    if (!profile || !profile.is_banned) return null

    if (profile.ban_expires_at) {
      const expiresMs = Date.parse(profile.ban_expires_at)
      if (Number.isFinite(expiresMs) && Date.now() > expiresMs) {
        await supabase
          .from('user_profiles')
          .update({ is_banned: false, ban_lifted_at: new Date().toISOString() })
          .eq('user_id', userId)
        return null
      }
    }

    return blocked(profile.ban_reason ?? 'Violation of PasteCraft terms of service', {
      ban_expires_at: profile.ban_expires_at ?? null,
    })
  } catch (_) {
    return failOpen ? null : blocked('Unable to verify account status')
  }
}
