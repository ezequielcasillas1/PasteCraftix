$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot '..'
$website = Join-Path $root 'website'
if (!(Test-Path $website)) { throw "Missing website/ directory at: $website" }

$patterns = @(
  '(?m)^\s*(const|let)\s+supabase\s*=',
  'window\.supabase\.createClient'
)

$files = Get-ChildItem -Path $website -Recurse -File -Include *.html,*.js | Select-Object -ExpandProperty FullName

$bad = @()
foreach ($f in $files) {
  $c = Get-Content -Raw -LiteralPath $f
  if ($c -match $patterns[0]) {
    $bad += $f
  }
}

if ($bad.Count -gt 0) {
  Write-Error ("Found forbidden redeclare pattern (const/let supabase) in:`n- " + ($bad -join "`n- "))
  exit 2
}

Write-Output "OK: no const/let supabase redeclare patterns found in website/"













