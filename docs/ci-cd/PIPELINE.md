# PasteCraft CI/CD Pipeline

Production-ready pipeline for the MV3 extension (Chrome + Edge), the Astro
website, and the Supabase Edge Functions. Both stores ship the **same**
`extension/` zip — never diverge Chrome vs Edge.

## Phase plan

| Phase | CI (testing) | CD (release) |
|---|---|---|
| **P0** (must-have) | Manifest safety guard, extension smoke test, popup events test, website build | On `v*.*.*` tag: build cross-platform zip `pastecraft-v<version>.zip`, attach to GitHub Release (same zip for Chrome + Edge) |
| **P1** (important) | Deno `check` over `supabase/functions` (non-blocking), manifest "key"/semver/permission guard on every run | Optional automated store submission jobs, gated behind secrets — skip gracefully when unconfigured |
| **P2** (nice-to-have) | Real-browser/e2e (`test:chrome`/`test:edge`), Lighthouse, `npm audit` | Website Netlify deploy hook, `supabase functions deploy` |

> Real-browser scripts (`test:chrome`, `test:edge`, `test:all-browsers`) are **never** run in CI — they launch actual browsers.

## Workflows

### `.github/workflows/ci.yml`
Runs on every `pull_request` and on pushes to `main` / `infra/ci-cd-pipeline`.

- **extension** — Node 20, `npm ci`, then:
  - `npm run verify:manifest` (Production Publishing Safety gate)
  - `node tests/extension-smoke.test.js`
  - `node --test tests/popup-events-smoke.test.mjs`
- **website** — Node 20, `cd website && npm ci && npm run build`
- **edge-functions** — Deno `check` over `supabase/functions/**/*.ts` (`continue-on-error: true` until function deps are pinned)

### `.github/workflows/release.yml`
Runs on `v*.*.*` tag push (or manual `workflow_dispatch`).

- **build-release** — guards the manifest, reads the version, builds the zip via
  `npm run package:extension`, uploads it as a workflow artifact, and attaches it
  to a GitHub Release.
- **publish-chrome** / **publish-edge** — optional. Each checks for its secrets
  and **skips gracefully** when they are absent. The actual upload step is a
  documented TODO (see secrets below).

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `scripts/verify-manifest.mjs` | `npm run verify:manifest` | Asserts MV3, no `key` field, semver version, core permissions/hosts present |
| `scripts/package-extension.mjs` | `npm run package:extension` | Cross-platform zip of the **contents** of `extension/` → `releases/pastecraft-v<version>.zip` (uses `zip` CLI on CI/Linux, PowerShell `Compress-Archive` fallback on Windows) |
| `scripts/package-extension.ps1` | (manual) | Original PowerShell packager — unchanged, still the local Windows fallback |

## How to cut a release

1. Bump `version` in `extension/manifest.json` (must strictly increase; never reuse a number).
2. Commit on a release branch / `main`.
3. Tag and push:
   ```bash
   git tag v3.0.12
   git push origin v3.0.12
   ```
4. The Release workflow builds `pastecraft-v3.0.12.zip` and attaches it to the GitHub Release.
5. Download that asset and upload it to each store (manual today — see fallback).

## Optional store automation — required GitHub secret NAMES

Names only. **Do not commit any values.** When these are set, the matching
publish job activates; otherwise it skips.

**Chrome Web Store**
- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

**Edge Add-ons (Partner Center API)**
- `EDGE_PRODUCT_ID`
- `EDGE_CLIENT_ID`
- `EDGE_API_KEY`

## Manual fallback (current default)

Store uploads are **manual** today. Per
`.cursor/rules/production-publishing-safety.mdc`:

1. Build locally: `npm run package:extension` (or `scripts/package-extension.ps1` on Windows).
2. Confirm `extension/manifest.json` has **no** `"key"` field and the version is greater than the last published.
3. Smoke-test the unpacked build (login persists, clips intact, settings intact, no console errors) on Chrome Stable and Edge Stable.
4. Upload the **same** zip to the existing Chrome Web Store and Edge Add-ons listings (never create a new listing). Package = contents of `extension/` only — never the repo root, never the dev-loader root `manifest.json`.

## Next steps for Ezequiel

- Bump `extension/manifest.json` version, then tag `vX.Y.Z` to trigger CD.
- Add the store API secrets above only if/when you want automated publishing; until then the publish jobs stay skipped and uploads remain manual.
- Recommended home branch for this scaffolding: `infra/ci-cd-pipeline`.
