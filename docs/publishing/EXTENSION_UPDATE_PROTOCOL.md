# PasteCraft — Production Extension Update Protocol

**Purpose:** Upload a new package to the **existing** Chrome Web Store and Edge Add-ons listings (never create a new listing).  
**Authority:** `.cursor/rules/production-publishing-safety.mdc`  
**Package script:** `scripts/package-extension.ps1` → `releases/pastecraft-v<version>.zip`

---

## Release: 2026-08-03 (v3.0.30) — production finalization

| Field | Value |
|---|---|
| Manifest version | `3.0.30` (from last published `3.0.29`; 3.0.29 already on store — never reuse) |
| Package | `releases/pastecraft-v3.0.30.zip` — same zip for Chrome **and** Edge |
| Edge listing ID | `fblihhfoojjhmhnhilhhejdcigjmmncc` |
| Chrome listing ID | `fidljmdohgkjmmgojdblbbnfoeengoko` |
| Section I triggers | **Full Section G checklist** — manifest/offscreen clipboard path + capture writer + AI Lab history/summary UX |

### What’s in this update (since 3.0.28)

| Area | Change |
|---|---|
| Clipboard | Offscreen channel + clipboard-writer page for reliable image/text writes |
| Capture | Capture handler clipboard path hardened |
| AI Lab | History persist/continue/render + summary modal polish |
| Activity | Soft-delete visibility in Deleted filter |
| Widget | Ghost “Drop” box only during active click-and-drag (no left-side leak) |
| UI | Header model picker spacing; light craft + AI icons |
| API keys | Provider env aliases resolved without OpenAI fallback |
| Version | Strict bump 3.0.29 → 3.0.30 after store rejected reuse of 3.0.29 |

### Store “What’s new” (paste into both dashboards)

```
PasteCraft 3.0.30

• Floating Drop box only appears during an active clip drag (ghost fix)
• More reliable image/text clipboard writes (offscreen + writer bridge)
• AI Lab history sync and continue improvements
• Activity Deleted filter shows soft-deleted items correctly
• Header model picker spacing and craft/AI icon polish
• Provider API keys resolve from env aliases without wrong OpenAI fallback
• Includes 3.0.28–3.0.29 clipboard, notes annotate, and Funky AI header work
```

### Chrome certification note (permissions)

```
offscreen is required for reliable clipboard image writes. clipboardRead remains optional and is requested only for PDF/clipboard capture. optional_host_permissions <all_urls> is requested when the user starts Capture Tools. content_scripts still match <all_urls> for the floating widget. Required hosts stay limited to Supabase, Google accounts, PasteCraft, and Azure blob.
```

---

## Prior release: 2026-08-03 (v3.0.29)

On store as last published. Superseded for next upload by 3.0.30 (store rejected re-upload of 3.0.29). Keep `releases/pastecraft-v3.0.29.zip` for rollback.

---

## Prior release: 2026-07-23 (v3.0.24)

Superseded for store upload. Keep zip for rollback if needed. Permission narrowing (optional clipboardRead / optional all_urls host) remains the baseline shape through 3.0.30 (`offscreen` required since 3.0.28).

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

- [ ] Output: `releases/pastecraft-v3.0.30.zip` (version from manifest)
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
2. Upload `releases/pastecraft-v3.0.30.zip`  
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
  - `Last published version: 3.0.30` (only after store approval of 3.0.30)
  - Chrome Web Store ID: `fidljmdohgkjmmgojdblbbnfoeengoko`
- [ ] If Chrome just went live: set `website/src/data/site.js` `chrome` URL to the real store link
- [ ] Keep zip: `pastecraft-v3.0.30.zip` in local archive (last 3)

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
