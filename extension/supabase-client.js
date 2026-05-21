// Backward-compat barrel — global singleton for popup.html script order
import { pasteCraftSupabase, PasteCraftSupabase } from './supabase/index.js';

globalThis.pasteCraftSupabase = pasteCraftSupabase;
globalThis.PasteCraftSupabase = PasteCraftSupabase;

export { pasteCraftSupabase, PasteCraftSupabase };
