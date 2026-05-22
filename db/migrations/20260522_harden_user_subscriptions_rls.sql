-- Harden user_subscriptions: block client tier escalation; deprecate admin tier.
-- Date: 2026-05-22

-- Ensure admin_users exists for migration sync
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Migrate subscription_tier = 'admin' → admin_users + reset tier
INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.user_subscriptions
WHERE subscription_tier = 'admin'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.user_subscriptions
SET subscription_tier = CASE
  WHEN stripe_subscription_id IS NOT NULL AND subscription_status IN ('active', 'past_due') THEN 'premium'
  ELSE 'free'
END
WHERE subscription_tier = 'admin';

-- Normalize any other invalid tiers
UPDATE public.user_subscriptions
SET subscription_tier = 'free'
WHERE subscription_tier NOT IN ('free', 'premium');

-- Tier constraint: billing tiers only (no admin tier in extension/DB)
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (subscription_tier IN ('free', 'premium'));

-- RLS: remove client UPDATE entirely (webhook/service role bypasses RLS)
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;

DROP POLICY IF EXISTS "Allow inserts during signup" ON public.user_subscriptions;
CREATE POLICY "Allow inserts during signup"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND subscription_tier = 'free'
    AND subscription_status = 'active'
    AND COALESCE(has_unlimited_ai, FALSE) = FALSE
    AND stripe_customer_id IS NULL
    AND stripe_subscription_id IS NULL
  );

-- Drop JWT app_metadata admin SELECT policy (admin uses admin-api service role)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

-- Trigger: reject authenticated UPDATE attempts on privileged columns
CREATE OR REPLACE FUNCTION public.guard_user_subscriptions_client_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );

  -- Service role and postgres bypass
  IF jwt_role IN ('service_role', '') AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'user_subscriptions updates are not allowed for authenticated clients';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_subscriptions ON public.user_subscriptions;
CREATE TRIGGER trg_guard_user_subscriptions
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_subscriptions_client_writes();
