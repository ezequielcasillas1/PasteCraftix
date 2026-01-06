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

