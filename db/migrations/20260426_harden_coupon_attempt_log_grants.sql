-- Harden coupon_attempt_log table exposure.
-- Coupon redemption writes through the authenticated Edge Function/service role.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupon_attempt_log FROM anon;
