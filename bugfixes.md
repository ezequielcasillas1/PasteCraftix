### May 27, 2026 - AI history sync 400 ai_history_type_check
**Status:** SUCCESS
**Files:** db/migrations/20260521_refactor_tickets_and_ai_history_type.sql (applied to Supabase), db/supabase-schema.sql, extension/supabase/ai-history-sync.js
**Result:** Client saved `type: refactorization` but production CHECK only allowed summary/breakdown. Applied missing migration; constraint now includes refactorization + refactor_tickets table.

### May 21, 2026 - Floating widget missing after content-script split
**Status:** Fixed (pending reload test)
**Files:** content-script.js, background.js, content/content.js, content/widget/widget.js, manifest.json
**Result:** Phase C replaced monolithic content-script with `import` shim; Repo Loader manifest lacked `type: module`, so script parse failed and widget never init. Bootstrap now uses dynamic `import()` with repo-loader paths; content init waits for `document.body`; widget visibility fallback if storage is slow.

### May 21, 2026 - AI History load-more UX (user feedback)
**Status:** Fixed (pending verify)
**Files:** ai-lab.history.js, popup.html, popup.js, modals-shared.events.js
**Result:** User wanted numbered pages (1, 2, 3…) not cumulative Load More. Switched to page index + clips-style pagination bar.

### May 21, 2026 - Clip Share + Profile AI image CSP
**Status:** SUCCESS (user verified)
**Files:** popup.js, clips.share.js, clips.controller.js, clips.render.js, clips.events.js, supabase-client.js
**Result:** Share: refactor dropped `showShareMenuForClip` on `PasteCraftPopup`; category row called missing method (`TypeError`). Restored delegates + `clips.share.js`. Profile AI: `downloadAndUploadImage` fetched `data:image/...` URLs; MV3 CSP `connect-src` blocks `data:`. Route data URLs through `uploadDataUrlToProfileImages` (base64 decode, no fetch).

### May 21, 2026 - Supabase sync 42501 user_is_not_banned
**Status:** Fixed (verified)
**Files:** db/migrations/20260521_fix_sync_rls_grants.sql, extension/supabase-client.js
**Result:** Hardening revoked EXECUTE on `user_is_not_banned` used by restrictive `ban_gate_*` RLS; sync failed with 42501/401. Migration re-grants EXECUTE to authenticated, sets INVOKER, confirms archived_clips/ai_history grants. Client skips full sync without live JWT (bridge-only user caused anon RLS failures).

### May 21, 2026 - Popup delete toast + craft toggles regression
**Status:** Fixed (pending reload test)
**Files:** popup-ui.js, popup.js, clips.preview.js, clips.state.js, clips.service.js, craft-toolbar.events.js
**Result:** Chip × delete had no toast (`removeChip`); `showToast` accepts type again. Craft toggles called `updatePreviewFromSelection` on Clips tab and wiped preview/joiner UX; guarded to Categories-only + tab-aware preview updates.

### May 19, 2026 - Supabase hardening broke sync (user_is_not_banned)
**Status:** Fixed (pending reload test)
**Files:** db/migrations/20260519_fix_rls_helper_function_grants.sql (applied via MCP)
**Result:** Revoking EXECUTE on `user_is_not_banned` caused 403 on clips/settings/ai_history (`permission denied for function user_is_not_banned`). RLS ban_gate_* policies need authenticated EXECUTE. Also fixed `get_effective_access_state` uuid vs text (`user_subscriptions.user_id` is uuid).

### May 19, 2026 - Popup console fixes v2 (3.0.7)
**Status:** Fixed (pending reload test)
**Files:** popup.js, clips.service.js, background.js, sync.loader.js, manifest.json (3.0.7)
**Result:** `renderOpenRecentConversation` typeof guard + inline fallback; copy via execCommand then `pcCopyText` in SW; sync loader skips when context invalidated; reload from `extension/` folder required.

### May 19, 2026 - AI History not showing in popup
**Status:** Fixed (pending reload test)
**Files:** ai-lab.summary.js, ai-lab.history.js, ai-lab-page.events.js, auth.session.js, popup.js, manifest.json
**Result:** Open-recent only ran on summary reset, not on Summary tab/back-to-input; render now calls `loadAiHistory()` (cloud merge). History list renders Lucide icons. Startup preloads history. v3.0.7.

### May 19, 2026 - Post-reload popup console fixes
**Status:** Fixed (pending reload test)
**Files:** ai-lab.summary.js, ai-lab.constants.js, clips.viewer.js, clips.service.js, files.events.js, indexeddb-store.js
**Result:** Restored missing `renderOpenRecentConversation`; clip viewer copy uses `copyToClipboardFallback`; silenced files manage-btn warn when DOM absent; IDB `DB_VERSION` raised to 3 to match existing stores.

### May 19, 2026 - Files Feature Module Missing (Popup init crash)
**Status:** Fixed (pending reload test)
**Files:** extension/popup/features/files/* (restored from 0b3faad)
**Result:** `popup.js` imported `files.controller.js` but `extension/popup/features/files/` was missing on disk — `init()` failed. Restored 5 modules from git `0b3faad`.

### 2026-04-19 - Deleted Categories Resurrect Across Browsers
**Status:** SUCCESS
**Files:** extension/supabase-client.js, extension/popup.js, extension/indexeddb-store.js
**Result:** Root cause: a stale second browser (Edge) ran UP-sync with `deleted_at: null`, overwriting the tombstone Comet just set, and realtime resurrected the category. Fix: pre-fetch tombstoned ids from Supabase and filter them out of every UP-sync (categories/clips/archived/notes); make `deleteOperation` atomic across chrome.storage + IndexedDB (`deleteByIds`) + local `pc_deleted_*`; merge helpers now honor local tombstones too. One delete now sticks.

### 2026-02-20 - Device Sync Not Showing Remote Devices
**Status:** SUCCESS
**Files:** extension/supabase-client.js, extension/popup.js
**Result:** Root cause: devices were only registered when opening the device-sync modal, so device A never appeared to device B. Fix: auto-register device on authenticated popup init and before/while processing sync operations (throttled).

### 2026-02-20 - Custom Clip Upload Shows on Wrong Page
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Root cause: loadData() used IndexedDB when available; IndexedDB getAll() returns key order (oldest first), so new clips appeared on last page. Fix: (1) Sort clips by timestamp descending after load. (2) Set currentPage = 0 on save (manual, PDF, category modal) and on clipSaved (context menu). New clips now appear on first page.

### 2026-02-20 - Device Sync Panel Diff Authority Fix
**Status:** SUCCESS
**Files:** extension/supabase-client.js, extension/popup.js
**Result:** Replaced mixed clipboard-history/all-clips feed with one authoritative remote→target diff source (`getUniqueClipsFromRemoteDevice`), preventing stale or non-actionable sync rows.

### 2026-02-20 - Subscription Access State Accuracy
**Status:** SUCCESS
**Files:** extension/supabase-client.js, db/supabase-schema.sql, db/supabase-fixes.sql
**Result:** Added server-side effective access evaluation (`get_effective_access_state`) so premium/cloud-sync gating consistently honors subscription state, DEV4EVER coupon fields, and owner-only override.

### Feb 5, 2026 - Tips Widget Flicker on New Pages
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Prevented pre-settings render so the tips widget no longer flashes before stored settings apply.

### Feb 4, 2026 - 3-Digit PIN Persistence & Session Management
**Status:** SUCCESS
**Files:** extension/popup.js, extension/popup.html
**Result:** Fixed PIN not persisting after sign-in (currentUser set before save), added unlimited session mode, synced checkbox states, updated text consistency.

### Jan 25, 2026 - Messaging Errors (Missing Receiver/Tab)
**Status:** SUCCESS
**Files:** extension/background.js, extension/content-script.js
**Result:** Added safe messaging helpers + array normalization to prevent runtime messaging and null length errors.

### Jan 25, 2026 - Supabase set_config Request Flood
**Status:** SUCCESS
**Files:** extension/supabase-client.js
**Result:** Throttled set_config RPC and added backoff/in-flight dedupe to stop resource exhaustion errors.

### Jan 4, 2026 - Pre-publish Cleanup
**Status:** SUCCESS
**Files:** popup.js, website/pricing.html, content-script.js
**Result:** Removed debug/instrumentation (local ingest calls + debug UI) to prep for Edge Store publish.

### Jan 4, 2026 - Popup Instant Clip Refresh + Repo-Loader Paths
**Status:** SUCCESS
**Files:** extension/popup.js, extension/content-script.js, manifest.json, extension/manifest.json, extension/background.js
**Result:** Popup updates immediately after saving clips (no page refresh); fixed repo-root loader resource URLs; cleaned debug instrumentation.

### Jan 7, 2026 - Cross-tab Settings Sync (Auto Copy)
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Fixed auto-copy enabled/disabled not reflecting across tabs; added storage-based sync for widget/quick paste settings.

### Jan 7, 2026 - Albums Attachments Not Opening
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/attachment-viewer.html, extension/attachment-viewer.js
**Result:** Removed broken attachment copy UX in albums; attachments now open (popup default) with optional overlay/back mode.

### Jan 11, 2026 - Albums Reflect Updated Notes
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Albums now re-sync after note updates (save note or add clip), so new clips/URLs reflect immediately.

### Jan 11, 2026 - Album Viewer Missing Note Context + Copy
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Album viewer shows source note title/description/body per attachment and adds per-item quick copy.

### Jan 11, 2026 - Album Click Opens Full Note (Not Bundled)
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Clicking an album item opens the full source note overlay with clips/urls/images + per-item copy; attachment open is secondary.

### Jan 18, 2026 - Cross-device Sync + Duplicate Clip Fix
**Status:** SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js, extension/background.js, extension/popup.html
**Result:** Fixed transfer/sync stability + eliminated post-open duplicate clip rendering; removed all debug instrumentation/scripts (no commit yet).

### Jan 18, 2026 - Category Creation UI Lag
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Category folders render immediately (no waiting on cloud sync); added loading state on create buttons while background sync runs.

### Jan 18, 2026 - Profile Avatar Generation Hanging
**Status:** PARTIAL
**Files:** extension/supabase-client.js, extension/popup.js
**Result:** Fixed profile AI image calls to hit `ai-image` + added fetch timeouts so avatar generation can’t hang forever (better errors on timeout).

### Jan 19, 2026 - Clip Disappears After Refresh (Sync Backup Overwrites Local)
**Status:** SUCCESS
**Files:** extension/popup.js, extension/background.js
**Result:** Fixed refresh wiping newest clips by updating `pc_local_updatedAt` on saves so sync-transfer won’t overwrite local with stale sync backup.

### Jan 20, 2026 - Image Copy Not Saving to Clips
**Status:** SUCCESS
**Files:** extension/background.js
**Result:** Added image right-click actions (Copy Image / Copy Image Link) that save the image URL to clips reliably (browser native copy does not trigger auto-copy).

### Feb 4, 2026 - Auto-Copy Clips Not Appearing
**Status:** SUCCESS
**Files:** extension/background.js, extension/content-script.js, extension/popup.js
**Result:** Fixed undefined `normalizeArray` in background clip save path so auto-copied clips persist and show; instrumentation removed after verification.