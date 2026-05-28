-- Purchased AI credit balance + purchase audit + app announcements

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS ai_purchased_credits_balance INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_subscriptions.ai_purchased_credits_balance IS
  'Unified purchased credit pool (never resets). Text drains at model weight; image at 1:1.';

CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  price_id TEXT NOT NULL,
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  amount_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
  ON public.credit_purchases(user_id, purchased_at DESC);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own credit purchases" ON public.credit_purchases;
CREATE POLICY "Users read own credit purchases"
  ON public.credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  link_label TEXT,
  audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'premium', 'free')),
  priority INTEGER NOT NULL DEFAULT 0,
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_announcements_active
  ON public.app_announcements(priority DESC, active_from DESC);

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.app_announcements;
CREATE POLICY "Anyone can read active announcements"
  ON public.app_announcements FOR SELECT
  USING (
    active_from <= now()
    AND (active_until IS NULL OR active_until > now())
  );
