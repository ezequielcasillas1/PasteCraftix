/** @forward-slice Grant click — chrome.permissions.request from popup gesture. */

import {
  clearSiteAccessNeeded,
  detectBrowserBrand,
  notifyTabsOptionalHostGranted,
  pcDebugOperaAf03f9,
  requestHostAccessFromUserGesture,
} from '../../../shared/optional-permissions.js';
import { SITE_ACCESS_ACTIONS, SITE_ACCESS_FIELDS } from './site-access.constants.js';
import { activeTabOriginPattern, refreshSiteAccessBanner } from './site-access.render.js';

async function readContains(originPattern) {
  const out = { containsAll: false, containsOrigin: false };
  try {
    out.containsAll = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (originPattern) {
      out.containsOrigin = await chrome.permissions.contains({ origins: [originPattern] });
    }
  } catch (_) {}
  return out;
}

function logGrantClick(before, result, originPattern) {
  // #region agent log
  pcDebugOperaAf03f9('H-O1', 'site-access.events.js:onGrantClick', 'permissions.request result', {
    ok: !!result.ok,
    scope: result.scope || null,
    error: result.error || null,
    allUrlsError: result.allUrlsError || null,
    originError: result.originError || null,
    containsAllBefore: !!before.containsAll,
    containsOriginBefore: !!before.containsOrigin,
    hasOriginPattern: !!originPattern,
  });
  pcDebugOperaAf03f9('H-O5', 'site-access.events.js:onGrantClick', 'origin fallback', {
    ok: !!result.ok,
    scope: result.scope || null,
    hasOriginPattern: !!originPattern,
  });
  // #endregion
}

function grantFailureText(result) {
  if (detectBrowserBrand().isOpera) {
    return 'Permission was not granted. If no prompt appeared, use opera://extensions → PasteCraft → Details → Site access.';
  }
  return result.message || 'Permission was not granted.';
}

async function finishGrantedFromPopup() {
  await notifyTabsOptionalHostGranted();
  await clearSiteAccessNeeded();
  await refreshSiteAccessBanner();
  window.close();
}

async function onGrantClick(btn) {
  btn.disabled = true;
  const status = document.querySelector(`[data-field="${SITE_ACCESS_FIELDS.STATUS}"]`);
  if (status) status.textContent = '';

  const originPattern = await activeTabOriginPattern();
  const before = await readContains(originPattern);
  const result = await requestHostAccessFromUserGesture(originPattern).catch((err) => ({
    ok: false,
    error: String(err?.message || err),
  }));
  logGrantClick(before, result, originPattern);

  if (result.ok) {
    await finishGrantedFromPopup();
    return;
  }
  if (status) status.textContent = grantFailureText(result);
  btn.disabled = false;
}

export function bindSiteAccessEvents() {
  if (bindSiteAccessEvents._bound) return;
  bindSiteAccessEvents._bound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest(`[data-action="${SITE_ACCESS_ACTIONS.GRANT}"]`);
    if (!btn) return;
    event.preventDefault();
    onGrantClick(btn).catch(() => {
      btn.disabled = false;
    });
  });
}
