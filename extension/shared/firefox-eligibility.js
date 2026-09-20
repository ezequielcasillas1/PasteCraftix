/**
 * Firefox / AMO eligibility for PasteCraft.
 * Chromium store zip (Chrome + Edge) stays unchanged.
 * Firefox loads from a transformed package (scripts/prepare-firefox-extension.mjs).
 *
 * Capture Tools stay ineligible via capture-browser-support.js.
 */

export const FIREFOX_STORE_VERDICT = Object.freeze({
  ELIGIBLE: 'eligible',
  CONDITIONAL: 'conditional',
  BLOCKED: 'blocked',
});

export const FIREFOX_FEATURE_STATUS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

export const FIREFOX_FEATURES = Object.freeze({
  LOCAL_CLIPS: 'local_clips',
  EMAIL_AUTH: 'email_auth',
  GOOGLE_OAUTH: 'google_oauth',
  CLOUD_SYNC: 'cloud_sync',
  AI_LAB: 'ai_lab',
  IMAGE_CLIPBOARD: 'image_clipboard',
  CAPTURE_TOOLS: 'capture_tools',
});

export const FIREFOX_BLOCKERS = Object.freeze({
  OFFSCREEN_PERMISSION: 'offscreen_permission',
  SERVICE_WORKER_ONLY: 'service_worker_only',
  MISSING_GECKO_ID: 'missing_gecko_id',
  MISSING_DATA_COLLECTION: 'missing_data_collection',
  CHROMIUM_OAUTH_REDIRECT: 'chromium_oauth_redirect',
});

export const FIREFOX_GECKO_MIN_VERSION = '140.0';

export const FIREFOX_AMO_REQUIRED = Object.freeze({
  geckoId: true,
  dataCollectionPermissions: true,
  backgroundScripts: true,
  noOffscreenPermission: true,
});

function listPermissions(manifest) {
  return Array.isArray(manifest?.permissions) ? manifest.permissions.map(String) : [];
}

function geckoSettings(manifest) {
  return manifest?.browser_specific_settings?.gecko || null;
}

export function listFirefoxManifestBlockers(manifest = {}) {
  const blockers = [];
  const perms = listPermissions(manifest);
  const gecko = geckoSettings(manifest);

  const hasWorker = typeof manifest?.background?.service_worker === 'string';
  const hasScripts = Array.isArray(manifest?.background?.scripts)
    && manifest.background.scripts.length > 0;

  if (perms.includes('offscreen')) blockers.push(FIREFOX_BLOCKERS.OFFSCREEN_PERMISSION);
  if (hasWorker || !hasScripts) blockers.push(FIREFOX_BLOCKERS.SERVICE_WORKER_ONLY);
  if (!gecko?.id) blockers.push(FIREFOX_BLOCKERS.MISSING_GECKO_ID);
  if (!gecko?.data_collection_permissions) blockers.push(FIREFOX_BLOCKERS.MISSING_DATA_COLLECTION);
  return blockers;
}

export function isFirefoxPackageShape(manifest = {}) {
  return listFirefoxManifestBlockers(manifest).length === 0;
}

/**
 * Production Chrome/Edge zip must never be AMO-ready.
 * Gecko keys stay off this manifest.
 */
export function assessChromiumPackageForAmo(manifest = {}) {
  const blockers = listFirefoxManifestBlockers(manifest);
  return {
    store: 'amo',
    verdict: FIREFOX_STORE_VERDICT.BLOCKED,
    blockers,
    reason: 'chromium_zip_not_for_amo',
  };
}

/**
 * @param {object} [adapters]
 * @param {boolean} [adapters.oauthRedirectAllowlisted]
 * @param {boolean} [adapters.clipboardAdapter]
 */
export function assessFirefoxFeatureMatrix(adapters = {}) {
  const oauthReady = !!adapters.oauthRedirectAllowlisted;
  const clipboardReady = adapters.clipboardAdapter !== false;
  return Object.freeze({
    [FIREFOX_FEATURES.LOCAL_CLIPS]: FIREFOX_FEATURE_STATUS.READY,
    [FIREFOX_FEATURES.EMAIL_AUTH]: FIREFOX_FEATURE_STATUS.READY,
    [FIREFOX_FEATURES.GOOGLE_OAUTH]: oauthReady
      ? FIREFOX_FEATURE_STATUS.READY
      : FIREFOX_FEATURE_STATUS.BLOCKED,
    [FIREFOX_FEATURES.CLOUD_SYNC]: FIREFOX_FEATURE_STATUS.READY,
    [FIREFOX_FEATURES.AI_LAB]: FIREFOX_FEATURE_STATUS.READY,
    [FIREFOX_FEATURES.IMAGE_CLIPBOARD]: clipboardReady
      ? FIREFOX_FEATURE_STATUS.READY
      : FIREFOX_FEATURE_STATUS.BLOCKED,
    [FIREFOX_FEATURES.CAPTURE_TOOLS]: FIREFOX_FEATURE_STATUS.BLOCKED,
  });
}

export function getFirefoxFeatureStatus(feature, adapters) {
  return assessFirefoxFeatureMatrix(adapters)[feature] || FIREFOX_FEATURE_STATUS.BLOCKED;
}

export function listPendingFirefoxAdapters(adapters = {}) {
  const pending = [];
  if (!adapters.oauthRedirectAllowlisted) pending.push(FIREFOX_BLOCKERS.CHROMIUM_OAUTH_REDIRECT);
  return pending;
}

export function assessFirefoxEligibility(manifest = {}, adapters = {}) {
  const packageAssessment = assessChromiumPackageForAmo(manifest);
  return {
    chromeEdgeZip: packageAssessment,
    firefoxPackageReady: isFirefoxPackageShape(manifest),
    geckoMinVersion: FIREFOX_GECKO_MIN_VERSION,
    features: assessFirefoxFeatureMatrix(adapters),
    pendingAdapters: listPendingFirefoxAdapters(adapters),
    nextSlices: ['oauth-redirect-allowlist'],
  };
}
