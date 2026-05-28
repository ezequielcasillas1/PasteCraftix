#!/usr/bin/env node
/**
 * Cross-platform PasteCraft extension packager (CI + local).
 *
 * Mirrors scripts/package-extension.ps1 but runs on Linux CI runners as well as
 * Windows. Reads the version from extension/manifest.json and zips the CONTENTS
 * of extension/ (NOT the folder itself) into releases/pastecraft-v<version>.zip
 * — the exact shape required by the Chrome Web Store and Edge Add-ons.
 *
 * The SAME zip is uploaded to both stores; never diverge Chrome vs Edge.
 *
 * Zip strategy:
 *   - Ubuntu / macOS: use the preinstalled `zip` CLI (deterministic, store-safe).
 *   - Windows fallback: use PowerShell Compress-Archive when `zip` is absent.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionDir = path.join(repoRoot, 'extension');
const releasesDir = path.join(repoRoot, 'releases');
const manifestPath = path.join(extensionDir, 'manifest.json');

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  die(`manifest.json not found at ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

if (Object.prototype.hasOwnProperty.call(manifest, 'key')) {
  die('manifest contains a "key" field — refusing to package. Remove it before any store upload.');
}
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  die(`manifest version must be strict semver MAJOR.MINOR.PATCH (got ${JSON.stringify(version)})`);
}

const outputName = `pastecraft-v${version}.zip`;
const outputPath = path.join(releasesDir, outputName);

fs.mkdirSync(releasesDir, { recursive: true });
if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { force: true });
}

console.log(`Packaging PasteCraft v${version}...`);
console.log(`Source: ${extensionDir}`);
console.log(`Output: ${outputPath}`);

function hasZipCli() {
  const probe = spawnSync('zip', ['-v'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

function zipWithCli() {
  // Run inside extension/ so archive paths are relative to the folder CONTENTS.
  const result = spawnSync('zip', ['-r', '-q', '-X', outputPath, '.'], {
    cwd: extensionDir,
    stdio: 'inherit',
  });
  if (result.error) die(`zip CLI failed: ${result.error.message}`);
  if (result.status !== 0) die(`zip CLI exited with code ${result.status}`);
}

function zipWithPowerShell() {
  const psCommand = [
    '$ErrorActionPreference = "Stop";',
    `Compress-Archive -Path (Join-Path '${extensionDir}' '*') -DestinationPath '${outputPath}' -Force`,
  ].join(' ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', psCommand], {
    stdio: 'inherit',
  });
  if (result.error) die(`Compress-Archive failed: ${result.error.message}`);
  if (result.status !== 0) die(`Compress-Archive exited with code ${result.status}`);
}

if (hasZipCli()) {
  zipWithCli();
} else if (os.platform() === 'win32') {
  console.log('zip CLI not found — falling back to PowerShell Compress-Archive.');
  zipWithPowerShell();
} else {
  die('zip CLI not found on a non-Windows platform. Install zip (e.g. `apt-get install zip`).');
}

if (!fs.existsSync(outputPath)) {
  die('packaging finished but output zip was not created.');
}

const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
console.log(`Done. ${outputName} (${sizeMB} MB)`);
