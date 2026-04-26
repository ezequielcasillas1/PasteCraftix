-- Add universal editable titles for active and archived clips.
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

ALTER TABLE public.archived_clips
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
