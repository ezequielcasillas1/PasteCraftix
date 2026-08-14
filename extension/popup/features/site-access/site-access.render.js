/** @forward-slice Show/hide Allow site access banner. */

import {
  getCaptureToolsUnsupportedCopy,
  isCaptureToolsSupported,
} from '../../../shared/capture-browser-support.js';
import {
  detectBrowserBrand,
  hasOptionalHostAccess,
  originPatternFromUrl,
} from '../../../shared/optional-permissions.js';
import { SITE_ACCESS_ACTIONS, SITE_ACCESS_FIELDS } from './site-access.constants.js';

export async function activeTabOriginPattern() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return originPatternFromUrl(tabs?.[0]?.url);
  } catch (_) {
    return '';
  }
}

function setBannerGrantVisible(banner, visible) {
  const hint = banner.querySelector(`[data-field="${SITE_ACCESS_FIELDS.OPERA_HINT}"]`);
  const grantCopy = banner.querySelector(`[data-field="${SITE_ACCESS_FIELDS.GRANT_COPY}"]`);
  const grantBtn = banner.querySelector(`[data-action="${SITE_ACCESS_ACTIONS.GRANT}"]`);
  const unsupportedNote = banner.querySelector(`[data-field="${SITE_ACCESS_FIELDS.UNSUPPORTED}"]`);
  if (unsupportedNote) unsupportedNote.hidden = visible;
  if (grantCopy) grantCopy.hidden = !visible;
  if (grantBtn) grantBtn.hidden = !visible;
  if (hint && visible === false) hint.hidden = true;
  return { hint, unsupportedNote };
}

function showUnsupportedCaptureBanner(banner) {
  banner.hidden = false;
  const { unsupportedNote } = setBannerGrantVisible(banner, false);
  if (unsupportedNote) unsupportedNote.textContent = getCaptureToolsUnsupportedCopy('popup');
}

export async function refreshSiteAccessBanner() {
  const banner = document.querySelector(`[data-field="${SITE_ACCESS_FIELDS.BANNER}"]`);
  if (!banner) return;
  if (!isCaptureToolsSupported()) {
    showUnsupportedCaptureBanner(banner);
    return;
  }

  const { hint } = setBannerGrantVisible(banner, true);
  const originPattern = await activeTabOriginPattern();
  const host = await hasOptionalHostAccess(originPattern);
  if (hint) hint.hidden = !detectBrowserBrand().isOpera;
  banner.hidden = !!host.ok;
}
