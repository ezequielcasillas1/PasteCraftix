#!/usr/bin/env bash
# Download the latest Snyk JSON report from a successful GitHub Actions Security Scans run.
# No Snyk settings page or Cursor secrets required — uses gh + CI artifacts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${SNYK_OUTPUT_DIR:-/tmp/snyk-reports}"
WORKFLOW="${SNYK_CI_WORKFLOW:-security-scans.yml}"
BRANCH="${SNYK_CI_BRANCH:-main}"
mkdir -p "$OUTPUT_DIR"

if ! command -v gh >/dev/null 2>&1; then
  echo "SNYK_CI_SKIP: gh CLI not available."
  exit 2
fi

echo "=== Fetch Snyk results from GitHub Actions (${WORKFLOW}) ==="

RUN_ID=""
while IFS= read -r line; do
  id="${line%%$'\t'*}"
  conclusion="${line#*$'\t'}"
  if [[ "$conclusion" == "success" ]]; then
    RUN_ID="$id"
    break
  fi
done < <(gh run list --workflow="$WORKFLOW" --branch="$BRANCH" --limit 20 --json databaseId,conclusion --jq '.[] | "\(.databaseId)\t\(.conclusion)"' 2>/dev/null || true)

if [[ -z "$RUN_ID" ]]; then
  echo "SNYK_CI_SKIP: no successful Security Scans run on ${BRANCH}."
  echo "Snyk will still run on the fix PR via the Snyk GitHub App integration."
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! gh run download "$RUN_ID" --name snyk-results --dir "$TMP_DIR" 2>/dev/null; then
  echo "SNYK_CI_SKIP: run ${RUN_ID} has no snyk-results artifact (Snyk job may have failed auth)."
  echo "Refresh CI auth: snyk auth && ./scripts/refresh-snyk-oauth-secret.ps1"
  echo "Or rely on Snyk GitHub App scan when the automation opens a PR."
  exit 2
fi

if [[ -f "$TMP_DIR/snyk-results.json" ]]; then
  cp "$TMP_DIR/snyk-results.json" "$OUTPUT_DIR/snyk-test.json"
  echo "OK: downloaded Snyk report from CI run ${RUN_ID}."
  echo "JSON report: ${OUTPUT_DIR}/snyk-test.json"
  exit 0
fi

echo "SNYK_CI_SKIP: artifact missing snyk-results.json."
exit 2
