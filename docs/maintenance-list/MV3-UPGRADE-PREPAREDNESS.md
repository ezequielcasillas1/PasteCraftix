# MV3 Upgrade Preparedness — PasteCraft

PasteCraft is **already Manifest V3** (`manifest_version: 3`, service worker background). "MV3 upgrade" here means **staying compliant** when Chrome/Edge tighten MV3 rules — not migrating from MV2.

---

## Compliance vs refactor

| MV3 compliance | Internal refactor (separate) |
|---|---|
| Manifest, permissions, CSP, WAR, lifecycle hooks | Clips merge, merchant queue, handler splits |
| Storage key migrations, auth redirect allowlists | CodeScene / vertical-slice cleanup |
| Store upload + smoke test | Feature work in `request.md` |

Touch compliance files first; do not bundle refactor debt into an MV3 fix.

---

## First-touch file map

### 1. Manifest / permissions changes

**Trigger:** New/changed permissions, host patterns, CSP directives, WAR rules, `externally_connectable`, deprecated APIs.

| File | Why | Test |
|---|---|---|
| `extension/manifest.json` | Single source: version, permissions, CSP, content_scripts, background, WAR | Reload unpacked; confirm permission prompt if added |
| `extension/content-script.js` | Entry listed in manifest; dynamic import path | Any page: widget loads, no CSP console errors |
| `.cursor/rules/production-publishing-safety.mdc` | Sections A–C, I — immutables + re-test triggers | Review before upload |

**Current snapshot:** v3.0.13 · permissions: `contextMenus`, `storage`, `activeTab`, `tabs`, `scripting`, `identity`, `clipboardWrite`, `clipboardRead` · hosts: Supabase, Azure blob, Google OAuth, pastecraft.com · WAR: `content/**`, libs, popup assets.

---

### 2. Service worker / background lifecycle

**Trigger:** SW registration rules, event listener limits, alarm/offscreen requirements, message routing changes.

| File | Why | Test |
|---|---|---|
| `extension/background.js` | Manifest entry (`type: module`) | SW starts; no registration errors |
| `extension/background/service-worker.js` | Imports handlers + shared bootstrap | Service worker → Inspect → no uncaught errors |
| `extension/background/shared.js` | `onInstalled`, `onStartup`, context menus, migrations, action click | Update over prior build; menus + icon click work |
| `extension/background/handlers/messages-internal.js` | Internal `chrome.runtime.onMessage` | Popup ↔ background messages |
| `extension/background/handlers/messages-external.js` | `onMessageExternal` (auth.pastecraft.com) | Password-reset bridge from web |
| `extension/background/handlers/internal/internal-handlers.js` | Handler map | Spot-check high-traffic actions |
| `extension/background/messaging/router.js` | Sender validation, async response contract | Reject foreign senders |
| `extension/background/messaging/message-types.js` | Action/type constants | Grep for drift vs handlers |

**Note:** SW has **no in-memory state** — persistence only via `chrome.storage` / IndexedDB.

---

### 3. Storage schema / chrome.storage migrations

**Trigger:** Key rename, shape change, new defaults on update.

| File | Why | Test |
|---|---|---|
| `extension/background/shared.js` | `SCHEMA_VERSION`, `runStorageMigrations`, `onInstalled` update path | Install vN → upgrade to vN+1; clips/settings intact |
| `extension/indexeddb-store.js` | IndexedDB cache layer | Large clip set survives reload |
| `extension/popup/features/clips/clips.constants.js` | Clip storage keys | Create/delete clip |
| `extension/popup/features/settings/settings.constants.js` | Settings + restore keys | Toggle setting; restore point |
| `extension/popup/features/auth/auth.constants.js` | Session-related keys | Login persists |
| `extension/content/merchant/merchant.constants.js` | Merchant prefs (if permission touches merchant pages) | Dock prefs persist |

**Rules:** Bump `SCHEMA_VERSION` · register step in `migrations` · never wipe `chrome.storage.local` on failure · archive to Supabase before key deletion.

---

### 4. Auth / Supabase / identity

**Trigger:** OAuth redirect changes, `identity` permission, CSP `connect-src`, external messaging.

| File | Why | Test |
|---|---|---|
| `extension/supabase/auth.js` | `launchWebAuthFlow`, `getRedirectURL` | Google sign-in Chrome + Edge |
| `extension/supabase/identity.js` | Identity helpers | Same |
| `extension/supabase/auth-bridge.js` | Session bridge / token freshness | Popup reopen restores session |
| `extension/supabase/storage-adapter.js` | Auth session in `chrome.storage` | No token in localStorage |
| `extension/supabase-client.js` | Legacy import shim | Popup boot still loads client |
| `extension/supabase/index.js` | Client singleton | Sync after login |
| `extension/supabase/sync-queue.js` | Tiered sync writes | Edit clip → cloud row updates |
| `extension/supabase/full-sync.js` | Hydrate on login | Second device sees clips |
| Supabase Auth dashboard | Redirect URLs: `https://<CHROME_ID>.chromiumapp.org/`, `https://<EDGE_ID>.chromiumapp.org/` | Both stores |
| Google Cloud OAuth client | Authorized redirect = Supabase callback only | No extension callback in GCP |

**Manifest tie-ins:** `host_permissions` for `*.supabase.co`, `accounts.google.com` · `externally_connectable` → `auth.pastecraft.com` · CSP `connect-src` matches fetch targets.

---

### 5. Content scripts / CSP / injected UI

**Trigger:** CSP for extension pages or page isolation, WAR match patterns, dynamic import rules, Shadow DOM injection limits.

| File | Why | Test |
|---|---|---|
| `extension/content-script.js` | Manifest-registered bootstrap; dynamic `import()` | Bootstrap on http + https pages |
| `extension/content/content.js` | Feature init entry | Widget + quick-paste on allowed site |
| `extension/content/safety/site-guard.js` | Site allow/deny | Blocked sites skip injection |
| `extension/content/widget/widget.core.js` | Shadow DOM widget, storage | Drag/position persists |
| `extension/content/widget/widget.events.js` | Message bridge to SW | Open panel from icon click |
| `extension/content/merchant/merchant.controller.js` | Merchant dock (large WAR surface) | Test lab page fill flow |
| `extension/popup.html`, `extension/popup/**` | Extension-page CSP (`script-src 'self'`) | No inline handlers; popup opens |
| `extension/manifest.json` → `web_accessible_resources` | Every dynamically imported module must be listed | Missing WAR = import failure in console |

**CSP today:** `extension_pages` — `script-src 'self' 'wasm-unsafe-eval'`; no inline scripts (MV3 requirement).

---

### 6. Store publish checklist (Section G summary)

Before **every** Chrome Web Store / Edge Add-ons upload:

1. `extension/manifest.json` — version **strictly increases**; **no `"key"`** field
2. Core permissions + Supabase/Google hosts still present
3. Load **previous published** unpacked → create test clip, category, login, settings change
4. Replace with new build → reload → verify data + no console errors
5. Repeat on **Chrome Stable** and **Edge Stable**
6. Zip **`extension/` folder only** (not repo root)
7. **Upload new package** to existing listings — never new listing / never force-push `main`

**Full re-test (Section I):** any edit to manifest, storage keys/shape, `onInstalled`/`onStartup`, supabase auth, Supabase schema, or `host_permissions` / `externally_connectable`.

Ref: `.cursor/rules/production-publishing-safety.mdc`

---

## Watchlist signals

| Signal | Likely first file |
|---|---|
| "Service worker registration failed" | `background.js`, `service-worker.js` |
| "Refused to load script" / dynamic import fail | `manifest.json` WAR, `content-script.js` |
| CSP violation on popup/options | `manifest.json` `content_security_policy` |
| Permission denied / `identity` errors | `manifest.json`, `supabase/auth.js` |
| Storage quota / migration log `[migration] failed` | `background/shared.js` |
| Store review: broad host access | `manifest.json` `host_permissions`, `<all_urls>` content_scripts |
| Store review: remote code | Ensure no remote script URLs; libs under `extension/lib/` |
| Chrome release notes: MV3 deprecation | Match API to handlers in `background/handlers/**` |

**Monitor:** [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3/intro/) · [Edge Chromium extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/) · CWS / Edge partner review emails.

---

## Agent + human workflow (MV3 rule change)

1. **Identify trigger** — release note, review rejection, or DevTools warning → map to group above
2. **Research** — read affected files; no drive-by refactors
3. **Minimal diff** — compliance only; bump `version` in manifest
4. **Migration** — if storage shape changes: `SCHEMA_VERSION` + idempotent step in `background/shared.js`
5. **Smoke test** — Section G checklist on Chrome + Edge
6. **Human gate** — Ezequiel confirms SUCCESS before success logs or store upload
7. **Publish** — human uploads zip to **both** stores; agent does **not** autonomous push

---

## Out of scope for MV3

These are **separate workstreams** — do not block or mix into MV3 compliance fixes:

- Clips local merge / `extension/shared/clips-local-merge.js`, IndexedDB dedup
- Merchant queue, adapters, one-shot paste (`extension/content/merchant/**`)
- Background handler refactor (`router.js`, `internal-handlers.js` splits)
- Popup vertical-slice extractions (`popup/features/**`)
- Supabase table migrations (backend — only touch extension if auth/sync contract changes)

Track feature/refactor items in `instructions/request.md`; bugs in `instructions/refresh.md`.
