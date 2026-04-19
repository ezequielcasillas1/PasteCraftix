-- Migration: Add missing AI text-credit columns to user_subscriptions
-- Date: 2026-04-19
-- Reason: The edge function `requireTextCredits` (supabase/functions/_shared/ai_workflow.ts)
--         selects stripe_current_period_end, ai_text_credits_limit,
--         ai_text_credits_used, ai_text_credits_reset_at. These columns were
--         declared in db/supabase-auth-schema.sql but never applied to the live DB,
--         so PostgREST returned a column-not-found error which the edge function
--         surfaced as `403 Subscription not found` even for users with a valid row.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_text_credits_limit     INTEGER,
  ADD COLUMN IF NOT EXISTS ai_text_credits_used      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_text_credits_reset_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end
  ON public.user_subscriptions(stripe_current_period_end)
  WHERE stripe_current_period_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_txt_reset
  ON public.user_subscriptions(ai_text_credits_reset_at)
  WHERE ai_text_credits_reset_at IS NOT NULL;
