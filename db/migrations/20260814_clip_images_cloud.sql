-- Durable cloud preserve for picked/captured clip images.
-- Bytes live in Storage; clips.image_url holds the public URL (no data URLs).

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.clips.image_url IS
  'Public HTTPS URL for a picked/captured clip image in the clip-images bucket. Never a data URL.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clip-images',
  'clip-images',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload their own clip images" ON storage.objects;
CREATE POLICY "Users can upload their own clip images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clip-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update their own clip images" ON storage.objects;
CREATE POLICY "Users can update their own clip images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clip-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete their own clip images" ON storage.objects;
CREATE POLICY "Users can delete their own clip images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clip-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users can view own clip images" ON storage.objects;
CREATE POLICY "Users can view own clip images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'clip-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
