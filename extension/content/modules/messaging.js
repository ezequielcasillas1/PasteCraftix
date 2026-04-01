// PasteCraft Content Script Messaging
// Communication helpers for content script context
// Note: Content scripts have limited chrome.* API access

import { MESSAGE_TYPES, STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Safe message send to background - doesn't throw
 * @param {Object} message - Message object
 * @returns {Promise<any|null>} Response or null on error
 */
export async function sendToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

/**
 * Save a clip via background script
 * @param {Object} options
 * @param {string} options.text - Clip text
 * @param {string} options.category - Category
 * @param {boolean} options.autoShow - Auto-show UI
 * @param {Object} options.meta - Metadata
 * @returns {Promise<{ success: boolean }>}
 */
export async function saveClip({ text, category = 'Uncategorized', autoShow = true, meta = null }) {
  return sendToBackground({
    action: 'saveClip',
    text,
    category,
    autoShow,
    meta
  });
}

/**
 * Open popup window via background
 * @param {Object} options
 * @param {string} options.page - Extension page path
 * @param {number} options.width - Window width
 * @param {number} options.height - Window height
 */
export async function openPopupWindow({ page, width = 980, height = 720 }) {
  return sendToBackground({
    action: MESSAGE_TYPES.OPEN_POPUP_WINDOW,
    page,
    width,
    height
  });
}

/**
 * Proxy fetch through background (for CORS bypass)
 * @param {Object} options
 * @param {string} options.url - Edge function URL
 * @param {string} options.method - HTTP method
 * @param {string} options.accessToken - Auth token
 * @param {Object} options.body - Request body
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
export async function fetchEdgeFunction({ url, method = 'POST', accessToken, body }) {
  return sendToBackground({
    action: MESSAGE_TYPES.FETCH_EDGE_FUNCTION,
    url,
    method,
    accessToken,
    body
  });
}

/**
 * Refresh Supabase token via background
 * @param {Object} options
 * @param {string} options.supabaseUrl
 * @param {string} options.anonKey
 * @param {string} options.refreshToken
 */
export async function refreshSupabaseToken({ supabaseUrl, anonKey, refreshToken }) {
  return sendToBackground({
    action: MESSAGE_TYPES.REFRESH_TOKEN,
    supabaseUrl,
    anonKey,
    refreshToken
  });
}

/**
 * Get stored session from chrome.storage
 * @returns {Promise<Object|null>} Session data or null
 */
export async function getStoredSession() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SESSION]);
    return result[STORAGE_KEYS.SESSION] || null;
  } catch (_) {
    return null;
  }
}

/**
 * Get access token from stored session
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const session = await getStoredSession();
  return session?.access_token || '';
}

/**
 * Listen for messages from background
 * @param {Function} handler - (message) => void
 * @returns {Function} Cleanup function
 */
export function onBackgroundMessage(handler) {
  const listener = (message, sender, sendResponse) => {
    // Only handle messages from extension (not from web pages)
    if (sender.id !== chrome.runtime.id) return;
    
    handler(message);
    sendResponse({ received: true });
    return false;
  };
  
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * Listen for storage changes
 * @param {Function} handler - (changes) => void
 * @returns {Function} Cleanup function
 */
export function onStorageChange(handler) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local') return;
    handler(changes);
  };
  
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
