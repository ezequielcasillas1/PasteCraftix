### 2026-05-15 - Activity Log — Deleted Item Recovery
**Status:** ✅ SUCCESS
**Files:** `extension/indexeddb-store.js`, `extension/background.js`, `extension/popup/features/clips/clips.service.js`, `extension/popup/features/categories/categories.service.js`, `extension/popup/features/notes/notes.service.js`, `extension/popup/features/activity/activity.service.js`, `extension/popup/features/activity/activity.render.js`, `extension/popup/features/activity/activity.events.js`, `extension/popup.html`
**Result:** Implemented fully offline deleted item recovery. Items are saved to IndexedDB `deleted_items` on delete, pruned after 7 days (max 200 items). Activity Log merges local deletes with cloud audit log and provides a "Recover" button for DELETE operations. Recovery re-inserts items locally and queues them for cloud sync.

### Jan 2, 2025 - Manual Text Input for Clips
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, styles.css, background.js
**Result:** Added collapsible manual text input section below header, above tabs. Users can type/paste text directly, select category (defaults to Uncategorized), and save as clip. Includes save and clear buttons with proper validation. Quick View menu does NOT auto-show when saving from manual input. Category limits: Uncategorized = unlimited (∞), all other categories = 150 clips max. Updated all UI displays to show correct limits.

### Dec 25, 2025 - Clips Page "Send to Notes" Icon
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js
**Result:** Added "Send to Notes" icon to clips between AI Summary and Categories icons. Clean styling with no backgrounds/outlines. Opens album picker to send clips to notes/albums.

### Dec 25, 2025 - Search Page "Send to Notes" Icon
**Status:** ✅ SUCCESS
**Files:** popup.js
**Result:** Added "Send to Notes" icon to search results between AI Summary and Categories icons. Opens album picker to send clips to notes/albums.

### Dec 25, 2025 - Album Picker UX Enhancement
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js
**Result:** Added "Create New Album" button to album picker modal. Added back button navigation in note editor to return to album picker when creating notes/albums from picker flow.

### Dec 24, 2025 - Clip Joiner & Settings UI Enhancement
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js
**Result:** Renamed "Delimiter" to "Clip Joiner" with live example text (updates on selection). Renamed "Options" to "Clip Settings". Added info icons with modal pop-ups showing real-world use cases for both features.

### Dec 22, 2025 - Widget Panels Width Increase (Popup + Settings + Quick View)
**Status:** ✅ SUCCESS
**Files:** content-script.js, popup.html
**Result:** Increased slide-in panel width to ~1 inch wider (476px) + popup fills full width + clips list rows now stretch to the right (better room for more action icons). (Commit: pending)

### Dec 22, 2025 - Categories Multi-Select Bulk Copy/Delete (Bottom Actions)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Categories selections now preserve UI order, populate Crafted Output, and show bottom `copy | delete` for 1+ selected. (Commit: pending)

### Dec 22, 2025 - Crafted Output Editable (All Tabs)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Crafted Output textarea is editable; manual edits aren’t auto-cleared when no selection exists. (Commit: pending)

### Dec 22, 2025 - Search Multi-Select Copy Button (Bottom Bar)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Search shows a blue bulk copy button for 2+ selected results, placed below results and above delimiter; copies in UI order. (Commit: pending)

### Dec 22, 2025 - Clips Quick Multi-Select Delete Button
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Clips tab shows red Delete Selected button for 2+ selected, placed below Quick Copy and above pagination. (Commit: pending)

### Dec 20, 2025 - Premium Access & Subscription Management

**Status:** ✅ PARTIAL SUCCESS

**Files:** supabase-client.js, website/account.html, supabase/functions/stripe-webhook/index.ts

**Result:** 
- Fixed premium access check to recognize coupon codes (`has_unlimited_ai` field)
- Fixed account page to show "Change Plan" and "Cancel Subscription" buttons for paid users
- Fixed "Upgrade to Paid Plan" button for coupon-only users
- Identified and documented Stripe webhook bug (`onConflict: 'user_id'` already fixed)
- User can now access AI features with dev4ever coupon code
- Buttons display correctly based on subscription status

**Critical Discovery:**
- Stripe payments succeed but webhook fails to record in database
- `create-portal-session` function not deployed (Cancel button shows CORS error)
- System NOT production ready for accepting real payments

**Next Steps Required:**
1. Install Supabase CLI (manual step - see PRODUCTION_DEPLOYMENT.md)
2. Deploy Edge Functions to Supabase
3. Configure Stripe webhook endpoint
4. Test full payment/cancellation flow
5. User needs to cancel current subscription via Stripe email link
