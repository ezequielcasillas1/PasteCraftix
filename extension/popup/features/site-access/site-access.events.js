/** @forward-slice Grant click — chrome.permissions.request from popup gesture. */

import {
  clearSiteAccessNeeded,
  detectBrowserBrand,
  notifyTabsOptionalHostGranted,
  requestHostAccessFromUserGesture,
} from '../../../shared/optional-permissions.js';
import { SITE_ACCESS_ACTIONS, SITE_ACCESS_FIELDS } from './site-access.constants.js';
import { activeTabOriginPattern, refreshSiteAccessBanner } from './site-access.render.js';

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
  const result = await requestHostAccessFromUserGesture(originPattern).catch((err) => ({
    ok: false,
    error: String(err?.message || err),
  }));

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
