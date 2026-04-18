-- Migration: Website page view analytics (privacy-light)
-- Date: 2026-04-17
-- Feature: Admin Dashboard Stats (visitor analytics)
--
-- Stores one row per page view. No IP, no user-agent, no PII.
-- A random visitor_id is generated client-side (localStorage) for unique-visitor counts.
-- Rows older than 90 days are auto-pruned.

CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  visitor_id TEXT,
  referrer_host TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast admin aggregations
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON public.page_views (visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON public.page_views (path);

-- RLS: anon can INSERT only; no SELECT/UPDATE/DELETE for anon.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_views_anon_insert" ON public.page_views;
CREATE POLICY "page_views_anon_insert"
  ON public.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role bypasses RLS, so admin-api Edge Function reads freely.

-- ── Prune function: delete rows older than 90 days ─────────────────────────
CREATE OR REPLACE FUNCTION public.prune_old_page_views()
RETURNS void AS $$
BEGIN
  DELETE FROM public.page_views
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── Schedule daily prune via pg_cron (Supabase Pro has this enabled) ──────
-- If pg_cron is not available in this project, this block fails silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('prune_page_views_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune_page_views_daily');
    PERFORM cron.schedule(
      'prune_page_views_daily',
      '15 3 * * *',
      $prune$SELECT public.prune_old_page_views();$prune$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — prune must be run manually or via Edge Function';
END$$;
