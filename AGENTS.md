# Cloud agent instructions

## Dependency security automation (weekly cron)

No Snyk settings page or Cursor secrets required.

When running the scheduled dependency security scan:

1. Ensure dependencies are installed: `npm ci && npm ci --prefix website`
2. Run the full pipeline:

   ```bash
   ./scripts/run-dependency-scan.sh
   ```

   This will:
   - Run **npm audit** (root + website)
   - Fetch **Snyk JSON from GitHub CI** if a recent successful Security Scans run exists
   - Build a unified **fix plan** at `/tmp/snyk-reports/fix-plan.json`
   - **Apply fixes** automatically (direct bumps, overrides, `npm audit fix`, lockfile regen)

3. If fixes were applied, verify website build: `npm run build --prefix website`
4. Open a PR on branch `fix/deps-YYYY-MM-DD`. PR body must list each fix from `/tmp/snyk-reports/fix-applied.json`: package, advisory ID, old/new version, scan source (snyk vs npm-audit).
5. Snyk GitHub App scans the PR automatically.

To preview fixes without applying: `APPLY_FIXES=0 ./scripts/run-dependency-scan.sh`

### Optional: CI Snyk artifact source

If GitHub Actions Snyk has findings, refresh OAuth on your PC (no settings page):

```powershell
snyk auth
.\scripts\refresh-snyk-oauth-secret.ps1
```

Then re-run Security Scans workflow on `main`. The next automation run will fetch that report via `fetch-snyk-from-ci.sh`.

Do not commit secrets. Never echo token values in logs or PR bodies.
