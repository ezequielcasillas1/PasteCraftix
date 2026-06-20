#!/usr/bin/env bash
# Run npm audit in every package.json directory (repo root + website/).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${SNYK_OUTPUT_DIR:-/tmp/snyk-reports}"
SEVERITY="${NPM_AUDIT_SEVERITY:-moderate}"
FAILED=0

mkdir -p "$REPORT_DIR"

run_audit() {
  local dir="$1"
  local label="$2"
  local out="${REPORT_DIR}/npm-audit-${label}.json"
  echo "=== npm audit: ${label} (${dir}) ==="
  if (cd "$dir" && npm audit --audit-level="${SEVERITY}" --json > "$out" 2>/dev/null); then
    echo "OK: no vulnerabilities at ${SEVERITY}+"
  else
    local code=$?
    if [[ $code -eq 1 ]]; then
      echo "FINDINGS: vulnerabilities at ${SEVERITY}+ (see ${out})"
      FAILED=1
    else
      echo "ERROR: npm audit failed (exit ${code})"
      exit "$code"
    fi
  fi
}

run_audit "$ROOT" "root"
run_audit "$ROOT/website" "website"

if [[ $FAILED -eq 1 ]]; then
  echo ""
  echo "npm audit summary: moderate+ issues found in one or more projects."
  exit 1
fi

echo ""
echo "npm audit summary: all projects clean at ${SEVERITY}+."
