// PasteCraft Messaging Utilities
// Handles communication between extension contexts (content script <-> background <-> popup)

import { MESSAGE_TYPES } from './constants.js';

/**
 * Send message to background service worker
 * @param {Object} message - Message object with action/type property
 * @returns {Promise<any>} Response from background
 */
export function sendToBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Send message to a specific tab's content script
 * @param {number} tabId - Tab ID
 * @param {Object} message - Message object
 * @returns {Promise<any>} Response from content script
 */
export function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Safe send to tab - doesn't throw on error (for broadcast scenarios)
 * @param {number} tabId - Tab ID
 * @param {Object} message - Message object
 * @returns {Promise<boolean>} true if successful, false otherwise
 */
export async function safeSendToTab(tabId, message) {
  try {
    await sendToTab(tabId, message);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Broadcast message to all tabs
 * @param {Object} message - Message object
 */
export async function broadcastToAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    const promises = tabs
      .filter(tab => tab.id != null)
      .map(tab => safeSendToTab(tab.id, message));
    await Promise.all(promises);
  } catch (err) {
    console.error('[Messaging] Broadcast error:', err);
  }
}

/**
 * Listen for messages from any context
 * @param {Function} handler - (message, sender, sendResponse) => boolean|void
 * @returns {Function} Cleanup function
 */
export function onMessage(handler) {
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}

/**
 * Listen for external messages (from allowed origins)
 * @param {Function} handler - (message, sender, sendResponse) => boolean|void
 * @returns {Function} Cleanup function
 */
export function onExternalMessage(handler) {
  chrome.runtime.onMessageExternal.addListener(handler);
  return () => chrome.runtime.onMessageExternal.removeListener(handler);
}

/**
 * Create a typed message sender for specific message types
 * @param {string} type - Message type from MESSAGE_TYPES
 * @returns {Function} (payload) => Promise<response>
 */
export function createTypedSender(type) {
  return (payload = {}) => sendToBackground({ type, ...payload });
}

/**
 * Create message router for background service worker
 * Routes messages to appropriate handlers based on type/action
 * @param {Object} handlers - { [type]: (message, sender) => Promise<response> }
 * @returns {Function} Message listener function
 */
export function createMessageRouter(handlers) {
  return (message, sender, sendResponse) => {
    const type = message?.type || message?.action;
    const handler = handlers[type];
    
    if (!handler) {
      return false;
    }

    // Handle async responses
    Promise.resolve(handler(message, sender))
      .then(response => sendResponse(response))
      .catch(err => {
        console.error(`[MessageRouter] Handler error for ${type}:`, err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  };
}

// Pre-built typed senders for common operations
export const messages = {
  saveClip: createTypedSender(MESSAGE_TYPES.CLIP_SAVE),
  deleteClip: createTypedSender(MESSAGE_TYPES.CLIP_DELETE),
  refreshClips: createTypedSender(MESSAGE_TYPES.CLIPS_REFRESH),
  openPopupPanel: () => sendToBackground({ action: MESSAGE_TYPES.OPEN_POPUP_PANEL }),
  checkout: createTypedSender(MESSAGE_TYPES.CHECKOUT)
};
