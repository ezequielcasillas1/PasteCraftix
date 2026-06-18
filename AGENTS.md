# Cloud agent instructions

## Dependency security automation (weekly cron)

When running the scheduled dependency security scan:

1. Ensure dependencies are installed: `npm ci && npm ci --prefix website`
2. Run Snyk via the repo script (do **not** call `npx snyk` directly):

   ```bash
   ./scripts/run-snyk-scan.sh
   ```

3. If Snyk reports moderate+ vulnerabilities with fixes, apply dependency updates only (no app logic changes unless required for compatibility).
4. Also run `./scripts/run-npm-audit.sh` and merge findings with Snyk output.
5. Open a PR on branch `fix/deps-YYYY-MM-DD` listing each fix: package, advisory ID, old/new version, scan source.

### Snyk auth requirement

The cloud VM does **not** receive GitHub Actions secrets. Snyk requires **`SNYK_TOKEN`** (long-lived API token) configured as a **Runtime Secret** in [Cursor Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) for this repository's environment.

If `SNYK_TOKEN` is missing, the scan script falls back to `npm audit` and notes Snyk was skipped.

Do not commit secrets. Never echo token values in logs or PR bodies.
