ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS separators jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.categories.separators IS
  'Named line-bar separators for study organization inside a category unit. Array of {id,name,afterClipId,createdAt,updatedAt,deletedAt?}.';
