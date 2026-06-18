#!/usr/bin/env bash
# Full dependency security pipeline: scan → fetch CI Snyk → build fix plan → apply fixes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${SNYK_OUTPUT_DIR:-/tmp/snyk-reports}"
APPLY_FIXES="${APPLY_FIXES:-1}"
mkdir -p "$REPORT_DIR"

cd "$ROOT"

echo "=== Dependency security pipeline ==="
echo ""

# 1. Install deps
if [[ ! -d node_modules ]]; then npm ci; fi
if [[ ! -d website/node_modules ]]; then npm ci --prefix website; fi

# 2. npm audit (always)
AUDIT_EXIT=0
"$ROOT/scripts/run-npm-audit.sh" || AUDIT_EXIT=$?

echo ""

# 3. Snyk — local token, then CI artifact, else skip
SNYK_EXIT=0
SNYK_SOURCE="none"

if [[ -n "${SNYK_TOKEN:-}" || -n "${SNYK_OAUTH_TOKEN:-}" ]]; then
  "$ROOT/scripts/run-snyk-scan.sh" && SNYK_SOURCE="local-cli" || { SNYK_EXIT=$?; SNYK_SOURCE="local-cli"; }
elif "$ROOT/scripts/fetch-snyk-from-ci.sh"; then
  SNYK_SOURCE="github-actions"
else
  SNYK_EXIT=2
  SNYK_SOURCE="skipped"
  echo "SNYK: skipped (no local token; no CI artifact). Snyk GitHub App will scan the fix PR."
fi

echo ""

# 4. Build unified fix plan from npm audit + Snyk JSON
PLAN_EXIT=0
node "$ROOT/scripts/build-fix-plan.mjs" || PLAN_EXIT=$?

echo ""

# 5. Apply fixes when plan has findings
APPLY_EXIT=0
RESCAN_EXIT=0
if [[ $PLAN_EXIT -ne 0 && "$APPLY_FIXES" == "1" ]]; then
  echo "=== Applying dependency fixes ==="
  node "$ROOT/scripts/apply-dependency-fixes.mjs" || APPLY_EXIT=$?
  echo ""
  echo "=== Re-scan after fixes ==="
  "$ROOT/scripts/run-npm-audit.sh" || RESCAN_EXIT=$?
  if [[ -n "${SNYK_TOKEN:-}" || -n "${SNYK_OAUTH_TOKEN:-}" ]]; then
    "$ROOT/scripts/run-snyk-scan.sh" || true
  fi
elif [[ $PLAN_EXIT -ne 0 ]]; then
  echo "Fix plan ready at ${REPORT_DIR}/fix-plan.json (APPLY_FIXES=0, skipping apply)."
fi

echo ""
echo "=== Pipeline summary ==="
echo "npm audit:     $([ $AUDIT_EXIT -eq 0 ] && echo clean || echo findings)"
echo "Snyk source:   ${SNYK_SOURCE}"
echo "Fix plan:      $([ $PLAN_EXIT -eq 0 ] && echo none || echo ${REPORT_DIR}/fix-plan.json)"
echo "Fixes applied: $([ $APPLY_EXIT -eq 0 ] && [ $PLAN_EXIT -ne 0 ] && [ "$APPLY_FIXES" == "1" ] && echo yes || echo no)"
echo "Post-fix scan: $([ $RESCAN_EXIT -eq 0 ] && echo clean || echo findings)"

# Exit 0 when clean after apply; exit 1 when findings remain or apply failed
if [[ $PLAN_EXIT -eq 0 ]]; then
  exit 0
fi
if [[ "$APPLY_FIXES" == "1" && $RESCAN_EXIT -eq 0 ]]; then
  exit 0
fi
exit 1
