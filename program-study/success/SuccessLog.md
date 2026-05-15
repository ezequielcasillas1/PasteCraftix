### May 9, 2026 - Notes Duplicate Sync + Ordering Fix
**Status:** SUCCESS
**Commit:** pending
**Files:** extension/supabase-client.js, extension/popup/features/notes/notes.service.js, extension/popup/features/notes/notes.editor.js, extension/popup/features/notes/notes.render.js
**Result:** Fixed duplicate album note sync by normalizing note IDs, deduping note upserts, and keeping notes sorted newest-first after IndexedDB reloads.

### Apr 26, 2026 - Supabase Audit Grant Hardening
**Status:** SUCCESS
**Commit:** pending
**Files:** db/migrations/20260426_harden_audit_log_grants.sql, db/migrations/20260426_harden_change_audit_log_grants.sql, db/migrations/20260426_harden_coupon_attempt_log_grants.sql
**Result:** Removed anon access from audit/coupon log tables while keeping authenticated access; Supabase advisor no longer lists those tables.

### Apr 26, 2026 - Clip Viewer Paragraph UI
**Status:** SUCCESS
**Commit:** 1e91b30
**Files:** extension/popup.js, extension/popup.html, extension/styles/clip-viewer.css
**Result:** Clip Viewer now formats plain text as stacked paragraphs with dedicated CSS, improving Clips/Search/Categories viewer readability.

### Apr 26, 2026 - OS Restart Auth Restore
**Status:** SUCCESS
**Commit:** 1e91b30
**Files:** extension/popup.js, extension/supabase-client.js
**Result:** Popup now waits for stored Supabase session restore before auth check; startup null sessions no longer erase the refresh-token bridge.

### Apr 20, 2026 - Popup Load Hardening + Header Icon Click Fix
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/popup.html, instructions/refresh.md
**Result:** Three surgical fixes to stop the purple loading overlay from sticking. (1) `init()` wrapped in try/catch/finally with 10s watchdog + clickable "Loaded in offline mode" retry banner — overlay can never get stuck. (2) `hideLoadingOverlay()` moved ahead of `_restoreSessionState()`, which is now fire-and-forget. (3) Added reusable `_withTimeout(promise, ms, fallback, label)` helper and wrapped `loadNotes` / `loadActivityLog` / `loadAiHistory` in 3s races inside session restore. Also fixed header Bot/Profile/Settings icons losing center-of-icon clicks: added `pointer-events: none` to `.settings-btn` children so every click targets the button.

### Apr 20, 2026 - Top-Right Icon Loading Lag (Settings/Profile/AI)
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Settings modal no longer blocks on `await loadPinConfig()` before render — reflects cached `_pinConfig` instantly, refreshes in the existing background `Promise.all` with a `data-userTouched` race guard on the PIN toggles. Profile modal: made `setupProfileModalEvents()` idempotent via `_profileModalEventsBound`; the expensive `cloneNode(true) + replaceWith` on 9 nodes now runs once per popup lifetime instead of every open. AI Lab (Bot) button: deferred `loadAIGallery()` + `migrateProfileImageToGallery()` one `requestAnimationFrame` so the tab-switch paints before network work starts.

### Apr 20, 2026 - Storage RLS Upload Path Fix (Profile Images)
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js, instructions/refresh.md
**Result:** Fixed `new row violates row-level security policy` 400 on `profile-images` bucket. Uploads wrote to bucket root (`{userId}-{ts}.png`) but RLS policy required `{userId}/...` folder prefix (`(storage.foldername(name))[1] = auth.uid()::text`). Changed all 3 upload sites — `uploadProfileImage`, `downloadAndUploadImage`, `uploadDataUrlToProfileImages` — to write to `{userId}/{ts}.ext`. DALL-E → permanent Storage URLs now persist instead of falling back to 2h temporary URLs.

### Apr 20, 2026 - Categories Bulk AI Actions (Modular)
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Mirrored the Clips-page 4-button bulk bar (AI Summary, Send to Categories, Send to Notes, AI Breakdown) onto the Categories page, shown below the existing copy/delete bar when 2+ clips selected. Refactored wiring into reusable `_wireBulkAiButtons(config)` helper + 3 new getters (`_getSelectedCategoryClip{IdKeys,Objects,Text}`). Zero duplication — both scopes now drive the same `showSummaryModal`, `showBreakdownModal`, `showCategoryModal(true)`, `showAlbumPicker()` flows.

### Apr 19, 2026 - Batch Category Sync + 8s Timeout Hotspot
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js, change_audit_log (Supabase)
**Result:** Fixed slow-closing category modal + cascading `57014` clips upserts. Decoupled bulk move from awaited sync (fire-and-forget via queue), added queue compaction + single-flight per sync type, made `performFullSync` read-mostly. Root cause of upsert timeouts: `change_audit_log` bloated to 1.23 GB / 1.02M rows from a prior runaway loop — trigger on every `clips` write stalled under 8s `statement_timeout`. Pruned to 7-day window + REINDEX + VACUUM FULL → 3.4 MB.

### Apr 19, 2026 - Tombstone-Safe CRUD (Fix Category Resurrection)
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js, extension/popup.js, extension/indexeddb-store.js
**Result:** Root cause: stale second browser (Edge) ran `syncCategoriesToSupabase` with `deleted_at: null`, clobbering the tombstone set by Comet and resurrecting deleted categories via realtime. Fix: added `_fetchTombstonedIds` pre-filter to all UP-syncs (categories/clips/archived/notes), made `PasteCraftCRUD.deleteOperation` atomic across chrome.storage + IndexedDB (`deleteByIds`) + local `pc_deleted_*` tombstone list, and made all merge helpers honor local tombstones. Single-delete now sticks across devices.

### Apr 19, 2026 - Publishing Safety + Cross-Browser Data Parity
**Status:** ✅ SUCCESS
**Files:** .cursor/rules/production-publishing-safety.mdc, extension/background.js, docs/publishing/CROSS_BROWSER_AUTH.md
**Result:** Added always-on Cursor rule (Sections A-J) for Chrome + Edge publishing discipline — identity preservation, version rules, permissions immutability, storage schema discipline, migration guards, LWW sync, pre-publish checklist, rollback, re-test triggers. Added SCHEMA_VERSION + idempotent migration registry to onInstalled; failures fall back to cloud rehydrate, never wipe local. Documented Chrome + Edge chromiumapp.org redirect URLs for Supabase Auth allowlist.

### Apr 17, 2026 - Tighten RLS + Pin Function search_path (Snyk + Supabase Advisor)
**Status:** ✅ SUCCESS
**Files:** db/migrations/20260417_tighten_rls_and_functions.sql
**Result:** Dropped 5 legacy `{public}` policies on `storage.objects` for profile-images bucket (anon could list/upload/update/delete any file). Replaced permissive `coupon_attempt_log` INSERT policy (roles=public, WITH CHECK true) with authenticated-only + `auth.uid() = user_id`. Pinned `search_path = public, pg_temp` on `set_config` (SECURITY DEFINER), `auto_archive_old_clips`, `search_clips`. Supabase advisor: 6 warnings → 1 (only `pg_net in public` remains, deferred). Snyk confirmed no real API key leaks — flagged JWTs are the public anon key.

### Apr 17, 2026 - Support Ticket Email Pipeline (Private Email + Resend)
**Status:** ✅ SUCCESS
**Files:** netlify.toml, netlify/functions/support-ticket.js (Netlify env vars RESEND_API_KEY + RESEND_FROM updated)
**Result:** End-to-end ticket flow works: extension → Netlify Function → Resend → support@pastecraft.com mailbox. Fixed 3 compounding issues — functions directory path (base=website), invalid RESEND_API_KEY, and RESEND_FROM using unverified @send subdomain (now @pastecraft.com). 4 aliases (team/help/reportbugs/howcanweimprove) forward to support@ mailbox. (Commit: 3e742fa)

### Apr 15, 2026 - PC1.7 Resend Email Integration
**Status:** ✅ SUCCESS
**Files:** supabase/templates/*.html, instructions/PC1.7-PRODUCTION-OVERVIEW.md, instructions/RESEND-EMAIL-SETUP.md, instructions/request.md
**Result:** Created PC1.7 branch for production release. Integrated Resend MCP for email delivery. Created 14 branded email templates (auth + support). Added production overview, setup guide. Test emails sent successfully. Added futures page, docs page, hotkeys to request.md. (Commit: 568d6ca)

### Apr 14, 2026 - Security Hardening + Quick View Fix
**Status:** ✅ SUCCESS
**Files:** extension/background.js, extension/manifest.json, extension/popup.html, extension/callback.js, extension/content-script.js, extension/popup.js
**Result:** Hardened messaging, popup URL handling, manifest permissions/CSP, token logging, and dynamic HTML escaping. Quick View regression was fixed by restoring srcdoc iframe delivery to `*` and validating `e.source === window.parent`, so recent clips now load correctly.

### Apr 10, 2026 - Cached Login Rewire (Remove 3 Sign-in Options)
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Removed "Stay signed in", "Remember email", and "3-digit code" checkboxes from sign-in UI and Settings. Replaced with always-on cached session restore on startup via existing session bridge. All auth paths (email, Google sign-in, Google sign-up) now auto-persist.

### Apr 9, 2026 - Remove PasteCraft Tips Safely
**Status:** ✅ SUCCESS
**Files:** extension/content-script.js, extension/background.js, extension/supabase-client.js
**Result:** Removed the PasteCraft Tips subsystem, stripped old tips settings from storage, and kept the main right-side widget/settings working. (Commit: pending)

### Apr 7, 2026 - Fix Realtime Message Quota Drain
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js, db/migrations/20260407_add_profile_rate_limit.sql, tests/profile-rate-limit.test.js, package.json
**Result:** Fixed 6M+ Realtime messages/month from user_profiles updates. Client: ignoreDuplicates=true, profile row caching, removed redundant calls. DB: 50/day rate limit trigger. Tests: 3/3 passed.

### Feb 20, 2026 - Device sync fixes, clip sort, diff authority
**Status:** ✅ SUCCESS
**Files:** bugfixes.md, extension/popup.js, extension/supabase-client.js
**Result:** Auto-register device on auth; sort clips desc; single diff source; bugfixes log. (Commit: 4142da2)

### Feb 20, 2026 - Cross-device diff sync authority
**Status:** ✅ SUCCESS
**Files:** db/supabase-schema.sql, db/supabase-fixes.sql, extension/supabase-client.js, extension/popup.js
**Result:** Added secure `get_device_diff_clips` RPC + clip hash/device indexes, then switched sync panel to source→target diff-only fetch with realtime refresh. (Commit: pending)

### Feb 20, 2026 - Extension popup, Supabase client, schema updates
**Status:** ✅ SUCCESS
**Files:** db/supabase-schema.sql, extension/popup.html, extension/popup.js, extension/supabase-client.js
**Result:** Popup UI/JS, supabase-client, db schema updates. (Commit: 046c3ab)

### Feb 10, 2025 - Privacy policy clips and AI disclosure
**Status:** ✅ SUCCESS
**Files:** website/privacy.html
**Result:** Clips bullet updated: AI models, network contexts (AI Lab + AI buttons), AI Lab + Supabase as reflective models for summaries/breakdowns. (Commit: 618d7a5)

### Feb 9, 2026 - Markup Language Rendering
**Status:** ✅ SUCCESS
**Files:** extension/markup-renderer.js, extension/popup.js, extension/popup.html, extension/content-script.js, extension/manifest.json, website/pricing.html
**Result:** 20+ markup formats (Markdown, JSON, YAML, LaTeX, Mermaid, etc.) + 190+ code languages with auto-detection, syntax highlighting, badges, Clip Viewer rendering, View Raw toggle. (Commit: d102055)

### Jan 26, 2026 - Restore Tips Widget Features
**Status:** ✅ SUCCESS
**Files:** extension/content-script.js
**Result:** Restored Tips widget features - top-right below navbar, resize, scroll, hostname/viewport-aware positioning. (Commit: ac1e04f)

### Jan 25, 2026 - Zero-Loss Sync + Durable Storage
**Status:** ✅ SUCCESS
**Files:** db/supabase-schema.sql, db/supabase-fixes.sql, extension/supabase-client.js, extension/popup.js, instructions/request.md
**Result:** Soft deletes + notes cloud sync + audit/device sync tracking for durable multi-device retention. (Commit: pending)

### Jan 25, 2026 - Messaging Errors (Missing Receiver/Tab)
**Status:** ✅ SUCCESS
**Files:** extension/background.js, extension/content-script.js
**Result:** Added safe messaging helpers + array normalization to stop runtime errors. (Commit: pending)

### Jan 25, 2026 - Supabase set_config Request Flood
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js
**Result:** Throttled set_config RPC with backoff/in-flight dedupe to prevent browser resource exhaustion. (Commit: pending)

### Dec 22, 2025 - Widget Panels Width Increase (Popup + Settings + Quick View)
**Status:** ✅ SUCCESS
**Files:** content-script.js, popup.html
**Result:** Slide-in panels now ~1 inch wider (476px) + popup content fills full width + clips rows stretch closer to scrollbar for more action icons. (Commit: pending)

### Dec 22, 2025 - Categories Bulk Actions (Copy/Delete Selected)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Added Categories bottom `copy | delete`, UI-order selection output into Crafted Output, bulk copy + bulk delete for 1+ selected. (Commit: pending)

### Dec 22, 2025 - Crafted Output Editable
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Crafted Output is now editable and won’t auto-clear user edits when nothing is selected. (Commit: pending)

### Dec 22, 2025 - Search Multi-Select Bulk Copy Button
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Search now shows a blue bulk copy button for 2+ selected results (below results, above delimiter) and copies in UI order. (Commit: pending)

### Dec 22, 2025 - Clips Quick Multi-Select Delete Button
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, Instructions/request.md
**Result:** Added red Delete Selected button in Clips (2+ selected), placed below Quick Copy and above pagination. (Commit: pending)

### Jan 18, 2026 - Cross-device Sync + Duplicate Clip Fix
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js, extension/background.js, extension/popup.html
**Result:** Sync/transfer fixed + post-open duplication removed; instrumentation deleted. (Commit: pending)

### Jan 20, 2026 - Image Copy to Clips (Context Menu)
**Status:** ✅ SUCCESS
**Files:** extension/background.js, extension/popup.js
**Result:** Added “Copy Image to PasteCraft” / “Copy Image Link to PasteCraft” to reliably save image URLs into Clips. (Commit: bafc2cd)

### Feb 4, 2026 - Auto-Copy Clips Not Appearing
**Status:** ✅ SUCCESS
**Files:** extension/background.js, extension/content-script.js, extension/popup.js
**Result:** Fixed undefined `normalizeArray` in background clip save path so auto-copied clips persist and show. (Commit: N/A)

### Dec 20, 2025 - Production Deployment Complete

**Status:** ✅ SUCCESS - System Production Ready

**Files:** supabase-client.js, website/account.html, supabase/functions (7 deployed)

**Fixes Implemented:**
1. Premium access logic now recognizes coupon codes (`has_unlimited_ai`)
2. Account page buttons adapt to subscription status:
   - Active paid: "Change Plan" + "Cancel Subscription"
   - Cancelled + coupon: "Reactivate Subscription"  
   - Coupon only: "Upgrade to Paid Plan"
3. Deployed 7 Supabase Edge Functions successfully
4. Stripe webhook connected with 4 events
5. Verified cancellation flow works end-to-end
6. Removed all debug instrumentation

**Production Readiness: 85%**
- ✅ Backend operational
- ✅ Functions deployed
- ✅ Payments working
- ✅ Extension ready for store submission
- ⚠️ Website needs deployment (code ready)

**App Store Status:** ✅ READY TO SUBMIT
- Edge Add-ons Store: Ready
- Chrome Web Store: Ready
- All requirements met

**Next Steps:**
1. Deploy website/ folder to hosting
2. Submit extension to Microsoft Edge Add-ons
3. Test with beta users
4. Public launch

**Critical Note:** User successfully cancelled subscription. Still has premium access via dev4ever coupon (permanent).

### Jan 3, 2026 - DEV4EVER Coupon Premium Access After Cancellation
**Status:** ✅ SUCCESS
**Files:** supabase-client.js, instructions/refresh.md, supabase/functions/stripe-webhook/index.ts, website/account.html, popup.js
**Result:** Coupon entitlement now grants premium AI access even when Stripe subscription is canceled; instrumentation cleaned. (Commit: 228aa8f)

### Jan 4, 2026 - Pre-publish Hardening (Support Forms + Security Cleanup)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, netlify/functions/support-ticket.js, website/account.html, website/pricing.html
**Result:** Added popup support form icons + Netlify/Resend email relay; added account password reset + email prefs; removed debug/instrumentation. (Commit: pending)

### Jan 4, 2026 - Popup Instant Clip Refresh + Repo-Loader Paths
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/content-script.js, manifest.json, extension/manifest.json, extension/background.js
**Result:** Popup refreshes instantly after saving clips; fixed repo-root loader getURL paths; removed debug instrumentation. (Commit: 8c7ae5b)

### Jan 6, 2026 - Support Form Schemas (5 Email Processes)
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, netlify/functions/support-ticket.js
**Result:** Added per-form descriptions + fields for team/help/support/reportbugs/howcanweimprove; emails now include structured field details + user-agent context. (Commit: 10a2dfc)

### Jan 7, 2026 - Cross-tab Settings Sync (Auto Copy + Quick Paste)
**Status:** ✅ SUCCESS
**Files:** extension/content-script.js
**Result:** Auto-copy + settings now sync across all tabs via storage listeners; added clipsUpdated refresh. (Commit: pending)

### Jan 7, 2026 - Albums Attachments Open Behavior
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/attachment-viewer.html, extension/attachment-viewer.js
**Result:** Album attachments open instead of copy (popup default) with setting for overlay/back mode. (Commit: pending)

### Jan 12, 2026 - Pricing 3-Card Plans + Toggles
**Status:** ✅ SUCCESS
**Files:** website/pricing.html, website/upgrade.html
**Result:** Replaced interval cards with Free/Basic/Enhanced + billing toggles and updated pricing/gating. (Commit: pending)

### Jan 11, 2026 - Albums Reflect Updated Notes
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Albums re-sync after note updates (save note + add clip to note) so new clips/URLs reflect immediately. (Commit: pending)

### Jan 11, 2026 - Album Viewer Note Context + Quick Copy
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Album viewer shows source note title/description/body per attachment and adds per-item copy without breaking open behavior. (Commit: pending)

### Jan 11, 2026 - Album Click Opens Full Source Note Overlay
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Album item click opens full source note (title/desc/body + clips/urls/images) with per-item copy; Back returns to album. (Commit: pending)

### Feb 5, 2026 - Settings Dark Mode Coming Soon
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/styles.css
**Result:** Disabled Dark Mode toggles and forced light theme to keep Dark Mode unreleased. (Commit: pending)

### Feb 8, 2026 - AI Text Credits 50% Limit + 3 Bug Fixes
**Status:** ✅ SUCCESS
**Files:** db/supabase-auth-schema.sql, supabase/functions/stripe-webhook/index.ts, supabase/functions/_shared/ai_workflow.ts, supabase/functions/ai-{summary,breakdown,hint,vision,trends}/index.ts, extension/popup.js
**Result:** Text credit enforcement (100/wk, 250/mo, 2500/yr). Gallery profile CRUD fix. PIN checkbox fix. Top-bar name marquee fix. (Commit: pending)

### Feb 8, 2026 - Loading Screen Crash Fix (PopupManager ReferenceError)
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Fixed ReferenceError: `PopupManager` → `PasteCraftPopup` in `_normalizeAiWorkflow` and `applyAiWorkflowToUi`. Wrong class name crashed `loadAiWorkflow()` inside `Promise.all`, killing init and leaving loading overlay visible. (Commit: pending)

### Feb 5, 2026 - AI Provider + GPT-5 Workflow Override
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/supabase-client.js, extension/content-script.js, supabase/functions/_shared/ai_workflow.ts, supabase/functions/ai-{summary,breakdown,name,hint,trends,vision,image}/index.ts
**Result:** Added AI workflow override toggle + provider/workflow dropdowns in AI Lab. Presets: Default (4o), Cheapest (GPT-5 Nano/Mini), Latest (GPT-5.2). Config persists in chrome.storage.sync/local. All AI requests pass workflow config; edge functions resolve models via allowlisted presets with safe fallbacks. (Commit: pending)

### Feb 9, 2026 - Markup Language Rendering (Feature #32)
**Status:** SUCCESS
**Commit:** d102055
**Files:** markup-renderer.js, popup.html, popup.js, content-script.js, styles.css, test-markup-clips.js, .gitignore, implementations.md, request.md, manifest.json
**Result:** Full 20+ markup detection/rendering engine with badges, Clip Viewer, View Raw toggle. Supports MD, JSON, HTML, YAML, XML, TOML, CSV, TSV, LaTeX, Mermaid, BBCode, Slack, AsciiDoc, rST, Org-mode, MediaWiki, Textile, JIRA, raw code (190+ langs). Updated subscription UI + help. 34 demo clips. Lib files gitignored.

### Feb 10, 2026 - Magic Button Intelligent Processing + Full Markup Detection
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/popup.html, extension/styles.css
**Result:** Replaced basic format shortcut with full intelligent processing. Delegates to PCMarkup.detectMarkupType for 20+ markup languages (MD, HTML, JSON, YAML, XML, TOML, CSV, TSV, LaTeX, Mermaid, BBCode, AsciiDoc, rST, Org-mode, MediaWiki, Textile, JIRA, Slack, code). Plus URL/email/phone detection. Auto-categorizes into Code, Data, Markup, Diagrams, Links, Contacts, Notes, Quick. Content enhancement per type. Duplicate removal. Results modal with stats.

### Feb 10, 2026 - Magic Button Interactive Preview Modal
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/popup.html, extension/styles.css
**Result:** Replaced auto-process magic with interactive preview modal. Shows paginated clip list (10/page) with per-clip analysis (type badge, issue tags: Uncategorized/Duplicate/Needs cleanup/Already clean). User selects clips then "Craft the Magic" or "Craft all Magic to clips" with undo snapshot. Undo banner appears on next magic click.### Feb 10, 2026 - Magic Modal Design Polish
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/popup.html, extension/styles.css
**Result:** Elevated magic modal with PasteCraft aesthetic: blue/amber gradients, header gleam animation, enhanced shadows (0-20px), stagger fade-in clips, polished issue tags with borders/icons (📁📋✨✓), refined type badges, blue gradient pagination, amber/purple gradient buttons with hover lift, slide-down undo banner, 28px touch targets, smooth cubic-bezier transitions, modal fade-in scale animation.### Feb 10, 2026 - Quick Paste Help Text Cleanup
**Status:** ✅ SUCCESS
**Files:** extension/popup.html, extension/content-script.js
**Result:** Removed obsolete Theme entry from Quick Paste help modals (popup + content-script). Updated Purpose to describe right-click context menu trigger. Updated settings description. Kept global theme runtime code intact.

### Feb 11, 2026 - Session Persistence Across All PC Features
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Full session persistence via chrome.storage.local. Active main tab, AI Lab sub-tab, AI Breakdown state (input, level, cache, threads), and AI Summary state (input, questions, result, threads) all survive popup close, browser restart, and sign-out/sign-in. Debounced saves on input, immediate saves on tab switch and AI result generation. Restored on init() before overlay hide.

### Feb 11, 2026 - AI Output Minimal Formatting + Quick Save Markup Support
**Status:** ✅ SUCCESS
**Files:** ai-summary/index.ts, ai-breakdown/index.ts, popup.js, popup.html, styles.css, markup-renderer.js
**Result:** AI responses no longer produce //, \\, *, or LaTeX notation. Prompts enforce plain-text step-based output. Client-side _formatAiOutput() strips residual formatting. Quick Save UI now includes 19-language markup selector with auto-detect default. Clips store markupHint in meta for reliable rendering.

### Feb 11, 2026 - PC 1.0 Preset Example Data
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** 4 example clips (LaTeX, Mermaid, JS code, Markdown), 4 categories (proper objects), 4 notes — all labeled [Example] with delete prompts. Replaced old 12-clip/5-cat/8-note seed.

### Feb 12, 2026 - Production Presets: Categories, Clips, Notes & Albums
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Replaced old 4-cat/4-clip/4-note seed with production-ready presets. 8 categories based on most-copied clipboard items (research-backed). 8 clips (4 markup + 4 common). 4 notes (2 notes + 2 albums) showcasing albums feature with noteRefs.### Feb 11, 2026 - AI Rich Markup Rendering (LaTeX, Diagrams, Tables)
**Status:** ✅ SUCCESS
**Files:** ai-summary/index.ts, ai-breakdown/index.ts, popup.js, popup.html
**Result:** Connected all 19 markup renderers to AI responses. Summary & Breakdown now render LaTeX math, Mermaid diagrams, code blocks, tables, and formatted Markdown. Prompts updated from plain-text-only to rich markup. New `_renderAiResponse()` orchestrates Markdown+LaTeX+Mermaid pipeline.

### Feb 11, 2026 - AI History Tab (Persistent Conversation Logs)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js
**Result:** Added AI History tab with persistent storage (pc_aiHistory_v1). Auto-saves summary/breakdown conversations with all threads. AI-generated titles via existing ai-summary endpoint. History viewer modal reuses breakdown modal pattern with pagination boxes, rich markup rendering, and copy support.

### Feb 12, 2026 - Skip to PasteCraft (Freemium Guest Mode)
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, styles.css
**Result:** "Skip to PasteCraft" button on auth screen enables freemium local-only mode. Guest state persists across sessions. Support forms show account-required notice for email priority. Guest flag auto-clears on sign-in/sign-out.

### Feb 12, 2026 - DEV4EVER Subscription Hang Fix (Upgrade Banner + AI Blocked)
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js
**Result:** Supabase auth session was stuck/hanging, causing `getUserSubscription()` to never resolve. Added 3s timeout + direct REST fallback (`_getUserSubscriptionDirect`) using stored access token from chrome.storage. Matches existing guardrail pattern in `getCurrentUser()`. Banner now hides correctly and AI features work.

### Mar 17, 2026 - Cross-Device Sync Bug Fixes
**Status:** ✅ SUCCESS
**Files:** extension/supabase-client.js
**Result:** Fixed 2 bugs: (1) Removed `device_id` filter from sync queries — was breaking cross-device sync when items uploaded from different devices. (2) No-op'd `setUserContext()` — was calling `rpc('set_config')` but no RLS policy read it. Now queries by user_id + deleted_at only, client-side handles device filtering.

### Mar 17, 2026 - Cross-Device Sync Full Implementation (Fiverr P1-P3)
**Status:** ✅ SUCCESS
**Files:** extension/indexeddb-store.js, extension/supabase-client.js, extension/popup.js, extension/background.js
**Result:** P1: Fixed IndexedDB `replaceFromAppItems()` - replaced clear-then-write with upsert+delete in single transaction (no data loss on interrupt). P2: Added device display names from userAgent in `registerCurrentSyncDevice()`. P2: Added content hash dedup for notes + name+icon dedup for categories in `importRemoteItem()`. Optional: Added update safety log in `onInstalled` handler.

### Mar 17, 2026 - AI History Cloud Persistence
**Status:** ✅ SUCCESS
**Files:** db/supabase-schema.sql, extension/supabase-client.js, extension/popup.js
**Result:** AI history now syncs to Supabase cloud. Users keep AI content regardless of subscription status (view always allowed). Added `ai_history` table with RLS policies, `syncAiHistoryToSupabase()`, `fetchAiHistoryFromSupabase()`, `mergeAiHistory()`. Local-first with cloud backup pattern. No custom RLS plumbing — queries by user_id, lets RLS handle auth.

### Apr 4, 2026 - Debug Instrumentation for Sync Flow
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js, PasteCraft_Consult.pdf, instructions/STRIPE_SANDBOX_SETUP.md
**Result:** Added debug agent logging to device sync flow for troubleshooting. (Commit: 0452681)

### Apr 5, 2026 - Cross-Device Sync + Debug Cleanup
**Status:** ✅ SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js
**Result:** Enabled automatic cross-device sync by removing device_id filters. Cleaned up debug instrumentation. (Commit: 3b6e746)

### Apr 5, 2026 - Notes Debug Instrumentation
**Status:** ✅ SUCCESS
**Files:** extension/popup.js
**Result:** Added debug logging for notes operations (saveNote, deleteNote, pagination, renderNotes). (Commit: 490ffdd)

### Apr 5, 2026 - Tiered Storage with Dynamic Lazy Loading
**Status:** ✅ SUCCESS
**Files:** storage-meter.js, tiered-storage.js, popup.js, popup.html, styles.css, supabase-client.js
**Result:** Implemented tiered storage respecting Chrome (5MB/item, 10MB total) and IndexedDB (50MB) limits. Dynamic item budgets, lazy loading from Supabase for older items, quota fallback to IDB, migration logic for excess data.

### Apr 5, 2026 - Storage Quota + Categories Duplicate Fix
**Status:** ✅ SUCCESS
**Files:** popup.js, supabase-client.js
**Result:** Fixed chrome.storage.sync quota error (pc_sync_backup_v1 exceeded 8KB limit), categories upsert duplicate error (string ID deduplication), removed non-existent RPC call, added safe storage setter with IDB fallback.

### Apr 5, 2026 - Remove Device Sync Feature
**Status:** ✅ SUCCESS
**Files:** popup.html, popup.js, supabase-client.js
**Result:** Removed "View Available Devices to Sync" feature, device registration/rename, sync backup functions. Cloud sync now uses Supabase only. 1247 lines deleted.

### Apr 5, 2026 - Sync Debug Instrumentation
**Status:** ✅ SUCCESS
**Commit:** 36ac916
**Files:** popup.js, supabase-client.js
**Result:** Added SYNC-DEBUG logging to key sync functions. Removed remaining device registration calls.

### Apr 8, 2026 - Security Hardening Complete
**Status:** ✅ SUCCESS
**Commit:** 3bd017d
**Files:** SUPABASEcsReport.md, supabase/functions/redeem-coupon/index.ts, DB migrations
**Result:** Full security hardening: burst protection (500ms) for clips/notes/categories, coupon brute-force protection (5/hour), storage bucket 5MB limit, daily rate limits, audit log cleanup. All vulnerabilities from security report resolved.

### Apr 12, 2026 - Website Overhaul with Astro
**Status:** ✅ SUCCESS
**Commit:** 89da43f
**Files:** website/src/*, website/astro.config.mjs, netlify.toml, tokens.css, base.css
**Result:** Full website rebuild using Astro. Logo-derived brand system (navy, teal, gold), shared components, centralized tokens. Preserved Supabase auth and Stripe flows in account/pricing/upgrade pages.

### Apr 30, 2026 - Clips Modular Refactor
**Status:** SUCCESS
**Files:** extension/popup.js, extension/popup/features/clips/*
**Result:** Extracted Clips constants, selectors, render, events, state, and service modules. User verified Clips page functionality works.

### May 1, 2026 - Clips Category/Search Refactor
**Status:** SUCCESS
**Files:** extension/popup.js, extension/popup/features/clips/*
**Result:** Moved category dropdown, delegated events, selection previews, and bulk actions into Clips modules. Fixed tooltip regression and user verified success.

### May 1, 2026 - Clips CodeScene Cleanup
**Status:** SUCCESS
**Files:** extension/popup/features/clips/*
**Result:** Simplified Clips state, service, render, and event modules. Syntax/lints passed and CodeScene quality gate passed.

### May 3, 2026 - Categories Modular Refactor
**Status:** SUCCESS
**Commit:** 5e547ff
**Files:** extension/popup.js, extension/popup/features/categories/* (7 new files)
**Result:** Extracted 13 category methods into vertical slice (constants, selectors, render, state, events, service, controller). popup.js -577 lines; saveTextWithCategory CC38→fixed, deleteCategory CC22→fixed. All CodeScene gates passed.

### May 8, 2026 - AI Lab Opus 4.7 Brain Method Refactor
**Status:** SUCCESS
**Files:** ai-lab.magic.js (new), ai-lab.history.js, ai-lab.controller.js, popup.js
**Result:** Extracted Magic feature (14 methods) and decomposed _craftMagic CC63→orchestrator CC1. Decomposed continueHistoryConversation CC38→router CC4. ai-lab.magic.js scored 10.0 optimal. popup.js improved 1.09→1.23. All CodeScene gates passed.

### May 13, 2026 - Profile Slice Refactor
**Status:** SUCCESS
**Files:** profile.constants.js, profile.selectors.js, profile.storage.js, profile.render.js, profile.events.js, profile.generators.js, profile.gallery.js, profile.controller.js, popup.js, supabase-client.js, supabase/functions/ai-image/index.ts
**Result:** Full Profile vertical slice extracted (7 modules). setupProfileModalEvents Large Method decomposed to 10.0 CodeScene. generateAnimalAvatar/Cartoon/AIName extracted with premium gating intact. gallery pagination/delegation wired. Bug fixed: dall-e-3 → gpt-image-1 deployed to live Edge Function.

### May 14, 2026 - Billing Slice Refactor
**Status:** SUCCESS
**Files:** billing.constants.js, billing.selectors.js, billing.controller.js, billing.service.js, billing.support.js, popup.js
**Result:** Extracted Checkout and Support features. Decomposed _createCheckout (CC=17), openSupportForm (CC=30), and submitSupportForm (CC=25). CodeScene scores 9.38-10.0. popup.js reduced by ~300 lines.

### May 15, 2026 - Sync/Data Slice Refactor
**Status:** SUCCESS
**Files:** sync.constants.js, sync.storage.js, sync.loader.js, sync.listener.js, sync.controller.js, popup.js
**Result:** Extracted Sync/Data into 5 modules. Decomposed loadData (CC=73) into 6 helpers (CC≤9). Demo seed, IndexedDB migration, storage listener, and realtime sync fully delegated. Phase 1 popup.js refactor complete.

### May 15, 2026 - Quick View Refresh + Billing Syntax Fix
**Status:** SUCCESS
**Files:** background.js, content-script.js, popup.html, styles.css, billing.support.js
**Result:** Fixed Extension context invalidated crash in sync.loader.js. Fixed Quick View refresh reading stale local storage vs IndexedDB. Fixed billing.support.js SyntaxError (we'll quote). Fixed pointer-events on icon buttons.
