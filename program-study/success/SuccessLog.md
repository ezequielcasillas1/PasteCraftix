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



### 2026-05-15 - Activity Log — Deleted Item Recovery
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
