
### Jul 20, 2026 - Clips delete IDB verify recovery
**Status:** SUCCESS
**Files:** clips.service.js, pastecraft-crud.js
**Commits:** fix/clips-delete-idb-verify (recover f937d80 + 02a3e70 onto main)
**Result:** Restored stranded delete verify + null-id filter; clips delete persists. User verified.

### Jul 20, 2026 - Image Picker capture channel + Scholar Merchant gate
**Status:** SUCCESS
**Files:** capture.handler.js, capture.region.js, capture.constants.js, popup.boot.js, qp.events.js, product-line-gate.js, content.js, widget.image-to-text.js, merchant.controller.js, first-party-cursor-models.mdc
**Result:** Image Picker preview works again; popup no longer steals pcCaptureRegion; Scholar defaults Merchant off. User verified.

### Jul 17, 2026 - Restore AI markup vendor libs
**Status:** SUCCESS
**Files:** scripts/prepare-extension-libs.mjs, extension/lib/* (local via prepare:libs)
**Result:** Extended prepare:libs for marked/purify/highlight/katex/mermaid; AI chat no longer falls back to monospace pre. User verified.

### Jul 13, 2026 - Capture Tools tooltip left + no em dash
**Status:** SUCCESS
**Files:** widget.styles.js, capture.stats.js
**Result:** Tooltip left-aligned like other widget tips; hides when Spot/Image menu open; copy uses colon not em dash. User verified.

### Jul 12, 2026 - Offline mode banner (getClipIdKey)
**Status:** SUCCESS
**Files:** clips.state.js, popup.js, popup.init.js, sync.loader.js
**Result:** Popup init threw ReferenceError (export-only getClipIdKey); fixed import+export. Offline banner gone; clips load. User verified.

### Jul 11, 2026 - Help/info premium blue polish
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, settings.render.js
**Result:** Settings help icon visible; Help & Clip Joiner/Settings example modals use navy glass instead of white cards. User verified.

### Jul 11, 2026 - Categories blue loader cascade (follow-up)
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, popup.html, tab-loading.js, files.render.js
**Result:** Blue premium loading cascade on Categories; files track clears correctly. User verified SUCCESS.
### Jul 11, 2026 - Popup tab loading screens
**Status:** SUCCESS
**Files:** tab-loading.js, popup.tab-lifecycle.js, liked.render.js, popup.html, theme-blue-phase2.css
**Result:** First-visit tab loading icons; Categories files loader no longer stuck; blue premium loading UI. User verified.

### Jul 10, 2026 - Popup startup and tab performance pass
**Status:** SUCCESS
**Files:** popup.tab-lifecycle.js, popup.init.js, clips.render.js, sync.loader.js, resource-loader.js, popup-icons.js, tests/popup-*-performance.test.mjs
**Result:** Cached tab activation, deferred startup cloud work, truthful hydration states, lazy PDF/Mermaid. PR #129 merged @ bf2c4ce; 41/41 tests pass.

### Jul 9, 2026 - AI Lab Blue Dark Mode premium grade
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, popup.html
**Result:** AI Lab Phase 3D navy glass + white-on-blue contrast (tabs, cards, summary, rf/bd panels); fixed credit-buy CSS brace. User verified.

### Jun 23, 2026 - Tags max options button with provider presets
**Status:** SUCCESS
**Files:** merchant.listing-dock.js, merchant.constants.js, merchant.dock-storage.js, merchant.dock-styles.js
**Result:** Options control beside Tags label opens preset popover; Etsy/Shopify/Printify/Custom limits persist in merchant prefs and drive validation, hints, and tag queue cap.

### Jun 23, 2026 - Scrollable tag presets list + more providers + Custom
**Status:** SUCCESS
**Files:** merchant.listing-dock.js, merchant.dock-styles.js, merchant.constants.js
**Result:** Preset list scrolls in popover; additional provider caps wired; Custom opens numeric limit entry with persisted preference.

### Jun 23, 2026 - Smart tag paste + batch delimiter removal
**Status:** SUCCESS
**Files:** merchant.tags.js, merchant.dock-storage.js, merchant.listing-dock.js, merchant.tag-queue.js, merchant.constants.js
**Result:** Batch delimiter only affected copy export, not clipboard import. Smart paste now normalizes Perplexity/AI tag lists on From clipboard and field paste into Etsy-valid comma-separated tags. Batch delimiter UI removed.

### Jun 23, 2026 - Merchant Phase 2 Listing Dock + Pulse
**Status:** SUCCESS
**Files:** merchant.dock-storage.js, merchant.pulse.js, merchant.listing-dock.js, merchant.dock-styles.js, merchant.layout.js, merchant.controller.js
**Result:** Ephemeral 24h staging dock + Pulse in top strip; Shadow DOM panel; Spot stages selection. User-approved commit on feat/merchant-phase-2-3.

### Jun 23, 2026 - Merchant Phase 3 Etsy tag validation + Test Lab
**Status:** SUCCESS
**Files:** merchant.tags.js, merchant.listing-dock.js, merchant.spot.js, merchant.constants.js, merchant-test-lab/*
**Result:** Tags-only default dock UI; 13×20 preview chips; dedupe on save; Test Lab mock Etsy/Printify/generic pages. User-approved commit on feat/merchant-phase-2-3.

### Jun 22, 2026 - Custom Search popup module overhaul
**Status:** SUCCESS
**Files:** clips.custom-search.module.js, clips.custom-search.service.js, clips.action-menu.js, popup.html, popup.js, tests/custom-search.test.mjs
**Result:** Dual-input popup module replaces saved-search modal; highlight + question ? Google on active tab. Fixed formatClipViewerPlainText.call(app) open crash. User verified SUCCESS.

**Status:** SUCCESS
**Files:** ai-refactor/index.ts, ai_workflow.ts, ai-functions.js, ai-lab.magic.js, clips.viewer.js, clip-viewer.css, popup.html, auth.js
**Result:** Haiku primary / GPT-4o fallback; sibling links + resolver; Original+Refactored viewer. User confirmed SUCCESS. main @ d206cc0.

### Jun 21, 2026 - AI refactor replace-on-re-refactor
**Status:** SUCCESS
**Files:** ai-lab.magic.js, clips.viewer.js, popup.html, clip-viewer.css, request.md
**Result:** Removed Revert button; re-refactor uses original source and replaces prior sibling clip + local link registry.

### Jun 21, 2026 - Header clip count on all tabs
**Status:** SUCCESS
**Files:** extension/popup.html, clips.render.js, clips.selectors.js, clips.constants.js, popup.js, tab-nav.events.js, sync.storage.js
**Result:** Header shows total clips next to Synced across tabs. User confirmed SUCCESS.

### Jun 21, 2026 - AI Refactorization list refresh on clip changes
**Status:** SUCCESS
**Files:** ai-lab.refactorization.js, clips.service.js, auth.session.js, sync.listener.js, popup-messaging.js, popup.js, ai-lab.magic.js
**Result:** Refactor panel clip list stays in sync after CRUD and cloud refresh. User confirmed SUCCESS.### Jun 17, 2026 - Profile photo upload
**Status:** SUCCESS
**Files:** profile.events.js, clips-shell.events.js, popup.html
**Result:** Upload Photo button did not open file picker after modal re-open; fixed by cloning button + input, initProfileImageUpload at popup init, type=button on upload btn. User confirmed SUCCESS.

### Jun 17, 2026 - Profile names (display + funky save + UX)
**Status:** SUCCESS
**Files:** profile.storage.js, profile.render.js, profile.account-info.js, profile-sync.js, realtime.js, full-sync.js, extension/shared/profile-merge.js, popup.html, ai-functions.js
**Result:** Split display vs AI name UI; fixed save wipe from cloud merge and name-only upsert; top bar shows display name, funky name in Account card. User confirmed SUCCESS.

### Jun 17, 2026 - Clips pagination Lucide icons disappear
**Status:** SUCCESS
**Files:** extension/popup/features/clips/clips.render.js
**Result:** Pagination re-render left `<i data-lucide>` placeholders unpainted; Google icon unaffected. Added explicit `renderLucideIconsSync(container)` after renderChips and lazyLoadClipsPage. User confirmed SUCCESS.

### Jun 17, 2026 - Category not appending to list after create (H1 IDB overwrite)
**Status:** SUCCESS
**Files:** extension/shared/categories-local-merge.js, extension/popup/features/sync/sync.loader.js, categories.service.js, categories.render.js, categories.events.js
**Result:** New categories saved to chrome.storage but popup loadData preferred stale IndexedDB, overwriting fresh writes. Fixed with mergeActiveCategoriesSources (LWW by id/timestamp) in fetchRawData. User confirmed SUCCESS.

### Jun 17, 2026 - Category creation cancel stuck "Creating..." button
**Status:** SUCCESS
**Files:** extension/popup/features/categories/categories.service.js, categories.render.js, categories/events.js
**Result:** "Creating..." button stayed disabled after canceling new category prompt. Fixed with try/finally loading reset, prompt cancel aborts create, modal close clears createNewCategory loading. User confirmed SUCCESS.

### Jun 16, 2026 - Lucide icon flicker (boot, tab switch, CRUD)
**Status:** SUCCESS
**Files:** popup-icons.js, popup.init.js, popup.boot.js, tab-nav.events.js, auth.session.js, pastecraft-crud.js, files.render.js, popup.html
**Result:** Icons flashed on popup open, tab switch, and CRUD DOM updates. Fixed with single boot pass (`finishBootLucideIcons`), scoped tab-panel flush, CRUD icon hooks, boot/tab rendering guards, placeholder CSS. User confirmed SUCCESS.

### Jun 16, 2026 - Drag-and-drop widget CRUD (delete/update gaps closed)
**Status:** SUCCESS
**Files:** extension/background/shared.js, extension/background/handlers/messages-internal.js, extension/popup/shared/popup-messaging.js, extension/popup/features/clips/clips.title.js, bugfixes.md, implementations.md
**Result:** Quick View delete now purges IDB + enqueues Supabase tombstones + clipsUpdated popup refresh; title edits mirror IDB. Create/read already on unified save pipeline. User confirmed SUCCESS.

### Jun 16, 2026 - Drag-and-drop widget save ? Clips page sync architecture
**Status:** SUCCESS
**Files:** extension/shared/clips-local-merge.js, extension/background/shared.js, extension/popup/features/sync/sync.loader.js, extension/popup/shared/popup-messaging.js, bugfixes.md
**Result:** Widget drag-drop only wrote chrome.storage; Clips page preferred stale IndexedDB. Fixed with merge-by-id/timestamp, IDB mirror + sync queue on widget save, clipSaved refresh path. User confirmed SUCCESS.

### Jun 16, 2026 - Quick View Menu loading in Stable Architect
**Status:** SUCCESS
**Files:** widget.js, shared.js, messages-internal.js, bugfixes.md
**Result:** Quick View srcdoc iframe postMessage used invalid targetOrigin `"null"` ? loadClips failed. Fixed with `'*'` + e.source validation; added `pcDeleteQuickViewClip` CRUD delete with tombstones; fixed iframe selector for storage refresh. User confirmed SUCCESS.

### Jun 16, 2026 - Lucide icon lag / flicker on popup open
**Status:** SUCCESS
**Files:** popup-icons.js, popup.boot.js, popup.html, manifest.json
**Result:** Icons disappeared then popped in across tabs. Root cause: double boot + batched rAF rendering (12 icons/frame). Fixed with single boot guard, sync flush for ?120 icons, larger batches, CSS hide on placeholders until SVG. User confirmed SUCCESS.
**Status:** SUCCESS
**Files:** notes.album-interlaying.editor.js, notes.album.js, popup.html, notes.controller.js, notes.events.js, popup.js
**Result:** Album attachment Edit opens inline modal instead of full note editor. Edits persist album-local via updateAlbumInterlaying. User confirmed successful.

### Jun 11, 2026 - One-click copy + local profile image
**Status:** SUCCESS
**Files:** popup.html, clips.render.js, clips-shell.events.js, settings.storage.js, profile.events.js, profile-sync.js, ai-lab-page.events.js
**Result:** One-click copy toggle on Clips tab (under tab bar); persisted in quickPasteSettings. Clip click copies when enabled. Removed AI Lab gallery/upload UI; single profile image stored locally only (no Supabase Storage). User verified.

### Jun 8, 2026 - Text-only AI credits + upload gallery
**Status:** SUCCESS
**Files:** stripe-webhook/index.ts, ai_workflow.ts, ai-image/index.ts, popup.html, profile/*, billing.constants.js, site.js, pricing.astro, upgrade.astro
**Result:** Removed AI image generation; kept manual upload/gallery/profile/widget flows. Enhanced text credits: 4k weekly rollover to 20k, 35k monthly, 500k yearly. Commit 60b0921.

### Jun 5, 2026 - Clip action icons â?? Google search + bundle menus
**Status:** SUCCESS
**Files:** clips.render.js, clips.action-menu.js, clips.events.js, popup.html, google-logo.svg
**Result:** User reloaded extension; Google logo button and org/AI bundle menus appear on clip rows. Issue was stale unpacked build, not missing code.

### Jun 4, 2026 - Google search action on clip icons
**Status:** SUCCESS
**Files:** clips.action-menu.js, clips.render.js, clips.events.js, clips.viewer.js, modals-shared.events.js, popup.js, popup.html, google-logo.svg
**Result:** Google logo on clip action surfaces opens menu with vague/meaning search options; URLs open in Google. User verified ("it works! good job").

### Jun 2, 2026 - AI Summary stale context on new clip
**Status:** SUCCESS
**Commit:** ce02d27 on main
**Files:** extension/popup/features/ai-lab/ai-lab.session-state.js, ai-lab.summary-modal.js
**Result:** clearSummaryAiContext resets old Q&A/threads when sending new clips to AI Summary. User verified.

### May 22, 2026 - Widget lazy popup warm + offline banner contention fix
**Status:** SUCCESS
**Commit:** TBD on main
**Files:** extension/content/widget/widget.js
**Result:** Disabled eager warmPopupIframe on every tab (caused multi-tab popup init contention + 10s watchdog/offline banner). Lazy warm on widget logo hover only. Verified: popup init 1965ms, reveal 464ms, no watchdog, purple loader shows, no white flash. User verified.

### May 22, 2026 - Widget popup preload + settings Shadow DOM + loading shell
**Status:** SUCCESS
**Commit:** 6b3ec8b on feature/widget-popup-preload-settings-shadow
**Files:** extension/content/widget/widget.js
**Result:** Warm hidden iframe for in-page popup panel; settings panel in closed Shadow DOM; loader gradient paints immediately via inline shell styles and iframe stays visibility:hidden until reveal â?? removes white blank flash before spinner.

### May 21, 2026 - AI avatar 3D quality + security hardening + animal deck
**Status:** SUCCESS
**Commit:** 5e7dc12 on main
**Files:** supabase/functions/ai-image/index.ts, extension/supabase/ai-functions.js, security-gate, admin-api/alerts, ai-name, migrations 20260521â??20260523, extension/content/safety, extension/shared/animal-names.js, animals.ts, manifest 3.0.9
**Result:** Restored premium 3D avatar prompts (no flat outlines, quality high). P0-P3 security: RLS, cron auth, JWT gates, site-guard, Shadow DOM. Funky animal deck cycle. ai-image edge deployed. User verified.

### May 21, 2026 - Production release v3.0.8
**Status:** SUCCESS
**Commit:** 3296842, merge 8a3bef2 on main
**Branch:** feature/craft-clips-ai â?? main (PR #1)
**Files:** extension/* (manifest 3.0.8), ai-lab.*, vertical slice refactor, releases/pastecraft-v3.0.8.zip
**Result:** Craft Clips AI, refactorization panel, AI history pagination, popup/background/content/supabase vertical slices. User verified all SUCCESS. Ready for Chrome + Edge store upload.

### May 21, 2026 - AI Lab Refactorization panel + tab sizing
**Status:** SUCCESS
**Files:** ai-lab.refactorization.js, ai-lab.magic.js, ai-lab.controller.js, ai-lab.history.js, ai-lab-page.events.js, auth.session.js, popup.html, popup.js
**Result:** AI Refactorization entry below Generator/Gallery/Summary; clip picker + level chips + Refactorization button; Craft Clips alternate path. Generator/Gallery/Summary tabs scaled to feature-card touch targets. User verified.

### May 21, 2026 - Craft Clips AI + refactor sibling clips
**Status:** SUCCESS
**Commit:** bb3410d, 88a981b on feature/craft-clips-ai
**Files:** ai-lab.magic.js, ai-lab.craft-clips.constants.js, ai-lab.craft-clips.settings.js, clips.render.js, supabase-client.js, ai-refactor/, ai_workflow.ts, popup.html, craft-toolbar.events.js, categories.service.js, styles.css
**Result:** Craft Clips (#47): AI Formatted/Refactoring, settings, dedupe archive. Refactor no longer replaces originalâ??new refactored clip in recents. User verified.

### May 21, 2026 - Clip row Share + Open delegates
**Status:** SUCCESS
**Files:** clips.share.js, clips.controller.js, clips.events.js, clips.render.js, popup.js
**Result:** Refactor dropped `showShareMenuForClip` on `PasteCraftPopup`; Share threw TypeError. Extracted share overlay module; restored thin delegates for open/viewer/share. User verified.

### May 21, 2026 - Profile AI image data URL CSP
**Status:** SUCCESS
**Files:** extension/supabase-client.js
**Result:** `downloadAndUploadImage` no longer fetches `data:image/...`; routes through `uploadDataUrlToProfileImages` (base64 decode). MV3 `connect-src` CSP fix for random AI / profile image flow. User verified.

### May 21, 2026 - AI History load-more pagination
**Status:** SUCCESS
**Files:** ai-lab.history.js, ai-lab.constants.js, popup.html, modals-shared.events.js, tab-nav.events.js, popup.js
**Result:** AI History tab shows 7 entries; Load More reveals next 7 (max 50). Button hidden when total â?¤7. User verified.

### May 21, 2026 - Popup orchestrator trim (batch 3 close-out)
**Status:** SUCCESS
**Files:** popup.js, popup.boot.js, popup.features.js, popup.init.js, ai-lab.analysis-history.js, ai-lab.summary.js, clips.state.js, categories.service.js, profile.generation-timer.js, profile.controller.js
**Result:** Extracted analysis history, boot/messaging, feature loader registry, selection helpers, profile AI timer; removed dead code. popup.js ~1898 â?? ~1549 lines. User verified.

### May 21, 2026 - Supabase sync RLS grants + session guard
**Status:** SUCCESS
**Files:** db/migrations/20260521_fix_sync_rls_grants.sql, extension/supabase-client.js
**Result:** Re-granted EXECUTE on `user_is_not_banned` for ban_gate RLS (42501 fix). `performFullSync` skips without live JWT. User verified.

### May 21, 2026 - Popup refactor final slice (init, auth, AI, profile)
**Status:** SUCCESS
**Files:** popup.init.js, auth.callbacks.js, auth.password-strength.js, billing.unsubscribe.js, profile.ai-image.js, profile.viewer.js, ai-lab.breakdown.js, ai-lab.summary-modal.js, popup-icons.js, popup.js, popup.html, auth/billing/profile/ai-lab controllers
**Result:** Startup, auth callbacks, password UI, unsubscribe, profile AI/viewer, breakdown/summary modals, Lucide boot extracted. popup.js ~2979 â?? ~1898 lines. User verified.

### May 21, 2026 - Popup refactor batch 3
**Status:** SUCCESS
**Files:** extension/popup/features/clips/clips.pdf.js, clips.title.js, billing.upgrade-ui.js, ai-lab.bulk.js, ai-lab.session-state.js, clips.controller.js, billing.controller.js, ai-lab.controller.js, extension/popup.js
**Result:** PDF, billing upgrade UI, clip titles, AI bulk, session state extracted; popup.js ~621 lines slimmer

### 2026-05-19 - Notes Delete Persistence
**Status:** SUCCESS
**Files:** extension/popup/features/notes/notes.service.js, extension/popup/features/notes/notes.render.js, extension/popup.js
**Commits:** fix/notes-delete-persistence (9ded1ed)
**Result:** Deletes persist across tab switch and storage refresh. IDB hard-delete + pc_deleted_notes tombstone + loadNotes filter. User verified.

### 2026-05-19 - Popup setupEventListeners Extraction
**Status:** SUCCESS
**Files:** extension/popup/popup.events.js, extension/popup/events/*.events.js, extension/popup.js, auth.events.js, tests/popup-events-smoke.test.mjs
**Commits:** refactor/popup-events-extraction (cd03746)
**Result:** ~1130 lines moved from popup.js into event modules. npm test popup-events smoke passes. popup.js reduced ~1.1k lines.

### 2026-05-19 - Git Branch Alignment Workflow
**Status:** SUCCESS
**Files:** .cursor/rules/git-commit-branch-alignment.mdc, .cursor/rules/git-workflow.mdc
**Commits:** docs/git-commit-branch-alignment (f1b52eb)
**Result:** Agent rule: branch name must match commit diff. Work split off fix/activity-history-html-escape into fix/ and refactor/ branches.



### 2026-05-15 - Activity Log â?? Deleted Item Recovery
**Status:** SUCCESS
**Files:** 
- `extension/indexeddb-store.js`
- `extension/background.js`
- `extension/popup/features/clips/clips.service.js`
- `extension/popup/features/categories/categories.service.js`
- `extension/popup/features/notes/notes.service.js`
- `extension/popup/features/activity/activity.service.js`
- `extension/popup/features/activity/activity.render.js`
- `extension/popup/features/activity/activity.events.js`
- `extension/popup.html`
**Result:** Implemented fully offline deleted item recovery. Items are saved to IndexedDB `deleted_items` on delete, pruned after 7 days (max 200 items). Activity Log merges local deletes with cloud audit log and provides a "Recover" button for DELETE operations. Recovery re-inserts items locally and queues them for cloud sync.

### 2026-05-15 - Files and Category Migration
**Status:** SUCCESS
**Files:** db/migrations/20260515_add_category_files.sql, extension/popup/features/files/*, extension/background.js, extension/popup.js
**Result:** Implemented files feature and category files migration

### 2026-05-16 - Widget Sidebar Tooltip Fix
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Replaced slide+fade tooltip animation with clean fade-only; dark background; all: initial + !important guards prevent host page CSS (chess.com etc.) from breaking tooltips. Commit d491256.

### June 15, 2026 - Clip Viewer Lucide Icons
**Status:** SUCCESS
**Files:** extension/popup.html, extension/styles/clip-viewer.css, extension/popup/features/clips/clips.viewer.js
**Result:** Unified clip viewer footer with Lucide pc-ai-icon-btn toolbar; Copy+Done adjacent; trailing icon alignment fixed via scoped CSS overrides.

### [June 21, 2026] - AI Formatted grammar guards + Craft Clips Beta
**Status:** SUCCESS
**Files:** supabase/functions/ai-format/index.ts, extension/popup/features/ai-lab/ai-lab.magic.js, extension/popup.html, extension/popup.js, extension/popup/events/craft-toolbar.events.js, extension/popup/features/ai-lab/ai-lab.refactorization.js, extension/styles.css, tests/popup-events-smoke.test.mjs, instructions/request.md
**Result:** Edge + client grammar guards reject AI filler/expansion; Craft Clips Beta badge shipped and magic undo UI removed; request.md #57 documents future grammar API. Branches fix/ai-format-grammar-guards @ fe4cd54, feat/craft-clips-formatted-beta @ 72db1a3, docs/grammar-api-craft-clips @ 5ec32ab merged to main @ 82c3585 and pushed.

### Jun 25, 2026 - Merchant tag queue chip submit
**Status:** SUCCESS
**Files:** extension/content/merchant/merchant.tag-submit.js, extension/content/merchant/merchant.tag-queue.js
**Result:** Etsy chip tag paste+Enter commit and queue auto-advance verified; debug probes removed before commit.

### [Jul 9, 2026] - Blue Dark Mode Phase 3 (Remaining Surfaces)
**Status:** SUCCESS
**Files:** extension/assets/styles/theme-blue-phase2.css, extension/content/merchant/merchant.spot.js
**Result:** Phase 3 completes blue dark mode across remaining surfaces ? merchant spot, clip-title, primitives, and search styles. theme-blue-phase2.css ships all scoped variables and overrides.

### [Jul 9, 2026] - Restore feat/blue-dark-mode (white Clip Joiner)
**Status:** SUCCESS
**Files:** checkout feat/blue-dark-mode @ 492f8a1; discarded main WIP theme-blue-phase2.css
**Result:** White bottom Clip Joiner/Settings fixed by restoring Phase 3 branch; incomplete main WIP removed.

### [Jul 9, 2026] - Widgets Tab (Embed Gallery)
**Status:** SUCCESS
**Files:** extension/popup/features/widgets/*, popup.html, tab-nav.events.js, theme-blue-phase2.css, tests/widgets-parse.test.mjs
**Result:** Embed gallery tab between Notes and AI History; iframe in-popup preview; script widgets open live via data URL; gallery Open live + panel blur; debug removed.

### [Jul 11, 2026] - Activity History HTML escape
**Status:** SUCCESS
**Files:** activity.render.js
**Result:** Escape clip text in activity rows so feed no longer nests/breaks.

### [2026-07-11] - Quick View DOM sync
**Status:** SUCCESS
**Files:** widget.quickview.js, widget.styles.js, widget.events.js, quickview-clips.js, background/shared.js, manifest.json
**Result:** Quick View renders in content-script DOM instead of iframe/srcdoc so clips sync and display under strict host CSP.
