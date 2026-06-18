# LEGACY: OAuth token (~1h). Prefer SNYK_TOKEN PAT instead:
#   $env:SNYK_TOKEN = '<pat>'; .\scripts\set-snyk-pat-secret.ps1
#   or: gh secret set SNYK_TOKEN

$ErrorActionPreference = 'Stop'

$configPath = Join-Path $env:USERPROFILE '.config\configstore\snyk.json'

if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Error 'FAIL: snyk.json missing. Run: snyk auth'
    exit 1
}

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$storage = $config.internal_oauth_token_storage
if (-not $storage) { $storage = $config.INTERNAL_OAUTH_TOKEN_STORAGE }

if (-not $storage) {
    Write-Error 'FAIL: no OAuth token stored. Run: snyk auth'
    exit 1
}

$oauth = $storage | ConvertFrom-Json
$token = $oauth.access_token

if (-not $token) {
    Write-Error 'FAIL: no access_token. Run: snyk auth'
    exit 1
}

if ($oauth.expiry) {
    $expiry = [DateTime]::Parse($oauth.expiry)
    if ($expiry -lt (Get-Date)) {
        Write-Warning 'WARN: OAuth token expired (~1h lifetime). Run: snyk auth, then re-run this script.'
        exit 1
    }
}

$token | gh secret set SNYK_OAUTH_TOKEN
if ($LASTEXITCODE -ne 0) {
    Write-Error 'FAIL: gh secret set SNYK_OAUTH_TOKEN'
    exit 1
}

Write-Output 'OK: SNYK_OAUTH_TOKEN updated (expires ~1h; refresh after snyk auth).'
