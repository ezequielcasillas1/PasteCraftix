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
