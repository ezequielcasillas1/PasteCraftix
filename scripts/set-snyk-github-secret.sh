#!/usr/bin/env bash
# Set long-lived SNYK_TOKEN in GitHub repo secrets (for CI). Run locally after creating token at app.snyk.io/account.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <snyk-api-token>"
  echo "  Or:  SNYK_TOKEN=xxx $0"
  echo ""
  echo "Create token: https://app.snyk.io/account → Auth token → Generate"
  exit 1
fi

TOKEN="${SNYK_TOKEN:-$1}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: token required"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI required"
  exit 1
fi

echo "$TOKEN" | gh secret set SNYK_TOKEN
echo "OK: SNYK_TOKEN updated in GitHub repo secrets."
echo ""
echo "Next: add the same token to Cursor Cloud Agents → Secrets (Runtime Secret, name SNYK_TOKEN)."
echo "Guide: docs/security/snyk-automation-setup.md"
