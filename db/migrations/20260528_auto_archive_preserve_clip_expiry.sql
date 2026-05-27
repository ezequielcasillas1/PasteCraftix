-- Preserve expires_at / expire_preset (and title) when auto_archive_old_clips runs.
-- Partial indexes help expiry-aware sync and purge queries per user.

CREATE INDEX IF NOT EXISTS idx_clips_user_expires_at
  ON public.clips (user_id, expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_archived_clips_user_expires_at
  ON public.archived_clips (user_id, expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.auto_archive_old_clips(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    archived_count INTEGER;
BEGIN
    WITH clips_to_archive AS (
        SELECT id, clip_id, text, title, category, timestamp, expires_at, expire_preset
        FROM public.clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 20
    )
    INSERT INTO public.archived_clips (
        user_id, clip_id, text, title, category, timestamp, expires_at, expire_preset
    )
    SELECT
        p_user_id,
        clip_id,
        text,
        COALESCE(title, ''),
        category,
        timestamp,
        expires_at,
        expire_preset
    FROM clips_to_archive
    ON CONFLICT (user_id, clip_id) DO NOTHING;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    DELETE FROM public.clips
    WHERE id IN (
        SELECT id FROM public.clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 20
    );

    DELETE FROM public.archived_clips
    WHERE id IN (
        SELECT id FROM public.archived_clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 1000
    );

    RETURN archived_count;
END;
$function$;
