-- Migration: Add missing AI image-credit columns to user_subscriptions
-- Date: 2026-05-21
-- Reason: ai-image edge function selects ai_image_credits_*; missing columns caused
--         PostgREST 42703 surfaced as `403 Subscription not found`.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS ai_image_credits_limit     INTEGER,
  ADD COLUMN IF NOT EXISTS ai_image_credits_used      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_image_credits_reset_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_img_reset
  ON public.user_subscriptions(ai_image_credits_reset_at)
  WHERE ai_image_credits_reset_at IS NOT NULL;
