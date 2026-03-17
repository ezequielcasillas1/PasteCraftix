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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    content_hash TEXT,
    UNIQUE(user_id, clip_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON public.clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_category ON public.clips(category);
CREATE INDEX IF NOT EXISTS idx_clips_timestamp ON public.clips(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_clips_deleted_at ON public.clips(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clips_content_hash ON public.clips(content_hash);
CREATE INDEX IF NOT EXISTS idx_clips_device_id ON public.clips(device_id);

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    content_hash TEXT,
    UNIQUE(user_id, clip_id)
);

-- Indexes for search functionality
CREATE INDEX IF NOT EXISTS idx_archived_clips_user_id ON public.archived_clips(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_clips_text ON public.archived_clips USING gin(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_archived_clips_timestamp ON public.archived_clips(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_archived_clips_deleted_at ON public.archived_clips(deleted_at);

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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    UNIQUE(user_id, category_id),
    UNIQUE(user_id, name) -- Category names must be unique per user
);

-- Index for user categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);

-- =====================================================
-- TABLE: notes
-- =====================================================
-- Stores notes + albums (synced, append-only history via note_versions)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    note_id TEXT NOT NULL, -- Extension-generated ID
    note_type TEXT NOT NULL DEFAULT 'note', -- 'note' | 'album'
    title TEXT,
    description TEXT,
    body TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, -- clips/images/urls for notes
    note_refs JSONB DEFAULT '[]'::jsonb, -- note ids for albums
    source_note_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    updated_ms BIGINT,
    content_hash TEXT,
    UNIQUE(user_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON public.notes(deleted_at);

-- =====================================================
-- TABLE: note_versions
-- =====================================================
-- Immutable snapshots for notes (history)
CREATE TABLE IF NOT EXISTS public.note_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    note_id TEXT NOT NULL,
    version_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    snapshot JSONB NOT NULL,
    device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_versions_user_id ON public.note_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON public.note_versions(note_id);

-- =====================================================
-- TABLE: device_sync_state
-- =====================================================
-- Tracks per-device sync state (multi-device reconciliation)
CREATE TABLE IF NOT EXISTS public.device_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sync_ms BIGINT,
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_sync_user_id ON public.device_sync_state(user_id);

-- =====================================================
-- TABLE: clipboard_history
-- =====================================================
-- Stores cross-device clipboard events for cloud clipboard UI sync
CREATE TABLE IF NOT EXISTS public.clipboard_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, content)
);

CREATE INDEX IF NOT EXISTS idx_clipboard_history_user_id ON public.clipboard_history(user_id);
CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at ON public.clipboard_history(created_at DESC);

-- =====================================================
-- TABLE: pastecraft_devices
-- =====================================================
-- Registry of known user devices with globally synced display names
CREATE TABLE IF NOT EXISTS public.pastecraft_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    display_name TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_pastecraft_devices_user_id ON public.pastecraft_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_pastecraft_devices_last_seen_at ON public.pastecraft_devices(last_seen_at DESC);

-- =====================================================
-- TABLE: audit_log
-- =====================================================
-- Append-only audit for user data mutations
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    data JSONB,
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON public.audit_log(entity_type);

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
-- AI_HISTORY TABLE
-- =====================================================
-- Stores AI conversation history (summaries, breakdowns)
-- Content persists regardless of subscription status (view always allowed)
CREATE TABLE IF NOT EXISTS public.ai_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    history_id BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('summary', 'breakdown')),
    title TEXT,
    threads JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE(user_id, history_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON public.ai_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_type ON public.ai_history(type);
CREATE INDEX IF NOT EXISTS idx_ai_history_deleted_at ON public.ai_history(deleted_at);

-- =====================================================
-- VIEWS
-- =====================================================

-- View: user_clip_stats
-- Provides quick statistics for each user
CREATE OR REPLACE VIEW public.user_clip_stats AS
SELECT 
    p.user_id,
    p.user_name,
    COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) as active_clips_count,
    COUNT(DISTINCT a.id) FILTER (WHERE a.deleted_at IS NULL) as archived_clips_count,
    COUNT(DISTINCT cat.id) as categories_count,
    MAX(c.timestamp) FILTER (WHERE c.deleted_at IS NULL) as last_clip_timestamp
FROM public.user_profiles p
LEFT JOIN public.clips c ON p.user_id = c.user_id
LEFT JOIN public.archived_clips a ON p.user_id = a.user_id
LEFT JOIN public.categories cat ON p.user_id = cat.user_id AND cat.deleted_at IS NULL
GROUP BY p.user_id, p.user_name;

-- View: category_clip_counts
-- Shows clip count per category per user
CREATE OR REPLACE VIEW public.category_clip_counts AS
SELECT 
    user_id,
    category,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as clip_count,
    MAX(timestamp) FILTER (WHERE deleted_at IS NULL) as last_updated
FROM (
    SELECT user_id, category, timestamp, deleted_at FROM public.clips
    UNION ALL
    SELECT user_id, category, timestamp, deleted_at FROM public.archived_clips
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

-- Function: get_effective_access_state
-- Server-authoritative access evaluation including owner override.
CREATE OR REPLACE FUNCTION public.get_effective_access_state(p_user_id TEXT)
RETURNS TABLE (
    is_owner BOOLEAN,
    is_premium BOOLEAN,
    has_cloud_sync BOOLEAN,
    source TEXT
) AS $$
DECLARE
    v_tier TEXT;
    v_status TEXT;
    v_has_unlimited BOOLEAN;
    v_ai_expires TIMESTAMP WITH TIME ZONE;
    v_coupon_access BOOLEAN;
    v_paid_premium BOOLEAN;
    v_paid_sync BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR auth.uid()::text <> p_user_id THEN
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
    WHERE user_id = p_user_id
    LIMIT 1;

    v_coupon_access := v_has_unlimited OR (v_ai_expires IS NOT NULL AND v_ai_expires > NOW());
    v_paid_premium := (v_tier IN ('premium', 'admin') AND v_status = 'active');
    v_paid_sync := (v_tier IN ('basic', 'premium', 'admin') AND v_status IN ('active', 'past_due'));

    is_owner := (p_user_id = '5a9d4f09-9473-4df6-82cc-1094c84ae438');
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

-- Trigger for clips
CREATE TRIGGER update_clips_updated_at
    BEFORE UPDATE ON public.clips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for archived_clips
CREATE TRIGGER update_archived_clips_updated_at
    BEFORE UPDATE ON public.archived_clips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for categories
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for notes
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pastecraft_devices
CREATE TRIGGER update_pastecraft_devices_updated_at
    BEFORE UPDATE ON public.pastecraft_devices
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
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastecraft_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid()::text = user_id);

-- clips policies
CREATE POLICY "Users can view their own clips"
    ON public.clips FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own clips"
    ON public.clips FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own clips"
    ON public.clips FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own clips"
    ON public.clips FOR DELETE
    USING (auth.uid()::text = user_id);

-- archived_clips policies
CREATE POLICY "Users can view their own archived clips"
    ON public.archived_clips FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own archived clips"
    ON public.archived_clips FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own archived clips"
    ON public.archived_clips FOR DELETE
    USING (auth.uid()::text = user_id);

-- categories policies
CREATE POLICY "Users can view their own categories"
    ON public.categories FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own categories"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own categories"
    ON public.categories FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own categories"
    ON public.categories FOR DELETE
    USING (auth.uid()::text = user_id);

-- settings policies
CREATE POLICY "Users can view their own settings"
    ON public.settings FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own settings"
    ON public.settings FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own settings"
    ON public.settings FOR UPDATE
    USING (auth.uid()::text = user_id);

-- clipboard_history policies
CREATE POLICY "Users can view their own clipboard history"
    ON public.clipboard_history FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own clipboard history"
    ON public.clipboard_history FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- pastecraft_devices policies
CREATE POLICY "Users can view their own pastecraft devices"
    ON public.pastecraft_devices FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own pastecraft devices"
    ON public.pastecraft_devices FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own pastecraft devices"
    ON public.pastecraft_devices FOR UPDATE
    USING (auth.uid()::text = user_id);

-- ai_history policies (view always allowed regardless of subscription)
CREATE POLICY "Users can view their own ai history"
    ON public.ai_history FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own ai history"
    ON public.ai_history FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own ai history"
    ON public.ai_history FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own ai history"
    ON public.ai_history FOR DELETE
    USING (auth.uid()::text = user_id);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.archived_clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sync_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clipboard_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pastecraft_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_history;

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
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- SCHEMA SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this schema in your Supabase SQL editor
-- 2. Update supabase-client.js to include sync methods
-- 3. Implement real-time listeners in popup.js
-- =====================================================



