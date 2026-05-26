-- PasteCraft security + storage RLS verification
-- Run after applying 20260526180000_security_rls_hardening.sql

\echo '=== 1. Legacy Allow all policies (expect 0) ==='
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND policyname ILIKE '%allow all%';

\echo '=== 2. ban_gate policies (expect >= 14) ==='
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND policyname ILIKE 'ban_gate%'
ORDER BY tablename, policyname;

\echo '=== 3. user_profiles guard trigger ==='
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'aaa_guard_user_profiles';

\echo '=== 4. Storage profile-images policies (expect 3 write policies, 0 allow-all) ==='
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (policyname ILIKE '%profile%' OR policyname ILIKE '%allow all%')
ORDER BY policyname;

\echo '=== 5. profile-images bucket ==='
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'profile-images';

\echo '=== 6. Burst config for settings + clipboard_history ==='
SELECT table_name, per_minute, per_hour, per_day, enabled
FROM public.rate_limit_config
WHERE table_name IN ('settings', 'clipboard_history')
ORDER BY table_name;

\echo '=== 7. Orphan auto-ban functions (informational) ==='
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'check_auto_ban_on_violation',
    'flag_coupon_abuse',
    'scan_clip_content_for_threats'
  );

\echo '=== 8. Clips SELECT quarantine filter ==='
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clips' AND cmd = 'SELECT';

\echo '=== DONE ==='
