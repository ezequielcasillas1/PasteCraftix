-- =====================================================
-- PASTECRAFT CRITICAL FIXES
-- Missing RPC Function + Storage Bucket Setup
-- =====================================================

-- =====================================================
-- FIX #1: Create missing set_config RPC function
-- =====================================================
-- This function is required for RLS policies to work with custom user IDs

CREATE OR REPLACE FUNCTION set_config(setting TEXT, value TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config(setting, value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION set_config(TEXT, TEXT) TO anon, authenticated;

-- =====================================================
-- FIX #2: Storage Bucket Instructions
-- =====================================================
-- The 'profile-images' bucket MUST be created manually in Supabase Dashboard
-- 
-- MANUAL STEPS (Do this in Supabase Dashboard):
-- 1. Navigate to: Storage → Create a new bucket
-- 2. Bucket Name: profile-images
-- 3. Public bucket: YES (check the box)
-- 4. File size limit: 5 MB
-- 5. Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp
-- 6. Click "Create bucket"
--
-- After creating the bucket, the RLS policies below will secure it.

-- =====================================================
-- FIX #3: Storage Bucket RLS Policies
-- =====================================================
-- Run these AFTER creating the 'profile-images' bucket

-- Enable RLS on the storage.objects table for profile-images bucket
-- Note: These policies apply to the storage.objects table

-- Policy: Allow users to upload their own profile images
CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to all profile images
CREATE POLICY "Profile images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- Policy: Allow users to update their own profile images
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own profile images
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- ALTERNATIVE: Allow uploads without auth (for Chrome extension user IDs)
-- =====================================================
-- If you're NOT using Supabase Auth and using Chrome extension IDs instead,
-- use these more permissive policies (uncomment the ones below and comment out the ones above):

/*
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
CREATE POLICY "Allow all uploads to profile-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
CREATE POLICY "Allow all updates to profile-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
CREATE POLICY "Allow all deletes from profile-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-images');
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Test 1: Verify set_config function exists
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'set_config';

-- Test 2: Check storage bucket exists (run this in Supabase after creating bucket)
SELECT * FROM storage.buckets WHERE name = 'profile-images';

-- Test 3: Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Manually create 'profile-images' bucket in Storage dashboard
-- 3. Test AI image generation in extension
-- 4. Verify image uploads to Supabase Storage
-- =====================================================


