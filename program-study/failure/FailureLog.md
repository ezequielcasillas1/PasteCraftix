# Failure Log

**Purpose:** Document failed implementations to learn from

---

## Format for each entry:
```
### [YYYY-MM-DD] - [Feature Name]
**Commit:** [SHA if available]
**Files:** [List key files]
**What Failed:** [Description]
**Why It Failed:** [Root cause]
**Lessons:** [What to avoid/try differently]
```

---

## Entries:

### [2026-08-14] - Image Picker Opera site-permission grant
**Status:** FAILURE
**Commit:** uncommitted
**Files:** grant-site-access.html, grant-site-access.js, popup/features/site-access/*, optional-permissions.js, capture.handler.js, widget.capture-menu.js, popup.html, popup.boot.js
**What Failed:** Image Picker / Capture Tools cannot get MV3 optional `<all_urls>` host permission on Opera. Grant tab and toolbar popup Allow site access both failed in user test.
**Why It Failed:** Opera blocks `chrome-extension://…/grant-site-access.html` with ERR_BLOCKED_BY_CLIENT. Skip-tab + popup `chrome.permissions.request` path also did not grant; Image Picker still blocked.
**Lessons:** Do not treat Chrome/Edge grant-tab or Opera popup skip as verified. Opera optional-host grant remains a bottleneck until a working path is confirmed.

