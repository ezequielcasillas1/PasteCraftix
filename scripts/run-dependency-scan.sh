#!/usr/bin/env bash
# Entry point for the weekly dependency security automation.
# No Snyk settings page or Cursor secrets required.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${SNYK_OUTPUT_DIR:-/tmp/snyk-reports}"
mkdir -p "$OUTPUT_DIR"

cd "$ROOT"

echo "=== Dependency security scan ==="
echo ""

# 1. npm audit (always — runs locally in the cloud agent)
AUDIT_EXIT=0
"$ROOT/scripts/run-npm-audit.sh" || AUDIT_EXIT=$?

echo ""

# 2. Snyk — try local token, then CI artifact, else skip (GitHub App covers the PR)
SNYK_EXIT=0
SNYK_SOURCE="none"

if [[ -n "${SNYK_TOKEN:-}" || -n "${SNYK_OAUTH_TOKEN:-}" ]]; then
  if "$ROOT/scripts/run-snyk-scan.sh"; then
    SNYK_SOURCE="local-cli"
  else
    SNYK_EXIT=$?
    SNYK_SOURCE="local-cli"
  fi
elif "$ROOT/scripts/fetch-snyk-from-ci.sh"; then
  SNYK_SOURCE="github-actions"
else
  SNYK_EXIT=2
  SNYK_SOURCE="skipped"
  echo "SNYK: skipped in automation (no local token; no CI artifact)."
  echo "      Snyk GitHub App will scan the fix PR automatically."
fi

echo ""
echo "=== Summary ==="
echo "npm audit:  $([ $AUDIT_EXIT -eq 0 ] && echo clean || echo findings)"
echo "Snyk:       ${SNYK_SOURCE}$([ $SNYK_EXIT -eq 0 ] && [ "$SNYK_SOURCE" != skipped ] && echo " (clean)" || true)$([ $SNYK_EXIT -eq 1 ] && echo " (findings)" || true)"

# Fail if either scanner found issues at threshold
if [[ $AUDIT_EXIT -ne 0 || $SNYK_EXIT -eq 1 ]]; then
  exit 1
fi

exit 0
