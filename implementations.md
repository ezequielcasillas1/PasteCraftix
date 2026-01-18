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
**Result:** Renamed “Funky Name” → “Funky Animal Name” and updated AI name prompt to remix the user’s typed name while ending with a valid animal.



