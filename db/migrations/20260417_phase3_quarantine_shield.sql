-- Migration: Phase 3 — Quarantine shield (defense layer 3)
-- Date: 2026-04-17
-- Feature: Anti-spam shield — soft-delete + auto-purge for burst floods
--          that slipped past layers 1 (injection filter) and 2 (burst rate limit).
--
-- HOW IT WORKS
--   1. Every 5 min, `pc_detect_bursts()` scans the last 10-min window per user.
--      Any user whose inserts crossed 10x their per_minute cap gets:
--        - All those rows marked with `quarantined_at = NOW()` (not hard-deleted).
--        - `user_profiles.quarantine_paused_until = NOW() + 1 hour` (extension blocked).
--        - A row in `quarantine_events` so the admin UI can surface it.
--   2. RLS hides `quarantined_at IS NOT NULL` rows from users; admins can still see them.
--   3. Daily `pc_purge_quarantine()` hard-deletes rows older than 48h in quarantine.
--   4. Admin can `SELECT pc_restore_quarantined_user(user_id)` to undo a false positive.

-- =====================================================
-- Soft-delete columns on protected tables
-- =====================================================
ALTER TABLE public.clips      ADD COLUMN IF NOT EXISTS quarantined_at    TIMESTAMPTZ;
ALTER TABLE public.clips      ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.notes      ADD COLUMN IF NOT EXISTS quarantined_at    TIMESTAMPTZ;
ALTER TABLE public.notes      ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS quarantined_at    TIMESTAMPTZ;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.ai_history ADD COLUMN IF NOT EXISTS quarantined_at    TIMESTAMPTZ;
ALTER TABLE public.ai_history ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_clips_quarantined      ON public.clips      (quarantined_at) WHERE quarantined_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_quarantined      ON public.notes      (quarantined_at) WHERE quarantined_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_quarantined ON public.categories (quarantined_at) WHERE quarantined_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_history_quarantined ON public.ai_history (quarantined_at) WHERE quarantined_at IS NOT NULL;

-- Per-user auto-pause flag on user_profiles (extension honors this via a view below).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS quarantine_paused_until TIMESTAMPTZ;

-- =====================================================
-- quarantine_events — audit trail for every quarantine action
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quarantine_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  row_count    INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at  TIMESTAMPTZ,
  purged_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quarantine_events_created ON public.quarantine_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quarantine_events_user    ON public.quarantine_events (user_id);

ALTER TABLE public.quarantine_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quarantine_events admin only" ON public.quarantine_events;
CREATE POLICY "quarantine_events admin only"
  ON public.quarantine_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- =====================================================
-- Burst detector — run every 5 minutes via pg_cron
-- =====================================================
-- Rule: if a user inserted more than 10x the per_minute cap within the last 10 minutes
-- on a protected table, quarantine every one of those rows and pause the user for 1h.

CREATE OR REPLACE FUNCTION public.pc_detect_bursts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg       public.rate_limit_config%ROWTYPE;
  burst_tbl TEXT;
  threshold INTEGER;
  r         RECORD;
  total     INTEGER := 0;
  affected  INTEGER;
BEGIN
  FOR cfg IN SELECT * FROM public.rate_limit_config WHERE enabled LOOP
    burst_tbl := cfg.table_name;
    threshold := GREATEST(cfg.per_minute * 10, 100);

    -- Find offending users in the last 10-minute window on this table.
    FOR r IN
      EXECUTE format($q$
        SELECT user_id, COUNT(*) AS row_count
        FROM public.%I
        WHERE created_at >= NOW() - INTERVAL '10 minutes'
          AND quarantined_at IS NULL
        GROUP BY user_id
        HAVING COUNT(*) > $1
      $q$, burst_tbl)
      USING threshold
    LOOP
      -- Quarantine those rows.
      EXECUTE format($q$
        UPDATE public.%I
          SET quarantined_at = NOW(),
              quarantine_reason = $1
          WHERE user_id = $2
            AND created_at >= NOW() - INTERVAL '10 minutes'
            AND quarantined_at IS NULL
      $q$, burst_tbl)
      USING ('burst:' || burst_tbl || ':' || r.row_count || '/10min'), r.user_id;

      GET DIAGNOSTICS affected = ROW_COUNT;
      total := total + affected;

      -- Pause this user's inserts for 1 hour.
      UPDATE public.user_profiles
        SET quarantine_paused_until = GREATEST(
          COALESCE(quarantine_paused_until, NOW()),
          NOW() + INTERVAL '1 hour'
        )
        WHERE user_id = r.user_id;

      -- Audit.
      INSERT INTO public.quarantine_events (user_id, table_name, row_count, window_minutes, reason)
      VALUES (r.user_id, burst_tbl, affected, 10,
              'Auto: ' || r.row_count || ' inserts in 10min on ' || burst_tbl);
    END LOOP;
  END LOOP;

  RETURN total;
END;
$$;

-- =====================================================
-- Auto-purge — hard-delete rows quarantined >48h ago
-- =====================================================
CREATE OR REPLACE FUNCTION public.pc_purge_quarantine()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg   public.rate_limit_config%ROWTYPE;
  cnt   INTEGER;
  total INTEGER := 0;
BEGIN
  FOR cfg IN SELECT * FROM public.rate_limit_config LOOP
    EXECUTE format($q$
      DELETE FROM public.%I WHERE quarantined_at IS NOT NULL AND quarantined_at < NOW() - INTERVAL '48 hours'
    $q$, cfg.table_name);
    GET DIAGNOSTICS cnt = ROW_COUNT;
    total := total + cnt;
  END LOOP;

  UPDATE public.quarantine_events
    SET purged_at = NOW()
    WHERE purged_at IS NULL
      AND restored_at IS NULL
      AND created_at < NOW() - INTERVAL '48 hours';

  RETURN total;
END;
$$;

-- =====================================================
-- Admin helpers — restore or confirm-delete a user's quarantined rows
-- =====================================================
CREATE OR REPLACE FUNCTION public.pc_restore_quarantined_user(target_user TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg   public.rate_limit_config%ROWTYPE;
  cnt   INTEGER;
  total INTEGER := 0;
BEGIN
  -- Admin-only guard.
  IF NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  FOR cfg IN SELECT * FROM public.rate_limit_config LOOP
    EXECUTE format($q$
      UPDATE public.%I SET quarantined_at = NULL, quarantine_reason = NULL WHERE user_id = $1
    $q$, cfg.table_name)
    USING target_user;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    total := total + cnt;
  END LOOP;

  UPDATE public.user_profiles SET quarantine_paused_until = NULL WHERE user_id = target_user;
  UPDATE public.quarantine_events
    SET restored_at = NOW()
    WHERE user_id = target_user AND restored_at IS NULL AND purged_at IS NULL;

  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.pc_confirm_delete_quarantined_user(target_user TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg   public.rate_limit_config%ROWTYPE;
  cnt   INTEGER;
  total INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  FOR cfg IN SELECT * FROM public.rate_limit_config LOOP
    EXECUTE format($q$
      DELETE FROM public.%I WHERE user_id = $1 AND quarantined_at IS NOT NULL
    $q$, cfg.table_name)
    USING target_user;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    total := total + cnt;
  END LOOP;

  UPDATE public.quarantine_events
    SET purged_at = NOW()
    WHERE user_id = target_user AND purged_at IS NULL;

  RETURN total;
END;
$$;

-- =====================================================
-- Extension-facing auto-pause check
-- =====================================================
-- Block inserts while a user is auto-paused. Fires with the burst trigger (aaa_ prefix).
CREATE OR REPLACE FUNCTION public.pc_check_quarantine_pause()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paused_until TIMESTAMPTZ;
BEGIN
  SELECT quarantine_paused_until INTO paused_until
    FROM public.user_profiles WHERE user_id = NEW.user_id;
  IF paused_until IS NOT NULL AND paused_until > NOW() THEN
    RAISE EXCEPTION 'Account paused until % due to burst-flood protection. Contact support if this is in error.', paused_until
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aab_pc_quarantine_pause ON public.clips;
CREATE TRIGGER aab_pc_quarantine_pause
  BEFORE INSERT ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_quarantine_pause();

DROP TRIGGER IF EXISTS aab_pc_quarantine_pause ON public.notes;
CREATE TRIGGER aab_pc_quarantine_pause
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_quarantine_pause();

DROP TRIGGER IF EXISTS aab_pc_quarantine_pause ON public.categories;
CREATE TRIGGER aab_pc_quarantine_pause
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_quarantine_pause();

DROP TRIGGER IF EXISTS aab_pc_quarantine_pause ON public.ai_history;
CREATE TRIGGER aab_pc_quarantine_pause
  BEFORE INSERT ON public.ai_history
  FOR EACH ROW EXECUTE FUNCTION public.pc_check_quarantine_pause();

-- =====================================================
-- pg_cron schedule — detect every 5 min, purge daily
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove prior schedules with the same name if they exist (idempotent).
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('pc-detect-bursts', 'pc-purge-quarantine') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'pc-detect-bursts',
  '*/5 * * * *',
  $$SELECT public.pc_detect_bursts();$$
);

SELECT cron.schedule(
  'pc-purge-quarantine',
  '15 3 * * *',
  $$SELECT public.pc_purge_quarantine();$$
);

-- =====================================================
-- RLS: hide quarantined rows from their owners
-- =====================================================
-- Admin UI uses the service_role key which bypasses RLS, so admins keep full visibility.
-- Only the authenticated owner gets the filtered view.

DROP POLICY IF EXISTS "Users can view their own clips"           ON public.clips;
CREATE POLICY "Users can view their own clips"
  ON public.clips FOR SELECT
  USING (auth.uid()::text = user_id AND quarantined_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own notes"           ON public.notes;
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  USING (auth.uid()::text = user_id AND quarantined_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own categories"      ON public.categories;
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (auth.uid()::text = user_id AND quarantined_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own ai_history"      ON public.ai_history;
CREATE POLICY "Users can view their own ai_history"
  ON public.ai_history FOR SELECT
  USING (auth.uid()::text = user_id AND quarantined_at IS NULL);
