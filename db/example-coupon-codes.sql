-- =====================================================
-- EXAMPLE COUPON CODES
-- Use this file to add new coupon codes to the system
-- =====================================================

-- Example: Add a 3-month free AI access coupon
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, expires_at)
VALUES ('FREEMONTH3', 'months_free', 3, TRUE, '3 months free AI access', NULL)
ON CONFLICT (code) DO UPDATE 
SET benefit_type = EXCLUDED.benefit_type,
    benefit_value = EXCLUDED.benefit_value,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    expires_at = EXCLUDED.expires_at;

-- Example: Add a 6-month free AI access coupon
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, expires_at)
VALUES ('FREEMONTH6', 'months_free', 6, TRUE, '6 months free AI access', NULL)
ON CONFLICT (code) DO UPDATE 
SET benefit_type = EXCLUDED.benefit_type,
    benefit_value = EXCLUDED.benefit_value,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    expires_at = EXCLUDED.expires_at;

-- Example: Add a 1-year free AI access coupon
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, expires_at)
VALUES ('FREEMONTH12', 'months_free', 12, TRUE, '1 year free AI access', NULL)
ON CONFLICT (code) DO UPDATE 
SET benefit_type = EXCLUDED.benefit_type,
    benefit_value = EXCLUDED.benefit_value,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    expires_at = EXCLUDED.expires_at;

-- Example: Add a limited-time coupon that expires on a specific date
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, expires_at)
VALUES ('HOLIDAY2025', 'months_free', 3, TRUE, 'Holiday special - 3 months free', '2025-12-31 23:59:59+00')
ON CONFLICT (code) DO UPDATE 
SET benefit_type = EXCLUDED.benefit_type,
    benefit_value = EXCLUDED.benefit_value,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    expires_at = EXCLUDED.expires_at;

-- Example: Deactivate a coupon code (set is_active to FALSE)
-- UPDATE coupon_codes SET is_active = FALSE WHERE code = 'OLDCODE';

-- Example: View all active coupon codes
-- SELECT code, benefit_type, benefit_value, description, expires_at 
-- FROM coupon_codes 
-- WHERE is_active = TRUE 
-- ORDER BY created_at DESC;

-- =====================================================
-- NOTES
-- =====================================================
-- benefit_type options:
--   - 'unlimited': Grants unlimited AI access forever (benefit_value should be NULL)
--   - 'months_free': Grants free AI access for X months (benefit_value = number of months)
--
-- expires_at: 
--   - NULL = coupon code never expires (can be used anytime)
--   - TIMESTAMPTZ = coupon code expires on this date (users can't redeem after this date)
--
-- To add a new coupon code, use the INSERT statement format above.
-- To modify an existing coupon, use UPDATE or the ON CONFLICT DO UPDATE pattern.






























