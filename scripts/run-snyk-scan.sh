#!/usr/bin/env bash
# Snyk scan for Cursor automations, CI helpers, and local use.
# Requires SNYK_TOKEN (long-lived API token). OAuth tokens expire ~1h and are unsuitable for cron.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THRESHOLD="${SNYK_SEVERITY_THRESHOLD:-medium}"
OUTPUT_DIR="${SNYK_OUTPUT_DIR:-/tmp/snyk-reports}"
mkdir -p "$OUTPUT_DIR"

if [[ -z "${SNYK_TOKEN:-}" ]]; then
  echo "SNYK_SKIP: SNYK_TOKEN is not set."
  echo ""
  echo "Cursor automations cannot read GitHub Actions secrets."
  echo "Add a long-lived Snyk API token as a Runtime Secret named SNYK_TOKEN:"
  echo "  https://cursor.com/dashboard/cloud-agents → Secrets → this repo environment"
  echo ""
  echo "Also set the same token in GitHub repo secrets for CI:"
  echo "  ./scripts/set-snyk-github-secret.sh"
  echo ""
  echo "Setup guide: docs/security/snyk-automation-setup.md"
  exit 2
fi

cd "$ROOT"

if [[ ! -d node_modules ]]; then
  npm ci
fi
if [[ ! -d website/node_modules ]]; then
  npm ci --prefix website
fi

echo "=== Snyk test (severity >= ${THRESHOLD}, all projects) ==="

SNYK_EXIT=0
npx --yes snyk test \
  --all-projects \
  --severity-threshold="${THRESHOLD}" \
  --json > "${OUTPUT_DIR}/snyk-test.json" 2>"${OUTPUT_DIR}/snyk-test.stderr" || SNYK_EXIT=$?

if [[ -s "${OUTPUT_DIR}/snyk-test.stderr" ]]; then
  cat "${OUTPUT_DIR}/snyk-test.stderr"
fi

if [[ $SNYK_EXIT -eq 0 ]]; then
  echo "OK: Snyk found no vulnerabilities at ${THRESHOLD}+."
  echo "JSON report: ${OUTPUT_DIR}/snyk-test.json"
  exit 0
fi

if [[ $SNYK_EXIT -eq 1 ]]; then
  echo "FINDINGS: Snyk reported vulnerabilities at ${THRESHOLD}+."
  echo "JSON report: ${OUTPUT_DIR}/snyk-test.json"
  # Human-readable summary when jq is available
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      .vulnerabilities[]? |
      "\(.severity | ascii_upcase)\t\(.packageName)\t\(.id // .identifiers.CVE[0] // .identifiers.GHSA[0] // "n/a")\t\(.version)\tfix: \(.fixedIn | join(", ") // "none")"
    ' "${OUTPUT_DIR}/snyk-test.json" 2>/dev/null | head -50 || true
  fi
  exit 1
fi

echo "ERROR: Snyk failed (exit ${SNYK_EXIT}). Check ${OUTPUT_DIR}/snyk-test.stderr"
if grep -qi "authentication\|SNYK-0005\|401" "${OUTPUT_DIR}/snyk-test.stderr" 2>/dev/null; then
  echo ""
  echo "Auth failed — regenerate SNYK_TOKEN at https://app.snyk.io/account and update Cursor + GitHub secrets."
fi
exit "$SNYK_EXIT"
