-- =====================================================
-- PASTECRAFT CRITICAL FIXES
-- Missing RPC Function + Storage Bucket Setup
-- =====================================================

-- =====================================================
-- FIX #1: Create missing set_config RPC function
-- =====================================================
-- SECURITY NOTE:
-- Do NOT expose a set_config RPC to clients. If your RLS depends on
-- current_setting('app.current_user_id'), a client could spoof it.
-- This project should use auth.uid()-based policies instead.

DROP FUNCTION IF EXISTS public.set_config(TEXT, TEXT);

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
-- FIX #4: Durable Sync + Retention (Soft Delete + Notes)
-- =====================================================
-- Adds soft delete columns, notes tables, device sync tracking, and audit logs.

-- --- Clips + Archived Clips ---
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE public.archived_clips
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- --- Notes Tables ---
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  note_id TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note',
  title TEXT,
  description TEXT,
  body TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  note_refs JSONB DEFAULT '[]'::jsonb,
  source_note_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  device_id TEXT,
  updated_ms BIGINT,
  content_hash TEXT,
  UNIQUE(user_id, note_id)
);

CREATE TABLE IF NOT EXISTS public.note_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  note_id TEXT NOT NULL,
  version_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  snapshot JSONB NOT NULL,
  device_id TEXT
);

-- --- Device Sync State ---
CREATE TABLE IF NOT EXISTS public.device_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_ms BIGINT,
  UNIQUE(user_id, device_id)
);

-- --- Audit Log ---
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  data JSONB,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- Update triggers ---
DROP TRIGGER IF EXISTS update_clips_updated_at ON public.clips;
CREATE TRIGGER update_clips_updated_at
  BEFORE UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_archived_clips_updated_at ON public.archived_clips;
CREATE TRIGGER update_archived_clips_updated_at
  BEFORE UPDATE ON public.archived_clips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --- Enable RLS on new tables ---
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- --- RLS deletes off (soft delete only) ---
DROP POLICY IF EXISTS "Users can delete their own clips" ON public.clips;
DROP POLICY IF EXISTS "Users can delete their own archived clips" ON public.archived_clips;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

-- --- Notes RLS ---
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes"
ON public.notes FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "Users can insert their own notes"
ON public.notes FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes"
ON public.notes FOR UPDATE
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view their own note versions" ON public.note_versions;
CREATE POLICY "Users can view their own note versions"
ON public.note_versions FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own note versions" ON public.note_versions;
CREATE POLICY "Users can insert their own note versions"
ON public.note_versions FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view their own device sync state" ON public.device_sync_state;
CREATE POLICY "Users can view their own device sync state"
ON public.device_sync_state FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can upsert their own device sync state" ON public.device_sync_state;
CREATE POLICY "Users can upsert their own device sync state"
ON public.device_sync_state FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own device sync state" ON public.device_sync_state;
CREATE POLICY "Users can update their own device sync state"
ON public.device_sync_state FOR UPDATE
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view their own audit log" ON public.audit_log;
CREATE POLICY "Users can view their own audit log"
ON public.audit_log FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own audit log" ON public.audit_log;
CREATE POLICY "Users can insert their own audit log"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- --- Realtime ---
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sync_state;

-- --- Indexes ---
CREATE INDEX IF NOT EXISTS idx_clips_deleted_at ON public.clips(deleted_at);
CREATE INDEX IF NOT EXISTS idx_archived_clips_deleted_at ON public.archived_clips(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON public.notes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_device_sync_user_id ON public.device_sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_content_hash ON public.clips(content_hash);
CREATE INDEX IF NOT EXISTS idx_clips_device_id ON public.clips(device_id);

-- --- Server-authoritative access state (subscription/coupon/owner) ---
CREATE OR REPLACE FUNCTION public.get_effective_access_state(p_user_id TEXT)
RETURNS TABLE (
  is_owner BOOLEAN,
  is_premium BOOLEAN,
  has_cloud_sync BOOLEAN,
  source TEXT
) AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_has_unlimited BOOLEAN;
  v_ai_expires TIMESTAMP WITH TIME ZONE;
  v_coupon_access BOOLEAN;
  v_paid_premium BOOLEAN;
  v_paid_sync BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::text <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized access to get_effective_access_state';
  END IF;

  SELECT
    COALESCE(LOWER(subscription_tier), ''),
    COALESCE(LOWER(subscription_status), ''),
    COALESCE(has_unlimited_ai, false),
    ai_access_expires_at
  INTO
    v_tier,
    v_status,
    v_has_unlimited,
    v_ai_expires
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
  LIMIT 1;

  v_coupon_access := v_has_unlimited OR (v_ai_expires IS NOT NULL AND v_ai_expires > NOW());
  v_paid_premium := (v_tier IN ('premium', 'admin') AND v_status = 'active');
  v_paid_sync := (v_tier IN ('basic', 'premium', 'admin') AND v_status IN ('active', 'past_due'));

  is_owner := (p_user_id = '5a9d4f09-9473-4df6-82cc-1094c84ae438');
  is_premium := (is_owner OR v_paid_premium OR v_coupon_access);
  has_cloud_sync := (is_owner OR v_paid_sync OR v_coupon_access);
  source := CASE
    WHEN is_owner THEN 'owner_override'
    WHEN v_coupon_access THEN 'coupon'
    WHEN v_paid_sync OR v_paid_premium THEN 'subscription'
    ELSE 'free'
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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


-- =====================================================
-- FIX #5: AI_HISTORY TABLE (Mar 17, 2026)
-- =====================================================
-- Creates ai_history table for cloud-persisted AI conversations
-- Content viewable regardless of subscription status

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    history_id BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('summary', 'breakdown')),
    title TEXT,
    threads JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE(user_id, history_id)
);

-- Add deleted_at column if table already exists without it
ALTER TABLE public.ai_history 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON public.ai_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_type ON public.ai_history(type);
CREATE INDEX IF NOT EXISTS idx_ai_history_deleted_at ON public.ai_history(deleted_at);

-- Enable RLS
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid duplicates)
DROP POLICY IF EXISTS "Users can view their own ai history" ON public.ai_history;
CREATE POLICY "Users can view their own ai history"
    ON public.ai_history FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own ai history" ON public.ai_history;
CREATE POLICY "Users can insert their own ai history"
    ON public.ai_history FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own ai history" ON public.ai_history;
CREATE POLICY "Users can update their own ai history"
    ON public.ai_history FOR UPDATE
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own ai history" ON public.ai_history;
CREATE POLICY "Users can delete their own ai history"
    ON public.ai_history FOR DELETE
    USING (auth.uid()::text = user_id);

-- Realtime (ignore error if already added)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_history;
