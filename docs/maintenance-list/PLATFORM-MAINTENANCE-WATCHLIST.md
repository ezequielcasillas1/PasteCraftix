# Platform Maintenance Watchlist — PasteCraft

Operational maintenance for **PasteCraft as a shipped product** — extension, Supabase, Stripe, stores, website, auth, security. Not feature work.

**Sibling doc:** [MV3-UPGRADE-PREPAREDNESS.md](./MV3-UPGRADE-PREPAREDNESS.md) — manifest, CSP, WAR, service worker, store upload.

---

## Compliance vs refactor debt

| Platform maintenance (this doc) | Refactor / feature debt (separate) |
|---|---|
| Auth redirects, RLS, migrations, Edge Functions | Clips local merge, IndexedDB dedup |
| Stripe webhooks, checkout metadata | Merchant queue, adapters, one-shot paste |
| Store privacy + permissions justification | Background handler / router splits |
| `SCHEMA_VERSION` + storage migrations | Popup vertical-slice extractions |
| Website deploy, merchant-test sync | CodeScene / vertical-slice cleanup |
| DNS, Resend, OAuth console | Items in `instructions/request.md` / `refresh.md` |

Touch maintenance surfaces first; do not bundle refactor debt into a compliance fix.

---

## First-touch file map

### 1. Supabase — auth, RLS, migrations, Edge Functions

**Trigger:** Login failures, RLS errors, schema change, new Edge Function, redirect mismatch Chrome vs Edge.

| File | Why | Test |
|---|---|---|
| `extension/supabase/auth.js` | `launchWebAuthFlow`, redirect URL | Google sign-in Chrome + Edge |
| `extension/supabase/auth-bridge.js` | Session bridge / token freshness | Popup reopen restores session |
| `extension/supabase/sync-queue.js` | Tiered writes to cloud | Edit clip → Supabase row updates |
| `extension/supabase/full-sync.js` | Hydrate on login | Second device sees clips |
| `supabase/migrations/*.sql` | Schema + RLS policies | Apply locally; verify RLS with anon JWT |
| `supabase/functions/create-checkout/index.ts` | Stripe session creation | Upgrade flow returns checkout URL |
| `supabase/functions/stripe-webhook/index.ts` | Subscription state from Stripe | Test webhook; profile status updates |
| `supabase/functions/redeem-coupon/index.ts` | Coupon redemption | Valid/invalid code paths |
| Supabase Auth dashboard | Redirect URLs: `https://<CHROME_ID>.chromiumapp.org/`, `https://<EDGE_ID>.chromiumapp.org/` | Both store builds |
| Supabase project settings | Anon key + URL in extension only (no service role in bundle) | Grep extension for `service_role` |

**RLS rule:** Query by `user_id`; let `auth.uid()` enforce — no custom `set_config` plumbing (see `.cursor/rules/no-architecture-ids.mdc`).

---

### 2. Stripe — webhooks, checkout, metadata

**Trigger:** Payment succeeds but subscription inactive, webhook 4xx/5xx, checkout session errors.

| File | Why | Test |
|---|---|---|
| `supabase/functions/create-checkout/index.ts` | Creates session; metadata carries `supabase_user_id` | Complete test checkout |
| `supabase/functions/stripe-webhook/index.ts` | Verifies signature; updates `profiles` | Stripe CLI or dashboard test event |
| `supabase/functions/create-portal-session/index.ts` | Billing portal link | Manage subscription from popup |
| Stripe Dashboard → Webhooks | Endpoint URL + signing secret in Supabase env | Redeliver failed events |
| `extension/popup/features/settings/settings.coupon.js` | Coupon UI (if billing surface touched) | Redeem test coupon |

**Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Edge Functions env only, never extension bundle.

---

### 3. Chrome Web Store + Edge Add-ons

**Trigger:** Review rejection, permission re-consent, version upload, privacy policy update.

| File | Why | Test |
|---|---|---|
| `extension/manifest.json` | Version bump, permissions, hosts, CSP | Section G smoke test (see MV3 doc) |
| `.cursor/rules/production-publishing-safety.mdc` | Sections A–J — immutables, migrations, dual-store parity | Review before upload |
| `docs/publishing/PUBLISHING_CHECKLIST.md` | Human upload steps | Chrome + Edge same zip |
| `docs/publishing/EDGE_STORE_PUBLISHING.md` | Edge-specific notes | Edge Stable smoke test |

**Rules:** Same `extension/` zip to **both** stores · upload to **existing** listings · never `"key"` in manifest · version strictly increases.

---

### 4. chrome.storage — SCHEMA_VERSION / migrations

**Trigger:** Key rename, shape change, data loss after update, migration log errors.

| File | Why | Test |
|---|---|---|
| `extension/background/shared.js` | `SCHEMA_VERSION`, `runStorageMigrations`, `onInstalled` | Install vN → upgrade vN+1 |
| `extension/indexeddb-store.js` | IndexedDB cache layer | Large clip set survives reload |
| `extension/popup/features/clips/clips.constants.js` | Clip storage keys | Create/delete clip |
| `extension/popup/features/settings/settings.constants.js` | Settings keys | Toggle; restore point |
| `extension/popup/features/auth/auth.constants.js` | Session keys | Login persists across reload |

**Rules:** Bump `SCHEMA_VERSION` · idempotent migration steps · never wipe `chrome.storage.local` on failure · archive to Supabase before key deletion.

---

### 5. Website — Astro / Netlify, merchant-test sync

**Trigger:** Site deploy fail, merchant mocks out of sync, broken auth pages on web.

| File | Why | Test |
|---|---|---|
| `website/` | Astro site, Netlify config | `cd website && npm run build` |
| `netlify.toml` | Build command, redirects, env | Preview deploy |
| `merchant-test-lab/` | Local static mocks (source of truth for dev) | `npx serve merchant-test-lab -p 5173` |
| `website/public/merchant-test/` | Deployed mocks (must mirror lab) | Diff lab vs public after changes |
| `website/src/pages/merchant-test/index.astro` | Production hub page | `/merchant-test.html` loads |

**Note:** Netlify ↔ Namecheap DNS connection is **not assumed** until Ezequiel confirms. Verify domain separately before treating pastecraft.com as live.

---

### 6. Google OAuth console

**Trigger:** OAuth error after GCP change, new Supabase callback URL.

| Location | Why | Test |
|---|---|---|
| Google Cloud Console → OAuth client | Authorized redirect = **Supabase callback only** | Sign-in from extension |
| `extension/manifest.json` → `oauth2` block | Legacy; current flow uses `launchWebAuthFlow` | No duplicate redirect in GCP |
| Supabase Auth → Providers → Google | Client ID/secret match GCP | Provider test in dashboard |

Extension callback is `https://<EXT_ID>.chromiumapp.org/` — allowlisted in **Supabase Auth**, not GCP redirect URIs.

---

### 7. Third-party host_permissions

**Trigger:** New external API, store review on broad access, CSP `connect-src` mismatch.

| Host (manifest) | Purpose | Test |
|---|---|---|
| `https://*.supabase.co/*` | Auth, DB, Edge Functions | Login + sync |
| `https://*.blob.core.windows.net/*` | Azure blob assets (if used) | Asset load in feature that uses it |
| `https://accounts.google.com/*` | OAuth | Sign-in |
| `https://pastecraft.com/*`, `https://*.pastecraft.com/*` | Web auth bridge, site | Password reset / external messaging |

**Files:** `extension/manifest.json` (hosts + CSP `connect-src`) · justify any new host in store listing privacy notes.

---

### 8. Security — RLS, secrets, Snyk/CVE

**Trigger:** Failed security scan, suspected secret leak, RLS bypass report, abuse spike.

| File / tool | Why | Test |
|---|---|---|
| `supabase/migrations/*.sql` | RLS on every table | Policy test with anon + authed JWT |
| Extension grep | No `service_role`, Stripe secret, DeepSeek key in bundle | CI / manual grep |
| `.cursor/rules/pastecraft-security-breach-response.mdc` | Triage playbook | Read before hotfix |
| Snyk (CI / MCP) | Dependency CVEs | Fix or accept with ticket |

**AI surfaces to guard:** `ai-refactor`, `ai-image`, `ai-lab`, agent prompts — no clip PII or secrets in outbound traffic.

---

### 9. Dependencies — pnpm workspace

**Trigger:** Lockfile drift, function runtime deps, website build failures.

| File | Why | Test |
|---|---|---|
| `pnpm-workspace.yaml` | Workspace roots (if expanded) | `pnpm install` at repo root |
| `pnpm-lock.yaml` | Locked dependency tree | Clean install |
| `supabase/functions/package.json` | Edge Function deps | Deploy function; smoke invoke |
| `website/package.json` | Site deps | `npm run build` in website |

---

### 10. Domain / email — Resend, DNS

**Trigger:** Verification emails fail, support mail bounce, DNS propagation.

| File / service | Why | Test |
|---|---|---|
| `docs/email/EMAIL_VERIFICATION_SETUP.md` | Resend + Supabase email config | Send test verification |
| `docs/NETLIFY_SUPPORT_EMAIL_SETUP.md` | Support routing | Inbound test |
| Resend dashboard | API key in Supabase/server env only | Delivery logs |
| Namecheap DNS (when connected) | MX/TXT for domain email | DNS lookup |

**Note:** Do not assume Netlify or Namecheap are wired until Ezequiel confirms.

---

## Watchlist signals

| Signal | Likely first touch |
|---|---|
| "Invalid redirect URI" / OAuth loop | Supabase Auth redirects, GCP OAuth client |
| 401/403 on Supabase queries | RLS policy, expired session, `auth-bridge.js` |
| Stripe webhook 400/500 | `stripe-webhook/index.ts`, signing secret env |
| Paid but still free tier | Webhook metadata `supabase_user_id`, profile update |
| Clips missing after login | `full-sync.js`, RLS, deleted_at filter |
| `[migration] failed` in SW console | `background/shared.js` |
| Store: excessive permissions | `manifest.json` hosts + `<all_urls>` content_scripts |
| Merchant test diverges from prod | Diff `merchant-test-lab/` vs `website/public/merchant-test/` |
| Netlify build fail | `website/`, env vars in Netlify dashboard |
| Email not delivered | Resend logs, Supabase Auth SMTP/settings |
| Snyk / Dependabot alert | Lockfile + affected package path |
| MV3-specific (CSP, WAR, SW) | → [MV3-UPGRADE-PREPAREDNESS.md](./MV3-UPGRADE-PREPAREDNESS.md) |

**Monitor:** Supabase status · Stripe status · Netlify deploy emails · CWS/Edge partner review · Snyk/Dependabot · Chrome/Edge extension release notes.

---

## Agent + human workflow

1. **Identify trigger** — user report, dashboard alert, CI failure, store email → map to section above
2. **Research** — read listed files only; no drive-by refactors
3. **Minimal diff** — maintenance/compliance scope; bump extension `version` if shipping
4. **Migration** — storage: `SCHEMA_VERSION` + step in `background/shared.js`; DB: new `supabase/migrations/` file
5. **Test** — section-specific test column + MV3 Section G if manifest/storage/auth touched
6. **Human gate** — Ezequiel confirms SUCCESS before success logs or store upload
7. **Publish** — human uploads zip to both stores; agent does not autonomous push to production

---

## Related docs

| Doc | Scope |
|---|---|
| [MV3-UPGRADE-PREPAREDNESS.md](./MV3-UPGRADE-PREPAREDNESS.md) | Manifest V3 compliance |
| `.cursor/rules/production-publishing-safety.mdc` | Store + storage immutables |
| `docs/publishing/` | Upload checklists |
| `docs/supabase/` | Backend setup |
| `instructions/request.md` | Features (not maintenance) |
| `instructions/refresh.md` | Bugs (not maintenance) |
