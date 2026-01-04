# PasteCraft Extension Packager for Edge Add-ons Store
# This script creates a clean ZIP package ready for submission

$version = "3.0.6"
$outputName = "pastecraft-v$version.zip"
$tempFolder = "temp-package"
$extensionFolder = "extension"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PasteCraft Extension Packager" -ForegroundColor Cyan
Write-Host "  Version: $version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Files to include in the package (copied into a clean temp folder so the ZIP root is correct)
$extensionFilesToInclude = @(
    "manifest.json",
    "background.js",
    "content-script.js",
    "popup.html",
    "popup.js",
    "styles.css",
    "config.js",
    "supabase-client.js",
    "supabase.js",
    "callback.html",
    "callback.js",
    "callback-hosted.html",
    "icon.png",
    "logo.svg",
    "index.html"
)

# Optional helper pages (kept outside extension/ for repo organization, but included in the ZIP)
$toolFilesToInclude = @(
    @{ Source = "tools\\utils\\get-extension-id.html"; Dest = "get-extension-id.html" },
    @{ Source = "tools\\setup\\setup-edge.html"; Dest = "setup-edge.html" }
)

# Check if all files exist
Write-Host "Checking required files..." -ForegroundColor Yellow
$missingFiles = @()
foreach ($file in $extensionFilesToInclude) {
    $path = Join-Path $extensionFolder $file
    if (-Not (Test-Path $path)) {
        $missingFiles += $path
        Write-Host "  ❌ Missing: $path" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Found: $path" -ForegroundColor Green
    }
}

foreach ($tool in $toolFilesToInclude) {
    if (-Not (Test-Path $tool.Source)) {
        $missingFiles += $tool.Source
        Write-Host "  ❌ Missing: $($tool.Source)" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Found: $($tool.Source)" -ForegroundColor Green
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ ERROR: $($missingFiles.Count) file(s) missing!" -ForegroundColor Red
    Write-Host "Please ensure all required files exist before packaging." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All files found! Creating package..." -ForegroundColor Yellow

# Recreate temp folder
if (Test-Path $tempFolder) {
    Remove-Item $tempFolder -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $tempFolder | Out-Null

# Remove old package if exists
if (Test-Path $outputName) {
    Remove-Item $outputName -Force
    Write-Host "Removed old package: $outputName" -ForegroundColor Gray
}

# Create the ZIP package
try {
    foreach ($file in $extensionFilesToInclude) {
        Copy-Item -Force (Join-Path $extensionFolder $file) (Join-Path $tempFolder $file)
    }

    foreach ($tool in $toolFilesToInclude) {
        Copy-Item -Force $tool.Source (Join-Path $tempFolder $tool.Dest)
    }

    Compress-Archive -Path (Join-Path $tempFolder "*") -DestinationPath $outputName -Force

    # Cleanup temp folder
    Remove-Item $tempFolder -Recurse -Force
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package created: $outputName" -ForegroundColor Cyan
    
    # Get file size
    $fileSize = (Get-Item $outputName).Length
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-Host "Package size: $fileSizeMB MB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "Your extension package is ready!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Test the package by loading it in Edge (edge://extensions/)" -ForegroundColor White
    Write-Host "2. Log in to Microsoft Partner Center" -ForegroundColor White
    Write-Host "3. Upload $outputName" -ForegroundColor White
    Write-Host "4. Complete the store listing with assets from edge-store-assets/" -ForegroundColor White
    Write-Host "5. Submit for review!" -ForegroundColor White
    Write-Host ""
    Write-Host "Good luck!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host ("ERROR creating package: " + $_) -ForegroundColor Red
    exit 1
}

