-- Fix regression from harden_security_definer_rpc_grants:
-- RLS policies invoke user_is_not_banned(); authenticated must keep EXECUTE.
-- get_effective_access_state: cast user_id (uuid) vs text param.

GRANT EXECUTE ON FUNCTION public.user_is_not_banned() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_effective_access_state(p_user_id TEXT)
RETURNS TABLE (
  is_owner BOOLEAN,
  is_premium BOOLEAN,
  has_cloud_sync BOOLEAN,
  source TEXT
) AS $$
DECLARE
  v_user_id uuid;
  v_tier TEXT;
  v_status TEXT;
  v_has_unlimited BOOLEAN;
  v_ai_expires TIMESTAMP WITH TIME ZONE;
  v_coupon_access BOOLEAN;
  v_paid_premium BOOLEAN;
  v_paid_sync BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized access to get_effective_access_state';
  END IF;

  BEGIN
    v_user_id := p_user_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Unauthorized access to get_effective_access_state';
  END;

  IF auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized access to get_effective_access_state';
  END IF;

  SELECT
    COALESCE(LOWER(subscription_tier), ''),
    COALESCE(LOWER(subscription_status), ''),
    COALESCE(has_unlimited_ai, false),
    ai_access_expires_at
  INTO
    v_tier,
    v_status,
    v_has_unlimited,
    v_ai_expires
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
  LIMIT 1;

  v_coupon_access := v_has_unlimited OR (v_ai_expires IS NOT NULL AND v_ai_expires > NOW());
  v_paid_premium := (v_tier IN ('premium', 'admin') AND v_status = 'active');
  v_paid_sync := (v_tier IN ('basic', 'premium', 'admin') AND v_status IN ('active', 'past_due'));

  is_owner := (v_user_id = '5a9d4f09-9473-4df6-82cc-1094c84ae438'::uuid);
  is_premium := (is_owner OR v_paid_premium OR v_coupon_access);
  has_cloud_sync := (is_owner OR v_paid_sync OR v_coupon_access);
  source := CASE
    WHEN is_owner THEN 'owner_override'
    WHEN v_coupon_access THEN 'coupon'
    WHEN v_paid_sync OR v_paid_premium THEN 'subscription'
    ELSE 'free'
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_effective_access_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_access_state(text) TO authenticated;
