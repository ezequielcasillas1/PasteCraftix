-- =====================================================
-- PasteCraft Supabase Database Schema
-- =====================================================
-- This schema provides real-time data storage and sync
-- for the PasteCraft Chrome Extension
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: user_profiles
-- =====================================================
-- Stores user profile information including AI-generated names and images
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL, -- Chrome extension user ID
    user_name TEXT,
    ai_generated_name TEXT,
    profile_image_url TEXT,
    profile_image_base64 TEXT, -- For uploaded photos
    generated_image_url TEXT,
    ai_generated_image BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- =====================================================
-- TABLE: clips
-- =====================================================
-- Stores clipboard items (active clips, max 20)
CREATE TABLE IF NOT EXISTS public.clips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    clip_id TEXT NOT NULL, -- Extension-generated ID
    text TEXT NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, clip_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON public.clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_category ON public.clips(category);
CREATE INDEX IF NOT EXISTS idx_clips_timestamp ON public.clips(timestamp DESC);

-- =====================================================
-- TABLE: archived_clips
-- =====================================================
-- Stores older clips (search-only storage, max 1000)
CREATE TABLE IF NOT EXISTS public.archived_clips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    clip_id TEXT NOT NULL,
    text TEXT NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    timestamp BIGINT NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, clip_id)
);

-- Indexes for search functionality
CREATE INDEX IF NOT EXISTS idx_archived_clips_user_id ON public.archived_clips(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_clips_text ON public.archived_clips USING gin(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_archived_clips_timestamp ON public.archived_clips(timestamp DESC);

-- =====================================================
-- TABLE: categories
-- =====================================================
-- Stores user-created clip categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    category_id TEXT NOT NULL, -- Extension-generated ID
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category_id),
    UNIQUE(user_id, name) -- Category names must be unique per user
);

-- Index for user categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- =====================================================
-- TABLE: settings
-- =====================================================
-- Stores user preferences and settings
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    auto_delete_period TEXT DEFAULT 'never',
    theme TEXT DEFAULT 'light',
    auto_hide BOOLEAN DEFAULT true,
    show_timestamps BOOLEAN DEFAULT true,
    max_clips_display INTEGER DEFAULT 20,
    delimiter TEXT DEFAULT 'comma',
    custom_delimiter TEXT DEFAULT ', ',
    deduplicate BOOLEAN DEFAULT false,
    sort BOOLEAN DEFAULT false,
    uppercase BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- VIEWS
-- =====================================================

-- View: user_clip_stats
-- Provides quick statistics for each user
CREATE OR REPLACE VIEW public.user_clip_stats AS
SELECT 
    p.user_id,
    p.user_name,
    COUNT(DISTINCT c.id) as active_clips_count,
    COUNT(DISTINCT a.id) as archived_clips_count,
    COUNT(DISTINCT cat.id) as categories_count,
    MAX(c.timestamp) as last_clip_timestamp
FROM public.user_profiles p
LEFT JOIN public.clips c ON p.user_id = c.user_id
LEFT JOIN public.archived_clips a ON p.user_id = a.user_id
LEFT JOIN public.categories cat ON p.user_id = cat.user_id
GROUP BY p.user_id, p.user_name;

-- View: category_clip_counts
-- Shows clip count per category per user
CREATE OR REPLACE VIEW public.category_clip_counts AS
SELECT 
    user_id,
    category,
    COUNT(*) as clip_count,
    MAX(timestamp) as last_updated
FROM (
    SELECT user_id, category, timestamp FROM public.clips
    UNION ALL
    SELECT user_id, category, timestamp FROM public.archived_clips
) combined
GROUP BY user_id, category
ORDER BY user_id, clip_count DESC;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: update_updated_at_column
-- Automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for settings
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function: auto_archive_old_clips
-- Moves clips beyond position 20 to archived_clips
CREATE OR REPLACE FUNCTION auto_archive_old_clips(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move clips beyond 20th position to archive
    WITH clips_to_archive AS (
        SELECT id, clip_id, text, category, timestamp
        FROM public.clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 20
    )
    INSERT INTO public.archived_clips (user_id, clip_id, text, category, timestamp)
    SELECT p_user_id, clip_id, text, category, timestamp
    FROM clips_to_archive
    ON CONFLICT (user_id, clip_id) DO NOTHING;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Delete archived clips from active table
    DELETE FROM public.clips
    WHERE id IN (
        SELECT id FROM public.clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 20
    );
    
    -- Keep only latest 1000 archived clips
    DELETE FROM public.archived_clips
    WHERE id IN (
        SELECT id FROM public.archived_clips
        WHERE user_id = p_user_id
        ORDER BY timestamp DESC
        OFFSET 1000
    );
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function: search_clips
-- Full-text search across active and archived clips
CREATE OR REPLACE FUNCTION search_clips(
    p_user_id TEXT,
    p_search_query TEXT,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    clip_id TEXT,
    text TEXT,
    category TEXT,
    "timestamp" BIGINT,
    is_archived BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.clip_id,
        c.text,
        c.category,
        c.timestamp,
        false as is_archived
    FROM public.clips c
    WHERE c.user_id = p_user_id
        AND (p_search_query IS NULL OR c.text ILIKE '%' || p_search_query || '%')
        AND (p_category IS NULL OR c.category = p_category)
    UNION ALL
    SELECT 
        a.clip_id,
        a.text,
        a.category,
        a.timestamp,
        true as is_archived
    FROM public.archived_clips a
    WHERE a.user_id = p_user_id
        AND (p_search_query IS NULL OR a.text ILIKE '%' || p_search_query || '%')
        AND (p_category IS NULL OR a.category = p_category)
    ORDER BY timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

-- clips policies
CREATE POLICY "Users can view their own clips"
    ON public.clips FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own clips"
    ON public.clips FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own clips"
    ON public.clips FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete their own clips"
    ON public.clips FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));

-- archived_clips policies
CREATE POLICY "Users can view their own archived clips"
    ON public.archived_clips FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own archived clips"
    ON public.archived_clips FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete their own archived clips"
    ON public.archived_clips FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));

-- categories policies
CREATE POLICY "Users can view their own categories"
    ON public.categories FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own categories"
    ON public.categories FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own categories"
    ON public.categories FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete their own categories"
    ON public.categories FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));

-- settings policies
CREATE POLICY "Users can view their own settings"
    ON public.settings FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own settings"
    ON public.settings FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own settings"
    ON public.settings FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.archived_clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;

-- =====================================================
-- SAMPLE DATA (for testing)
-- =====================================================
-- Uncomment to insert sample data

/*
-- Sample user
INSERT INTO public.user_profiles (user_id, user_name, ai_generated_name)
VALUES ('test_user_123', 'John Doe', 'JohnDragon');

-- Sample clips
INSERT INTO public.clips (user_id, clip_id, text, category, timestamp)
VALUES 
    ('test_user_123', 'clip_1', 'Hello World', 'Uncategorized', 1700000000000),
    ('test_user_123', 'clip_2', 'Sample code snippet', 'Code', 1700000001000);

-- Sample category
INSERT INTO public.categories (user_id, category_id, name, icon)
VALUES ('test_user_123', 'cat_1', 'Code', '💻');

-- Sample settings
INSERT INTO public.settings (user_id, theme, max_clips_display)
VALUES ('test_user_123', 'dark', 20);
*/

-- =====================================================
-- GRANTS (for anon and authenticated roles)
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- SCHEMA SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this schema in your Supabase SQL editor
-- 2. Update supabase-client.js to include sync methods
-- 3. Implement real-time listeners in popup.js
-- =====================================================



