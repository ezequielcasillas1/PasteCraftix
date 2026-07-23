# PasteCraft — Production Extension Update Protocol

**Purpose:** Upload a new package to the **existing** Chrome Web Store and Edge Add-ons listings (never create a new listing).  
**Authority:** `.cursor/rules/production-publishing-safety.mdc`  
**Package script:** `scripts/package-extension.ps1` → `releases/pastecraft-v<version>.zip`

---

## Release: 2026-07-23 (v3.0.24)

| Field | Value |
|---|---|
| Manifest version | `3.0.24` (bumped from 3.0.23 — permission narrowing for Chrome review) |
| Package | Same `extension/` zip for Chrome **and** Edge |
| Edge listing ID | `fblihhfoojjhmhnhilhhejdcigjmmncc` |
| Chrome listing ID | Fill from Chrome Web Store Dev Console (do not invent) |
| Section I triggers | **Full Section G checklist** — `manifest.json` + permission shape changed (re-consent possible for optional grants) |

### Permissions (what changed vs always-on)

| Permission | 3.0.23-style | 3.0.24 |
|---|---|---|
| `clipboardRead`, `offscreen` | Always-on `permissions` | **`optional_permissions`** — requested before PDF/clipboard capture |
| `<all_urls>` host API access | Always-on `host_permissions` | **`optional_host_permissions`** — requested before Capture Tools (Spot / Image Picker / frame selection) |
| Auth/sync hosts | supabase / google / pastecraft / blob | Still required `host_permissions` (narrower than all_urls) |
| `content_scripts` matches | `<all_urls>` | **Still `<all_urls>`** — floating widget must inject on many sites (honest tradeoff; install dialog may still mention broad page access) |
| Core | storage, identity, tabs, scripting, activeTab, contextMenus, clipboardWrite | Unchanged required |

### What’s in this update (on `main` since 3.0.22)

| Area | Change | Commit / PR |
|---|---|---|
| Permissions | Optional clipboard/offscreen + optional all_urls host; keep content_scripts all_urls for widget | this release |
| Widget boot | Lazy-load PDF capture so floating widget boots | PR #166 / `3ffdc76` |
| PDF capture | Clipboard PDF via offscreen reader bridge | PR #165 / `13c3202` |
| Security | Validate quickview `postMessage` origin + storage key centralize | PR #164 / `8de3103` |
| Billing | Basil-safe Stripe webhook period / invoice subscription id | PR #163 / `0b9d270` |
| Architecture | Phase 1 vertical-slice modularity | PR #162 / `25d38b9` |
| Notes / annotate | Image picker, album annotate toolbar, clip annotate wiring | `f84c462` / `9e6d3c6` |

Prior 3.0.22 fixes (auth/sync, clip tombstones, Image Picker, titles, categories) remain in the package.

### Store “What’s new” (paste into both dashboards)

```
PasteCraft 3.0.24

• Narrower install permissions: clipboard/PDF capture and broad site API access are optional (prompted when you use Capture Tools / PDF capture)
• Floating widget still works across sites; auth/sync hosts stay explicit
• Floating widget boots reliably (PDF capture loads only when needed)
• PDF clipboard capture via secure offscreen reader
• Harden Quick View messaging and storage key handling
• Stripe webhook billing period fixes for subscription renewals
• Notes image picker + clip annotate tooling
• Includes prior 3.0.22 clip delete, auth sync, and Image Picker fixes
```

### Chrome certification note (permissions)

```
clipboardRead and offscreen are optional and requested only when the user uses PDF/clipboard capture (native PDF viewers block normal selection). optional_host_permissions <all_urls> is requested when the user starts Capture Tools (region/screenshot/all-frame selection). content_scripts still match <all_urls> so the floating widget can appear on study sites without per-site installs. Required hosts are limited to Supabase, Google accounts, PasteCraft, and Azure blob for auth/sync/media.
```

---

## Phase 0 — Preflight (every update)

- [ ] On `main`, clean, pulled: `git checkout main && git pull origin main`
- [ ] Confirm `extension/manifest.json` `version` > last published store version
- [ ] Confirm **no** `"key"` field in `manifest.json`
- [ ] Permissions still include: `storage`, `identity`, `scripting`, `activeTab`, `clipboardWrite`, `tabs`, `contextMenus`
- [ ] Host permissions still include: `*.supabase.co`, `accounts.google.com`
- [ ] Run prepare libs if AI markup needed: `npm run prepare:libs` (if in package.json)
- [ ] Supabase Auth redirect allowlist still has **both**:
  - `https://<CHROME_ID>.chromiumapp.org/`
  - `https://fblihhfoojjhmhnhilhhejdcigjmmncc.chromiumapp.org/`

If version was already published: bump patch (`3.0.23` → `3.0.24`) before packaging. Never reuse a submitted version.

---

## Phase 1 — Package

```powershell
.\scripts\package-extension.ps1
```

- [ ] Output: `releases/pastecraft-v3.0.24.zip` (version from manifest)
- [ ] Zip = contents of `extension/` only (not repo root, not `manifest.json` at repo root)
- [ ] Archive last 3 published zips locally as rollback copies

---

## Phase 2 — Full Section G smoke (required this release)

Load **previous published** unpacked → create test data → replace with **new** files → reload.

| Step | Chrome Stable | Edge Stable |
|---|---|---|
| Login persists after reload | [ ] | [ ] |
| 1 clip create / copy / delete (stays deleted after reload) | [ ] | [ ] |
| Clip title edit saves | [ ] | [ ] |
| 1 category create / rename / delete (no sync error) | [ ] | [ ] |
| Floating widget appears / opens on a normal page | [ ] | [ ] |
| Capture Tools → accept optional site access when prompted | [ ] | [ ] |
| PDF clipboard / capture path — accept optional clipboard when prompted | [ ] | [ ] |
| Deny clipboard optional → toast explains need (no silent break) | [ ] | [ ] |
| Image Picker / region capture → preview saves | [ ] | [ ] |
| After login, sync hydrates without stuck session | [ ] | [ ] |
| Notes image picker / annotate (smoke) | [ ] | [ ] |
| No console errors on popup open | [ ] | [ ] |
| Cloud sync still hydrates after login | [ ] | [ ] |

---

## Phase 3 — Upload (same zip, both stores)

### Edge Add-ons (live)

1. Partner Center → PasteCraft → **Update** / new submission  
2. Upload `releases/pastecraft-v3.0.24.zip`  
3. Paste “What’s new” above  
4. Submit for certification  

Dashboard: https://partner.microsoft.com/dashboard/microsoftedge/  
Store: https://microsoftedge.microsoft.com/addons/detail/pastecraft/fblihhfoojjhmhnhilhhejdcigjmmncc  

### Chrome Web Store

1. Dev Console → existing PasteCraft listing → **Package** → Upload new package  
2. Same zip as Edge  
3. Paste same “What’s new”  
4. Submit for review  

Dashboard: https://chrome.google.com/webstore/devconsole  

**Never** create a new listing. **Never** ship different code per store.

---

## Phase 4 — After approval

- [ ] Install from each store URL (not unpacked) and re-smoke login + one clip
- [ ] Update `.cursor/rules/production-publishing-safety.mdc`:
  - `Last published version: 3.0.24`
  - Chrome Web Store ID if still `TBD_CHROME_ID`
- [ ] If Chrome just went live: set `website/src/data/site.js` `chrome` URL to the real store link
- [ ] Keep zip: `pastecraft-v3.0.24.zip` in local archive (last 3)

### Rollback

If live update breaks users: re-upload the previous good zip under a **higher** version number (never reuse the broken version).

---

## Prior release note (v3.0.23)

Superseded by 3.0.24 before store upload if 3.0.23 was only a local prep (always-on clipboard/offscreen). Prefer 3.0.24 package.

---

## Prior release note (v3.0.22 — 2026-07-20)

Package kept at `releases/pastecraft-v3.0.22.zip` for rollback.

---

## Repeatable checklist (future updates)

1. Land fixes on `main` → verify SUCCESS  
2. Bump `extension/manifest.json` version  
3. Package → smoke (Section G if Section I triggers)  
4. Upload **same** zip to Chrome + Edge  
5. Record published version + archive zip  

**Section I → full smoke:** manifest edit, storage key/shape change, `onInstalled`/`onStartup`, auth flow, clips/categories/settings schema migration, host_permissions / externally_connectable.

**Otherwise:** short smoke (login, 1 clip, 1 setting) is enough.

---

## Related docs

- `.cursor/rules/production-publishing-safety.mdc`
- `docs/publishing/INDEX_PUBLISHING_DOCS.md`
- `scripts/package-extension.ps1`
