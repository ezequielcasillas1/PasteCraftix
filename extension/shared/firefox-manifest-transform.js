/**
 * Build-time Adapter: Chromium manifest → Firefox AMO/load shape.
 * Never write this back into extension/manifest.json (Chrome + Edge zip).
 */

import { FIREFOX_GECKO_MIN_VERSION } from './firefox-eligibility.js';

export const FIREFOX_GECKO_ID = 'pastecraft@pastecraft.com';

export const FIREFOX_DATA_COLLECTION = Object.freeze({
  required: Object.freeze([
    'authenticationInfo',
    'websiteContent',
    'websiteActivity',
    'browsingActivity',
  ]),
  optional: Object.freeze(['technicalAndInteraction']),
});

const CHROME_ONLY_PERMISSIONS = new Set(['offscreen']);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export function transformChromiumManifestForFirefox(manifest = {}) {
  const next = cloneJson(manifest);
  next.permissions = (Array.isArray(next.permissions) ? next.permissions : [])
    .map(String)
    .filter((perm) => !CHROME_ONLY_PERMISSIONS.has(perm));

  delete next.oauth2;

  const worker = next.background?.service_worker || 'background.js';
  const type = next.background?.type || 'module';
  // Firefox 154 still rejects service_worker ("currently disabled"). Event page only.
  next.background = { scripts: [worker], type };

  next.browser_specific_settings = {
    gecko: {
      id: FIREFOX_GECKO_ID,
      strict_min_version: FIREFOX_GECKO_MIN_VERSION,
      data_collection_permissions: {
        required: [...FIREFOX_DATA_COLLECTION.required],
        optional: [...FIREFOX_DATA_COLLECTION.optional],
      },
    },
  };

  return next;
}
