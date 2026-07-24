/**
 * Thin facade / early-load shim for PasteCraftSupabase.
 * Primary load path: popup/features/app/popup.boot.js → supabase/index.js
 * Keeps globalThis.pasteCraftSupabase for legacy non-module callers.
 */
import('./supabase/index.js')
  .then(({ pasteCraftSupabase, PasteCraftSupabase }) => {
    globalThis.pasteCraftSupabase = pasteCraftSupabase;
    globalThis.PasteCraftSupabase = PasteCraftSupabase;
  })
  .catch((err) => console.error('[supabase-client] load failed:', err));
