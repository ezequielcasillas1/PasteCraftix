-- Migration: Drop aggressive 500ms burst triggers that blocked legitimate sync
-- Date: 2026-04-19
-- Reason: These triggers were added directly to the DB (outside migrations) and
--         blocked any 2nd insert within 500ms for the same user, which killed
--         legitimate batch sync (e.g. upserting 172 clips at login).
--         Phase-2 `pc_check_insert_burst` (see 20260417_phase2_burst_rate_limits.sql)
--         already provides proper per-minute / per-hour caps via `rate_limit_config`
--         (clips 60/min, notes 30/min, categories 10/min, ai_history 20/min).
--         The 500ms guard is strictly worse and redundant.

DROP TRIGGER IF EXISTS enforce_clips_burst_protection      ON public.clips;
DROP TRIGGER IF EXISTS enforce_categories_burst_protection ON public.categories;
DROP TRIGGER IF EXISTS enforce_notes_burst_protection      ON public.notes;

DROP FUNCTION IF EXISTS public.check_clips_burst_protection();
DROP FUNCTION IF EXISTS public.check_categories_burst_protection();
DROP FUNCTION IF EXISTS public.check_notes_burst_protection();
