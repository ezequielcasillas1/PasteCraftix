### May 26, 2026 - Security RLS hardening migration
**Status:** PARTIAL
**Files:** db/migrations/20260526180000_security_rls_hardening.sql, scripts/security/apply-and-verify.mjs, scripts/security/verify-security-rls.sql, package.json
**Result:** Migration fixes F-1 profile guard, F-2 ban_gate policies, S-1 storage RLS, F-3 settings/clipboard burst limits. Apply script needs DATABASE_URL; not run in cloud (no creds).

### May 26, 2026 - Security + Storage RLS audit
**Status:** SUCCESS
**Files:** docs/security/security-rls-audit-2026-05-26.md
**Result:** Repo-only audit: no automatic is_banned; quarantine/rate-limit only. Table RLS mostly hardened; flagged user_profiles self-UPDATE, missing ban_gate policy DDL, storage policy prod verify SQL.

### May 26, 2026 - Security workflow educational guide
**Status:** SUCCESS
**Files:** docs/security/pastecraft-security-workflow.md
**Result:** Comprehensive MD explaining defense layers, abuse/quarantine/ban workflows, admin alerts, AI gaps, Zscaler ops layer, and P0–P2 roadmap.

### May 21, 2026 - AI avatar image quality restore
**Status:** SUCCESS
**Files:** supabase/functions/ai-image/index.ts, extension/supabase/ai-functions.js
**Result:** Prompt asked for thick black outlines + flat anime style (caused ugly 2D stickers). Switched to premium 3D stylized render prompts, quality high, expanded animal traits. Redeploy `ai-image` required.

### May 22, 2026 - Security hardening pass (P0–P3)
**Status:** SUCCESS
**Files:** db/migrations/20260522_*.sql, admin-api, admin-alerts, ai-name, ai_workflow, security-gate, cors.ts, create-checkout, extension auth/ai-functions/messages/widget/quick-paste/site-guard, website _headers + supabase.min.js, manifest 3.0.9
**Result:** Locked user_subscriptions RLS; admin-alerts cron auth; ai-name JWT gate; removed extension admin sign-in; localhost-only admin-api CORS; site-guard blocklist; Shadow DOM for widget/quick-paste; coupon RLS; admin_actions audit. Migrations applied to prod (page_views skipped — table absent). Edge deploy via CLI.

**Status:** SUCCESS
**Files:** ai-lab.refactorization.js, ai-lab.magic.js, ai-lab.controller.js, ai-lab.history.js, ai-lab-page.events.js, auth.session.js, popup.html, popup.js
**Result:** Standalone AI Lab path for refactor-ready clips (levels ELI5–Wise Man); reuses craft refactor pipeline. Larger Generator/Gallery/Summary tabs. User verified.

### May 21, 2026 - Production v3.0.8 store release
**Status:** SUCCESS
**Files:** extension/manifest.json, releases/pastecraft-v3.0.8.zip, feature/craft-clips-ai → main
**Result:** Version 3.0.8 packaged; feature branch merged to main. Section G smoke test pending on Chrome + Edge before store upload.

### May 21, 2026 - Smart categorize custom AI titles
**Status:** SUCCESS
**Files:** supabase/functions/ai-categorize/index.ts, ai-lab.magic.js, ai-lab.craft-clips.category-pick.js
**Result:** Removed preset padding (Quick Notes/Links/Work). Edge prompt asks for content-specific titles; filters generic buckets; retries once if empty/generic. Client shows 1–5 AI titles only; rule-based fallback only when AI returns none. Redeploy `ai-categorize` required.

### May 21, 2026 - Vertical slice refactor (Phases B–D)
**Status:** SUCCESS
**Files:** extension/supabase/*, extension/supabase-client.js, extension/content/*, extension/content-script.js, extension/background/*, extension/background.js, extension/manifest.json, extension/popup/features/app/popup.boot.js, scripts/split-*.mjs, REFACTOR_REMAINING.md
**Result:** supabase-client 4755→7-line barrel + 18 slices; content-script 5715→2-line barrel + shared/quick-paste/widget; background 893→2-line barrel + shared/handlers; MV3 module SW + content script; popup loads Supabase via popup.boot dynamic import. Phase A popup already ~1581 lines from batch 3.

### May 21, 2026 - Craft Clips AI Rebuild (#47)
**Status:** SUCCESS
**Files:** ai-lab.magic.js, ai-lab.craft-clips.*, craft-toolbar.events.js, popup.html, clips.render.js, supabase-client.js, ai-refactor/index.ts, ai_workflow.ts, categories.service.js, styles.css, request.md
**Result:** Craft Clips rebrand, action cards, settings, AI Formatted vs AI Refactoring. Refactor keeps original clip + adds sibling refactored clip in recents. Smart categorize: 5 AI title picker modal after craft (premium). ai-categorize suggestions mode deployed.

### May 21, 2026 - Magic Clips / Craft Clips coordination (docs only)
**Status:** PENDING USER VERIFY
**Files:** instructions/request.md, implementations.md, docs/refactoring/craft-clips-ai-implementation-plan.md
**Result:** Mapped current Magic Wand (`extension/popup/features/ai-lab/ai-lab.magic.js`, `magicClipList`, `aiCategorize`/`aiFormat`) vs planned Craft Clips revamp. Gaps: detect-only dupes, no action cards/settings toggles, dual AI modes, client category IDs. No refresh.md entry (no confirmed magic-only bug). Not implementation success.

### May 21, 2026 - Clip row Share + Open delegates
**Status:** SUCCESS
**Files:** clips.share.js, clips.controller.js, clips.events.js, clips.render.js, popup.js
**Result:** Restored `showShareMenuForClip` / `openClipViewer` thin delegates after popup refactor. Share overlay module extracted. User verified.

### May 21, 2026 - Profile AI image data URL upload (CSP)
**Status:** SUCCESS
**Files:** extension/supabase-client.js
**Result:** `downloadAndUploadImage` skips fetch for `data:image/` URLs; uses base64 upload path. User verified.

### May 21, 2026 - AI conversation history numbered pagination
**Status:** PENDING USER VERIFY
**Files:** ai-lab.history.js, ai-lab.selectors.js, popup.html, popup.js, modals-shared.events.js
**Result:** Replaced Load More with Prev/numbered pages/Next (7 per page, in-memory max ~50). Bar hidden when filtered total ≤7. `_aiHistoryPageIndex` 0-based; UI labels Page 1 of N. Search/filter/tab reset to page 1.

### May 21, 2026 - AI conversation history load-more pagination
**Status:** SUPERSEDED (numbered pagination May 21)
**Files:** ai-lab.history.js, ai-lab.constants.js, popup.html, popup.js, modals-shared.events.js, tab-nav.events.js
**Result:** Prior load-more UX replaced by numbered pages per user feedback.

### May 21, 2026 - popup.js final orchestrator slice (batch 3 close-out)
**Status:** SUCCESS
**Files:** popup.js, popup.boot.js, popup.features.js, popup.init.js, ai-lab.analysis-history.js, ai-lab.controller.js, ai-lab.summary.js, clips.state.js, categories.service.js, profile.generation-timer.js, profile.controller.js
**Result:** Extracted analysis history, selection helpers (getSelectedOrCurrentText, clearAllSelections), boot/messaging, feature loader registry, profile AI timer, dead code removed (appendDeletedItems, moveToSearchStorage, toggleClipSelection). popup.js ~1898 → ~1549 lines. Fixed missing showSummaryModal/getSelectedOrCurrentText delegates. User verified.

### May 21, 2026 - popup.js final slice (init, auth, breakdown, profile)
**Status:** SUCCESS
**Files:** popup.init.js, auth.callbacks.js, auth.password-strength.js, billing.unsubscribe.js, profile.ai-image.js, profile.viewer.js, ai-lab.breakdown.js, ai-lab.summary-modal.js, popup-icons.js, popup.js, popup.html, auth/billing/profile/ai-lab controllers
**Result:** Extracted startup orchestration, auth callbacks, password strength UI, unsubscribe, profile AI images, image viewer, breakdown modal stack, summary modal nav, Lucide boot. popup.js ~2979 → ~1898 lines; thin delegates retained. User verified.

### May 21, 2026 - Supabase sync RLS grants + performFullSync session guard
**Status:** SUCCESS
**Files:** db/migrations/20260521_fix_sync_rls_grants.sql, extension/supabase-client.js
**Result:** Migration re-grants `user_is_not_banned` EXECUTE for ban_gate RLS (42501). Client skips full sync without live JWT. User verified.

### May 21, 2026 - popup.js batch 3 (pdf, billing, titles, bulk AI, session)
**Status:** SUCCESS
**Files:** clips.pdf.js, clips.title.js, billing.upgrade-ui.js, ai-lab.bulk.js, ai-lab.session-state.js, clips.controller.js, billing.controller.js, ai-lab.controller.js, popup.js
**Result:** Extracted PDF modal (~310 LoC), freemium upgrade UI (~20), clip title CRUD (~130), bulk AI button wiring (~50), AI Lab session persistence (~185). popup.js ~620 lines slimmer; thin delegates retained.

### May 21, 2026 - popup.js batch 2 (restore, repair, visibility)
**Status:** Pending verification
**Files:** settings.restore.js, sync.repair.js, sync.visibility.js, settings.controller.js, sync.controller.js, popup-ui.js, popup.js
**Result:** Extracted restore points (~240 LoC), repairLocalClipIds (~80), setupVisibilityListener, setActionButtonLoading. popup.js ~314 lines slimmer; delegates on settingsFeature.restore + syncFeature.

### May 19, 2026 - PasteCraftCRUD Shared Module Extraction
**Status:** Pending verification
**Files:** extension/popup/shared/pastecraft-crud.js, extension/popup.html, extension/popup.js
**Result:** Moved PasteCraftCRUD (~560 lines) out of popup.js into IIFE shared script (async-utils pattern). popup.html loads pastecraft-crud.js before popup.js. CodeScene popup.js 2.34 → 2.78; new file 4.51. Feature modules unchanged (window.PasteCraftCRUD).

### May 19, 2026 - Supabase SECURITY DEFINER RPC Hardening
**Status:** Applied (pending advisor recount + extension smoke test)
**Files:** db/migrations/20260519_harden_security_definer_rpc_grants.sql, extension/supabase-client.js
**Result:** Dropped `set_config`; revoked EXECUTE on internal/admin SECURITY DEFINER RPCs from anon/PUBLIC; granted `get_effective_access_state` to authenticated (SECURITY INVOKER, uuid cast fix). **Follow-up:** `user_is_not_banned` must keep EXECUTE for `authenticated` (RLS ban_gate policies). Security advisor: 31 → ~2 warnings (`pg_net` + optional `user_is_not_banned` RPC lint).

### May 19, 2026 - Clip Viewer Modular Extraction
**Status:** Pending verification
**Files:** extension/popup/features/clips/clips.viewer.js, clips.controller.js, extension/popup.js
**Result:** Moved clip viewer (~240 lines) from popup.js into clips.viewer.js. Public API unchanged: app.openClipViewer, hideClipViewerModal, copyClipViewerText. Events stay in modals-shared.events.js.

### Apr 19, 2026 - Publishing Safety + Cross-Browser Data Parity
**Status:** SUCCESS
**Files:** .cursor/rules/production-publishing-safety.mdc, extension/background.js, docs/publishing/CROSS_BROWSER_AUTH.md
**Result:** New always-on rule codifies Chrome + Edge publishing safety (Sections A-J). Migration guard scaffold (SCHEMA_VERSION + registry) added to onInstalled — preserves local data on failure, falls back to cloud rehydrate. Cross-browser OAuth redirect URL doc explains Supabase allowlist setup.

### Apr 17, 2026 - Support Ticket Email Pipeline (Private Email + Resend)
**Status:** SUCCESS
**Files:** netlify.toml, netlify/functions/support-ticket.js (+ Netlify env vars RESEND_API_KEY, RESEND_FROM)
**Result:** Connected Namecheap Private Email receiving (support@pastecraft.com + 4 aliases: team/help/reportbugs/howcanweimprove) with Resend sending from root @pastecraft.com. Extension ticket form now delivers into the Private Email inbox with subject-prefixed category tags. (Commit: 3e742fa)

### Apr 14, 2026 - Security Hardening + Quick View Fix
**Status:** SUCCESS
**Files:** extension/background.js, extension/manifest.json, extension/popup.html, extension/callback.js, extension/content-script.js, extension/popup.js
**Result:** Hardened messaging, popup URL handling, manifest permissions/CSP, token logging, and dynamic HTML escaping. Quick View regression was fixed by restoring srcdoc iframe delivery to `*` and validating `e.source === window.parent`, so recent clips now load correctly.

### Apr 10, 2026 - Cached Login Rewire (Remove 3 Sign-in Options)
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Removed "Stay signed in", "Remember email", and "3-digit code" checkboxes. Cached session restore now always runs on startup; no opt-in needed.

### Apr 9, 2026 - Remove PasteCraft Tips Safely
**Status:** SUCCESS
**Files:** extension/content-script.js, extension/background.js, extension/supabase-client.js
**Result:** Removed the PasteCraft Tips subsystem, stripped old tips settings from storage, and kept the main right-side widget/settings working.

### 2026-02-20 - Cross-Device Diff Sync Architecture
**Status:** SUCCESS
**Files:** db/supabase-schema.sql, db/supabase-fixes.sql, extension/supabase-client.js, extension/popup.js
**Result:** Added content-hash/device indexes + secure diff RPC, then migrated the device sync panel to fetch only remote clips missing on current device with realtime refresh support.

### Jan 4, 2026 - Support Forms + Account Settings
**Status:** SUCCESS
**Files:** popup.html, popup.js, netlify/functions/support-ticket.js, website/account.html
**Result:** Added popup support forms that auto-send via Netlify/Resend; added account password reset + email preferences toggle.

### Jan 6, 2026 - Support Form Schemas (5 Email Processes)
**Status:** SUCCESS
**Files:** extension/popup.js, netlify/functions/support-ticket.js
**Result:** Added per-form descriptions + targeted fields for team/help/support/reportbugs/howcanweimprove; emails now include structured field details and user-agent context.

### Jan 7, 2026 - Cross-tab Settings Sync (Auto Copy + Quick Paste)
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Settings/state now sync across all open tabs (auto-copy toggle, quick paste settings/position, widget settings/position).

### Jan 7, 2026 - Albums Attachments Open Behavior
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/attachment-viewer.html, extension/attachment-viewer.js
**Result:** Album attachments no longer copy; click opens via Settings (Edge popup default or in-extension overlay with Back).

### Jan 7, 2026 - Album Editor Cleanup (No Attachments)
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Removed attachments UI from album editor; albums no longer save clips/urls/images (notes-only container).

### Jan 11, 2026 - Albums Reflect Updated Notes
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Albums re-sync when a note is updated, so new clips/URLs show in the album right away.

### Jan 11, 2026 - Album Viewer Note Context + Quick Copy
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Album items now show source note title/description/body and support per-attachment quick copy.

### Jan 11, 2026 - Album Click Opens Full Note Overlay
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Album item click now opens full source note view with clips/urls/images sections and per-item copy; Back returns to album.

### Jan 12, 2026 - Pricing Page 3-Card Plans + Toggles
**Status:** SUCCESS
**Files:** website/pricing.html, website/upgrade.html
**Result:** Pricing UI now uses Free/Basic/Enhanced with weekly/monthly/yearly toggles (Basic/Enhanced) and updated clip + AI gating.

### Jan 18, 2026 - Cross-device Sync + Duplicate Clip Fix
**Status:** SUCCESS
**Files:** extension/popup.js, extension/supabase-client.js, extension/background.js, extension/popup.html
**Result:** Cross-device sync now transfers reliably; fixed duplicate clips appearing after popup opens; removed debug instrumentation/scripts (no commit yet).

### Jan 18, 2026 - Manual Clip Upload Loading Spinner
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/styles.css
**Result:** Added Save Clip uploading spinner + disabled state during Supabase sync so users know uploads may take time.

### Jan 18, 2026 - Profile Funky Animal Name Remix
**Status:** PARTIAL
**Files:** extension/popup.html, extension/popup.js, supabase/functions/ai-name/index.ts
**Result:** Renamed "Funky Name" → "Funky Animal Name" and updated AI name prompt to remix the user's typed name while ending with a valid animal.

### Jan 19, 2026 - Profile Name Save Buttons
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Added Save buttons next to the typed name and the generated funky animal name so users can save either field on demand.

### Jan 20, 2026 - Rich Auto-Copy + Clip Viewer (Open Button)
**Status:** SUCCESS
**Files:** extension/content-script.js, extension/background.js, extension/popup.js, extension/popup.html, extension/styles.css
**Result:** Auto-copy now captures text/plain + text/html + optional image metadata; added a per-clip Open button next to 🧠 that opens an in-extension viewer overlay.

### Jan 21, 2026 - Auto Refresh During Sync Progress
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** When the sync progress bar is visible, PasteCraft auto-refreshes the popup view every 5 seconds until syncing completes.

### Jan 22, 2026 - Tips Widget Auto Placement + Popup Fallback
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Tips widget now auto-detects "clean" space (avoids nav/interactive UI) and falls back to an in-page popup window; users can force popup via settings.

### Feb 5, 2026 - Settings Dark Mode Coming Soon
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/styles.css
**Result:** Dark Mode toggles are disabled + labeled "Coming soon"; theme is forced to light to prevent accidental dark-mode saves.

### Feb 6, 2026 - AI Lab Credits + Image Credit Enforcement
**Status:** PARTIAL
**Files:** extension/popup.html, extension/popup.js, extension/supabase-client.js, supabase/functions/ai-image/index.ts, supabase/functions/stripe-webhook/index.ts, db/supabase-auth-schema.sql
**Result:** AI Lab now shows credits remaining + next reset; image generation requires user JWT and decrements credits on success. Credit limits set to ~50% cost coverage (24/wk, 62/mo, 624/yr). Needs DB migration + deployed webhooks/functions to go live.

### Feb 8, 2026 - AI Text Credits (50% Limit) + 3 Bug Fixes
**Status:** SUCCESS
**Files:** db/supabase-auth-schema.sql, supabase/functions/stripe-webhook/index.ts, supabase/functions/_shared/ai_workflow.ts, supabase/functions/ai-{summary,breakdown,hint,vision,trends}/index.ts, extension/popup.js
**Result:** Added text credit limits (100/wk, 250/mo, 2500/yr) with server-side enforcement. Fixed gallery-to-profile image (CRUD practices). Fixed PIN checkbox stale state. Fixed top-bar name marquee measurement.

### Feb 6, 2026 - AI Lab Credit Pills (Image + Text)
**Status:** PARTIAL
**Files:** extension/popup.html, extension/popup.js
**Result:** Renamed "Credits" to "Image credits" and added a right-side "AI text credits" pill (currently unlimited unless text credit caps are added).

### Feb 5, 2026 - AI Provider + GPT-5 Workflow Override
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/supabase-client.js, extension/content-script.js, supabase/functions/_shared/ai_workflow.ts, supabase/functions/ai-{summary,breakdown,name,hint,trends,vision,image}/index.ts
**Result:** Added AI workflow override toggle + provider/workflow dropdowns in AI Lab. Presets: Default (4o), Cheapest (GPT-5 Nano/Mini), Latest (GPT-5.2). Config persists in chrome.storage.sync/local. All AI requests pass workflow config; edge functions resolve models via allowlisted presets with safe fallbacks.

### Feb 9, 2026 - Freemium Tier Clarity + Database Storage Tooltip
**Status:** SUCCESS
**Files:** website/pricing.html, website/upgrade.html
**Result:** Added "Database storage" line to all pricing tiers (crossed out for Freemium, checkmark+tooltip for Basic/Enhanced). Tooltip reads "We use Supabase". Fixed FAQ mentioning 20 clips → unlimited.

### Feb 9, 2026 - Freemium Upgrade Banner + Modal + Profile Link
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Added upgrade banner below header for Freemium users, upgrade modal with Basic/Enhanced comparison, and "Upgrade Subscription" button in Profile Account section. All entry points open the modal; plan buttons redirect to pricing.html.

### Feb 9, 2026 - MediaWiki, Textile, JIRA/Confluence Markup Support
**Status:** SUCCESS
**Files:** extension/markup-renderer.js, extension/content-script.js, extension/test-markup-clips.js
**Result:** Added detection, rendering, badges, and preview for MediaWiki, Textile, and JIRA/Confluence markup. Now 20 markup types supported total. Test clips updated with 3 new samples.

### Feb 9, 2026 - Notes Tab: Info Box, Details Modal & Search Bar
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Added description box between Notes heading and action buttons explaining notes/albums usage. Added expand button that opens a detailed guide modal. Added search bar below New Note/New Album buttons to filter notes by title, description, or type.

### Feb 9, 2026 - Raw Unfenced Code Auto-Detection
**Status:** SUCCESS
**Files:** extension/markup-renderer.js, extension/content-script.js, extension/test-markup-clips.js
**Result:** Added heuristic scoring to detect raw code (no ``` fences) for JS/TS, Python, Java, C/C++, Go, Rust, Ruby, PHP, Swift, SQL, Bash. highlight.js auto-detects language from ~190 supported. Test clips added for raw JS and Python.

### Feb 9, 2026 - Final Markup Detection Audit & Bug Fixes
**Status:** SUCCESS
**Files:** extension/markup-renderer.js, extension/test-markup-clips.js
**Result:** Fixed 2 detection bugs: (1) Textile/JIRA clips misdetected as Slack — reordered detection so Slack runs last among text markups. (2) JSX code clips misdetected as HTML — added code-keyword guard. Rewrote test-markup-clips.js v4 with 26 clips covering all 20 markup types + 6 raw code languages (JS, Python, C, Go, SQL, Bash).

### Mar 17, 2026 - Cross-Device Sync Bug Fixes (Fiverr)
**Status:** SUCCESS
**Files:** extension/supabase-client.js
**Result:** Bug 1: Removed `device_id` filter from sync queries — broke sync when items uploaded from different devices. Bug 2: No-op'd `setUserContext()` — `rpc('set_config')` was called but no RLS policy read it. Now queries by user_id + deleted_at, client-side handles device filtering.

### Mar 17, 2026 - Cross-Device Sync Full Implementation (Fiverr P1-P3)
**Status:** SUCCESS
**Files:** extension/indexeddb-store.js, extension/supabase-client.js, extension/popup.js, extension/background.js
**Result:** P1: IndexedDB `replaceFromAppItems()` now uses upsert+delete in single transaction instead of clear-then-write. P2: Device display names auto-generated from userAgent (e.g., "Edge on Windows"). P2: Notes dedup by content hash, categories dedup by name+icon. Optional: Update safety log added to `onInstalled` handler.

### Mar 17, 2026 - AI History Cloud Persistence
**Status:** SUCCESS
**Files:** db/supabase-schema.sql, extension/supabase-client.js, extension/popup.js
**Result:** AI history syncs to Supabase. Added `ai_history` table + RLS. View always allowed regardless of subscription. `syncAiHistoryToSupabase()`, `fetchAiHistoryFromSupabase()`, `mergeAiHistory()` added. No custom RLS plumbing — queries by user_id, lets RLS handle auth.

### May 21, 2026 - popup.js safe slice batch (non-risky)
**Status:** PENDING USER VERIFY
**Files:** extension/popup.js, extension/popup.html, extension/popup/shared/popup-ui.js, extension/popup/shared/popup-messaging.js, extension/popup/features/clips/clips.preview.js, extension/popup/features/clips/clips.controller.js
**Result:** Extracted UI utilities (toast/overlay/confetti/escapeHtml), craft preview (updatePreview/delimiter/toggles), background message handler. Thin delegates kept on PasteCraftPopup. CodeScene new files: 9.68 / 9.66 / 9.52. Deferred: _initImpl, auth callbacks, restore+repairLocalClipIds, PDF, AI breakdown, profile AI, visibility listener.
