
### Aug 16, 2026 - Website SERanking crawl/on-page SEO
**Status:** PENDING SUCCESS
**Files:** seo.js, BaseLayout.astro, SectionShell.astro, robots.txt.js, sitemap.xml.js, og-image.jpg
**Result:** robots + sitemap, title/desc lengths, H1s, alts, Twitter/OG image, noindex lab/account, footer inbound links.

### Aug 14, 2026 - Clip images in viewer (IDB-first + cloud preserve)
**Status:** SUCCESS
**Files:** clip-images.js, clip-images.idb.js, clip-images.cloud.js, capture.clip-save.js, clips.commands.js, clips.handler.js, sync-clips.*, storage-migrations.js
**Result:** IDB-first images + migrate `pc_clip_img_v1_*` out of chrome.storage. Cloud preserve via `clip-images` bucket + `clips.image_url`. Quota text: You have reached the limits of the providing local storage. User verified after reload + recapture.

### Aug 14, 2026 - Comet Capture Tools eligible
**Files:** capture-browser-support.js, capture-browser-support.test.mjs, support.astro, index.astro, popup.html
**Result:** Comet (Perplexity) treated as eligible for Image Picker + Spot like Chrome/Edge. Opera/Arc still Auto-Copy + click-and-drag only.

### Aug 14, 2026 - Capture Tools browser eligibility
**Files:** capture-browser-support.js, widget.capture-menu.js, widget.styles.core.js, site-access.*, popup.html, website/src/pages/support.astro, website/src/pages/index.astro
**Result:** Opera/Arc (when detected) hide Image Picker + Spot. Auto-Copy and click-and-drag stay on. Chrome/Edge/Comet eligible. Opera grant not claimed fixed.

### Aug 14, 2026 - Opera popup site-access grant
**Files:** popup/features/site-access/*, optional-permissions.js, capture.handler.js, widget.capture-menu.js, grant-site-access.js/html, popup.html, popup.boot.js
**Result:** Opera-blocked grant tab skipped. Toolbar popup Allow site access requests optional `<all_urls>` (then current origin). Chrome/Edge keep grant tab.

### Aug 13, 2026 - Production package v3.0.36
**Files:** extension/manifest.json, update.handler.js, docs/publishing/*, production-publishing-safety.mdc, releases/pastecraft-v3.0.36.zip
**Result:** Bump 3.0.35 → 3.0.36 for store upload. Send-to-notes catalog, GPT-5.4, AI summary sources, apply-on-download. Last published is 3.0.35 until 3.0.36 approved.

### Aug 13, 2026 - AI summary source references
**Files:** ai_summary_prompts.js, ai-summary/index.ts, clip-source.js, clips.action-menu/viewer.js, ai-lab.bulk.js, summary-clips-overview.js
**Result:** Summaries/Q&A now add a ## Sources section (quotes + clip page URLs). Title/category "return only" prompts stay bare.

### Aug 13, 2026 - Category send to Notes catalog
**Files:** notes.send-catalog.js, categories.notes-send.js, categories.render/controller/constants.js, popup.js/html, clips.action-menu/viewer.js, ai-lab.bulk.js, notes.editor.js
**Result:** Category cards inherit send-to-notes via the notes destination catalog (album picker). Clip/bulk/AI send paths share the same queue.

### Aug 12, 2026 - Production package v3.0.35
**Files:** extension/manifest.json, docs/publishing/*, production-publishing-safety.mdc
**Result:** Bump 3.0.34 → 3.0.35 for store upload. Category separators (#196) + AI Lab gateway (#197). Last published is 3.0.34 until 3.0.35 approved.

### Aug 12, 2026 - Category Separator section arrows
**Files:** categories.separators.section.js, categories.separators.render/events/constants.js, categories.controller.js, popup.js/html
**Result:** One toggle chevron (flips) + lead arrow by grip; both highlight master clips. Pending SUCCESS verify.

### Aug 12, 2026 - Category Separator Service (#62)
**Files:** categories.separators.*, categories.render/events.js, clips.render/events.js, sync-categories.js, popup.js/html, db/migrations/20260812_category_separators_jsonb.sql
**Result:** Named study section bars inside category units; CRUD + local/cloud persist. Pending SUCCESS verify.


### Aug 8, 2026 - Production package v3.0.34
**Files:** extension/manifest.json, releases/pastecraft-v3.0.34.zip, docs/publishing/*
**Result:** Bump 3.0.33 ? 3.0.34 for store upload. Auth hydrate preflight before setSession + 3.0.33 viewer-shell stack. Last published stays 3.0.29 until approved.

### Aug 8, 2026 - Production package v3.0.33
**Files:** extension/manifest.json, releases/pastecraft-v3.0.33.zip, docs/publishing/*
**Result:** Bump 3.0.32 → 3.0.33 for store upload. Includes viewer-shell wrap/expand/pop-out + Notes write/PDF + remember UI location. Last published stays 3.0.29 until approved.

### Aug 8, 2026 - Viewer shell wrap + expand + pop-out
**Files:** shared/viewer-shell/*, viewer-popout.html, viewer-popout.js, popup.html, popup.init.js, clip-viewer.css, manifest.json
**Result:** Shared shell mounts expand/pop-out on every modal; CODE/text wraps inside modules (no horizontal chop); pop-out opens viewer-popout window.


### Aug 6, 2026 - Production package v3.0.31
**Files:** extension/manifest.json, releases/pastecraft-v3.0.31.zip, docs/publishing/*
**Result:** Bump 3.0.30 → 3.0.31 for store upload. Includes MathJax clips, AI history reference image, model persist, header MODEL spacing. Last published stays 3.0.29 until approved.

### Aug 6, 2026 - KaTeX selection → real TeX (not Unicode dump)
**Files:** clipboard-markup.js, widget.events.js, widget.drag-capture.js, widget.spot.js, clips.viewer.js, clips.render.js
**Result:** Copy of rendered KaTeX reads parent `.katex` annotation (selection only has `.katex-html`). Spot/auto-copy/drag use DOM TeX. Viewer/chips recover from meta.html when text is a Unicode math dump.

### Aug 6, 2026 - Clip markup enrich + clipboard LaTeX recover
**Files:** markup.enrich.js, markup.render.js, markup.detect.js, markup.sanitize.js, latex.strategy.js, clipboard-markup.js, widget.events.js, widget.drag-capture.js, ai-lab.summary.js, popup.html, styles.css
**Result:** Shared LaTeX/Mermaid enrich for Clip Viewer (same as AI Lab). Widget auto-copy/drag recovers TeX from KaTeX/MathJax HTML. Wider latex detect; MathML allowlist; latex chip preview safe.

### Aug 3, 2026 - testerinfo.html rewritten for v3.0.30
**Files:** website/testerinfo.html
**Result:** Replaced REDDIT100-era plan with full current coverage: image/PDF clips, widget + capture tools, AI Lab + credits, sync, gating, stress. Coupon code removed — codes now DMed manually.

### Aug 3, 2026 - Reddit coupon reactivated (2 years)
**Files:** coupon_codes table (prod)
**Result:** REDDIT-47261 expiry moved from 2026-06-12 (expired) to 2028-08-03; active, 100 max redemptions, 0 used.

### Aug 3, 2026 - Tester knowledge context + FIVERRAI coupon live
**Files:** docs/testing/TESTER_KNOWLEDGE_CONTEXT.md, coupon_codes table (prod)
**Result:** Wrote v3.0.30 tester guide covering clips/notes/widget/capture/AI Lab/credits/sync/gating. Inserted FIVERRAI coupon (1 month AI, max 25) — was scripted but never in DB. REDDIT-47261 basic coupon expired 2026-06-12.

### Aug 3, 2026 - Chrome Web Store live on website
**Files:** website/src/data/site.js, website/src/pages/index.astro, pricing.astro, upgrade.astro, website/pricing.html, upgrade.html, index.html, production-publishing-safety.mdc, docs/publishing/*
**Result:** Chrome listing `fidljmdohgkjmmgojdblbbnfoeengoko` wired sitewide; pills/CTAs show Chrome + Edge live.

### Aug 3, 2026 - Production package v3.0.30
**Files:** extension/manifest.json, releases/pastecraft-v3.0.30.zip, docs/publishing/*, production-publishing-safety.mdc
**Result:** Store rejected re-upload of 3.0.29; bumped to 3.0.30. Same Drop ghost + clipboard-writer packet. Last published stays 3.0.29 until 3.0.30 approved.

### Aug 3, 2026 - Production package v3.0.29
**Files:** extension/* (working tree), releases/pastecraft-v3.0.29.zip, docs/publishing/EXTENSION_UPDATE_PROTOCOL.md, widget.drag-capture.js
**Result:** Repackaged 3.0.29 after Drop ghost fix + clipboard-writer/AI Lab/activity. Smoke Section G before store submit.

### Jul 28, 2026 - Manifest bump to 3.0.29
**Files:** extension/manifest.json
**Result:** v3.0.28 already tagged/released; bumped manifest to 3.0.29 for next Chrome/Edge upload cycle.

### Jul 26, 2026 - v3.0.28 image clipboard + notes annotate + funky header
**Files:** extension/shared/clipboard-image.js, notes.image-annotate*, profile.render.js, offscreen-clipboard.js, manifest.json
**Result:** Image copy, notes fullscreen annotate, funky name header showcase, AI Lab picker UI; release 3.0.28.

### Jul 24, 2026 - Local→cloud migrate on upgrade
**Status:** PENDING USER VERIFY
**Files:** sync.local-to-cloud.js, sync.local-to-cloud.constants.js, sync.controller.js, sync.listener.js, sync.visibility.js, popup.init.js
**Result:** When hasCloudSyncAccess becomes true, one-shot upsert of local clips/archived/categories/notes/settings to Supabase (per-user flag `pc_local_to_cloud_migrated_v1`). Free sign-in alone skips. Needs user verify.

### Jul 24, 2026 - Freemium data-safety (Aaron-class wipe guard)
**Status:** PENDING USER VERIFY
**Files:** data-safety/* (new slice), popup.features.js, popup.init.js, auth.events.js, popup.html, styles.css
**Result:** Guest/local durability: storage canary, sync hint, IDB/restore-point auto-recover, freemium banner + honest local-risk copy. Cloud sync users still use Supabase. Needs user verify.

### Jul 19, 2026 - Support page for store listing URL
**Status:** PENDING USER VERIFY
**Files:** website/src/pages/support.astro, website/src/data/site.js, netlify.toml
**Result:** Added /support page (email, FAQs, policies); footer link; Netlify redirect /support → /support.html. Needs deploy to go live.

### Jul 17, 2026 - Premium Blue Craft Clips Batch 3 + AI modal Lucide icons
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, popup-icons.js, ai-lab.magic.js, ai-lab.history.js, ai-lab.summary.js, ai-lab.breakdown.js, craft-toolbar.events.js, popup.html, AiLucideStyles.css, request.md
**Result:** Batch 3 Craft Clips navy/glass theme; FAB + History/Summary/Breakdown Lucide icons render on open; edit-title pencil next to title. Merged PR #150 to main.
### Jul 17, 2026 - Restore AI markup vendor libs
**Status:** SUCCESS
**Files:** scripts/prepare-extension-libs.mjs, extension/lib/* (via prepare:libs)
**Result:** Restored marked/purify/highlight/katex/mermaid download path; AI chat rich formatting works. User verified.

### Jul 11, 2026 - Categories blue loader cascade (follow-up)
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, popup.html, tab-loading.js, files.render.js
**Result:** Categories tab blue premium loader cascade; files.render hooks tab-loading. User verified.### Jul 11, 2026 - Popup tab loading screens
**Status:** SUCCESS
**Files:** tab-loading.js, popup.tab-lifecycle.js, liked.render.js, popup.html, theme-blue-phase2.css
**Result:** First-visit loading states for hydrate tabs; Categories track preserved; blue premium compact files loader.

### Jul 10, 2026 - Popup startup and tab performance pass
**Status:** SUCCESS
**Files:** popup.tab-lifecycle.js, popup.init.js, clips.render.js, sync.loader.js, resource-loader.js, popup-icons.js, package.json, tests/popup-*-performance.test.mjs
**Result:** Tab lifecycle coordinator, split critical/deferred startup, hydration states, lazy heavy libs, performance instrumentation. Merged PR #129.

### Jul 10, 2026 - Premium Blue 3I (Custom Search + AI Breakdown)
**Status:** PENDING USER VERIFY
**Files:** theme-blue-phase2.css
**Result:** Batch 2 CSS decorator: Custom Search navy glass + search input gap fix; Breakdown tabs layout restored under blue + level/content/followup themed.

### Jul 10, 2026 - Liked tab page (left of Notes)
**Status:** PENDING USER VERIFY
**Files:** liked/*, popup.html, tab-nav.events.js, popup.features.js, clips.liked.js, theme-blue-phase2.css
**Result:** Liked tab left of Notes; lists liked clips with unlike/copy/open + copy-all/clear.

### Jul 10, 2026 - Liked clips (Quick View heart filter)
**Status:** PENDING USER VERIFY
**Files:** shared/liked-clips.js, clips.liked.js, clips.render.js, clips.controller.js, clips.constants.js, widget.quickview.js, widget.liked-clips.js, clips.css, theme-blue-phase2.css, manifest.json
**Result:** Heart on clip rows + QV toolbar liked filter; CRUD via `likedClipIds`. Fix: QV uses `widget.liked-clips.js` (not shared/) so widget module graph loads.




### Jun 24, 2026 - Merchant Test Lab website (all platform mocks)
**Status:** PENDING USER TEST
**Files:** website/public/merchant-test/*, website/src/pages/merchant-test/index.astro, website/src/data/site.js, netlify.toml, merchant-test-lab/*, merchant-test-lab/README.md, docs/merchant/MERCHANT-ROADMAP-AND-TEST-LAB.md
**Result:** Full mock matrix (Etsy, Printify, Shopify, Amazon, eBay, Redbubble, TeePublic, WooCommerce, generic, social promo) with individual tag inputs + data-field hooks; live at pastecraft.com/merchant-test via Astro hub + footer nav; local static serve via merchant-test-lab/.

### Jun 24, 2026 - Merchant Phase 5 snippets, Seal & Ship, dock materials
**Status:** PENDING USER TEST
**Files:** merchant.materials.js, merchant.snippets.js, merchant.seal-ship.js, merchant.constants.js, merchant.listing-dock.js, merchant.top-strip.js, merchant.events.js, merchant.controller.js, merchant.styles.js, merchant-test-lab/etsy.html
**Result:** Snippets dropdown (default library in `pc_merchant_prefs_v1`) inserts into focused field; Seal & Ship shadow-DOM confirm purges staging + Pulse empty; materials dock-only (Copy materials one-shot) — strip materials queue removed as redundant.

### Jun 24, 2026 - Merchant Phase 4 complete (tag queue + presets)
**Status:** PENDING USER TEST
**Files:** merchant.tag-queue.js, merchant.listing-dock.js, merchant.top-strip.js, merchant.events.js, merchant.controller.js, merchant.constants.js, merchant.dock-styles.js
**Result:** Tag Queue strip toggle with paste-next on tag field focus; dock Copy tags / Paste next tag; platform presets in Options popover (`pc_merchant_prefs_v1`); queueAutoAdvance pref; Options popover row alignment fix.

### Jun 24, 2026 - Merchant innovation tier plan locked (docs)
**Status:** DOC ONLY
**Files:** docs/merchant/MERCHANT-ROADMAP-AND-TEST-LAB.md, instructions/request.md (#58), implementations.md
**Result:** Locked big three (tags + materials + snippets), alt text Phase 9+ deprioritized, tier 1–3 summary, merchant-worthy criteria; #58 status Phases 1–3 on main → Phase 4 verify → 5–7. No code.

### Jun 23, 2026 - Merchant Listing Dock tag-limit presets scroll + providers
**Status:** PENDING USER TEST
**Files:** merchant.constants.js, merchant.listing-dock.js, merchant.dock-styles.js
**Result:** Scrollable preset list (~220px); added Amazon, eBay, Redbubble, TeePublic, WooCommerce with documented limits; Custom row is a pill button that reveals max-tags input + Apply custom max.
**Status:** SUCCESS
**Files:** merchant.tags.js, merchant.dock-storage.js, merchant.listing-dock.js, merchant.tag-queue.js, merchant.constants.js
**Result:** `parseSmartTagCandidates` detects AI list formats (newline, comma, bullet, pipe, tab) and word-groups space prose to platform max (Etsy 13×20). From clipboard + tags-field paste auto-normalize to comma-separated valid tags. Batch delimiter UI/pref removed; Copy tags always comma-join.

### Jun 23, 2026 - Merchant clipboard tag comma join
**Status:** PENDING USER TEST
**Files:** merchant.tag-queue.js (new), merchant.constants.js, merchant.top-strip.js, merchant.events.js, merchant.controller.js, merchant.listing-dock.js, merchant.dock-styles.js, merchant.styles.js, merchant.tags.js, merchant.dock-storage.js
**Result:** Tag Queue strip toggle (paste-next on tag field focus); dock Copy tags / Paste next tag; platform preset (Etsy/Printify/Generic) + delimiter prefs in `pc_merchant_prefs_v1`; clipboard write with fallback.

### Jun 23, 2026 - Merchant roadmap + Test Lab architecture doc
**Status:** DOC ONLY (planning)
**Files:** docs/merchant/MERCHANT-ROADMAP-AND-TEST-LAB.md, instructions/request.md (#58 cross-ref)
**Result:** Locked tags-first product decisions, feature assessment table, top-strip nav map, prefs keys, phases 1–9+, `merchant-test-lab/` spec, testing matrix. No code; not committed.

### Jun 23, 2026 - Merchant Phase 3 tags-only dock + Etsy validation
**Status:** SUCCESS (user-approved commit)
**Files:** merchant.tags.js, merchant.listing-dock.js, merchant.dock-storage.js, merchant.dock-styles.js, merchant.spot.js, merchant.constants.js, merchant-test-lab/*
**Result:** Tags-first dock UI (title/desc under Advanced); live Etsy 13×20 preview chips; dedupe/trim on save; Spot stages listing pack tags; `tagsOnlyMode: true` pref stub; Test Lab mock pages at repo root.

### Jun 23, 2026 - Merchant Phase 2 Listing Dock + Pulse
**Status:** SUCCESS (user-approved commit)
**Files:** extension/content/merchant/merchant.constants.js, merchant.dock-storage.js, merchant.pulse.js, merchant.listing-dock.js, merchant.dock-styles.js, merchant.controller.js, merchant.top-strip.js, merchant.events.js, merchant.spot.js, merchant.styles.js, merchant.layout.js (+ Phase 1 merchant files restored from feat/merchant-phase-1-top-strip)
**Result:** Ephemeral listing dock (title/description/tags) with 24h TTL in `pc_merchant_dock_staging_v1`; Merchant Pulse indicator in top strip; Shadow DOM dock panel; Spot stages page selection/listing-pack text; Seal & Ship stub disabled. Supabase row shape prep only — no cloud sync.
**Layout fix:** Strip mounts on `document.documentElement` (outside Etsy scroll/transform stacks) with hardened `position:fixed !important`, pin guard on scroll/resize, max z-index; `merchant.layout.js` compensates via html/body padding (flow sites) or fixed-shell top offset (Etsy). Class `pc-merchant-strip-active`; styles restored on unmount.

### Jun 22, 2026 - Security fundamentals docs + breach response rule
**Status:** SUCCESS (local-only — not on GitHub)
**Files:** local/security/security-fundamentals.md, local/security/*, .cursor/rules/pastecraft-security-breach-response.mdc (gitignored), docs/security/README.md, .gitignore
**Result:** Private playbooks in `local/security/` + gitignore; public repo keeps stub README only. Removed tracked vulnerability reports from git index.

### Jun 21, 2026 - AI refactor replace-on-re-refactor + remove Revert
**Status:** SUCCESS
**Files:** ai-lab.magic.js, clips.viewer.js, popup.html, popup.js, modals-shared.events.js, clip-viewer.css, request.md
**Result:** Removed Revert button (dual Original+Refactored view kept). Re-refactor resolves original source, deletes prior sibling, inserts new one; link registry pruned locally.

### Jun 21, 2026 - AI Refactor pipeline + clip viewer dual-view
**Status:** SUCCESS
**Files:** ai-refactor/index.ts, ai_workflow.ts, ai-functions.js, ai-lab.magic.js, clips.viewer.js, clip-viewer.css, popup.html, auth.js, bugfixes.md
**Result:** Haiku primary / GPT-4o fallback; sibling links + resolver hydrate; Original+Refactored viewer; diagnostics + credit gate. User confirmed SUCCESS. Commit d206cc0 on main.

### Jun 21, 2026 - AI Refactor pipeline diagnostics + error surfacing
**Status:** SUCCESS
**Files:** extension/supabase/ai-functions.js, extension/popup/features/ai-lab/ai-lab.magic.js, extension/popup.js
**Result:** End-to-end refactor fix: stop silent empty responses on Failed to fetch; log eligible/map/siblings/skipped; toast on network failure, identical text, or zero siblings; purchased-credit users pass `_hasAiAccess`.

### Jun 21, 2026 - Clip viewer refactor resolver (H1 fix)
**Status:** SUCCESS
**Files:** clips.viewer.js, ai-lab.magic.js, auth.js
**Result:** Root cause: `_refactorResolverIndex` was session-only (never rebuilt from `pc_refactorLinks_v1`); link persist was fire-and-forget. Fix: hydrate index from storage on viewer open + after craft; await link persist; store `craftRefactorSourceText`; history-text synthetic dual-view; expanded H1 flat diagnostic string.

### Jun 21, 2026 - AI Craft without clip selection
**Status:** SUCCESS
**Files:** clips.action-menu.js
**Result:** runAiCraftFromClip passed clip id string to getSelectedOrCurrentClipIdKeys (expects clip object); fallback id was empty when row unselected. Fixed to pass clip object; category idKeys call aligned.

### Jun 21, 2026 - Clip viewer refactor revert (follow-up)
**Status:** SUPERSEDED (Revert removed Jun 21 — dual view sufficient)
**Files:** clips.viewer.js, sync-clips.js, ai-lab.magic.js, ai-lab.constants.js
**Result:** Removed meta from Supabase upsert (no DB column). Viewer loads AI history + refactor links async; text/content/history-id resolver paths; local pc_refactorLinks_v1 on refactor complete.
**Status:** SUCCESS
**Files:** extension/popup.html, clips.constants.js, clips.selectors.js, clips.render.js, popup.js, tab-nav.events.js, sync.storage.js
**Result:** Total clip count beside Synced in header; visible on every tab; updates on switch, tiered load, and clip render. User confirmed SUCCESS.
### Jun 17, 2026 - Share: Send to phone QR + email protocol
**Status:** PARTIAL (iPhone QR deferred)
**Files:** clips.share.js, protocol-share.js, qr-phone-share.js, qrcode-generator.js, profile.social-share.js, popup.html
**Result:** SMS share removed; QR "Send to phone" added; email protocol fix shipped. Plain-text QR encoding improved but iPhone Camera may still open browser for URL-like clip text — user accepted; future adjust in request.md #55.

### Jun 17, 2026 - Category IDB merge on popup load
**Status:** SUCCESS
**Files:** categories-local-merge.js, sync.loader.js
**Result:** Shared mergeActiveCategoriesSources prevents stale IndexedDB from overwriting fresh chrome.storage category writes on loadData. User verified.

### Jun 16, 2026 - Drag-drop clip full CRUD pipeline
**Status:** SUCCESS
**Files:** extension/background/shared.js, extension/background/handlers/messages-internal.js, extension/popup/shared/popup-messaging.js, extension/popup/features/clips/clips.title.js
**Result:** Quick View delete now purges IDB + enqueues Supabase tombstones + clipsUpdated popup refresh; title edits mirror IDB. Create/read already on unified save pipeline. User verified.

### Jun 16, 2026 - Widget drag-drop → Clips page sync
**Status:** SUCCESS
**Files:** clips-local-merge.js, background/shared.js, sync.loader.js, popup-messaging.js
**Result:** Shared merge-by-id/timestamp; widget save mirrors IDB + sync queue; popup refreshes on clipSaved. User verified.

### Jun 16, 2026 - Quick View Menu (Stable Architect)
**Status:** SUCCESS
**Files:** widget.js, shared.js, messages-internal.js
**Result:** Fixed srcdoc postMessage targetOrigin, Quick View clip delete with tombstones, storage refresh iframe selector. User verified in Stable Architect.

### Jun 11, 2026 - Album attachment viewer modal + AI toolbar
**Status:** Pending verification
**Files:** notes.album-attachment.viewer.js, notes.album.js, notes.events.js, notes.controller.js, notes.constants.js, popup.html, popup.js
**Result:** Album row click opens attachment modal with details; bottom-left AI icons match clip viewer; Edit/Delete/Copy/› unchanged.

### Jun 11, 2026 - Album interlaying edit modal
**Status:** SUCCESS
**Files:** notes.album-interlaying.editor.js, notes.album.js, popup.html, notes.controller.js, notes.events.js, popup.js
**Result:** Album attachment Edit opens inline modal; saves via updateAlbumInterlaying without opening full note editor. User verified.

### Jun 11, 2026 - One-click copy + local profile image
**Status:** SUCCESS
**Files:** popup.html, clips.render.js, settings.storage.js, profile.events.js, profile-sync.js
**Result:** Clips-tab one-click copy toggle with saved preference; gallery removed from AI Lab; profile upload is local-only single image.

### Jun 8, 2026 - Text-only AI credits + upload gallery
**Status:** SUCCESS
**Files:** stripe-webhook/index.ts, ai_workflow.ts, ai-image/index.ts, extension/popup.html, profile/*, billing.constants.js, website/src/data/site.js
**Result:** Disabled AI image generation end-to-end; preserved upload/gallery/profile/widget icon flows. New Enhanced text credits: 4k/week (20k cap), 35k/month, 500k/year.

### Jun 5, 2026 - Upgrade modal billing interval toggles
**Status:** PENDING USER VERIFY
**Files:** billing.constants.js, billing-upgrade.events.js, popup.html
**Result:** Upgrade modal now shows Weekly/Monthly/Yearly toggle for Basic ($0.99/$1.99/$9.99) and Weekly-only for Enhanced ($3.99). Active interval drives price ID sent to _createCheckout.

### Jun 5, 2026 - Enhanced $3.99 weekly Stripe price
**Status:** PENDING USER VERIFY
**Files:** billing.constants.js, billing-upgrade.events.js, stripe-webhook/index.ts, popup.html, site.js, pricing.html, upgrade.html, pricing.astro, upgrade.astro
**Result:** New checkouts use price_1Tf3UoLOdeLTrjap4O8BGFvS ($3.99/wk, 24 img / 4000 text credits). Grandfathered monthly price_1SUYs3LOdeLTrjapCFFDe7td kept in webhook. Display updated $4.99/mo → $3.99/wk.

### Jun 4, 2026 - Snyk OAuth CI + refresh script
**Status:** SUCCESS
**Files:** security-scans.yml, scripts/refresh-snyk-oauth-secret.ps1, .cursor/rules/snyk-oauth.mdc
**Result:** Snyk CI kept with SNYK_OAUTH_TOKEN (+ SNYK_TOKEN fallback). Refresh script syncs local `snyk auth` token to gh secret. Cursor rule reminds on Snyk ops.

### Jun 4, 2026 - Custom Search in Google search menu
**Status:** PENDING USER VERIFY
**Files:** clips.action-menu.js
**Result:** Added third Google search menu option "Custom Search"; opens native prompt pre-filled with clip text so user can edit query before Google opens. Shared menu covers clips list, search results, categories, and clip viewer.

### Jun 4, 2026 - Custom Search CRUD on clip Google menu
**Status:** PENDING USER VERIFY
**Files:** clips.custom-search.constants.js, clips.custom-search.service.js, clips.custom-search.modal.js, clips.action-menu.js, clips.controller.js, modals-shared.events.js, popup.js, popup.html, tests/custom-search-crud.test.mjs
**Result:** Shared PasteCraftCRUD service persists saved search templates in chrome.storage.local (`pc_custom_searches`). Menu lists saved templates; Custom Search modal supports create/update/delete, preview, Search now; usage logged to `pc_custom_search_usage`. Sanitized Google URL building; modal has ARIA/focus trap.

### Jun 4, 2026 - Google search action on clip icons
**Status:** SUCCESS
**Files:** clips.action-menu.js, clips.render.js, clips.events.js, clips.viewer.js, modals-shared.events.js, popup.js, popup.html, google-logo.svg
**Result:** Google logo button on clip surfaces opens mini-portal menu with "Do a vague search" and "Search for meaning"; each option opens the correct Google search URL. User verified.

### Jun 5, 2026 - Clip action icons verification (Google + bundles)
**Status:** SUCCESS
**Files:** clips.render.js, clips.action-menu.js, clips.events.js, popup.html, google-logo.svg
**Result:** User reloaded extension; Google search button and org/AI bundle menus visible on clip rows. Stale unpacked build was the cause, not missing code.

### Jun 4, 2026 - Clip action icon bundles
**Status:** SUCCESS
**Files:** clips.action-menu.js, clips.render.js, clips.events.js, clips.controller.js, popup.html
**Result:** Clips/Search/Categories rows use two bundle buttons (org + AI). Mini-portal menu opens on click with sub-actions; AI Craft opens Craft Clips modal with clip pre-selected.

### Jun 3, 2026 - Album interlayings CRUD
**Status:** PENDING USER VERIFY
**Files:** notes.album-interlayings.crud.js, notes.album.js, notes.editor.js, notes.events.js, notes.render.js, popup.html, popup.js, tests/album-interlayings-crud.test.mjs
**Result:** Album Notes list items use PasteCraft CRUD via mutateNote; viewer Edit/Delete, Edit Album footer, source overlay Edit Note; album editor saves clips/urls/images.

### Jun 2, 2026 - Quick Save category dropdown CRUD sync
**Status:** PENDING USER VERIFY
**Files:** categories.render.js, categories.service.js, sync.listener.js, tab-nav.events.js
**Result:** Quick Save/PDF dropdowns use `app.categories` (newest first) instead of clip-derived names. Category CRUD + sync listeners refresh `updateManualInputCategories()`.

### May 31, 2026 - AI Lab input validation + refactorization opt-in
**Status:** PENDING USER VERIFY
**Files:** ai-lab.input-validation.js, ai-lab-page.events.js, ai-lab.constants.js, ai-lab.refactorization.js, ai-lab.summary.js, ai-lab.breakdown.js, ai-functions.js, popup.html
**Result:** Restored stashed 1-word minimum for Summary/Breakdown/follow-ups; 12k char limits; refactorization clips start unchecked (Select all optional). Backend RAG enrichment not included (stripped in ae85316).
**Status:** SUCCESS
**Files:** extension/popup/features/ai-lab/ai-lab.credit-error.js (new), ai-lab.breakdown.js, ai-lab.summary.js, popup.html
**Result:** Added `isOutOfCreditsError` + `showCreditExhaustedInline` helper. When backend returns 402 "No * credits remaining", AI Lab catch blocks now render a styled amber card with "Buy Credits" (scrolls to credit pack banner) and "Upgrade Plan" (opens upgrade modal) instead of the generic error toast.

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

### Jun 4, 2026 - Bug fix: Custom Search preview always visible on URL input
**Status:** FIXED
**Files:** clips.custom-search.modal.js, popup.html
**Result:** `updatePreview` now explicitly sets `previewEl.style.display = 'block'` on every call, preventing any external display toggle from hiding it. Added try-catch around `getClipTextFromContext` so an exception in `app.getSelectedOrCurrentText` no longer aborts the render — fallback text always shows. CSS also made explicit with `display: block` on `.custom-search-preview`. 10/10 tests pass.

### Jun 4, 2026 - Custom Search modal UX v2 (site: prefix + drag-to-insert)
**Status:** PENDING USER VERIFY
**Files:** popup.html, clips.custom-search.modal.js, clips.custom-search.constants.js, tests/custom-search-crud.test.mjs
**Result:** Added visual `site:` prefix to URL input (strip from stored template on load, prepend on save/search). TLD detection hint appears when domain is typed. Disclaimer added below Preview label. `mouseup` on preview captures selected text → `click` anywhere in modal (non-button, non-preview) appends it to URL input. `{clip}` backward compatible. 10/10 tests pass.

### Jun 4, 2026 - Custom Search modal UX
**Status:** PENDING USER VERIFY
**Files:** extension/popup.html, clips.custom-search.modal.js, clips.custom-search.service.js, clips.custom-search.constants.js, clips.action-menu.js, tests/custom-search-crud.test.mjs
**Result:** Renamed "Search template" to "Website URL". `{clip}` is optional — URL/query searched as-is without it. Placeholder and hint document behavior. Saved searches without `{clip}` no longer require clip text.

### Jun 4, 2026 - Google Search navigates active tab
**Status:** PENDING USER VERIFY
**Files:** clips.action-menu.js, clips.custom-search.modal.js
**Result:** Replaced `chrome.tabs.create` (new tab) with `chrome.tabs.query+update` (navigate current tab) for all three search actions: vague search, search for meaning, and custom search (Search Now + saved templates). Manifest already had `tabs` permission — no change needed.

### Jun 21, 2026 - Clip viewer refactor resolver v2 (float ID + heuristic)
**Status:** PENDING USER VERIFY
**Files:** clips.state.js, clips.viewer.js, ai-lab.magic.js
**Result:** getClipIdKey normalizes legacy float ids; refactor links persist + hydrate before results modal; heuristic-recent fallback for same-session pairs; gated H1 debug spam.

**Status:** PENDING USER VERIFY
**Files:** extension/popup.js, extension/popup.html, extension/popup/shared/popup-ui.js, extension/popup/shared/popup-messaging.js, extension/popup/features/clips/clips.preview.js, extension/popup/features/clips/clips.controller.js
**Result:** Extracted UI utilities (toast/overlay/confetti/escapeHtml), craft preview (updatePreview/delimiter/toggles), background message handler. Thin delegates kept on PasteCraftPopup. CodeScene new files: 9.68 / 9.66 / 9.52. Deferred: _initImpl, auth callbacks, restore+repairLocalClipIds, PDF, AI breakdown, profile AI, visibility listener.

### Jun 22, 2026 - Custom Search popup module overhaul
**Status:** SUCCESS
**Files:** clips.custom-search.module.js, clips.custom-search.service.js, clips.custom-search.constants.js, clips.action-menu.js, clips.controller.js, modals-shared.events.js, popup.js, popup.html, tests/custom-search.test.mjs
**Result:** Replaced saved-search modal with popup module: clip preview, read-only highlight input, editable question input, Search Google on active tab. Removed CRUD, site: templates, and pc_custom_searches storage. User verified SUCCESS.

### Jun 23, 2026 - Listing Dock tag limit Options
**Status:** SUCCESS (UI alignment PARTIAL � see PartialLog)
**Files:** merchant.constants.js, merchant.tag-queue.js, merchant.listing-dock.js, merchant.dock-styles.js
**Result:** Options button beside Tags label opens preset popover (Etsy 13, Shopify 250, Printify 20, Custom). Selection persists; hint, validation, smart paste, and tag queue respect chosen max. Etsy Options row alignment bug pending fix.

### Jun 25, 2026 - Merchant tag queue chip submit (Etsy paste+Enter)
**Status:** SUCCESS
**Files:** merchant.tag-submit.js, merchant.tag-queue.js
**Result:** Chip-style tag inputs sync paste events; trusted Enter commits via native flow; _committing blocks recursion; queue advances on commit success via onCommitSuccess.

### Jul 9, 2026 - Blue Dark Mode Phase 3 (Remaining Surfaces)
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, merchant.spot.js
**Result:** Remaining surfaces (merchant spot, clip-title, primitives, search) themed under blue dark mode. theme-blue-phase2.css contains all scoped overrides.

### Jul 9, 2026 - AI Lab Blue Dark Mode premium grade
**Status:** SUCCESS
**Files:** theme-blue-phase2.css, popup.html
**Result:** Phase 3D AI Lab navy glass + white-on-blue contrast; tabs/cards/summary/rf/bd; credit-buy CSS brace fix.

### Jul 9, 2026 - Restore feat/blue-dark-mode (white Clip Joiner)
**Status:** SUCCESS
**Files:** feat/blue-dark-mode @ 492f8a1
**Result:** Restored Phase 3 checkout; discarded broken main WIP that left Clip Joiner white.

### Jul 11, 2026 - Activity History HTML escape
**Status:** SUCCESS
**Files:** activity.render.js
**Result:** Escape clip text in activity rows so feed no longer nests/breaks.

### Jul 24, 2026 - Signup confirm email redirect + guards
**Status:** SUCCESS
**Files:** extension/supabase/auth/auth.js, extension/popup/features/auth/auth.events.js, website/public/js/account-auth.js
**Result:** emailRedirectTo pastecraft.com/account; already_registered empty-identities guard; skip subscription without session; honest resend copy; website verified-email notice after confirm hash.

### Jul 24, 2026 - Release v3.0.27 (production signup fix)
**Status:** SUCCESS
**Files:** extension/manifest.json @ ef647fb
**Result:** Patch release ships confirm-email redirect to pastecraft.com/account, already_registered guard, session-gated subscription, account verified landing.

### [2026-08-29] - Remove footer follow-me profiles
**Status:** PARTIAL
**Files:** website/src/components/Footer.astro, website/src/data/site.js
**Result:** Removed the footer “follow me at” column and personal Instagram/X @casiezeq links. Official Facebook/Reddit stay in data for schema only. Not live until deploy.

### [2026-08-10] - Classic light mode UI + starlight
**Status:** SUCCESS
**Files:** popup.html, header.starlight.js, popup.boot.js, widgets.parse.js, theme-blue-phase2.css, star-shooting.png
**Result:** Launch-ready light wrap and starlight header; user verified UI iterations.

