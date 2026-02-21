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