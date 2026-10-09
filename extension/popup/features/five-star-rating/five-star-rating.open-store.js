import {
  CHROME_WEB_STORE_REVIEWS_URL,
  EDGE_ADDONS_REVIEWS_URL,
  FIVE_STAR_RATE_LABEL_CHROME,
  FIVE_STAR_RATE_LABEL_EDGE,
} from './five-star-rating.constants.js';

export function isEdgeBrowser() {
  const ua = globalThis.navigator?.userAgent || '';
  return /Edg\//.test(ua);
}

export function resolveStoreReviewsUrl() {
  return isEdgeBrowser() ? EDGE_ADDONS_REVIEWS_URL : CHROME_WEB_STORE_REVIEWS_URL;
}

export function resolveStoreRateLabel() {
  return isEdgeBrowser() ? FIVE_STAR_RATE_LABEL_EDGE : FIVE_STAR_RATE_LABEL_CHROME;
}

/**
 * Open the correct store reviews/listing page for this browser.
 * Prefers chrome.tabs.create inside the extension popup.
 */
export function openChromeWebStoreReviews(createTab, url = resolveStoreReviewsUrl()) {
  if (typeof createTab === 'function') {
    createTab({ url, active: true });
    return 'tabs';
  }
  const openWindow = globalThis.window?.open;
  if (typeof openWindow === 'function') {
    openWindow(url, '_blank', 'noopener,noreferrer');
    return 'window';
  }
  return 'unavailable';
}

export function chromeTabsCreate() {
  const create = globalThis.chrome?.tabs?.create;
  if (typeof create !== 'function') return null;
  return create.bind(globalThis.chrome.tabs);
}
