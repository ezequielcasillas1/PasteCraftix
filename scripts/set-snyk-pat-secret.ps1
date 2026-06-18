# Sync long-lived Snyk PAT to GitHub Actions secret SNYK_TOKEN (no snyk auth required).
# Usage:
#   $env:SNYK_TOKEN = '<paste-pat>'; .\scripts\set-snyk-pat-secret.ps1
#   .\scripts\set-snyk-pat-secret.ps1 -Token '<paste-pat>'
# Also set SNYK_TOKEN in Cursor Cloud Agent secrets for the weekly scan automation.

param(
    [string]$Token = $env:SNYK_TOKEN
)

$ErrorActionPreference = 'Stop'

if (-not $Token) {
    Write-Error 'FAIL: no token. Set SNYK_TOKEN env var or pass -Token. Create PAT in Snyk → Account settings → Personal access tokens.'
    exit 1
}

$Token | gh secret set SNYK_TOKEN
if ($LASTEXITCODE -ne 0) {
    Write-Error 'FAIL: gh secret set SNYK_TOKEN (run gh auth login first)'
    exit 1
}

Write-Output 'OK: SNYK_TOKEN updated. Add the same value in Cursor Cloud Agent secrets. Optional: remove SNYK_OAUTH_TOKEN from GitHub.'
