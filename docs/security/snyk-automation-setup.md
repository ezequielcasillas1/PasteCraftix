# Snyk without the settings page

You do **not** need to visit [app.snyk.io/account](https://app.snyk.io/account) or copy an API token.

## How it works

```
Weekly Cursor automation
  └─ npm audit (local, no auth)
  └─ opens fix/deps-YYYY-MM-DD PR
       └─ Snyk GitHub App scans PR automatically ✓

Optional GitHub Actions (Security Scans workflow)
  └─ snyk test in CI
  └─ auth via CLI: snyk auth + refresh script (no settings page)
```

## For the dependency automation

Run `./scripts/run-dependency-scan.sh` — no setup required.

Snyk coverage on the PR comes from the **Snyk GitHub App** integration already connected to this repo.

## Optional: keep CI Snyk job green

When the Security Scans workflow Snyk job fails with `401 SNYK-0005`:

```powershell
snyk auth
.\scripts\refresh-snyk-oauth-secret.ps1
```

1. `snyk auth` — opens browser, logs you in via CLI (OAuth ~1h)
2. Refresh script — pushes token to GitHub secret `SNYK_OAUTH_TOKEN`

Run this when CI fails, or schedule it on your PC before the weekly Monday scan if you want CI artifacts available to the automation.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run-dependency-scan.sh` | **Full pipeline** — scan, fetch CI Snyk, build plan, apply fixes |
| `scripts/build-fix-plan.mjs` | Merge npm audit + Snyk JSON → `fix-plan.json` |
| `scripts/apply-dependency-fixes.mjs` | Apply direct bumps, overrides, lockfile regen |
| `scripts/run-npm-audit.sh` | npm audit for root + website |
| `scripts/fetch-snyk-from-ci.sh` | Pull Snyk JSON from latest green CI run |
| `scripts/run-snyk-scan.sh` | Local Snyk if token env is set |
| `scripts/refresh-snyk-oauth-secret.ps1` | Sync CLI OAuth → GitHub (no settings page) |

## When you would need the settings page

Only if you explicitly want a **long-lived API token** (`SNYK_TOKEN`) instead of CLI OAuth. That is optional and not required for the automation.
