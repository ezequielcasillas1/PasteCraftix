# tools/check-secrets.ps1
# Quick pre-commit sanity scan.
# Blocks commits that would leak obvious secrets:
#   - Long JWTs (eyJhbG...)
#   - Supabase service_role key bodies
#   - Stripe live/secret keys (sk_live_... / rk_live_...)
#   - Resend API keys (re_...)
#   - Google API keys (AIza...)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools/check-secrets.ps1
#
# Optional: install as a git pre-commit hook by copying this into .git/hooks/pre-commit.ps1
# and calling it from a pre-commit wrapper.

$ErrorActionPreference = 'Stop'

# Files that would go into a commit right now (staged + modified).
$targets = git diff --cached --name-only
if (-not $targets) { $targets = git diff --name-only }
if (-not $targets) { Write-Host "No changes to scan." -ForegroundColor DarkGray; exit 0 }

$patterns = @(
  @{ name = 'JWT (service_role / anon leakage)'; regex = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]{40,}\.[A-Za-z0-9_\-]{20,}' },
  @{ name = 'Supabase service_role literal'; regex = '"role"\s*:\s*"service_role"' },
  @{ name = 'Stripe live secret key';        regex = 'sk_live_[A-Za-z0-9]{20,}' },
  @{ name = 'Stripe restricted live key';    regex = 'rk_live_[A-Za-z0-9]{20,}' },
  @{ name = 'Resend API key';                regex = 're_[A-Za-z0-9_\-]{20,}' },
  @{ name = 'Google API key';                regex = 'AIza[0-9A-Za-z_\-]{30,}' },
  @{ name = 'Generic private key header';    regex = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' }
)

$hits = @()
foreach ($file in $targets) {
  if (-not (Test-Path $file)) { continue }
  # Skip obvious binary / lock / vendored junk.
  if ($file -match '\.(png|jpg|jpeg|gif|webp|zip|crx|pem|p12|pfx|ico)$') { continue }
  if ($file -match 'node_modules|extension/lib|\.git/')                  { continue }

  $content = Get-Content -Raw -LiteralPath $file -ErrorAction SilentlyContinue
  if (-not $content) { continue }

  foreach ($p in $patterns) {
    if ($content -match $p.regex) {
      $hits += [pscustomobject]@{ File = $file; Rule = $p.name }
    }
  }
}

if ($hits.Count -gt 0) {
  Write-Host ""
  Write-Host "BLOCKED: potential secrets detected in staged files" -ForegroundColor Red
  $hits | Format-Table -AutoSize
  Write-Host ""
  Write-Host "Fix: remove the secret, or add the file to .gitignore, then retry." -ForegroundColor Yellow
  exit 1
}

Write-Host "OK — no obvious secrets detected." -ForegroundColor Green
exit 0
