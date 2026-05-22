-- Replace service_role_key in admin_alerts_settings with cron_secret.
-- Date: 2026-05-22
-- After apply: set cron_secret via SQL editor to match ADMIN_ALERTS_CRON_SECRET edge secret.

ALTER TABLE public.admin_alerts_settings
  ADD COLUMN IF NOT EXISTS cron_secret TEXT;

-- Copy existing service_role_key into cron_secret if cron_secret empty (rotate after deploy)
UPDATE public.admin_alerts_settings
SET cron_secret = service_role_key
WHERE cron_secret IS NULL AND service_role_key IS NOT NULL;

ALTER TABLE public.admin_alerts_settings
  DROP COLUMN IF EXISTS service_role_key;

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

  IF s.cron_secret IS NULL OR length(trim(s.cron_secret)) = 0 THEN
    RAISE NOTICE 'admin_alerts_settings.cron_secret not configured; skipping';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := s.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.cron_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO req_id;

  RETURN req_id;
END;
$$;
