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

