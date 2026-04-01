// PasteCraft Window Handler
// Handles window/popup operations

import { STORAGE_KEYS } from '../../shared/constants.js';
import { getStorageItems } from '../../shared/storage-adapter.js';

/**
 * Check if this is a repo loader development build
 */
function isRepoLoaderBuild() {
  try {
    const mf = chrome.runtime?.getManifest?.();
    const name = mf?.name ? String(mf.name) : '';
    const desc = mf?.description ? String(mf.description) : '';
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

/**
 * Get full extension page URL
 * @param {string} pagePath - Page path relative to extension root
 * @returns {string} Full URL
 */
export function getExtensionPageUrl(pagePath) {
  const raw = String(pagePath || '').trim();
  const path = raw.startsWith('extension/') || !isRepoLoaderBuild() ? raw : `extension/${raw}`;
  return chrome.runtime.getURL(path);
}

/**
 * Get user's preferred app open mode
 * @returns {Promise<'inPage' | 'edgePopup'>}
 */
export async function getAppOpenMode() {
  try {
    const result = await getStorageItems([STORAGE_KEYS.WIDGET_SETTINGS]);
    const widgetSettings = result[STORAGE_KEYS.WIDGET_SETTINGS] || {};
    const mode = typeof widgetSettings.appOpenMode === 'string' 
      ? widgetSettings.appOpenMode 
      : 'inPage';
    return mode === 'edgePopup' ? 'edgePopup' : 'inPage';
  } catch (_) {
    return 'inPage';
  }
}

/**
 * Open the app as a popup window
 * @returns {Promise<chrome.windows.Window>}
 */
export async function openAppPopupWindow() {
  const url = getExtensionPageUrl('popup.html');
  return chrome.windows.create({
    url,
    type: 'popup',
    width: 520,
    height: 760,
    focused: true
  });
}

/**
 * Open a custom popup window
 * @param {Object} options
 * @param {string} options.url - URL to open
 * @param {string} options.page - Extension page name (alternative to url)
 * @param {number} options.width - Window width
 * @param {number} options.height - Window height
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function openPopupWindow({ url, page, width = 980, height = 720 }) {
  try {
    const finalUrl = url || (page ? getExtensionPageUrl(page) : '');
    if (!finalUrl) {
      return { success: false, error: 'missing_url' };
    }

    const w = Math.max(200, Math.round(width));
    const h = Math.max(200, Math.round(height));

    await chrome.windows.create({
      url: finalUrl,
      type: 'popup',
      width: w,
      height: h,
      focused: true
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Handle extension icon click
 * @param {chrome.tabs.Tab} tab - Current tab
 */
export async function handleActionClick(tab) {
  try {
    const mode = await getAppOpenMode();
    
    if (mode === 'edgePopup') {
      console.log('[WindowHandler] Opening popup window');
      await openAppPopupWindow();
      return;
    }

    console.log('[WindowHandler] Opening slide-in panel');
    await chrome.tabs.sendMessage(tab.id, { action: 'openPopupPanel' });
  } catch (error) {
    console.error('[WindowHandler] Could not open UI:', error);
    // Fallback to popup window
    try {
      await openAppPopupWindow();
    } catch (_) {}
  }
}
