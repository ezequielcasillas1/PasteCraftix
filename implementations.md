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

### Feb 6, 2026 - AI Lab Credit Pills (Image + Text)
**Status:** PARTIAL
**Files:** extension/popup.html, extension/popup.js
**Result:** Renamed "Credits" to "Image credits" and added a right-side "AI text credits" pill (currently unlimited unless text credit caps are added).

### Feb 5, 2026 - AI Provider + GPT-5 Workflow Override
**Status:** SUCCESS
**Files:** extension/popup.html, extension/popup.js, extension/supabase-client.js, extension/content-script.js, supabase/functions/_shared/ai_workflow.ts, supabase/functions/ai-{summary,breakdown,name,hint,trends,vision,image}/index.ts
**Result:** Added AI workflow override toggle + provider/workflow dropdowns in AI Lab. Presets: Default (4o), Cheapest (GPT-5 Nano/Mini), Latest (GPT-5.2). Config persists in chrome.storage.sync/local. All AI requests pass workflow config; edge functions resolve models via allowlisted presets with safe fallbacks.
