# Browser Extension Agent Guide

Master context file loaded every session.

## Project Overview

Vanilla HTML + CSS + JavaScript browser extension (Manifest V3).
Targets: Chrome, Edge (Chromium), Brave, Arc -- all Chromium browsers.
Backend: Supabase (PostgreSQL + Auth + Edge Functions on Deno).
Payments: Stripe (subscriptions + one-time) via Supabase Edge Functions.

Official Documentation:
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/intro/
- Supabase: https://supabase.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Stripe Webhooks: https://docs.stripe.com/webhooks
- Shadow DOM: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- Edge Extensions: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/

## Directory Map

```
extension/
  manifest.json
  background/service-worker.js       Event-driven; no memory state
  background/handlers/               One file per message type
  content/content.js                 Entry only; delegates to modules/
  content/modules/                   Feature logic + Shadow DOM factory
  content/widget.css                 Injected styles (inside shadow root)
  popup/popup.html + popup.js + popup.css
  options/options.html + options.js + options.css
  shared/api.js                      Supabase client (singleton)
  shared/auth.js                     Session helpers
  shared/store.js                    Observer-based state
  shared/messaging.js                sendToBackground helper
  shared/storage-adapter.js          chrome.storage adapter for Supabase
  shared/constants.js                STORAGE_KEYS, MESSAGE_TYPES, SUBSCRIPTION
  assets/styles/tokens.css           CSS custom properties only

supabase/
  migrations/YYYYMMDDHHmmss_*.sql    One file per schema change
  functions/create-checkout/         Stripe session creator
  functions/stripe-webhook/          Webhook receiver + DB updater
  functions/check-subscription/      Auth-gated status check
```

## Golden Rules (Apply to Every Task)

1. IDs come from the server only. userId comes from session.user.id. Postgres assigns all entity IDs via gen_random_uuid(). The extension NEVER generates IDs. Read id-management skill before touching any id field.

2. All injected UI runs inside a Shadow DOM. Never inject bare HTML/CSS into the host page. Read css-isolation skill before any content script UI work.

3. Service worker state lives in chrome.storage only. Variables reset when the service worker terminates. Read background-service skill.

4. Stripe secret keys never leave Edge Functions. The extension only receives a checkout URL. Read stripe-payments skill.

5. Every Supabase table must have RLS enabled. No table without a policy. Read db-migrations skill.

6. MV3 CSP forbids inline scripts and onclick handlers. All JavaScript in external module files.

7. Minimum permissions. Only request what is actively used in manifest.json.

8. Do NOT use browser.* namespace. Use chrome.* -- all Chromium browsers support it.

## Skill Load Map

| Task | Skill to load |
|---|---|
| Content script UI or logic | content-script |
| Injecting CSS into pages | css-isolation |
| Service worker / background | background-service |
| Popup, options pages | popup-ui |
| Supabase queries, auth, RLS | supabase-backend |
| Stripe checkout or webhooks | stripe-payments |
| SQL migration files | db-migrations |
| ID fields, userId, entity IDs | id-management |
| Naming, modules, conventions | core-conventions |
| Full system reference | docs/agent-guides/architecture.md |
