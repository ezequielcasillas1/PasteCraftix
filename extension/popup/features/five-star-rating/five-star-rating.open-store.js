import { CHROME_WEB_STORE_REVIEWS_URL } from './five-star-rating.constants.js';

/**
 * Edge adapter: open the Chrome Web Store reviews page.
 * Prefers chrome.tabs.create inside the extension popup.
 */
export function openChromeWebStoreReviews(createTab, url = CHROME_WEB_STORE_REVIEWS_URL) {
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
