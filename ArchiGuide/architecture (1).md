# Architecture Deep Reference

Full reference for the browser extension + Supabase backend system.

References:
- Chrome Extension MV3: https://developer.chrome.com/docs/extensions/mv3/intro/
- Supabase Architecture: https://supabase.com/docs/guides/functions/architecture
- Shadow DOM (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- Edge (Chromium): https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/

## Full Directory Map

```
my-extension/
├── manifest.json
├── background/
│   ├── service-worker.js         # Entry; delegates to handlers
│   └── handlers/
│       ├── auth.handler.js
│       ├── checkout.handler.js
│       └── feature.handler.js
├── content/
│   ├── content.js                # Entry; imports feature modules
│   ├── widget.css                # Injected inside shadow root
│   └── modules/
│       ├── ui-injector.js        # Shadow DOM factory
│       ├── messaging.js          # sendToBackground helper
│       └── feature-a.js         # One file per feature
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── shared/
│   ├── api.js                    # Supabase client
│   ├── auth.js                   # Session helpers
│   ├── store.js                  # Observer state
│   ├── messaging.js              # Shared message util
│   ├── storage-adapter.js        # chrome.storage adapter for Supabase
│   └── constants.js              # STORAGE_KEYS, MESSAGE_TYPES, etc.
└── assets/
    ├── icons/
    └── styles/
        └── tokens.css            # CSS custom properties only

supabase/
├── migrations/
│   ├── 20260331120000_create_profiles.sql
│   └── 20260331130000_create_entries.sql
└── functions/
    ├── create-checkout/
    │   └── index.ts              # Stripe checkout session creator
    ├── stripe-webhook/
    │   └── index.ts              # Webhook receiver + DB updater
    └── check-subscription/
        └── index.ts              # Auth-gated status check

.claude/
└── skills/
    ├── id-management/SKILL.md
    ├── css-isolation/SKILL.md
    ├── background-service/SKILL.md
    ├── content-script/SKILL.md
    ├── popup-ui/SKILL.md
    ├── supabase-backend/SKILL.md
    ├── stripe-payments/SKILL.md
    ├── db-migrations/SKILL.md
    └── core-conventions/SKILL.md

docs/agent-guides/
├── architecture.md               # this file
└── data-flow.md                  # full end-to-end flows
```

## Component Responsibilities

| Component | Responsibility | Must NOT |
|---|---|---|
| `service-worker.js` | Route messages, open tabs, trigger auth | Store state in memory |
| `content.js` | Init feature modules, check auth, inject UI | Call Supabase directly |
| `content/modules/` | Feature logic on host pages | Contain inline styles or id generation |
| `popup.js` | UI state, user actions | Contain business logic |
| `shared/api.js` | Single Supabase client | Be imported from content scripts directly |
| `shared/auth.js` | Session read/write | Generate or store userId separately |
| Edge Functions | Server-side logic, Stripe, DB admin writes | Be called with secret keys from the extension |

## Context Isolation (Important for Content Scripts)

Content scripts run in an isolated world -- they cannot access the host page's JS variables,
and the host page cannot access the extension's content script variables.

The extension has 3 separate JS contexts:
1. Service worker (background) -- has full chrome.* API access
2. Popup / options pages -- have full chrome.* API access
3. Content scripts -- limited chrome.* API (mainly chrome.runtime, chrome.storage.local)

Content scripts cannot call chrome.tabs, chrome.windows, or chrome.identity.
For those operations, they must send a message to the service worker.
Reference: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

## Data Flow: User Creates an Entry

```
1. User types in content script widget (Shadow DOM)
2. content/modules/feature-a.js collects form data
3. sendToBackground({ type: 'feature:create', title, body })
4. service-worker.js routes to feature.handler.js
5. feature.handler.js calls shared/auth.js -> getUserId() -> session.user.id
6. feature.handler.js calls supabase.from('entries').insert({ title, body, user_id: userId })
   -- id is OMITTED -- Postgres assigns gen_random_uuid()
7. Supabase returns { id: 'server-uuid', title, body, user_id, created_at }
8. sendResponse({ ok: true, entry: data })
9. content script renders the new entry using data.id from the response
```

## Data Flow: Stripe Payment

```
1. User clicks Upgrade in popup
2. popup.js sends message { type: 'checkout', priceId, userEmail }
3. checkout.handler.js POSTs to Supabase Edge Function: create-checkout
   -- Authorization: Bearer {supabase_anon_key} header included
   -- userId NOT in body -- Edge Function extracts from JWT
4. Edge Function verifies JWT, calls stripe.checkout.sessions.create()
   -- metadata: { supabase_user_id: user.id } stored on Stripe session
5. Edge Function returns { checkout_url }
6. Background opens chrome.tabs.create({ url: checkout_url })
7. User completes payment on Stripe hosted page
8. Stripe POSTs to stripe-webhook Edge Function
9. Webhook verifies Stripe-Signature header
10. Webhook reads userId from event.data.object.metadata.supabase_user_id
11. Webhook updates profiles.subscription_status = 'active'
12. Extension checks subscription status on next popup open via check-subscription
```

## Browser Compatibility

All Chromium browsers use the same MV3 API:
- Chrome: https://developer.chrome.com/docs/extensions/
- Edge: fully supports MV3 (enforced from July 2022)
  Reference: https://blogs.windows.com/msedgedev/2020/10/14/extension-manifest-chromium-edge/
- Brave, Arc, Opera: same Chromium extension API
- Use chrome.* namespace -- all Chromium browsers support it natively
- Do NOT use browser.* polyfill unless Firefox support is required

## Secrets: What Goes Where

| Secret | Location | Never In |
|---|---|---|
| STRIPE_SECRET_KEY | Supabase Edge Function (Deno.env) | Extension bundle |
| STRIPE_WEBHOOK_SECRET | Supabase Edge Function (Deno.env) | Extension bundle |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Edge Function (Deno.env) | Extension bundle |
| SUPABASE_URL | Extension (build-time env var, public) | -- |
| SUPABASE_ANON_KEY | Extension (build-time env var, public) | -- |
| Stripe publishable key (pk_live) | Extension (public, safe to expose) | -- |

Run: supabase secrets set KEY=value
Reference: https://supabase.com/docs/guides/functions#secrets-and-environment-variables
