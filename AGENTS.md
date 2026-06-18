# Cloud agent instructions

## Dependency security automation (weekly cron)

No Snyk settings page or Cursor secrets required.

When running the scheduled dependency security scan:

1. Ensure dependencies are installed: `npm ci && npm ci --prefix website`
2. Run the unified scan script:

   ```bash
   ./scripts/run-dependency-scan.sh
   ```

3. If moderate+ vulnerabilities with fixes are found, apply dependency updates only (no app logic unless required for compatibility).
4. Open a PR on branch `fix/deps-YYYY-MM-DD` listing each fix: package, advisory ID, old/new version, scan source.

### How Snyk is covered (no manual API token)

| Layer | How | Auth needed? |
|-------|-----|--------------|
| **Automation scan** | `npm audit` via `run-dependency-scan.sh` | No |
| **Snyk on fix PR** | Snyk GitHub App (already installed) | No — automatic |
| **Optional CI Snyk** | GitHub Actions Security Scans workflow | CLI only: `snyk auth` + refresh script |

The automation does **not** need `SNYK_TOKEN` in Cursor secrets. When it opens a PR, the Snyk GitHub App scans it automatically.

### Optional: fix CI Snyk job (no settings page)

If the GitHub Actions Snyk job fails with `401`, refresh OAuth from the CLI on your machine:

```powershell
snyk auth
.\scripts\refresh-snyk-oauth-secret.ps1
```

This uses browser login via the Snyk CLI — you never visit Snyk account settings to copy a token.

Do not commit secrets. Never echo token values in logs or PR bodies.
