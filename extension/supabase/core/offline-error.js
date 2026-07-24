/** Shared offline/network detection for Supabase client calls. */

export function isOfflineSupabaseError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  );
}
