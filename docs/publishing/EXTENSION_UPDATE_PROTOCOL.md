# PasteCraft — Production Extension Update Protocol

**Purpose:** Upload a new package to the **existing** Chrome Web Store and Edge Add-ons listings (never create a new listing).  
**Authority:** `.cursor/rules/production-publishing-safety.mdc`  
**Package script:** `scripts/package-extension.ps1` → `releases/pastecraft-v<version>.zip`

---

## Release: 2026-07-20 (v3.0.22)

| Field | Value |
|---|---|
| Manifest version | `3.0.22` (bumped from 3.0.21 — includes post-packet clip/auth fixes) |
| Package | Same `extension/` zip for Chrome **and** Edge |
| Edge listing ID | `fblihhfoojjhmhnhilhhejdcigjmmncc` |
| Chrome listing ID | Fill from Chrome Web Store Dev Console (do not invent) |
| Section I triggers | **Full Section G checklist** — `manifest.json` changed in this release |

### What’s in this update (on `main`)

| Area | Change | Commit |
|---|---|---|
| Auth / sync | Hydrate session from bridge before sync | `87e372f` |
| Clips delete | Honor tombstones across load and sync merges | `83dc036` |
| Categories sync | Soft-deleted remote name reconcile — stops unique upsert `23505` | `9febfaf` |
| Clips delete | IDB delete verify + null-id filter restored | `58a9ef1` |
| Clip titles | Title updates via clips write facade | `0d35185` |
| Image Picker | Capture reply path fixed; Scholar-default Merchant gate | `3a8fa52` |
| Clip Viewer UI | Premium blue refactor cards | `d4177c5` |
| Settings UI | Clip settings toggle contrast | `03c21b9` / PR #155 |

Website-only (not in extension zip): Scholar vs Merchant landing (PR #156).

### Store “What’s new” (paste into both dashboards)

```
PasteCraft 3.0.22

• Fix deleted clips staying gone after reload and cloud sync
• Fix auth session so sync starts reliably after login
• Fix Image Picker / region capture so previews save reliably
• Fix clip title editing and category sync after rename/delete
• Premium Blue polish: Clip Viewer cards + settings toggle contrast
• Scholar product line: Merchant tools stay off by default for study-focused use
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

If version was already published: bump patch (`3.0.21` → `3.0.22`) before packaging. Never reuse a submitted version.

---

## Phase 1 — Package

```powershell
.\scripts\package-extension.ps1
```

- [ ] Output: `releases/pastecraft-v3.0.22.zip` (version from manifest)
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
| Image Picker / region capture → preview saves | [ ] | [ ] |
| After login, sync hydrates without stuck session | [ ] | [ ] |
| Settings toggle readable (contrast) | [ ] | [ ] |
| Clip Viewer cards look correct | [ ] | [ ] |
| No console errors on popup open | [ ] | [ ] |
| Cloud sync still hydrates after login | [ ] | [ ] |

---

## Phase 3 — Upload (same zip, both stores)

### Edge Add-ons (live)

1. Partner Center → PasteCraft → **Update** / new submission  
2. Upload `releases/pastecraft-v3.0.22.zip`  
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
  - `Last published version: 3.0.22`
  - Chrome Web Store ID if still `TBD_CHROME_ID`
- [ ] If Chrome just went live: set `website/src/data/site.js` `chrome` URL to the real store link
- [ ] Keep zip: `pastecraft-v3.0.22.zip` in local archive (last 3)

### Rollback

If live update breaks users: re-upload the previous good zip under a **higher** version number (never reuse the broken version).

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

| Doc | Use |
|---|---|
| `.cursor/rules/production-publishing-safety.mdc` | Hard safety rules |
| `docs/publishing/CROSS_BROWSER_AUTH.md` | OAuth redirect IDs |
| `docs/publishing/EDGE_STORE_PUBLISHING.md` | First-publish / listing copy (assets) |
| `docs/publishing/PUBLISHING_CHECKLIST.md` | First Edge publish (assets) |

*Protocol updated: 2026-07-20 · Target package: v3.0.22*
