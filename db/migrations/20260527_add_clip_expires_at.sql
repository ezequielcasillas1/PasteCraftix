-- Per-clip auto-expire timestamps for active and archived clips.
-- expires_at: Unix ms when clip should be purged; NULL = no auto-expire.
-- expire_preset: client preset key (30m, 1h, custom, etc.) for UI restore.
ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS expires_at BIGINT,
  ADD COLUMN IF NOT EXISTS expire_preset TEXT;

ALTER TABLE public.archived_clips
  ADD COLUMN IF NOT EXISTS expires_at BIGINT,
  ADD COLUMN IF NOT EXISTS expire_preset TEXT;

COMMENT ON COLUMN public.clips.expires_at IS 'Unix ms auto-delete time; NULL disables expiry';
COMMENT ON COLUMN public.clips.expire_preset IS 'Preset key chosen in extension UI';
COMMENT ON COLUMN public.archived_clips.expires_at IS 'Unix ms auto-delete time; NULL disables expiry';
COMMENT ON COLUMN public.archived_clips.expire_preset IS 'Preset key chosen in extension UI';
