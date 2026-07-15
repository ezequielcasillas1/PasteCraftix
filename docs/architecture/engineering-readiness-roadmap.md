---
name: PasteCraft Engineering Readiness Roadmap
updated: 2026-07-15
status: Advisory — collaborative discussion doc
scope: Platform compliance, store readiness, Supabase key migration, Forward Architecture alignment
---

# Engineering Readiness Roadmap

Collaborative doc for Ezequiel + agent. **No implementation, deployment, key rotation, or SuccessLog from this file alone.**

**Separate commit scope:** Local Stripe webhook / Basil hardening changes — review, test, and commit on their own branch. Do not mix with this roadmap work.

---

## Completed baseline

| Item | Status | Notes |
|---|---|---|
| Chrome in-extension privacy disclosure | ✅ Done | `extension/popup/features/privacy/` — Settings Privacy & Data |
| Website privacy policy | ✅ Done | `website/privacy.html` |
| PostgreSQL version | ✅ Done | Production PG **17.6** — no upgrade needed |
| Stripe Basil period handling | ✅ Deployed | `stripe-webhook` v32; API version pinned `2023-10-16` intentionally |
| MV3 compliance | ✅ Done | Module SW + content; no inline handlers |
| TypeScript 5 floor | N/A | Mostly vanilla JS |
| Node 22 CI/deployment | ✅ Done | Already aligned |
| Forward Architecture cutoff | ✅ Canonical | `docs/architecture/FORWARD-ARCHITECTURE.md` (2026-07-05) |

---

## Priority ladder

| # | When | Workstream |
|---|---|---|
| 1 | **Now** | Edge Partner Center privacy answers + Chrome/Edge listing alignment |
| 2 | **Before next store upload** | Permissions, hosts, privacy URL, auth/sync/AI/billing copy match reality |
| 3 | **Before Stripe API-version bump** | Review deployed webhook separately; billing smoke tests |
| 4 | **Next engineering phase** | Supabase publishable/secret-key + ES256 — **research first** (Phase A) |
| 5 | **Before OAuth maintenance** | Record real Chrome + Edge extension IDs |
| 6 | **Optional** | `supabase-js` upgrade (`^2.102.1` today) |
| 7 | **Ongoing** | Forward Architecture slice extraction — only when touching legacy |

---

## Workstream summary

| Workstream | Integrated | Missing | To do |
|---|---|---|---|
| **Supabase API keys / ES256** | Legacy `anonKey` works; Edge Functions use service role server-side | No `sb_publishable_` / `sb_secret_`; no ES256 migration plan on disk | Phase A inventory → phased B–G (see below) |
| **Edge Partner Center Privacy** | `PARTNER_CENTER_INFO.md`, `website/privacy.html`, in-app disclosure | Form answers not drafted; manifest in doc is stale (3.0.6 vs **3.0.19**) | Agent drafts answers; Ezequiel submits in Partner Center |
| **Store listing alignment** | Docs under `docs/publishing/`, `edge-store-assets/` | Chrome dashboard copy manual; Edge doc permissions outdated | Reconcile manifest ↔ listing ↔ privacy before upload |
| **OAuth dual-ID docs** | `chrome.identity.getRedirectURL()` in code | `TBD_CHROME_ID` / `TBD_EDGE_ID` in publishing rules | Ezequiel supplies IDs → agent updates docs + allowlist checklist |
| **supabase-js upgrade** | `^2.102.1` in `package.json`; Node 22 | Not on latest 2.110+ | Optional maintenance window + auth/sync tests |
| **Forward Architecture** | Cutoff doc + slice patterns + refactor progress | Legacy monoliths remain (`popup.js`, `quick-paste.js`, etc.) | Extract on touch per `REFACTOR_REMAINING.md` |
| **Stripe webhook (local)** | Deployed v32 in prod | Uncommitted local changes possible | **Separate branch/commit** — not part of this roadmap |

---

## 1. Supabase API keys + ES256 migration

### What it means

| Key type | Where | Rule |
|---|---|---|
| Legacy `anon` JWT | Extension + Edge today | Current production path |
| `sb_publishable_...` | Extension, website client | Public `apikey` header only |
| `sb_secret_...` | Edge Functions, server only | **Never** in extension, git, or store zip |
| User access JWT | `Authorization: Bearer <token>` | Real user token — not publishable/secret key |

**Current status:** Deferred intentionally. Only legacy anon key verified. No safe replacement to flip to yet.

### When

| Start research when | Do **not** start before |
|---|---|
| Supabase migration deadline announced | Store submission |
| Security policy requires ES256 | Billing change |
| Major auth/infrastructure release planned | Large refactor or launch week |
| Maintenance window + login/sync test capacity | Period without manual auth testing |

### Prerequisites

| Ezequiel | Agent |
|---|---|
| Confirm Supabase project + prod env | Inventory every key/header reference |
| Create/enable new key types in Dashboard | Classify client vs user JWT vs backend secret |
| Keep legacy key active during window | Update client config + Edge env var names |
| List Edge Functions using `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Header helpers, tests, staged deploy checklist |
| Access Auth, API, Edge secrets, logs | RLS + auth path review |
| Approve maintenance window + rollback owner | **Cannot** create or rotate prod keys without explicit approval |

### Key touchpoints (inventory starting list)

- `extension/config.example.js`
- `extension/supabase/auth.js`, `ai-functions.js`, `ai-history-sync.js`, `subscription.js`
- `extension/popup/features/auth/auth.service.js`, `billing/billing.service.js`
- `extension/background/handlers/messages-internal.js`
- `supabase/functions/*` (checkout, portal, webhook, admin, redeem, usage, announcements, `_shared/ai_workflow.ts`)

### Phased plan (A–G)

#### Phase A — Read-only inventory *(research only)*

- [ ] Every `anonKey` / `SUPABASE_ANON_KEY` / service-role reference
- [ ] Every `createClient()`, `apikey`, `Authorization` header
- [ ] Every Edge Function auth model + `verify_jwt` setting
- [ ] Classify: `apikey: sb_publishable_...` + `Authorization: Bearer <user JWT>` — never Bearer with publishable/secret key

**Success:** Written inventory doc, zero code changes.  
**Rollback:** N/A.

#### Phase B — Dual-key window

- Ezequiel creates new keys; legacy stays active
- Record: creation date, env mapping, rollback key, planned revocation date

**Success:** Both key types exist; legacy not revoked.  
**Rollback:** Continue on legacy only.

#### Phase C — Backend preparation

Move server-only functions to `sb_secret_...` after compatibility check.

Likely functions: `create-checkout`, `create-portal-session`, `stripe-webhook`, `admin-api`, `admin-alerts`, `redeem-coupon`, `usage-beacon`, `get-announcements`, `_shared/ai_workflow.ts`.

**Success:** Backend uses secret key server-side only.  
**Rollback:** Restore prior Edge env vars.

#### Phase D — JWT validation preparation

- Map validation: Edge gateway vs function vs `supabase-js` vs RLS
- Do not blindly set `verify_jwt = false`
- Stripe webhook: gateway JWT off OK if Stripe signature verified
- User-facing functions: retain JWT validation; use documented ES256/JWKS approach if manual

**Success:** Auth model documented per function.  
**Rollback:** Revert `config.toml` / function auth settings.

#### Phase E — Client migration

Extension uses publishable key for `apikey`; user tokens in `Authorization`.

Update: client init, REST headers, auth refresh, function invoke, checkout messages, config examples.

**Success:** No secret key in bundle; headers correct.  
**Rollback:** Restore prior `config` / client key.

#### Phase F — Staging verification

Test: email + Google login, refresh, sign-out, session restore, RLS clips/categories/notes/settings, Realtime, AI, subscription, checkout, webhook, admin functions.

**Success:** All paths pass on staging with new keys.  
**Rollback:** Revert client + backend to legacy keys.

#### Phase G — Production flip

1. Deploy backend env → deploy extension → monitor auth/errors
2. Keep legacy key active through activity window
3. Re-check login, sync, RLS, billing
4. Revoke legacy key only after rollback window closes

**Success criteria (all phases):**

- [ ] No secret key in extension or website client
- [ ] Client: `apikey` = publishable; `Authorization` = user JWT
- [ ] Login, refresh, RLS, sync, billing unchanged for existing users
- [ ] Stripe webhooks still signature-validated

**Rollback (any phase after B):** Restore prior client key + Edge env vars; keep new keys for investigation; **no** DB reset or emergency RLS changes.

### Forward Architecture boundary

Treat as **controlled infrastructure slice** — not a full Supabase refactor.

| Layer | Path |
|---|---|
| Supabase client modules | `extension/supabase/` |
| Shared header/config contracts | `extension/shared/` |
| Cross-context requests | `extension/background/handlers/` |
| Backend auth helpers | `supabase/functions/_shared/` |
| Forbidden | New logic in legacy monoliths |

---

## 2. Edge Partner Center Privacy

### What it is

Manual privacy/disclosure form in Microsoft Partner Center. Code cannot submit it.

| Reference | Path |
|---|---|
| Submission notes | `edge-store-assets/PARTNER_CENTER_INFO.md` |
| Live policy | `https://pastecraft.com/privacy` → `website/privacy.html` |
| In-app disclosure | `extension/popup/features/privacy/` |

### When

Before next Edge publication. **Independent** of Supabase key migration — describe **current** behavior.

### Prerequisites

| Ezequiel | Agent |
|---|---|
| Partner Center access | Draft form answers from manifest + privacy.html + Settings copy |
| Intended listing version | Flag contradictions (e.g. stale permissions in `PARTNER_CENTER_INFO.md`) |
| Confirm privacy URL live | Align Chrome ↔ Edge wording |
| Confirm active telemetry/analytics | Remove unsupported claims |

### Success criteria

- [ ] Remote code: **No**
- [ ] Data: account info, user-saved content, settings, support messages (where used)
- [ ] Cloud: Supabase; Billing: Stripe; AI: only on user invocation
- [ ] Privacy URL live, no placeholders
- [ ] Matches Chrome listing disclosures

### Rollback / testing

- [ ] Open privacy URL in clean browser
- [ ] Every stated permission exists in `extension/manifest.json`
- [ ] Every claimed feature exists in shipped build
- If rejected: fix listing/disclosure text — do not change product behavior to match inaccurate copy

---

## 3. Chrome + Edge store listing alignment

### When

Before any Chrome or Edge upload; whenever permissions, hosts, auth, sync, AI, or billing change.

### Prerequisites

| Ezequiel | Agent |
|---|---|
| Review store dashboard fields | Compare listing ↔ `manifest.json` |
| Confirm audience + disclosures | Remove stale version claims (e.g. "v1.0" / "v2.0 coming") |
| Submit listing updates | Permission justifications; flag dev-only hosts |

### Current manifest snapshot (verify before upload)

| Area | Current (`extension/manifest.json`) |
|---|---|
| Version | **3.0.19** |
| Permissions | `contextMenus`, `storage`, `activeTab`, `tabs`, `scripting`, `identity`, `clipboardWrite` |
| Hosts | `<all_urls>`, `*.supabase.co`, `*.blob.core.windows.net`, `accounts.google.com`, `pastecraft.com` |
| CSP connect-src | Supabase, blob, Google, pastecraft.com |

> `PARTNER_CENTER_INFO.md` still lists older permissions (e.g. `api.openai.com`, `127.0.0.1:7242`) — **reconcile before submit**.

### Success criteria

- [ ] Store copy = actual features
- [ ] Permissions justified truthfully
- [ ] Privacy + terms URLs work
- [ ] Chrome and Edge describe the **same** `extension/` zip
- [ ] Screenshots/promo assets current (`edge-store-assets/`)

### Rollback / testing

- Keep last accepted listing text
- Manifest change → full Section G checklist (`.cursor/rules/production-publishing-safety.mdc`)

---

## 4. Optional `supabase-js` upgrade

| | |
|---|---|
| **Current** | `@supabase/supabase-js ^2.102.1` (`package.json`) |
| **When** | Planned dependency window — not bundled with key migration unless required |
| **Ezequiel** | Approve target version + window |
| **Agent** | Upgrade lockfile, run tests, check deprecated auth options |
| **Test** | Session restore, refresh, Realtime, sync, Edge Function calls |
| **Rollback** | Restore prior package + lockfile; re-run auth/sync tests |
| **Rule** | Do not combine with key rotation or large refactor |

---

## 5. OAuth dual-ID documentation

| | |
|---|---|
| **Code** | ✅ `chrome.identity.getRedirectURL()` — correct portable pattern |
| **Docs** | ❌ `TBD_CHROME_ID` / `TBD_EDGE_ID` in `production-publishing-safety.mdc` |
| **When** | Before prod OAuth testing, store submit with login, Supabase redirect review |
| **Ezequiel** | Copy real IDs from Chrome + Edge dashboards; confirm Google Cloud + Supabase Auth allowlists |
| **Agent** | Replace placeholders; parity checklist; verify no hard-coded ID replaced runtime redirect |
| **Success** | Both IDs in Google OAuth + Supabase redirects + publishing docs; login works Chrome + Edge (fresh + existing session) |
| **Rollback** | Add new redirects before removing old; compare generated redirect URL to allowlist exactly |

---

## 6. Forward Architecture connection

Readiness work **does not** replace the refactor roadmap.

| Doc | Role |
|---|---|
| `FORWARD-ARCHITECTURE.md` | Canonical cutoff + bridges |
| `master-refactor-roadmap.md` | Popup/monolith phased execution |
| `REFACTOR_REMAINING.md` | Daily automation queue |

**Order of operations:**

1. Urgent compliance + production readiness (this doc)
2. Keep extension shippable
3. On legacy touch → one vertical slice + bridge if needed
4. Arkitect before structural work; CodeScene on changed files
5. Stable storage keys + auth contracts unless explicit migration planned

---

## Discussion — choose next position

Review this file, then pick **A**, **B**, or **C**.

### A — Approve / use this roadmap only

| | |
|---|---|
| **Integrated** | Baseline items done; priority ladder; workstream tables; phased Supabase plan; Forward Architecture link |
| **Missing** | Formal SUCCESS approval; `implementations.md` entry (only after Ezequiel confirms) |
| **To do** | Ezequiel reads + adjusts priorities; agent updates doc if gaps found; then pick B or C |
| **Agent next** | Hold implementation until position chosen |
| **Ezequiel next** | Confirm ladder order or reprioritize |

### B — Prepare Edge Partner Center privacy answers next

| | |
|---|---|
| **Integrated** | Privacy slice, website policy, `PARTNER_CENTER_INFO.md` shell |
| **Missing** | Drafted Partner Center form answers; manifest ↔ doc reconciliation; Chrome parity pass |
| **To do** | Agent drafts Q&A from manifest `3.0.19` + `privacy.html` + Settings disclosure; Ezequiel reviews + submits in Partner Center |
| **Prerequisites** | Partner Center login; confirmed privacy URL |
| **Success** | Submitted form matches shipped extension; no placeholder text |
| **Not in scope** | Supabase key migration; Stripe webhook commit |

### C — Start research-only Phase A (Supabase API keys)

| | |
|---|---|
| **Integrated** | Known touchpoint list (above); deferred status documented |
| **Missing** | Full grep inventory; per-function `verify_jwt` matrix; header classification table |
| **To do** | Agent runs read-only inventory → deliver Phase A report; **zero** code/key/dashboard changes |
| **Prerequisites** | Ezequiel confirms target Supabase project; approves research-only scope |
| **Success** | Complete inventory artifact; go/no-go for Phase B |
| **Not in scope** | Key creation, rotation, deploy, extension config changes |

---

## Quick checklists

### Before next store upload

- [ ] `manifest.json` version > last published
- [ ] No `"key"` field in package zip
- [ ] Privacy URL live
- [ ] Partner Center / Chrome dashboard copy matches manifest
- [ ] Section G smoke test if manifest touched

### Before Supabase key migration (any phase after A)

- [ ] Phase A inventory approved
- [ ] Maintenance window scheduled
- [ ] Rollback owner named
- [ ] Not same week as store submit or Stripe API bump

### Before OAuth doc update

- [ ] Real Chrome ID from dashboard
- [ ] Real Edge ID from dashboard
- [ ] Supabase Auth redirect allowlist checked

---

## Related docs

- [FORWARD-ARCHITECTURE.md](./FORWARD-ARCHITECTURE.md)
- [master-refactor-roadmap.md](../refactoring/master-refactor-roadmap.md)
- [REFACTOR_REMAINING.md](../../REFACTOR_REMAINING.md)
- [PARTNER_CENTER_INFO.md](../../edge-store-assets/PARTNER_CENTER_INFO.md)
- [production-publishing-safety.mdc](../../.cursor/rules/production-publishing-safety.mdc)
