-- Migration: Security RLS hardening (audit fixes F-1, F-2, S-1, F-3)
-- Date: 2026-05-26
-- Fixes:
--   F-1  Block client writes to privileged user_profiles columns
--   F-2  Add ban_gate_* restrictive RLS policies (user_is_not_banned)
--   S-1  Recreate profile-images storage policies (per-user folder scope)
--   F-3  Burst rate limits on settings + clipboard_history

BEGIN;

-- =====================================================
-- F-1: Guard privileged user_profiles columns from clients
-- =====================================================
CREATE OR REPLACE FUNCTION public.guard_user_profiles_client_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );

  -- service_role (admin-api) may modify any column
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_banned := FALSE;
    NEW.ban_reason := NULL;
    NEW.banned_at := NULL;
    NEW.ban_expires_at := NULL;
    NEW.ban_lifted_at := NULL;
    NEW.quarantine_paused_until := NULL;
    NEW.daily_clip_limit := 700;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.ban_expires_at IS DISTINCT FROM OLD.ban_expires_at
       OR NEW.ban_lifted_at IS DISTINCT FROM OLD.ban_lifted_at
       OR NEW.quarantine_paused_until IS DISTINCT FROM OLD.quarantine_paused_until
       OR NEW.daily_clip_limit IS DISTINCT FROM OLD.daily_clip_limit
       OR NEW.warning_count IS DISTINCT FROM OLD.warning_count
       OR NEW.daily_update_count IS DISTINCT FROM OLD.daily_update_count
       OR NEW.last_update_reset_at IS DISTINCT FROM OLD.last_update_reset_at
    THEN
      RAISE EXCEPTION 'Cannot modify protected profile fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_guard_user_profiles ON public.user_profiles;
CREATE TRIGGER aaa_guard_user_profiles
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profiles_client_writes();

-- =====================================================
-- F-2: ban_gate restrictive policies (authenticated)
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_is_not_banned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT NOT COALESCE(
    (SELECT is_banned FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.user_is_not_banned() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_not_banned() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_is_not_banned() TO authenticated;

DO $$
DECLARE
  tbl TEXT;
  tables_all TEXT[] := ARRAY[
    'clips', 'archived_clips', 'categories', 'notes', 'note_versions',
    'device_sync_state', 'audit_log', 'clipboard_history', 'pastecraft_devices',
    'change_audit_log', 'settings', 'ai_history', 'refactor_tickets'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_all LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS ban_gate_%I ON public.%I', tbl, tbl);
      EXECUTE format(
        'CREATE POLICY ban_gate_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.user_is_not_banned()) WITH CHECK (public.user_is_not_banned())',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- user_profiles: allow SELECT when banned (for future UX), block writes
DROP POLICY IF EXISTS ban_gate_user_profiles_insert ON public.user_profiles;
CREATE POLICY ban_gate_user_profiles_insert
  ON public.user_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.user_is_not_banned());

DROP POLICY IF EXISTS ban_gate_user_profiles_update ON public.user_profiles;
CREATE POLICY ban_gate_user_profiles_update
  ON public.user_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.user_is_not_banned())
  WITH CHECK (public.user_is_not_banned());

-- =====================================================
-- S-1: profile-images storage — per-user folder RLS
-- =====================================================
DROP POLICY IF EXISTS "Allow all deletes from profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to profile-images"   ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to profile-images"   ON storage.objects;
DROP POLICY IF EXISTS "Profile images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images"         ON storage.objects;

DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
CREATE POLICY "Users can upload their own profile images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
CREATE POLICY "Users can update their own profile images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
CREATE POLICY "Users can delete their own profile images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket serves objects via URL; SELECT policy optional.
-- Add authenticated-only SELECT if bucket is ever made private:
-- DROP POLICY IF EXISTS "Users can read own profile images" ON storage.objects;
-- CREATE POLICY "Users can read own profile images"
--   ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- F-3: Burst limits on settings + clipboard_history
-- =====================================================
INSERT INTO public.rate_limit_config (table_name, per_minute, per_hour, per_day) VALUES
  ('settings',           5,  20,  100),
  ('clipboard_history',   30, 150, 1000)
ON CONFLICT (table_name) DO UPDATE SET
  per_minute = EXCLUDED.per_minute,
  per_hour   = EXCLUDED.per_hour,
  per_day    = EXCLUDED.per_day,
  updated_at = NOW();

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['settings', 'clipboard_history'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS aaa_pc_burst_limit ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER aaa_pc_burst_limit BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pc_check_insert_burst()',
        tbl
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_user_created ON public.%I (user_id, created_at DESC)',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- Safety: drop any legacy permissive table policies if they linger
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname ILIKE '%allow all%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

COMMIT;
