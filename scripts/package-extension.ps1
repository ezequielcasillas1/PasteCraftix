# PasteCraft Extension Packager — zips extension/ folder for Chrome + Edge store upload.
# Version is read from extension/manifest.json.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionFolder = Join-Path $repoRoot 'extension'
$releasesFolder = Join-Path $repoRoot 'releases'
$manifestPath = Join-Path $extensionFolder 'manifest.json'

if (-not (Test-Path $manifestPath)) {
    Write-Host "ERROR: manifest.json not found at $manifestPath" -ForegroundColor Red
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$outputName = "pastecraft-v$version.zip"
$outputPath = Join-Path $releasesFolder $outputName

if (-not (Test-Path $releasesFolder)) {
    New-Item -ItemType Directory -Force -Path $releasesFolder | Out-Null
}

if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
}

Write-Host "Packaging PasteCraft v$version..." -ForegroundColor Cyan
Write-Host "Source: $extensionFolder" -ForegroundColor Gray
Write-Host "Output: $outputPath" -ForegroundColor Gray

# Zip contents of extension/ (not the folder itself) — required by Chrome/Edge upload.
Compress-Archive -Path (Join-Path $extensionFolder '*') -DestinationPath $outputPath -Force

$fileSizeMB = [math]::Round((Get-Item $outputPath).Length / 1MB, 2)
Write-Host "Done. $outputName ($fileSizeMB MB)" -ForegroundColor Green
