-- =====================================================
-- COUPON CODE FEATURE MIGRATION
-- Flexible coupon code system supporting multiple codes with different benefits
-- =====================================================

-- Create coupon_codes table to store valid coupon codes
CREATE TABLE IF NOT EXISTS coupon_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    benefit_type TEXT NOT NULL, -- 'unlimited' or 'months_free'
    benefit_value INTEGER, -- NULL for unlimited, or number of months (3, 6, 12, etc.)
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT, -- Optional description of the coupon
    expires_at TIMESTAMPTZ, -- Optional expiration date for the coupon itself
    max_redemptions INTEGER DEFAULT NULL, -- NULL = unlimited redemptions, or max number of times code can be used
    redemption_count INTEGER DEFAULT 0, -- Current number of times code has been redeemed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for coupon_codes
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_active ON coupon_codes(is_active) WHERE is_active = TRUE;

-- Add AI access tracking columns to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS has_unlimited_ai BOOLEAN DEFAULT FALSE;

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS ai_access_expires_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN user_subscriptions.has_unlimited_ai IS 'True if user has unlimited AI access (never expires)';
COMMENT ON COLUMN user_subscriptions.ai_access_expires_at IS 'Timestamp when AI access expires (NULL if unlimited)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_unlimited_ai 
ON user_subscriptions(has_unlimited_ai) 
WHERE has_unlimited_ai = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_ai_expires 
ON user_subscriptions(ai_access_expires_at) 
WHERE ai_access_expires_at IS NOT NULL;

-- Create coupon_redemptions table to track individual redemptions
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id BIGSERIAL PRIMARY KEY,
    coupon_code_id BIGINT REFERENCES coupon_codes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coupon_code_id, user_id) -- Prevent same user from redeeming same code twice
);

-- Create indexes for coupon_redemptions
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code_user ON coupon_redemptions(coupon_code_id, user_id);

-- Enable RLS on coupon_codes (read-only for authenticated users)
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active coupon codes (for validation)
CREATE POLICY "Anyone can view active coupon codes"
ON coupon_codes FOR SELECT
USING (is_active = TRUE);

-- Enable RLS on coupon_redemptions
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own redemptions
CREATE POLICY "Users can view their own redemptions"
ON coupon_redemptions FOR SELECT
USING (auth.uid() = user_id);

-- Insert coupon codes with redemption limits
-- DEV4EVER: 1 redemption (developer unlimited)
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count)
VALUES ('DEV4EVER', 'unlimited', NULL, TRUE, 'Developer coupon - Unlimited AI access forever', 1, 0)
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count;

-- PASTE3: 2 redemptions (3 months free)
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count)
VALUES ('PASTE3', 'months_free', 3, TRUE, '3 months free AI access', 2, 0)
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count;

-- PASTE6: 2 redemptions (6 months free)
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count)
VALUES ('PASTE6', 'months_free', 6, TRUE, '6 months free AI access', 2, 0)
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count;

-- PASTE12: 2 redemptions (12 months free)
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count)
VALUES ('PASTE12', 'months_free', 12, TRUE, '12 months free AI access', 2, 0)
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count;

-- REDDIT100: 100 redemptions (12 months free) - Reddit launch promo
INSERT INTO coupon_codes (code, benefit_type, benefit_value, is_active, description, max_redemptions, redemption_count, expires_at)
VALUES ('REDDIT100', 'months_free', 12, TRUE, 'Reddit launch promo - 1 year free AI access for first 100 users', 100, 0, '2026-06-12T23:59:59Z')
ON CONFLICT (code) DO UPDATE 
SET max_redemptions = EXCLUDED.max_redemptions,
    redemption_count = EXCLUDED.redemption_count,
    expires_at = EXCLUDED.expires_at;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check coupon_codes table:
-- SELECT * FROM coupon_codes;

-- Check user_subscriptions columns:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_subscriptions' 
-- AND column_name IN ('has_unlimited_ai', 'ai_access_expires_at');

-- Check coupon codes and their redemption counts:
-- SELECT code, benefit_type, benefit_value, max_redemptions, redemption_count 
-- FROM coupon_codes 
-- ORDER BY code;

-- Check all redemptions:
-- SELECT cr.*, cc.code, u.email 
-- FROM coupon_redemptions cr
-- JOIN coupon_codes cc ON cr.coupon_code_id = cc.id
-- JOIN auth.users u ON cr.user_id = u.id
-- ORDER BY cr.redeemed_at DESC;

