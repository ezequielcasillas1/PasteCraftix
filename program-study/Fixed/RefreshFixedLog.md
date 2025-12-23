# PasteCraft - Fixed Issues Log

All issues that have been resolved and fixed are documented here.

---

### [Dec 23, 2025] - Website View Tint Overlay Regression (In-Page Panels)
**Status:** SUCCESS ✅
**Files:** content-script.js
**Result:** Removed dimming/backdrop tint and made in-page panels non-blocking so users can interact with the website while Popup/Settings/Quick View are open.

---

### [November 23, 2025] - Category Clip Counts Not Updating in Real-Time
**Status:** SUCCESS ✅
**Files:** popup.js, background.js
**Result:** Fixed category counts showing stale data (1/25 instead of 3/25) when clips added. Root cause: (1) saveTextWithCategory() missing renderCategories() call after save. (2) No auto-reload on tab switches. Fix: Added renderCategories() after clip saves, implemented auto-reload for all tabs (clips, categories, search) on tab switch to ensure fresh data display.

---

### [November 20, 2025] - Generate Questions Button Word Minimum
**Status:** SUCCESS ✅
**Files:** popup.js
**Result:** Fixed Generate Questions button requiring 20 words minimum (blocking valid single sentences). Changed to 5-word minimum matching AI Breakdown validation. User can now generate questions from one sentence (15 words).

---

### [November 17, 2025] - Quick View & Follow-up Level Tabs
**Status:** SUCCESS ✅
**Files:** content-script.js, popup.js
**Result:** Fixed two bugs: (1) Quick view menu no longer auto-opens when visiting websites - only shows on explicit user action via context menu. (2) Follow-up level style tabs now auto-submit when clicked instead of requiring separate Send button click.

---

### November 16, 2025 - AI Thread Pagination System Not Visible
**Status:** SUCCESS ✅  
**Files:** popup.html, styles.css  
**Result:** Fixed invisible pagination boxes that should appear after 2nd follow-up in AI Summary and Breakdown. **Root Cause:** (1) Summary - Copy button placed AFTER pagination in HTML, preventing proper right-alignment in flex layout. (2) Breakdown - CSS positioned pagination with `top: -48px` placing it outside visible area. **Fix:** (1) Reordered Summary HTML to place copy button BEFORE pagination. (2) Moved Breakdown pagination between tabs and content, changed from absolute to flex-end positioning. Pagination now visible and properly aligned right in both locations.

### November 13, 2025 - Animal Avatar Button Greyed Out Bug
**Status:** SUCCESS ✅
**Files:** popup.js, supabase-client.js
**Result:** Fixed Animal Avatar button staying disabled with valid AI names. Root cause: `updateAIGenerateButtonState()` had outdated regex pattern (23 animals) while generator used expanded list (70+ animals). Button stayed disabled when AI generated new animals like Otter, Sloth, Griffin, etc. Synced both regex patterns to include all 70+ animals. Also fixed typo "Racoon" → "Raccoon".

### November 12, 2025 - "Last: NaNd ago" Display Bug
**Status:** SUCCESS ✅
**Files:** popup.js
**Result:** Fixed "NaNd ago" bug in header. Root cause was property name mismatch - clips have `timestamp` property, but `updateLastCapture()` was trying to access non-existent `date` property. Changed `lastClip.date` to `lastClip.timestamp` and consolidated duplicate `getTimeAgo()` functions. Added validation to handle invalid timestamps gracefully.

### November 12, 2025 - AI Lab Tab Click Detection
**Status:** SUCCESS ✅
**Files:** popup.js
**Result:** Fixed unresponsive tab clicks by using `closest()` method to handle clicks on nested span elements (emojis/text) inside tab buttons. Changed from direct target check to parent element traversal.

## ✅ FIXED: AI Gallery - Set as Profile & Pagination Not Working

**Date Fixed:** November 11, 2025

**Root Cause:**
- Inline `onclick` event handlers not working reliably with dynamically generated HTML
- Using `innerHTML` to create buttons with `onclick="pasteCraftPopup.method()"` causes context/scope issues
- Event handlers not properly bound to DOM elements after dynamic rendering

**Symptoms:**
- "Set as Profile" button (👤) didn't update profile image
- Pagination buttons (Page 2, 3, etc.) were not clickable
- No errors in console, buttons simply didn't respond to clicks

**The Fix:**
1. Replaced inline `onclick` attributes with `data-*` attributes
2. Implemented event delegation using `addEventListener` on parent containers
3. Added `setupGalleryEventListeners()` for gallery action buttons
4. Added `setupPaginationEventListeners()` for pagination buttons
5. Used `e.target.closest()` for proper event bubbling handling

**Files Modified:**
- `popup.js`: Replaced onclick handlers with event delegation (+35 lines)

**Key Code Changes:**
```javascript
// Before: <button onclick="pasteCraftPopup.setAsProfile(1)">
// After:  <button data-action="set-profile" data-index="1">

// Event delegation
galleryGrid.addEventListener('click', (e) => {
  const button = e.target.closest('.ai-gallery-action-btn');
  if (button) this.setAsProfile(parseInt(button.dataset.index));
});
```

**Status:** ✅ FIXED - Both features now working correctly

---

## ✅ FIXED: AI-Generated Profile Images Not Persisting (Temporary URLs Expiring)

**Date Fixed:** November 9, 2025

**Root Cause:**
- Supabase Storage bucket `profile-images` **did not exist**
- Missing RPC function `set_config()` for RLS policies
- AI-generated images returned **temporary DALL-E URLs** (expire in 2 hours) as fallback
- Images saved to `chrome.storage.local` with temporary URLs → displayed fine initially
- URLs expired after 2 hours → images disappeared

**Diagnostic Evidence:**
```
❌ Upload error: StorageApiError: Bucket not found
❌ Failed to convert temporary URL to permanent
⚠️ Returning original temporary URL as fallback
profileImageUrl: 'https://oaidalleapiprodscus.blob.core.windows.net/...' (TEMPORARY)
```

**The Fix:**
1. Created `supabase-fixes.sql` with missing `set_config()` RPC function
2. Created `SUPABASE_STORAGE_SETUP.md` with step-by-step bucket setup instructions
3. Added Storage RLS policies for `profile-images` bucket
4. User must manually create bucket in Supabase Dashboard (cannot be done via SQL)

**Files Created:**
- `supabase-fixes.sql`: SQL fixes for RPC function + Storage policies
- `SUPABASE_STORAGE_SETUP.md`: Complete setup guide with verification steps

**Status:** Fix ready, requires manual Supabase Dashboard configuration (5 minutes)

**Verification:** After setup, permanent URLs will be: `https://[project].supabase.co/storage/v1/object/public/profile-images/...`

---

## ✅ FIXED: AI-Generated Profile Images Disappear After Clearing Cache/Cookies

**Date Fixed:** November 8, 2025

**Root Cause:**
- Profile WAS being synced from Supabase in `performFullSync()`, but timing issue prevented UI update
- Sequence: `loadUserProfile()` → UI renders (no image) → `performBackgroundSync()` → profile synced from Supabase → UI never updated
- The profile image URL was successfully restored to local storage, but the UI didn't know to refresh

**The Fix (in popup.js):**
1. Added profile reload + UI update in `performBackgroundSync()` after sync completes (lines 137-142)
2. Added profile reload in `setupVisibilityListener()` when popup becomes visible (line 158)
3. Added storage change listener for profile changes to update UI in real-time (lines 187-196)

**Files Modified:**
- `popup.js`: Updated 3 locations to reload profile and update UI after sync

---

**Last Updated:** November 9, 2025


