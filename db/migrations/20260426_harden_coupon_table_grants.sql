-- Harden coupon table exposure.
-- Account pages and coupon redemption use authenticated/service-role access.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupon_codes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupon_redemptions FROM anon;
