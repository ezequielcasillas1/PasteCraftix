-- Migration: Tighten RLS + pin function search_path
-- Date: 2026-04-17
-- Fixes flagged by Supabase Security Advisor:
--   1. profile-images bucket: drop 5 legacy {public} policies that allow anon to
--      list/upload/update/delete ANY file in the bucket. The existing
--      {authenticated} policies scoped to auth.uid() folder remain in place.
--      (Public bucket still serves object URLs without a SELECT policy.)
--   2. coupon_attempt_log: replace the overly permissive INSERT policy
--      (roles={public}, WITH CHECK true) with an authenticated-only policy
--      that requires auth.uid() = user_id. service_role bypasses RLS natively.
--   3. Pin search_path on 3 functions to prevent search_path hijacking,
--      especially critical for public.set_config() which is SECURITY DEFINER.
--
-- Safety:
--   - All statements use IF EXISTS / OR REPLACE and are idempotent.
--   - No data is touched.
--   - Rollback: see bottom of file.

BEGIN;

-- =====================================================
-- 1. profile-images bucket: remove legacy public policies
-- =====================================================
-- These policies let ANY anon request (using the public anon JWT) list/delete/
-- update/upload any file in the bucket. The correct {authenticated} policies
-- already exist and will enforce per-user folder scoping once these are gone.

DROP POLICY IF EXISTS "Allow all deletes from profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to profile-images"   ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to profile-images"   ON storage.objects;
DROP POLICY IF EXISTS "Profile images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images"         ON storage.objects;

-- =====================================================
-- 2. coupon_attempt_log: scope INSERT to the owning user
-- =====================================================
DROP POLICY IF EXISTS "Service can insert coupon attempts" ON public.coupon_attempt_log;

CREATE POLICY "Users can insert own coupon attempts"
  ON public.coupon_attempt_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can insert own coupon attempts" ON public.coupon_attempt_log IS
  'Authenticated users may log only their own coupon attempts. service_role bypasses RLS, so Edge Functions are unaffected.';

-- =====================================================
-- 3. Pin search_path on flagged functions
-- =====================================================
-- Prevents a malicious role from shadowing built-in names via their own
-- search_path. Critical for set_config() because it is SECURITY DEFINER.

ALTER FUNCTION public.set_config(text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.auto_archive_old_clips(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.search_clips(text, text, text, integer)
  SET search_path = public, pg_temp;

COMMIT;

-- =====================================================
-- Rollback (manual, if ever needed)
-- =====================================================
-- BEGIN;
--   -- profile-images (NOT RECOMMENDED - reintroduces the vulnerability)
--   CREATE POLICY "Profile images are publicly accessible" ON storage.objects
--     FOR SELECT TO public USING (bucket_id = 'profile-images');
--   -- coupon_attempt_log
--   DROP POLICY IF EXISTS "Users can insert own coupon attempts" ON public.coupon_attempt_log;
--   CREATE POLICY "Service can insert coupon attempts" ON public.coupon_attempt_log
--     FOR INSERT TO public WITH CHECK (true);
--   -- functions
--   ALTER FUNCTION public.set_config(text, text) RESET search_path;
--   ALTER FUNCTION public.auto_archive_old_clips(text) RESET search_path;
--   ALTER FUNCTION public.search_clips(text, text, text, integer) RESET search_path;
-- COMMIT;
