# PasteCraft Extension Packager for Edge Add-ons Store
# This script creates a clean ZIP package ready for submission

$version = "3.0.6"
$outputName = "pastecraft-v$version.zip"
$tempFolder = "temp-package"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PasteCraft Extension Packager" -ForegroundColor Cyan
Write-Host "  Version: $version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Files to include in the package
$filesToInclude = @(
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
    "index.html",
    "get-extension-id.html",
    "setup-edge.html"
)

# Check if all files exist
Write-Host "Checking required files..." -ForegroundColor Yellow
$missingFiles = @()
foreach ($file in $filesToInclude) {
    if (-Not (Test-Path $file)) {
        $missingFiles += $file
        Write-Host "  ❌ Missing: $file" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Found: $file" -ForegroundColor Green
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

# Remove old package if exists
if (Test-Path $outputName) {
    Remove-Item $outputName -Force
    Write-Host "Removed old package: $outputName" -ForegroundColor Gray
}

# Create the ZIP package
try {
    Compress-Archive -Path $filesToInclude -DestinationPath $outputName -Force
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package created: $outputName" -ForegroundColor Cyan
    
    # Get file size
    $fileSize = (Get-Item $outputName).Length
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-Host "Package size: $fileSizeMB MB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📦 Your extension package is ready!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Test the package by loading it in Edge (edge://extensions/)" -ForegroundColor White
    Write-Host "2. Log in to Microsoft Partner Center" -ForegroundColor White
    Write-Host "3. Upload $outputName" -ForegroundColor White
    Write-Host "4. Complete the store listing with assets from edge-store-assets/" -ForegroundColor White
    Write-Host "5. Submit for review!" -ForegroundColor White
    Write-Host ""
    Write-Host "Good luck! 🚀" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR creating package: $_" -ForegroundColor Red
    exit 1
}

