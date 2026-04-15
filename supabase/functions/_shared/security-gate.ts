/**
 * Security gate: checks if a user is banned before allowing any Edge Function to proceed.
 * Returns a ready-to-send Response if banned, or null if allowed.
 */
export async function requireNotBanned(
  userId: string,
  supabase: any,
): Promise<Response | null> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_banned, ban_reason, ban_expires_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) return null // fail open — don't block on DB errors

    if (!profile || !profile.is_banned) return null

    // Temp ban: check if it has expired
    if (profile.ban_expires_at) {
      const expiresMs = Date.parse(profile.ban_expires_at)
      if (Number.isFinite(expiresMs) && Date.now() > expiresMs) {
        // Lift expired ban automatically
        await supabase
          .from('user_profiles')
          .update({ is_banned: false, ban_lifted_at: new Date().toISOString() })
          .eq('user_id', userId)
        return null
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Account suspended',
        reason: profile.ban_reason ?? 'Violation of PasteCraft terms of service',
        ban_expires_at: profile.ban_expires_at ?? null,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 403 },
    )
  } catch (_) {
    return null // fail open
  }
}
