$ErrorActionPreference = 'Stop'

$url = $env:PASTECRAFT_ACCOUNT_URL
if ([string]::IsNullOrWhiteSpace($url)) { $url = 'https://pastecraft.com/account.html' }

$r = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ 'Cache-Control' = 'no-cache' }
$c = $r.Content

$hasConstSupabase = [bool]($c -match '(?m)^\s*const\s+supabase\s*=')
$hasConstSb = [bool]($c -match '(?m)^\s*const\s+sb\s*=')

if ($hasConstSupabase -and -not $hasConstSb) {
  Write-Error "LIVE FAIL: $url is serving const supabase (will trigger redeclare SyntaxError in some browsers)."
  exit 2
}

Write-Output "LIVE OK: $url does not look like the broken const supabase variant."



























