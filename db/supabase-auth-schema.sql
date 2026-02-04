-- =====================================================
-- PASTECRAFT AUTHENTICATION SCHEMA
-- Task #12: User Authentication & Subscription System
-- =====================================================

-- Enable Supabase Auth (should be enabled by default)
-- This script creates the user_subscriptions table for subscription tracking

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    subscription_tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'basic', 'premium', 'admin'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due'
    trial_ends_at TIMESTAMPTZ,
    has_unlimited_ai BOOLEAN DEFAULT FALSE, -- Special coupon code grants unlimited AI access (never expires)
    ai_access_expires_at TIMESTAMPTZ, -- Timestamp when AI access expires (NULL if unlimited or no coupon)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON user_subscriptions(email);

-- Enable Row Level Security (RLS)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Only allow inserts through application code (sign up flow)
CREATE POLICY "Allow inserts during signup"
ON user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON user_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
ON user_subscriptions FOR SELECT
USING (
  -- IMPORTANT: avoid self-referential subquery on user_subscriptions (causes RLS recursion error)
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
);

-- =====================================================
-- UPDATED CLIPS TABLE WITH USER AUTHENTICATION
-- =====================================================

-- Update existing clips table to use auth.users
ALTER TABLE clips ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for auth_user_id
CREATE INDEX IF NOT EXISTS idx_clips_auth_user_id ON clips(auth_user_id);

-- Update RLS policies for clips to use auth.uid()
DROP POLICY IF EXISTS "Users can view their own clips" ON clips;
CREATE POLICY "Users can view their own clips"
ON clips FOR SELECT
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can insert their own clips" ON clips;
CREATE POLICY "Users can insert their own clips"
ON clips FOR INSERT
WITH CHECK (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can update their own clips" ON clips;
CREATE POLICY "Users can update their own clips"
ON clips FOR UPDATE
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can delete their own clips" ON clips;
CREATE POLICY "Users can delete their own clips"
ON clips FOR DELETE
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

-- =====================================================
-- UPDATED CATEGORIES TABLE WITH USER AUTHENTICATION
-- =====================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_auth_user_id ON categories(auth_user_id);

-- Update RLS policies for categories
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
ON categories FOR SELECT
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
CREATE POLICY "Users can insert their own categories"
ON categories FOR INSERT
WITH CHECK (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
CREATE POLICY "Users can update their own categories"
ON categories FOR UPDATE
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
CREATE POLICY "Users can delete their own categories"
ON categories FOR DELETE
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

-- =====================================================
-- UPDATED USER PROFILES TABLE WITH USER AUTHENTICATION
-- =====================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- Update RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
ON user_profiles FOR SELECT
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
ON user_profiles FOR INSERT
WITH CHECK (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE
USING (
  auth.uid()::text = user_id OR 
  auth.uid() = auth_user_id
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on user_subscriptions
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- Example: Create a test admin user subscription
-- NOTE: You need to create the user in Supabase Auth first, then run this with their UUID
-- INSERT INTO user_subscriptions (user_id, email, subscription_tier)
-- VALUES ('YOUR-USER-UUID-HERE', 'admin@pastecraft.com', 'admin');

-- =====================================================
-- INSTRUCTIONS
-- =====================================================

-- 1. Run this script in your Supabase SQL Editor
-- 2. Enable Google OAuth in Supabase Dashboard → Authentication → Providers
-- 3. Add Google OAuth credentials (Client ID & Secret)
-- 4. Update manifest.json with your Google Client ID
-- 5. Update config.js with your Supabase URL and Anon Key

-- =====================================================
-- GOOGLE OAUTH SETUP STEPS
-- =====================================================

-- 1. Go to Supabase Dashboard → Authentication → Providers
-- 2. Enable Google provider
-- 3. Go to https://console.cloud.google.com/
-- 4. Create a new project or select existing
-- 5. Enable Google+ API
-- 6. Create OAuth 2.0 Client ID (Web application)
-- 7. Add authorized redirect URI: https://[your-project-ref].supabase.co/auth/v1/callback
-- 8. Copy Client ID and Client Secret to Supabase
-- 9. Update manifest.json with Client ID
-- 10. Test authentication in your extension


