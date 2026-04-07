-- Migration: Add rate limiting to user_profiles table
-- Purpose: Prevent Realtime message quota drain from excessive profile updates
-- Limit: 50 profile updates per user per day

-- Add rate limiting columns
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS daily_update_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_update_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Create rate limiting function
CREATE OR REPLACE FUNCTION check_profile_update_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset counter if new day (UTC)
  IF OLD.last_update_reset_at IS NULL OR OLD.last_update_reset_at::date < CURRENT_DATE THEN
    NEW.daily_update_count := 1;
    NEW.last_update_reset_at := NOW();
    RETURN NEW;
  END IF;
  
  -- Check limit (50 updates per day)
  IF OLD.daily_update_count >= 50 THEN
    RAISE EXCEPTION 'Profile update limit exceeded (50/day). Please try again tomorrow.';
  END IF;
  
  -- Increment counter
  NEW.daily_update_count := COALESCE(OLD.daily_update_count, 0) + 1;
  NEW.last_update_reset_at := COALESCE(OLD.last_update_reset_at, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS enforce_profile_update_limit ON public.user_profiles;

CREATE TRIGGER enforce_profile_update_limit
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_update_limit();
