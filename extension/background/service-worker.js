// PasteCraft Service Worker (Background Script)
// Entry point that delegates to modular handlers
// Note: Service workers are stateless - all state must use chrome.storage

import { MESSAGE_TYPES } from '../shared/constants.js';
import { broadcastToAllTabs } from '../shared/messaging.js';

// Handlers
import { saveClip } from './handlers/clip.handler.js';
import { handleExternalMessage } from './handlers/auth.handler.js';
import { createContextMenus, handleContextMenuClick } from './handlers/context-menu.handler.js';
import { handleActionClick, openPopupWindow } from './handlers/window.handler.js';
import { handleFetchEdgeFunction, handleRefreshToken } from './handlers/proxy.handler.js';

// =====================================================
// LIFECYCLE EVENTS
// =====================================================

chrome.runtime.onInstalled.addListener((details) => {
  createContextMenus();
  
  if (details.reason === 'update') {
    console.log('[ServiceWorker] PasteCraft updated — user data preserved');
  } else if (details.reason === 'install') {
    console.log('[ServiceWorker] PasteCraft installed — welcome!');
  }
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

// Create menus immediately on load
createContextMenus();

// =====================================================
// ACTION (ICON) CLICK
// =====================================================

chrome.action.onClicked.addListener(handleActionClick);

// =====================================================
// CONTEXT MENU CLICKS
// =====================================================

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// =====================================================
// EXTERNAL MESSAGES (from auth.pastecraft.com)
// =====================================================

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true; // Keep channel open for async
});

// =====================================================
// INTERNAL MESSAGES (from content scripts, popup)
// =====================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action || message?.type;
  console.log('[ServiceWorker] Message:', action);

  // Window operations
  if (action === 'pcOpenPopupWindow' || action === MESSAGE_TYPES.OPEN_POPUP_WINDOW) {
    openPopupWindow({
      url: message.url,
      page: message.page,
      width: message.width,
      height: message.height
    })
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Edge function proxy
  if (action === 'pcFetchEdgeFunction' || action === MESSAGE_TYPES.FETCH_EDGE_FUNCTION) {
    handleFetchEdgeFunction(message)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Token refresh proxy
  if (action === 'pcRefreshSupabaseToken' || action === MESSAGE_TYPES.REFRESH_TOKEN) {
    handleRefreshToken(message)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Save clip
  if (action === 'saveClip' || action === MESSAGE_TYPES.CLIP_SAVE) {
    saveClip({
      text: message.text,
      category: message.category,
      autoShow: message.autoShow !== false,
      meta: message.meta
    })
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Refresh/broadcast clips updated
  if (action === 'refreshClips' || action === 'clipsUpdated' || 
      action === MESSAGE_TYPES.CLIPS_REFRESH || action === MESSAGE_TYPES.CLIPS_UPDATED) {
    broadcastToAllTabs({ action: 'clipsUpdated' });
    sendResponse({ success: true });
    return false;
  }

  // Unknown message
  return false;
});

console.log('[ServiceWorker] PasteCraft background initialized');
