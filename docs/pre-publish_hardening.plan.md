---
name: Pre-publish hardening
overview: Remove debug instrumentation, add popup support-email icons with forms that auto-send via Netlify+Resend to your Neo Space inboxes, and improve the account page with password management and email preferences before Edge Store launch.
todos:
  - id: make-icons-folder
    content: Create folder for user-provided support icons and decide file naming convention used by popup.
    status: completed
  - id: popup-support-icons-ui
    content: Add 5 support icons next to popup close button and create reusable modal UI shell.
    status: completed
    dependencies:
      - make-icons-folder
  - id: netlify-resend-function
    content: Implement Netlify Function to validate Supabase session and send email via Resend to correct inbox; add env var doc.
    status: completed
  - id: popup-submit-wiring
    content: Wire popup modal submission to Netlify Function; map each icon to destination inbox and per-form schema placeholder.
    status: completed
    dependencies:
      - popup-support-icons-ui
      - netlify-resend-function
  - id: account-password-preferences
    content: "Update website account page: password reset email + marketing opt-in stored in Supabase user_metadata."
    status: completed
  - id: remove-debug-instrumentation
    content: Remove localhost ingest logs and debug UI across popup.js, website/pricing.html, content-script.js; scan for remaining debug overlays.
    status: completed
---

# Pre-publish release polish

## Scope
- Remove all debug/instrumentation UI and local ingest calls before publishing.
- Add support icons next to the popup exit button and implement 5 forms (teams/help/support/reportbugs/howcanweimprove) that auto-send to your business inboxes.
- Revise the website account page to include password management and email preferences.
- Recommend tracking/analytics + security hardening steps for “go public”.

## Key code areas
- Extension popup UI: `extension/popup.html`, `extension/popup.js`
- Extension content script (debug button removal): `extension/content-script.js`
- Website pages (remove debug calls + account revisions): [website/account.html](c:\Users\ezequiel-casillas\OneDrive\Documents\PasteCraft\website\account.html), [website/pricing.html](c:\Users\ezequiel-casillas\OneDrive\Documents\PasteCraft\website\pricing.html)
- Netlify backend email relay (new): `netlify/functions/*` + [netlify.toml](c:\Users\ezequiel-casillas\OneDrive\Documents\PasteCraft\netlify.toml) (if needed)

## Implementation approach
### 1) Create icons folder (you will drop assets here)
- Create `assets/support-icons/` (or `assets/ui/support/`) and reference those files from `popup.html`.

### 2) Popup: add support icons and forms
- Update `popup.html` top bar (`#signOutContainer`) to include 5 icon buttons immediately left of the close `×` button.
- Add a single reusable modal in `popup.html` (title + info text + inputs + send button).
- In `popup.js`, implement:
  - A mapping: icon → destination email + form schema (you’ll provide per-email fields next)
  - Prefill sender as the logged-in user’s email (read from existing auth state)
  - Submit handler that calls a Netlify Function to send email
  - UX: disable send while submitting, show success/failure toast/message

### 3) Backend: Netlify Function + Resend
- Add `netlify/functions/support-ticket.(js|ts)` that:
  - Requires a valid Supabase session (Authorization Bearer token) to submit (anti-spam)
  - Validates payload length and required fields
  - Sends an email via Resend to the correct inbox (help/support/reportbugs/howcanweimprove/team)
  - Uses Resend env var `RESEND_API_KEY`
  - Uses Supabase env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY` to validate the user session
- Add minimal rate limiting:
  - Default: per-user cooldown (stored in Supabase `support_tickets` table) OR short in-memory fallback if you don’t want DB.

### 4) Website: account page password + email preferences
- In `website/account.html`:
  - Replace “Settings coming soon…” with:
    - **Manage password**: “Send password reset email” (Supabase reset email)
    - **Preferences**: marketing/product update opt-in toggle stored in Supabase `user_metadata` (e.g., `marketing_opt_in`)

### 5) Remove debug/instrumentation before publishing
- Remove local ingest calls in:
  - `popup.js` (multiple `fetch('http://127.0.0.1:7244/ingest/...')` blocks)
  - `website/pricing.html` (guarded `isLocal && fetch('http://127.0.0.1:7244/ingest/...')` blocks)
- Remove/disable debug UI in `content-script.js` (debug sticky footer button + noisy debug logging), or gate it behind an explicit local/dev flag.
- Search and remove any remaining debug overlays in website/extension code.

## Tracking / analytics recommendations (before Edge Store)
- Downloads/uninstalls: Microsoft Partner Center analytics (Edge Add-ons portal)
- Paid churn/loyalty: Stripe Dashboard + Stripe webhooks → `user_subscriptions`
- Product analytics (extension + website): PostHog or Amplitude (optional) with privacy controls

## Security hardening checklist (practical)
- Ensure least-privilege extension permissions in `manifest.json`.
- Ensure Supabase tables have RLS enabled and policies are correct.
- Keep all secrets server-side (Resend key only in Netlify env).
- Validate/limit support form payload sizes; implement rate limiting.
- Remove debug endpoints/loggers and any localhost ingest calls.


