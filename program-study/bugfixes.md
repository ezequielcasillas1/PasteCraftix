### Jun 2, 2026 - Quick Save stale category list
**Status:** PENDING USER VERIFY
**Files:** categories.render.js, categories.service.js, sync.listener.js, tab-nav.events.js
**Result:** Dropdown showed deleted/legacy names from clips and ignored new CRUD categories. Fixed source-of-truth + refresh hooks on category mutations and sync events.

### Jun 2, 2026 - AI Summary stale context on new clip
**Status:** SUCCESS
**Files:** ai-lab.summary-modal.js, ai-lab.session-state.js
**Result:** Sending clips to AI Summary now clears old questions/threads/results before loading new clip text (matched breakdown reset behavior).

### Jan 4, 2026 - Pre-publish Cleanup
**Status:** SUCCESS
**Files:** popup.js, website/pricing.html, content-script.js
**Result:** Removed debug/instrumentation (local ingest calls + debug UI) to prep for Edge Store publish.


