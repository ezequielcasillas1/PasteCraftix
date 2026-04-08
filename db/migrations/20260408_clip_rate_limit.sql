-- Migration: Clip insert rate limiting (700/day) with admin override
-- Date: 2026-04-08
-- Feature #41: Clip Rate Limiting + Admin Spam Control

-- Add per-user rate limit override column to user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS daily_clip_limit INTEGER DEFAULT 700,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Create rate limiting function
CREATE OR REPLACE FUNCTION check_clip_insert_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  user_limit INTEGER;
  user_banned BOOLEAN;
BEGIN
  -- Check if user is banned
  SELECT COALESCE(is_banned, FALSE) INTO user_banned
  FROM public.user_profiles
  WHERE user_id = NEW.user_id;
  
  IF user_banned THEN
    RAISE EXCEPTION 'User is banned from creating clips';
  END IF;

  -- Get user's custom limit (default 700)
  SELECT COALESCE(daily_clip_limit, 700) INTO user_limit
  FROM public.user_profiles
  WHERE user_id = NEW.user_id;

  -- Count clips created today by this user
  SELECT COUNT(*) INTO current_count
  FROM public.clips
  WHERE user_id = NEW.user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';

  -- Block if limit exceeded
  IF current_count >= user_limit THEN
    RAISE EXCEPTION 'Clip insert limit exceeded (%/day). Resets in 24 hours.', user_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS enforce_clip_insert_limit ON public.clips;
CREATE TRIGGER enforce_clip_insert_limit
  BEFORE INSERT ON public.clips
  FOR EACH ROW
  EXECUTE FUNCTION check_clip_insert_limit();

-- Create table to log rate limit violations (for admin spam detection)
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  daily_count INTEGER,
  limit_value INTEGER
);

-- RLS for rate_limit_violations (admin only)
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only rate limit violations" ON public.rate_limit_violations;
CREATE POLICY "Admin only rate limit violations"
ON public.rate_limit_violations FOR ALL
USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Function to log violations (called when limit hit)
CREATE OR REPLACE FUNCTION log_rate_limit_violation()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  user_limit INTEGER;
BEGIN
  SELECT COALESCE(daily_clip_limit, 700) INTO user_limit
  FROM public.user_profiles
  WHERE user_id = NEW.user_id;

  SELECT COUNT(*) INTO current_count
  FROM public.clips
  WHERE user_id = NEW.user_id
    AND created_at >= CURRENT_DATE;

  IF current_count >= user_limit THEN
    INSERT INTO public.rate_limit_violations (user_id, table_name, daily_count, limit_value)
    VALUES (NEW.user_id, 'clips', current_count, user_limit);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
