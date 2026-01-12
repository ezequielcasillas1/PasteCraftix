### Jan 4, 2026 - Pre-publish Cleanup
**Status:** SUCCESS
**Files:** popup.js, website/pricing.html, content-script.js
**Result:** Removed debug/instrumentation (local ingest calls + debug UI) to prep for Edge Store publish.

### Jan 4, 2026 - Popup Instant Clip Refresh + Repo-Loader Paths
**Status:** SUCCESS
**Files:** extension/popup.js, extension/content-script.js, manifest.json, extension/manifest.json, extension/background.js
**Result:** Popup updates immediately after saving clips (no page refresh); fixed repo-root loader resource URLs; cleaned debug instrumentation.

### Jan 7, 2026 - Cross-tab Settings Sync (Auto Copy)
**Status:** SUCCESS
**Files:** extension/content-script.js
**Result:** Fixed auto-copy enabled/disabled not reflecting across tabs; added storage-based sync for widget/quick paste settings.

### Jan 7, 2026 - Albums Attachments Not Opening
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/attachment-viewer.html, extension/attachment-viewer.js
**Result:** Removed broken attachment copy UX in albums; attachments now open (popup default) with optional overlay/back mode.

### Jan 11, 2026 - Albums Reflect Updated Notes
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Albums now re-sync after note updates (save note or add clip), so new clips/URLs reflect immediately.

### Jan 11, 2026 - Album Viewer Missing Note Context + Copy
**Status:** SUCCESS
**Files:** extension/popup.js
**Result:** Album viewer shows source note title/description/body per attachment and adds per-item quick copy.

### Jan 11, 2026 - Album Click Opens Full Note (Not Bundled)
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js
**Result:** Clicking an album item opens the full source note overlay with clips/urls/images + per-item copy; attachment open is secondary.

