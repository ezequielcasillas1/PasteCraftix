# PasteCraft Supabase Setup Guide

## Overview

This guide walks you through setting up Supabase as the backend for PasteCraft, enabling:
- **Real-time data sync** across devices
- **Cloud storage** for clips, categories, and user profiles
- **Automatic archiving** of older clips
- **Full-text search** across all saved clips
- **Secure access** with Row Level Security (RLS)

---

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Project Created**: Create a new Supabase project
3. **API Keys**: Have your `SUPABASE_URL` and `SUPABASE_ANON_KEY` ready

---

## Step 1: Run the Schema

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `supabase-schema.sql`
5. Click **RUN** to execute

This will create:
- ✅ 5 tables: `user_profiles`, `clips`, `archived_clips`, `categories`, `settings`
- ✅ 2 views: `user_clip_stats`, `category_clip_counts`
- ✅ 3 functions: `auto_archive_old_clips()`, `search_clips()`, `update_updated_at_column()`
- ✅ Row Level Security policies for all tables
- ✅ Realtime subscriptions enabled

---

## Step 2: Update Configuration

### Update `config.js`

Replace the placeholder values with your actual Supabase credentials:

```javascript
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'YOUR_SUPABASE_URL', // e.g., https://xxxxx.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY', // Your anon/public key
  },
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY',
  },
  replicate: {
    apiToken: 'YOUR_REPLICATE_TOKEN',
  }
};
```

**Where to find these:**
- **SUPABASE_URL**: Project Settings → API → Project URL
- **SUPABASE_ANON_KEY**: Project Settings → API → Project API keys → anon public

---

## Step 3: Database Schema Overview

### Tables

#### `user_profiles`
Stores user profile data including AI-generated names and profile images.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | Chrome extension user ID (unique) |
| `user_name` | TEXT | User's real name |
| `ai_generated_name` | TEXT | AI-generated funky name |
| `profile_image_url` | TEXT | Profile image URL |
| `profile_image_base64` | TEXT | Base64 of uploaded photo |
| `generated_image_url` | TEXT | AI-generated image URL |
| `ai_generated_image` | BOOLEAN | Whether image was AI-generated |

#### `clips`
Stores active clipboard items (max 20 per user).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User reference |
| `clip_id` | TEXT | Extension-generated ID |
| `text` | TEXT | Clip content |
| `category` | TEXT | Category name |
| `timestamp` | BIGINT | Unix timestamp (ms) |

#### `archived_clips`
Stores older clips for search-only access (max 1000 per user).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User reference |
| `clip_id` | TEXT | Extension-generated ID |
| `text` | TEXT | Clip content |
| `category` | TEXT | Category name |
| `timestamp` | BIGINT | Unix timestamp (ms) |

#### `categories`
Stores user-created clip categories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User reference |
| `category_id` | TEXT | Extension-generated ID |
| `name` | TEXT | Category name (unique per user) |
| `icon` | TEXT | Category emoji icon |

#### `settings`
Stores user preferences and extension settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User reference (unique) |
| `auto_delete_period` | TEXT | Auto-delete period (never/30days/7days) |
| `theme` | TEXT | UI theme (light/dark) |
| `auto_hide` | BOOLEAN | Auto-hide Quick Paste interface |
| `show_timestamps` | BOOLEAN | Show timestamps on clips |
| `max_clips_display` | INTEGER | Max clips to display |
| `delimiter` | TEXT | Delimiter type (comma/space/newline) |
| `custom_delimiter` | TEXT | Custom delimiter string |
| `deduplicate` | BOOLEAN | Remove duplicates when copying |
| `sort` | BOOLEAN | Sort alphabetically when copying |
| `uppercase` | BOOLEAN | Convert to uppercase when copying |

---

## Step 4: Key Functions

### `auto_archive_old_clips(p_user_id TEXT)`
Automatically moves clips beyond the 20th position to `archived_clips` and keeps only the latest 1000 archived clips.

**Usage:**
```sql
SELECT auto_archive_old_clips('user_123');
```

### `search_clips(p_user_id, p_search_query, p_category, p_limit)`
Full-text search across active and archived clips.

**Usage:**
```sql
SELECT * FROM search_clips('user_123', 'password', NULL, 50);
```

---

## Step 5: Realtime Subscriptions

All tables have realtime enabled. To listen for changes in your extension:

```javascript
// Example: Listen to clip changes
const clipChannel = pasteCraftSupabase.supabase
  .channel('clips')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'clips' }, 
    (payload) => {
      console.log('Clip changed:', payload);
      // Update UI accordingly
    }
  )
  .subscribe();
```

---

## Step 6: Row Level Security (RLS)

RLS is enabled on all tables to ensure users can only access their own data.

**How it works:**
- Before each query, set the user context:
```javascript
await supabase.rpc('set_config', {
  setting: 'app.current_user_id',
  value: currentUserId
});
```

- RLS policies will automatically filter all queries to show only that user's data

---

## Step 7: Testing Your Setup

### Test 1: Insert a User Profile
```sql
INSERT INTO public.user_profiles (user_id, user_name)
VALUES ('test_user_001', 'Test User')
RETURNING *;
```

### Test 2: Insert Clips
```sql
INSERT INTO public.clips (user_id, clip_id, text, category, timestamp)
VALUES 
  ('test_user_001', 'clip_001', 'Hello World', 'Uncategorized', 1700000000000),
  ('test_user_001', 'clip_002', 'Test clip', 'Work', 1700000001000)
RETURNING *;
```

### Test 3: Search Clips
```sql
SELECT * FROM search_clips('test_user_001', 'Hello', NULL, 10);
```

### Test 4: View Stats
```sql
SELECT * FROM user_clip_stats WHERE user_id = 'test_user_001';
```

---

## Step 8: Integration with Extension

The next phase involves updating `supabase-client.js` to include:

1. **Sync Methods:**
   - `syncClipsToSupabase(clips)` - Upload local clips to Supabase
   - `syncClipsFromSupabase()` - Download clips from Supabase
   - `syncUserProfile()` - Sync user profile data
   - `syncCategories()` - Sync categories
   - `syncSettings()` - Sync settings

2. **Realtime Listeners:**
   - `subscribeToClipChanges()` - Listen for clip updates
   - `subscribeToCategoryChanges()` - Listen for category updates

3. **Conflict Resolution:**
   - Timestamp-based conflict resolution
   - Merge local and remote changes

---

## Step 9: Migration Strategy

### Initial Sync (First-Time Users)
1. User opens extension
2. Check if Supabase profile exists
3. If not, create profile with Chrome user ID
4. Upload all local data (clips, categories, settings)

### Subsequent Syncs
1. On extension startup, fetch latest data from Supabase
2. Compare timestamps with local data
3. Merge changes (newest wins)
4. Upload any local changes made offline

### Realtime Updates
- Subscribe to realtime channels on extension startup
- Update UI immediately when changes detected
- Show sync status indicator in UI

---

## Step 10: Monitoring & Maintenance

### View Active Users
```sql
SELECT COUNT(*) FROM user_clip_stats;
```

### View Total Clips
```sql
SELECT 
  SUM(active_clips_count) as total_active,
  SUM(archived_clips_count) as total_archived
FROM user_clip_stats;
```

### Clean Up Old Archived Clips (for all users)
```sql
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM user_profiles LOOP
    PERFORM auto_archive_old_clips(user_record.user_id);
  END LOOP;
END $$;
```

---

## Security Best Practices

1. ✅ **Never expose service_role key** - Only use anon key in extension
2. ✅ **RLS is mandatory** - All tables have RLS enabled
3. ✅ **Validate user_id** - Always set context before queries
4. ✅ **Rate limiting** - Consider implementing API rate limits
5. ✅ **Input sanitization** - Validate all inputs before insertion

---

## Troubleshooting

### Issue: RLS blocking all queries
**Solution:** Ensure you're setting the user context:
```javascript
await supabase.rpc('set_config', {
  setting: 'app.current_user_id',
  value: currentUserId
});
```

### Issue: Realtime not working
**Solution:** Check that realtime is enabled:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.clips;
```

### Issue: Slow searches
**Solution:** Ensure indexes are created:
```sql
CREATE INDEX IF NOT EXISTS idx_clips_text 
ON public.clips USING gin(to_tsvector('english', text));
```

---

## Next Steps

1. ✅ Run `supabase-schema.sql` in Supabase SQL Editor
2. ⏳ Update `supabase-client.js` with sync methods
3. ⏳ Add realtime listeners to `popup.js`
4. ⏳ Implement conflict resolution logic
5. ⏳ Add sync status UI indicator
6. ⏳ Test with multiple devices

---

## Support

For issues or questions:
- Check [Supabase Documentation](https://supabase.com/docs)
- Review `supabase-schema.sql` comments
- Test queries in Supabase SQL Editor
- Monitor logs in Supabase Dashboard

---

**Schema Version:** 1.0  
**Last Updated:** 2025-11-01  
**Compatible with:** PasteCraft Extension v2.0+











