-- Migration: Phase 2 — Short-window rate limits (defense layer 2)
-- Date: 2026-04-17
-- Feature: Anti-spam shield — per-minute / per-hour insert rate caps.
--
-- WHY: The existing daily limits (e.g. 700 clips/day on `clips`) still let a user
-- flood 700 rows in 30 seconds, draining egress + Realtime messages. This migration
-- adds BURST limits (per minute, per hour) that trip long before the daily cap.
--
-- Tables protected: clips, notes, categories, ai_history
-- Limits are stored in `rate_limit_config` and can be tuned at runtime without redeploy.

-- =====================================================
-- rate_limit_config — admin-tunable per-table burst caps
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  table_name  TEXT PRIMARY KEY,
  per_minute  INTEGER NOT NULL,
  per_hour    INTEGER NOT NULL,
  per_day     INTEGER,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed sane defaults (overwritable by admin UPDATE later)
INSERT INTO public.rate_limit_config (table_name, per_minute, per_hour, per_day) VALUES
  ('clips',      60, 500, 2000),
  ('notes',      30, 200, 1000),
  ('categories', 10, 50,  200),
  ('ai_history', 20, 100, 500)
ON CONFLICT (table_name) DO NOTHING;

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_config admin only" ON public.rate_limit_config;
CREATE POLICY "rate_limit_config admin only"
  ON public.rate_limit_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- =====================================================
-- Generic burst-limit trigger function
-- =====================================================
-- Counts real rows in the target table for (user_id) in the last 60s and 3600s.
-- Runs BEFORE INSERT so we block flood before the row lands.
-- Logs to rate_limit_violations when tripped.

CREATE OR REPLACE FUNCTION public.pc_check_insert_burst()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg           public.rate_limit_config%ROWTYPE;
  count_min     INTEGER;
  count_hr      INTEGER;
  tbl           TEXT := TG_TABLE_NAME;
  violation_msg TEXT;
BEGIN
  SELECT * INTO cfg FROM public.rate_limit_config WHERE table_name = tbl;
  IF NOT FOUND OR NOT cfg.enabled THEN
    RETURN NEW;
  END IF;

  -- Short windows only; the existing per-day triggers still apply.
  EXECUTE format(
    'SELECT COUNT(*) FROM public.%I WHERE user_id = $1 AND created_at >= NOW() - INTERVAL ''1 minute''',
    tbl
  ) INTO count_min USING NEW.user_id;

  IF count_min >= cfg.per_minute THEN
    INSERT INTO public.rate_limit_violations (user_id, table_name, daily_count, limit_value)
    VALUES (NEW.user_id, tbl || ':per_minute', count_min, cfg.per_minute);

    violation_msg := format(
      'Rate limit: %s %s/min exceeded (tried to insert #%s). Slow down and retry in 60s.',
      tbl, cfg.per_minute, count_min + 1
    );
    RAISE EXCEPTION '%', violation_msg USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM public.%I WHERE user_id = $1 AND created_at >= NOW() - INTERVAL ''1 hour''',
    tbl
  ) INTO count_hr USING NEW.user_id;

  IF count_hr >= cfg.per_hour THEN
    INSERT INTO public.rate_limit_violations (user_id, table_name, daily_count, limit_value)
    VALUES (NEW.user_id, tbl || ':per_hour', count_hr, cfg.per_hour);

    violation_msg := format(
      'Rate limit: %s %s/hour exceeded. Try again in ~60min.',
      tbl, cfg.per_hour
    );
    RAISE EXCEPTION '%', violation_msg USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Install trigger on each protected table
-- =====================================================
-- Notes on existing triggers:
--   * clips already has `enforce_clip_insert_limit` (daily 700). We add a burst check
--     that fires FIRST in the AAA_ alphabetical slot so per-minute is evaluated first.
--   * notes/categories/ai_history have no limits today — this is their first one.

DROP TRIGGER IF EXISTS aaa_pc_burst_limit ON public.clips;
CREATE TRIGGER aaa_pc_burst_limit
  BEFORE INSERT ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_insert_burst();

DROP TRIGGER IF EXISTS aaa_pc_burst_limit ON public.notes;
CREATE TRIGGER aaa_pc_burst_limit
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_insert_burst();

DROP TRIGGER IF EXISTS aaa_pc_burst_limit ON public.categories;
CREATE TRIGGER aaa_pc_burst_limit
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_insert_burst();

DROP TRIGGER IF EXISTS aaa_pc_burst_limit ON public.ai_history;
CREATE TRIGGER aaa_pc_burst_limit
  BEFORE INSERT ON public.ai_history
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_insert_burst();

-- Helpful index for the time-window scans the trigger performs.
CREATE INDEX IF NOT EXISTS idx_clips_user_created      ON public.clips      (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created      ON public.notes      (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_user_created ON public.categories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_history_user_created ON public.ai_history (user_id, created_at DESC);
