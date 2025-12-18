# Supabase Storage Setup for Profile Images

## 🚨 CRITICAL: Missing Storage Bucket

The AI-generated profile images are **not persisting** because the Supabase Storage bucket `profile-images` does not exist.

### Root Cause Analysis

**What's Happening:**
1. AI generates image → DALL-E returns **temporary URL** (expires in 2 hours)
2. Code attempts to upload to Supabase Storage → **FAILS** (`StorageApiError: Bucket not found`)
3. Fallback returns temporary URL
4. Image displays for ~2 hours, then **disappears** when URL expires

**Evidence from Console:**
```
❌ Upload error: StorageApiError: Bucket not found
❌ Failed to convert temporary URL to permanent
⚠️ Returning original temporary URL as fallback
```

---

## ✅ FIX: Create Storage Bucket

### Step 1: Create the Bucket (Manual - Supabase Dashboard)

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your PasteCraft project

2. **Navigate to Storage**
   - Click **Storage** in the left sidebar
   - Click **"Create a new bucket"** button

3. **Configure Bucket Settings**
   ```
   Bucket Name:        profile-images
   Public bucket:      ✅ YES (check this box)
   File size limit:    5 MB
   Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp
   ```

4. **Click "Create bucket"**

---

### Step 2: Run SQL Fixes

1. **Open SQL Editor**
   - In Supabase Dashboard → SQL Editor
   - Create new query

2. **Copy and paste `supabase-fixes.sql`**
   - This adds the missing `set_config()` RPC function
   - This adds Storage RLS policies for the bucket

3. **Click RUN**

---

### Step 3: Choose RLS Policy Type

**Option A: With Supabase Auth** (Recommended if using auth)
- Use the default policies in `supabase-fixes.sql`
- Requires users to authenticate via Supabase Auth
- Most secure option

**Option B: Without Auth** (For Chrome Extension IDs)
- Uncomment the "ALTERNATIVE" policies in `supabase-fixes.sql`
- Allows uploads with Chrome extension user IDs
- More permissive but works with current setup

**Current Setup Uses:** Chrome extension IDs (not Supabase Auth)
**Recommended:** Use Option B (ALTERNATIVE policies)

---

### Step 4: Verify Setup

Run these verification queries in Supabase SQL Editor:

```sql
-- 1. Check bucket exists
SELECT * FROM storage.buckets WHERE name = 'profile-images';
-- Expected: 1 row with bucket details

-- 2. Check set_config function exists
SELECT proname, pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'set_config' AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row showing set_config(TEXT, TEXT)

-- 3. Check storage policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
-- Expected: Multiple policies for profile-images
```

---

### Step 5: Test in Extension

1. **Open PasteCraft extension**
2. **Generate AI profile image**
   - Upload a photo OR generate animal avatar
3. **Check browser console** for:
   ```
   ✅ Generated funky Wolf avatar! Converting to permanent URL...
   ✅ Image downloaded, size: XXXXX bytes
   ✅ Upload successful
   ✅ Permanent URL obtained: https://blpngeeqcegquiydreyu.supabase.co/storage/v1/...
   ```

4. **Verify in Supabase Dashboard**
   - Storage → profile-images bucket
   - You should see uploaded image files

---

## 🔍 Additional Issues Found

### Issue #2: RLS Policy Violations

**Error:**
```
❌ Failed to sync user profile to Supabase: 'new row violates row-level security policy for table "user_profiles"'
```

**Cause:** The `set_config` RPC function was missing, so user context wasn't set properly.

**Fix:** Running `supabase-fixes.sql` adds the missing function.

---

### Issue #3: Missing RPC Function

**Error:**
```
POST .../rest/v1/rpc/set_config 404 (Not Found)
```

**Cause:** The function wasn't defined in original schema.

**Fix:** Running `supabase-fixes.sql` creates the function.

---

## 📋 Summary

**Problems:**
1. ❌ Storage bucket `profile-images` doesn't exist
2. ❌ RPC function `set_config()` missing
3. ❌ Storage RLS policies not configured

**Solutions:**
1. ✅ Manually create bucket in Supabase Dashboard
2. ✅ Run `supabase-fixes.sql` to add RPC function
3. ✅ Run `supabase-fixes.sql` to add Storage RLS policies

**Result:**
- AI-generated images will upload to permanent Supabase Storage URLs
- Images persist indefinitely (no expiration)
- Works in developer mode AND production
- Works across browser restarts

---

## 🎯 To Answer Your Original Question

**Q:** Does it need to be production store for it to work? Or should it work in developer mode via Edge?

**A:** It should **definitely work in developer mode**. The issue is NOT related to developer vs production mode. The issue is:
1. Supabase Storage bucket missing (backend configuration)
2. Missing RPC function (backend configuration)

Extension storage APIs (`chrome.storage.local`) work identically in both modes. The problem was purely backend setup.

---

**Status:** Ready to fix once you complete the 5 steps above.
**Estimated Time:** 5 minutes
**Files Modified:** None (only Supabase backend configuration)


