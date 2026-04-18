-- Migration: Admin email alerts (Resend)
-- Date: 2026-04-17
-- Feature: Tiered email alerts for quarantine / rate-violation / security-event activity.
--
-- Tiering (to avoid inbox fatigue):
--   Tier 1 (immediate): every quarantine event
--   Tier 2 (hourly digest): a user's 5+ rate violations OR 3+ security events in 1h
--   Tier 3 (daily summary): one rollup email at 09:00 CST (15:00 UTC)
--
-- The actual send happens in the `admin-alerts` Edge Function, which pg_cron calls
-- every 10 minutes via pg_net. That function stamps rows so we never re-notify.

-- =====================================================
-- alert_recipients — who receives the emails
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alert_recipients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.alert_recipients (email) VALUES
  ('ezekielcasillas101@gmail.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_recipients admin only" ON public.alert_recipients;
CREATE POLICY "alert_recipients admin only"
  ON public.alert_recipients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- =====================================================
-- alert_state — per-(user,event_type) cooldown so we never spam
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alert_state (
  user_id       TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  last_alert_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count_since   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_state_last ON public.alert_state (last_alert_at DESC);

ALTER TABLE public.alert_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_state admin only" ON public.alert_state;
CREATE POLICY "alert_state admin only"
  ON public.alert_state FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- =====================================================
-- daily_summary_state — records which UTC-days we've already summarized
-- =====================================================
CREATE TABLE IF NOT EXISTS public.daily_summary_state (
  summary_date DATE PRIMARY KEY,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_summary_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_summary_state admin only" ON public.daily_summary_state;
CREATE POLICY "daily_summary_state admin only"
  ON public.daily_summary_state FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- =====================================================
-- Add notified_at columns where missing (dedup Tier 1 & 2)
-- =====================================================
-- These three tables live in other migrations (phase2, phase3, or are pre-existing).
-- We guard each ALTER so this migration can run before or after the others.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'quarantine_events') THEN
    EXECUTE 'ALTER TABLE public.quarantine_events ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'rate_limit_violations') THEN
    EXECUTE 'ALTER TABLE public.rate_limit_violations ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'security_events') THEN
    EXECUTE 'ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ';
  END IF;
END $$;

-- =====================================================
-- pg_cron: invoke the admin-alerts Edge Function every 10 min
-- =====================================================
-- This uses pg_net (Supabase-managed). Secrets are read from a settings row so we
-- don't hardcode them in the scheduled command.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Single-row settings table the cron job reads on each tick.
CREATE TABLE IF NOT EXISTS public.admin_alerts_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1,
  edge_function_url TEXT NOT NULL,
  service_role_key  TEXT NOT NULL,
  CONSTRAINT admin_alerts_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.admin_alerts_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_alerts_settings admin only" ON public.admin_alerts_settings;
CREATE POLICY "admin_alerts_settings admin only"
  ON public.admin_alerts_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id::text = auth.uid()::text));

-- Wrapper that reads the settings and fires the HTTP call.
CREATE OR REPLACE FUNCTION public.pc_trigger_admin_alerts()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.admin_alerts_settings%ROWTYPE;
  req_id BIGINT;
BEGIN
  SELECT * INTO s FROM public.admin_alerts_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'admin_alerts_settings not configured; skipping';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := s.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.service_role_key
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO req_id;

  RETURN req_id;
END;
$$;

-- Idempotent schedule (unschedule any prior version with same name).
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'pc-admin-alerts' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'pc-admin-alerts',
  '*/10 * * * *',
  $$SELECT public.pc_trigger_admin_alerts();$$
);
