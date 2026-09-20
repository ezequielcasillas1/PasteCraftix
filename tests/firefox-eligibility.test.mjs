import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  FIREFOX_BLOCKERS,
  FIREFOX_FEATURE_STATUS,
  FIREFOX_FEATURES,
  FIREFOX_GECKO_MIN_VERSION,
  FIREFOX_STORE_VERDICT,
  assessChromiumPackageForAmo,
  assessFirefoxEligibility,
  assessFirefoxFeatureMatrix,
  getFirefoxFeatureStatus,
  isFirefoxPackageShape,
  listFirefoxManifestBlockers,
  listPendingFirefoxAdapters,
} from '../extension/shared/firefox-eligibility.js';
import {
  FIREFOX_DATA_COLLECTION,
  FIREFOX_GECKO_ID,
  transformChromiumManifestForFirefox,
} from '../extension/shared/firefox-manifest-transform.js';
import { hasOffscreenDocuments } from '../extension/shared/offscreen-support.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromiumManifest = JSON.parse(
  readFileSync(join(root, 'extension', 'manifest.json'), 'utf8'),
);

test('Chromium production manifest is blocked for AMO', () => {
  const blockers = listFirefoxManifestBlockers(chromiumManifest);
  assert.ok(blockers.includes(FIREFOX_BLOCKERS.OFFSCREEN_PERMISSION));
  assert.ok(blockers.includes(FIREFOX_BLOCKERS.SERVICE_WORKER_ONLY));
  assert.ok(blockers.includes(FIREFOX_BLOCKERS.MISSING_GECKO_ID));
  assert.ok(blockers.includes(FIREFOX_BLOCKERS.MISSING_DATA_COLLECTION));
  assert.equal(isFirefoxPackageShape(chromiumManifest), false);

  const amo = assessChromiumPackageForAmo(chromiumManifest);
  assert.equal(amo.verdict, FIREFOX_STORE_VERDICT.BLOCKED);
  assert.equal(amo.reason, 'chromium_zip_not_for_amo');
  assert.ok(chromiumManifest.permissions.includes('offscreen'));
  assert.equal(chromiumManifest.browser_specific_settings, undefined);
});

test('Transform makes a Firefox package without touching Chromium keys we care about', () => {
  const fx = transformChromiumManifestForFirefox(chromiumManifest);
  assert.equal(isFirefoxPackageShape(fx), true);
  assert.deepEqual(listFirefoxManifestBlockers(fx), []);
  assert.equal(fx.permissions.includes('offscreen'), false);
  assert.equal(fx.oauth2, undefined);
  assert.equal(fx.background.service_worker, undefined);
  assert.deepEqual(fx.background.scripts, ['background.js']);
  assert.equal(fx.background.type, 'module');
  assert.equal(fx.browser_specific_settings.gecko.id, FIREFOX_GECKO_ID);
  assert.equal(fx.browser_specific_settings.gecko.strict_min_version, FIREFOX_GECKO_MIN_VERSION);
  assert.deepEqual(
    fx.browser_specific_settings.gecko.data_collection_permissions.required,
    [...FIREFOX_DATA_COLLECTION.required],
  );
  assert.ok(chromiumManifest.permissions.includes('offscreen'));
});

test('Core Scholar features and image clipboard are ready; capture stays blocked', () => {
  const features = assessFirefoxFeatureMatrix();
  assert.equal(features[FIREFOX_FEATURES.LOCAL_CLIPS], FIREFOX_FEATURE_STATUS.READY);
  assert.equal(features[FIREFOX_FEATURES.EMAIL_AUTH], FIREFOX_FEATURE_STATUS.READY);
  assert.equal(features[FIREFOX_FEATURES.CLOUD_SYNC], FIREFOX_FEATURE_STATUS.READY);
  assert.equal(features[FIREFOX_FEATURES.AI_LAB], FIREFOX_FEATURE_STATUS.READY);
  assert.equal(features[FIREFOX_FEATURES.IMAGE_CLIPBOARD], FIREFOX_FEATURE_STATUS.READY);
  assert.equal(features[FIREFOX_FEATURES.GOOGLE_OAUTH], FIREFOX_FEATURE_STATUS.BLOCKED);
  assert.equal(features[FIREFOX_FEATURES.CAPTURE_TOOLS], FIREFOX_FEATURE_STATUS.BLOCKED);
});

test('OAuth adapter is the remaining pending slice', () => {
  assert.equal(
    getFirefoxFeatureStatus(FIREFOX_FEATURES.GOOGLE_OAUTH, { oauthRedirectAllowlisted: true }),
    FIREFOX_FEATURE_STATUS.READY,
  );
  assert.deepEqual(listPendingFirefoxAdapters({ oauthRedirectAllowlisted: true }), []);
  assert.deepEqual(listPendingFirefoxAdapters(), [FIREFOX_BLOCKERS.CHROMIUM_OAUTH_REDIRECT]);
});

test('Eligibility report keeps Chrome/Edge zip blocked', () => {
  const report = assessFirefoxEligibility(chromiumManifest);
  assert.equal(report.chromeEdgeZip.verdict, FIREFOX_STORE_VERDICT.BLOCKED);
  assert.equal(report.firefoxPackageReady, false);
  assert.equal(assessFirefoxEligibility(
    transformChromiumManifestForFirefox(chromiumManifest),
  ).firefoxPackageReady, true);
  assert.equal(report.geckoMinVersion, '140.0');
  assert.deepEqual(report.nextSlices, ['oauth-redirect-allowlist']);
});

test('Offscreen API probe is false without chrome.offscreen', () => {
  assert.equal(hasOffscreenDocuments({}), false);
  assert.equal(hasOffscreenDocuments({ offscreen: { createDocument: async () => {} } }), true);
});
