-- Fiverr AI Tester Coupon: FIVERRAI
-- 1 month free AI access for Fiverr developers (separate from DEV4EVER owner code)
-- Run this in Supabase SQL Editor → Dashboard → SQL Editor → New Query

INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count)
VALUES ('FIVERRAI', 'months_free', 1, TRUE, 'Fiverr developer testing coupon - 1 month free AI access', 25, 0)
ON CONFLICT (code) DO UPDATE
SET benefit_type = EXCLUDED.benefit_type,
    benefit_value = EXCLUDED.benefit_value,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count,
    updated_at = NOW();

-- Verify it was inserted:
SELECT code, benefit_type, benefit_value, max_redemptions, redemption_count, is_active
FROM coupon_codes
WHERE code IN ('DEV4EVER', 'FIVERRAI')
ORDER BY code;
