### Aug 14, 2026 - Category clip selected highlight glitchy
**Status:** PARTIAL (pending user verify)
**Files:** theme-blue-phase2.css, popup.html, tests/category-clip-selected-theme.test.mjs
**Result:** Blue theme had hover but no `.category-clip.selected`, so hover beat the electric popup fill and native text selection showed on MD/title. Full-row dark-navy selected now beats hover; `user-select: none`.

### Aug 14, 2026 - Clip images blank (chrome.storage 10MB)
**Status:** SUCCESS
**Files:** clip-images.js, clip-images.idb.js, clip-images.cloud.js, capture.clip-save.js, clips.commands.js, clips.handler.js, sync-clips.*, storage-migrations.js
**Result:** Root cause was chrome.storage.local 10MB quota, not Supabase wipe. IDB-first + migrate `pc_clip_img_v1_*`; cloud `clip-images` bucket + `clips.image_url`. Quota text: You have reached the limits of the providing local storage. User verified images after reload + recapture.

### Aug 14, 2026 - Image Picker Opera site permission
**Status:** FAILURE
**Files:** grant-site-access.html, grant-site-access.js, popup/features/site-access/*, optional-permissions.js, capture.handler.js, widget.capture-menu.js, popup.html, popup.boot.js
**Result:** Opera ERR_BLOCKED_BY_CLIENT on grant tab. Popup Allow site access also failed in user test. Image Picker still blocked. Bottleneck.

### Aug 14, 2026 - Image Picker needs site permission
**Status:** FAILURE (Opera; grant-tab + popup paths)
**Files:** grant-site-access.html/js, widget.capture-menu.js, optional-permissions.js, capture.handler.js, message-types.js
**Result:** Packed MV3 cannot prompt from content/SW. Grant page `permissions.request` on click; SW `tabs.create` opens it. `<all_urls>` stays optional.

### Aug 14, 2026 - Clip viewer dropped picked image
**Status:** PARTIAL (pending re-capture verify)
**Files:** clips.viewer.js, clip-images.js, capture.clip-save.js, clips.commands.js, clips.handler.js, sync-clips.merge/map.js
**Result:** Old clips have no image bytes (`imgKeyCount: 0`). Viewer now always looks up store. Save no longer sends multi-MB dataUrl on saveClip — stashes pending, attaches after clip id. Re-capture required for old clips.


**Status:** FIXED (pending deploy + verify)
**Files:** website/public/js/reset-password.js, website/src/pages/reset-password.astro
**Result:** CSP `script-src 'self'` on `/reset-password*` blocked inline JS (meter/submit never bound). Moved logic to external `/js/reset-password.js`; `[hidden]` restored so form stays hidden until recovery session ready.

### Aug 3, 2026 - Store rejected 3.0.29 re-upload
**Status:** FIXED (packet)
**Files:** extension/manifest.json → 3.0.30, releases/pastecraft-v3.0.30.zip
**Result:** Store already has 3.0.29; strict bump to 3.0.30. Drop ghost fix retained in widget.drag-capture.js.

### Aug 3, 2026 - Ghost Drop UI on video pages
**Status:** PARTIAL
**Files:** extension/content/widget/widget.drag-capture.js
**Result:** Drop box mounted eagerly + opacity-only hide left orphans/ghosts mid-page. Now lazy, display:none+orphan sweep, show only while clickAndDrag drag active.

### Aug 3, 2026 - AI Summary white cards on blue theme
**Status:** PARTIAL
**Files:** theme-blue-phase2.css, popup.html
**Result:** Dark blue premium overrides for reference image, follow-up, clips overview; follow-up base CSS restored (styles.css unlinked).

### Jul 11, 2026 - Quick View empty (CSP / iframe)
**Status:** SUCCESS
**Files:** extension/content/widget/widget.quickview.js, widget.styles.js, widget.events.js, extension/shared/quickview-clips.js
**Result:** DOM-rendered Quick View panel fixes empty sync when host CSP blocked srcdoc and extension iframes.
### Jul 10, 2026 - PDF OCR for scanned docs
**Status:** BOTTLENECK
**Files:** clips.pdf.js
**Result:** Scanned PDFs (e.g. Breuer dictionary) are image-only; pdf.js extracts 0 text. Full OCR deferred → request.md §38b. Instrumentation removed. UX: scan notice + paste-to-preview.

### Jul 10, 2026 - PDF scanned image-only (Breuer dictionary)
**Status:** PARTIAL
**Files:** clips.pdf.js, popup.html, styles.css
**Result:** Confirmed PDF has no text layer (itemCount 0 + image ops). Save correctly blocked. Added scanned-PDF notice + paste-to-preview path; OCR not implemented.

**Status:** PARTIAL
**Files:** clips.pdf.js, popup.html
**Result:** Save button was hard-disabled when pdf.js found no text. Fixed mode-aware enable state, editable preview, save uses preview edits, tab/mode changes re-enable save.

### Jul 10, 2026 - PDF intake failed (upload/scan)
**Status:** PARTIAL
**Files:** extension/lib/pdf.min.js, extension/lib/pdf.worker.min.js, clips.pdf.js, scripts/prepare-extension-libs.mjs, package.json
**Result:** Root cause: pdf.js libs were 0-byte placeholders (gitignored). Restored v3.11.174 assets, added npm run prepare:libs, clearer errors for missing libs and image-only scans.

### Jun 23, 2026 - Merchant Etsy Options preset row alignment
**Result:** Preset popover shows provider rows but columns misalign on Etsy Options UI; fix flex/grid in dock-styles + listing-dock markup.

### Jun 21, 2026 - AI Refactor Haiku primary / GPT-4o fallback
**Status:** SUCCESS
**Files:** supabase/functions/_shared/ai_workflow.ts, ai-refactor/index.ts, ai-lab.credits.js, ai-lab.constants.js
**Result:** Refactor primary model switched from gpt-4o-mini to Claude Haiku (`claude-3-5-haiku-latest`); API failure or unchanged retry uses GPT-4o only (no 4o-mini). Credit gate stays 40 cr (anthropic default). User confirmed SUCCESS.

### Jun 21, 2026 - AI Refactor unchanged text / mapSize=0
**Status:** SUCCESS
**Files:** supabase/functions/ai-refactor/index.ts, ai-functions.js, ai-lab.magic.js, ai-lab.credits.js
**Result:** Root cause: edge used gpt-5-nano (cheapest) and often returned identical text; client skipped map entry → no sibling/link. Fixed: default model (4o-mini), stronger rewrite prompt, retry pass on unchanged, expanded skip diagnostics (outcome, lengths, previews). Credit gate 40 cr. User confirmed SUCCESS.

### Jun 21, 2026 - AI Refactor mapSize=0 no sibling / silent skip
**Status:** SUPERSEDED (see unchanged text entry above)
**Files:** ai-lab.magic.js, ai-lab.credits.js, ai-lab.refactorization.js, ai-lab.credit-error.js, ai-functions.js, popup.js
**Result:** mapSize=0 when AI text equals original (diagnostic outcome unchanged/identical_text). Added skipSummaries log, outcome-specific toasts, pre-call credit gate (25 cr), credit pill refresh after AI attempt, 402 → "Need more AI credits".

### Jun 21, 2026 - AI Refactorization produces no text change
**Status:** SUPERSEDED (see mapSize=0 entry above)
**Files:** ai-functions.js, ai-lab.magic.js, popup.js
**Result:** Earlier pass: rethrow failures, pipeline logs, access gate with purchased credits.

### Jun 21, 2026 - AI Refactorization clip list stale after sync
**Status:** SUCCESS
**Files:** ai-lab.refactorization.js, clips.service.js, auth.session.js, sync.listener.js, popup-messaging.js, popup.js, ai-lab.magic.js
**Result:** maybeRefreshRefactorizationPanel on clip mutations, storage, sync, and messages; eligible clips sorted newest-first. User confirmed SUCCESS.### Jun 17, 2026 - Profile photo upload not working
**Status:** SUCCESS (code path verified; user UI verify pending)
**Files:** profile.events.js, clips-shell.events.js, popup.html
**Result:** Upload handlers only bound on first profile open; file input not cloned with button. Fixed early bind at popup init, clone both controls, reset input value, optimization fallback, updated Step 2 copy.

### Jun 17, 2026 - Profile name saves wiped / not visible
**Status:** SUCCESS (user verified)
**Files:** profile.storage.js, profile.render.js, profile.account-info.js, profile-sync.js, realtime.js, full-sync.js, extension/shared/profile-merge.js, popup.html
**Result:** Cloud merge wiped local names; name upsert nulled image cols. Fixed local-first merge, name-only upsert, UI refresh, Account funky name row. User confirmed SUCCESS.

### Jun 17, 2026 - Profile names UX (display vs AI funky name)
**Status:** SUCCESS (user verified)
**Files:** extension/popup.html, profile.storage.js, profile.generators.js, profile.render.js, profile.account-info.js
**Result:** Split profile name section into two labeled blocks (display name vs optional AI funky name), clearer button labels, display name priority in top bar. Removed debug instrumentation.

### Jun 17, 2026 - Save real name does not update display name
**Status:** SUCCESS (user verified)
**Files:** extension/popup/features/profile/profile.render.js, profile.account-info.js, profile.storage.js
**Result:** Top bar preferred aiGeneratedName over userName. Fixed userName-first priority; refresh account info after save.

### Jun 17, 2026 - AI name generation failed (503 on ai-name)
**Status:** SUCCESS (user verified)
**Files:** extension/supabase/ai-functions.js, extension/popup/features/profile/profile.generators.js, supabase/functions/ai-name
**Result:** Supabase logs: POST ai-name 503 (platform boot failure). Client only fell back on 404. Fixed 502/503 fallback to generate-ai-name, surfaced error in toast, redeployed ai-name v6 with shared deps.

### Jun 17, 2026 - Clips pagination Lucide icons disappear
**Status:** SUCCESS (user verified)
**Files:** extension/popup/features/clips/clips.render.js
**Result:** Clicking pagination page numbers re-rendered chips but never painted Lucide placeholders (Google `<img>` unaffected). Mutation observer partial flush missed chips. Fixed with `renderLucideIconsSync(container)` after sync render and lazy load.

### Jun 17, 2026 - Category not appending to list after create (H1 IDB overwrite)
**Status:** SUCCESS (user verified)
**Files:** extension/shared/categories-local-merge.js, extension/popup/features/sync/sync.loader.js, categories.service.js, categories.render.js, categories.events.js
**Result:** Create wrote chrome.storage; loadData IDB branch replaced categories with stale IDB snapshot. Fixed with mergeActiveCategoriesSources union-by-id LWW merge (same pattern as clips-local-merge). User confirmed SUCCESS.

### Jun 17, 2026 - Category creation cancel stuck "Creating..." button
**Status:** SUCCESS (user verified)
**Files:** extension/popup/features/categories/categories.service.js, categories.render.js, categories/events.js
**Result:** Canceling category creation left "Creating..." disabled. try/finally resets loading; prompt cancel aborts create; modal close clears createNewCategory loading. User confirmed SUCCESS.

### Jun 16, 2026 - Lucide icon flicker (boot, tab switch, CRUD)
**Status:** SUCCESS (user verified)
**Files:** popup-icons.js, popup.init.js, tab-nav.events.js, auth.session.js, pastecraft-crud.js, files.render.js
**Result:** Boot triple-pass and tab innerHTML wiped SVGs before icon sync. Single boot pass, scoped tab flush, CRUD hooks, rendering guards. User confirmed SUCCESS.

### Jun 16, 2026 - Full sync spurious settings/profile skip warnings
**Status:** PENDING USER VERIFY
**Files:** extension/supabase/full-sync.js, extension/supabase/sync-settings.js, extension/supabase/realtime.js
**Result:** Settings/profile used global `pc_local_updatedAt` guard (false positive when clips/cleanup bump timestamp during long sync). Settings also wrote to unused `settings` key instead of flat storage keys. Fixed with `settingsUpdatedAt` LWW merge, flat payload via `toSettingsStoragePayload`, profile merge always applies; warn downgraded to debug for legitimate local-newer settings.

### Jun 16, 2026 - Quick View delete resurrected drag-drop clips from IDB
**Status:** SUCCESS (user verified)
**Files:** extension/background/shared.js, extension/background/handlers/messages-internal.js, extension/popup/shared/popup-messaging.js, extension/popup/features/clips/clips.title.js
**Result:** deleteQuickViewClip removed storage only; merged IDB clips reappeared in Quick View/Clips. Fixed with syncClipsToIndexedDb, syncDeletedClips queue, merged index lookup, popup clipsUpdated refresh, title-edit IDB mirror. User confirmed SUCCESS.

### Jun 16, 2026 - Clips page stale after widget drag-drop save
**Status:** SUCCESS (user verified)
**Files:** extension/shared/clips-local-merge.js, extension/background/shared.js, extension/popup/features/sync/sync.loader.js, extension/popup/shared/popup-messaging.js
**Result:** Drag-drop used saveTextDirectly (chrome.storage only); popup loadData preferred stale IndexedDB over fresh storage. Fixed with merge-by-id, background IDB mirror + sync queue, popup IDB mirror on clipSaved. User confirmed SUCCESS.

### Jun 16, 2026 - Quick View Menu not loading (srcdoc postMessage)
**Status:** SUCCESS (user verified)
**Files:** extension/content/widget/widget.js, extension/background/shared.js, extension/background/handlers/messages-internal.js
**Result:** srcdoc postMessage targetOrigin was `"null"` → loadClips failed. Fixed with `'*'` + source validation; `pcDeleteQuickViewClip` tombstones; iframe selector for storage refresh. User confirmed SUCCESS.

### Jun 16, 2026 - Lucide icon lag / flicker (popup + all tabs)
**Status:** SUCCESS (user verified)
**Files:** extension/popup/shared/popup-icons.js, popup/features/app/popup.boot.js, popup.html
**Result:** Icons blank then pop in on open/tab switch. Double `startPopup` + 12-icon rAF batches caused multi-frame delay. Sync flush, boot guard, placeholder visibility CSS. User confirmed SUCCESS.

### Jun 2, 2026 - Quick Save stale category list
**Status:** PENDING USER VERIFY
**Files:** categories.render.js, categories.service.js, sync.listener.js, tab-nav.events.js
**Result:** Quick Save showed stale/deleted categories from clips; new categories missing after CRUD. Dropdown now follows `app.categories` with refresh on CRUD/sync.

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

### 2026-08-02 - Image Clip Copy Not Pasting Into Chat Boxes
**Status:** SUCCESS
**Files:** extension/clipboard-writer.html, extension/clipboard-writer.js, extension/shared/clipboard-image.js, extension/background/handlers/capture.handler.js, extension/background/messaging/message-types.js, extension/shared/offscreen-clipboard-channel.js, extension/offscreen-clipboard.js
**Result:** Image clips now copy as real image/png via a tiny focused helper window (popup Permissions-Policy blocked, offscreen focus-blocked, SW dynamic import fixed); chat paste verified by user.

### 2026-08-02 - Picked image missing from AI summary history
**Status:** PENDING USER VERIFY
**Files:** ai-lab.summary-modal.js, ai-lab.summary.js, ai-lab.history.js, ai-lab.history.persist.js, ai-lab.history.render.js, ai-lab.history.continue.js, extension/supabase/ai/ai-history-sync.js, extension/popup.js
**Result:** Root cause: saveAiHistory never stored currentSummaryImageBase64. Now persisted on entry + first thread (quota-capped 640px JPEG), shown in history modal/list badge, restored on continue, round-trips cloud sync via threads JSON (no schema change).

### 2026-08-03 - AI History modal still missing Reference image
**Status:** PENDING USER VERIFY
**Files:** ai-history-sync.js, ai-lab.history.js, ai-lab.session-state.js, auth.session.js, ai-lab.summary.js, ai-lab.summary-modal.js, popup.html, popup.js
**Result:** Cloud merge wiped local imageBase64; save path reloaded+merged before write; session did not restore image. Fix: preserve local images on merge, strip images from cloud upsert, local-only load on save, session restore image+activeId, CSS force-show history preview, open-modal backfill.
