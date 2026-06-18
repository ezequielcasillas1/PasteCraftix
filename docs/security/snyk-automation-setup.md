# Snyk in Cursor automations

Cursor cloud agents **cannot** read GitHub Actions secrets. To run Snyk in the weekly dependency automation, configure a **long-lived API token** in two places.

## 1. Create a Snyk API token

1. Open [app.snyk.io/account](https://app.snyk.io/account)
2. **Auth token** → **Generate**
3. Copy the token (shown once)

Prefer this over `snyk auth` OAuth — OAuth tokens expire in ~1 hour and break cron jobs.

## 2. GitHub repo secret (CI)

From your machine (with `gh` authenticated):

```bash
./scripts/set-snyk-github-secret.sh YOUR_SNYK_API_TOKEN
```

Or manually: repo **Settings → Secrets → Actions → SNYK_TOKEN**.

## 3. Cursor Cloud Agent secret (automation)

1. Open [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)
2. Select the **PasteCraftix** environment (or create one linked to this repo)
3. **Secrets** → add:
   - **Name:** `SNYK_TOKEN`
   - **Type:** Runtime Secret
   - **Value:** same API token from step 1
4. Ensure the weekly automation uses that environment

The repo provides `.cursor/environment.json` (`npm ci` for root + website) and `AGENTS.md` scan instructions.

## 4. Verify

Manual cloud agent run or local test:

```bash
export SNYK_TOKEN=your-token
./scripts/run-snyk-scan.sh
```

Expected: `OK: Snyk found no vulnerabilities at medium+.` (or a findings report).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `SNYK_SKIP: SNYK_TOKEN is not set` in automation | Add Runtime Secret in Cursor dashboard (step 3) |
| CI Snyk job `401 SNYK-0005` | Re-run `set-snyk-github-secret.sh` with fresh API token |
| OAuth refresh script used but cron still fails | OAuth expires ~1h; switch to API token (`SNYK_TOKEN`) |
| Snyk network error in cloud agent | Allow `api.snyk.io` / `snyk.io` in Cursor network allowlist |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run-snyk-scan.sh` | Snyk `--all-projects` with JSON output |
| `scripts/run-npm-audit.sh` | npm audit for root + website |
| `scripts/set-snyk-github-secret.sh` | Push token to GitHub Actions |
| `scripts/refresh-snyk-oauth-secret.ps1` | Short-lived OAuth sync (CI only if refreshed hourly) |
