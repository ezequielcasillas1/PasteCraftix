#!/usr/bin/env node
/**
 * Production Publishing Safety gate for extension/manifest.json.
 *
 * Asserts the invariants required by .cursor/rules/production-publishing-safety.mdc
 * so a bad package can never reach the Chrome Web Store or Edge Add-ons:
 *   - manifest_version === 3
 *   - NO "key" field (would re-scope the extension ID and orphan user data)
 *   - version is valid strict semver (MAJOR.MINOR.PATCH)
 *   - core permissions + Supabase/Google host_permissions still present
 *
 * Exit code 0 = safe, 1 = a guard failed. Used by CI and the release workflow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'extension', 'manifest.json');

// Permissions that must never silently disappear (re-consent / sync breakers).
const REQUIRED_PERMISSIONS = ['storage', 'identity', 'scripting', 'tabs'];
const REQUIRED_HOST_PATTERNS = ['*.supabase.co', 'accounts.google.com'];
const SEMVER = /^\d+\.\d+\.\d+$/;

const failures = [];

function fail(message) {
  failures.push(message);
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    fail(`manifest.json not found at ${manifestPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    fail(`manifest.json is not valid JSON: ${err.message}`);
    return null;
  }
}

function checkManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    fail(`manifest_version must be 3 (got ${JSON.stringify(manifest.manifest_version)})`);
  }

  if (Object.prototype.hasOwnProperty.call(manifest, 'key')) {
    fail('manifest contains a "key" field — this re-scopes the extension ID and MUST NOT ship to stores');
  }

  if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) {
    fail(`version must be strict semver MAJOR.MINOR.PATCH (got ${JSON.stringify(manifest.version)})`);
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  for (const perm of REQUIRED_PERMISSIONS) {
    if (!permissions.includes(perm)) {
      fail(`missing required permission "${perm}"`);
    }
  }

  const hosts = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  for (const pattern of REQUIRED_HOST_PATTERNS) {
    if (!hosts.some((h) => h.includes(pattern))) {
      fail(`missing required host_permission matching "${pattern}"`);
    }
  }
}

const manifest = readManifest();
if (manifest) {
  checkManifest(manifest);
}

if (failures.length > 0) {
  console.error('Manifest safety check FAILED:');
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`Manifest safety check passed (v${manifest.version}, MV${manifest.manifest_version}).`);
