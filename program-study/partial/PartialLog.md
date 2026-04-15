# Partial Log

**Purpose:** Document partially working implementations

---

## Format for each entry:
```
### [YYYY-MM-DD] - [Feature Name]
**Commit:** [SHA if available]
**Files:** [List key files]
**What Works:** [Description]
**What's Missing:** [Description]
**Next Steps:** [What needs to be done]
```

---

## Entries:

### 2026-04-14 - Password Reset Return Flow
**Commit:** 62edbc7
**Files:** auth-site/index.html, extension/index.html, extension/callback-hosted.html, extension/popup.js, extension/background.js
**What Works:** Extension recovery/session plumbing exists and popup can enter recovery mode when given the correct recovery hash or storage callback.
**What's Missing:** Live `auth.pastecraft.com` flow still lands on the hosted auth page and does not reliably return users into the widget reset UI; the deployed auth page (`auth-site/index.html`) is still using the older website-first instructions.
**Next Steps:** Tomorrow, move reset UX fully into the widget login screen: show “pending password reset” inside the PC login interface, open new-password UI there, and keep the email link page as a simple thank-you/confirmation page only.

### November 12, 2025 - Offline Mode & Realtime Cross-Device Sync
**Status:** ⚠️ PARTIAL
**Commit:** 4dd0fb6
**Files:** supabase-client.js, popup.js, popup.html, instructions/refresh.md, instructions/request.md
**What Works:**
- Offline detection via navigator.onLine + online/offline events
- Sync queue persists in chrome.storage.local
- Operations auto-queue when offline (clips, categories, archived clips, settings, profiles)
- Auto-process queue when connection restored
- Sync status indicator UI (🔴 Offline | 🟡 Syncing | 🟢 Synced)
- Supabase Realtime WebSocket subscriptions for 5 tables
- Real-time UI refresh with toast notifications
- Event-driven architecture with CustomEvents
**What's Missing:**
- User testing to confirm offline → online transitions work reliably
- Testing with multiple devices to verify realtime sync
- Edge case testing (slow connections, intermittent offline)
- Verification that queue persists across browser restarts
- Testing sync conflict resolution with simultaneous edits
**Next Steps:**
- Test offline mode by disconnecting network
- Test queue persistence by restarting browser while offline
- Test realtime sync with 2+ devices/browsers simultaneously
- Monitor for race conditions or sync conflicts
- Verify queue processes correctly after extended offline periods

### 2026-01-06 - Support Email Send (Netlify Function 404)
**Status:** PARTIAL
**Files:** extension/popup.js, netlify/functions/support-ticket.js
**Result:** Support form POST returns 404 because Netlify site isn’t deploying functions yet; connect site to GitHub repo or deploy via Netlify CLI. (Commit: 10a2dfc)

### 2026-01-19 - Category Deletion Still Broken (Post Bugfix Stacking)
**Status:** ⚠️ PARTIAL
**Commit:** 50c2b04
**Files:** extension/popup.js, extension/supabase-client.js, extension/background.js, bugfixes.md
**What Works:** Clip persistence after refresh (updatedAt marker); deletion flow updates UI faster.
**What's Missing:** Category deletion still unreliable after refresh/sync; needs deeper fix.
**Next Steps:** Reproduce + trace sync/resurrection path; harden delete flow and sync ordering.

### 2026-02-20 - Cross-Device Sync Panel Fix
**Status:** ⚠️ PARTIAL
**Files:** extension/popup.html, extension/popup.js
**Result:** Fixed 3 bugs: CSS duplicate `display:flex` hiding toggle, `overflow-y:hidden` blocking scroll, clips with null `device_id` breaking device filter. Needs live multi-device test to confirm end-to-end.

### 2026-04-15 - Auto-Ban + Security Layer + Admin Dashboard
**Status:** ⚠️ PARTIAL
**Files:** supabase/functions/_shared/security-gate.ts, ai_workflow.ts, redeem-coupon, create-checkout, ai-image, supabase/functions/admin-api/index.ts, admin/index.html, admin/admin.js, admin/admin.css, admin/config.js
**Result:** DB migrations (security_events, admin_users, ban metadata, RLS ban gate, auto-ban trigger, coupon abuse flag, content scan) applied. All Edge Functions redeployed with ban gate. Admin dashboard built (localhost-only, gitignored): users table, security events feed, rate violations log, user detail panel, ban/unban/limit/delete actions. admin-api Edge Function deployed. Needs admin_users row inserted + live smoke test to confirm SUCCESS.

### 2026-02-20 - Cross-Device Ownership + Feed Merge
**Status:** ⚠️ PARTIAL
**Files:** extension/supabase-client.js, extension/popup.js
**Result:** Preserved per-clip `device_id` during upserts and removed text-only dedupe in device feed so Device A clips stay attributable on Device B. Existing rows previously overwritten in Supabase need live validation/rewrite.
