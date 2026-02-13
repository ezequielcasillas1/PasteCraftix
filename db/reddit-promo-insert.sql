-- Reddit Launch Promo: REDDIT100
-- 1 year free AI access for first 100 users
-- Run this in Supabase SQL Editor → Dashboard → SQL Editor → New Query

INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count, expires_at)
VALUES ('REDDIT100', 'months_free', 12, TRUE, 'Reddit launch promo - 1 year free AI access for first 100 users', 100, 0, '2026-06-12T23:59:59Z')
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count,
    expires_at = EXCLUDED.expires_at;

-- Verify it was inserted:
SELECT code, benefit_type, benefit_value, max_redemptions, redemption_count, is_active, expires_at
FROM coupon_codes
WHERE code = 'REDDIT100';
