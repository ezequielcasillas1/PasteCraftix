// Backward-compat: optional early load via dynamic import (popup.boot is primary)
import('./supabase/index.js')
  .then(({ pasteCraftSupabase, PasteCraftSupabase }) => {
    globalThis.pasteCraftSupabase = pasteCraftSupabase;
    globalThis.PasteCraftSupabase = PasteCraftSupabase;
  })
  .catch((err) => console.error('[supabase-client] load failed:', err));
