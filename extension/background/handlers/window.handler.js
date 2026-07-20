import { getExtensionPageUrl } from '../shared.js';
import { INTERNAL_MESSAGE_ACTIONS as A } from '../messaging/message-types.js';

/**
 * Extension popup-window opener (pcOpenPopupWindow).
 * Keep each helper CC ≤ 9.
 */

function resolvePopupWindowUrl(message) {
  const rawUrl = message && typeof message.url === 'string' ? message.url : '';
  const page = message && typeof message.page === 'string' ? message.page : '';
  return rawUrl || (page ? getExtensionPageUrl(page) : '');
}

function resolvePopupWindowSize(message) {
  const width = Number.isFinite(message?.width) ? Math.max(200, Math.round(message.width)) : 980;
  const height = Number.isFinite(message?.height) ? Math.max(200, Math.round(message.height)) : 720;
  return { width, height };
}

function createExtensionPopupWindow(finalUrl, size, sendResponse) {
  chrome.windows.create(
    {
      url: finalUrl,
      type: 'popup',
      width: size.width,
      height: size.height,
      focused: true,
    },
    () => {
      const err = chrome.runtime.lastError;
      if (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      } else {
        sendResponse({ success: true });
      }
    },
  );
}

export function handlePcOpenPopupWindow(message, { sendResponse }) {
  try {
    const finalUrl = resolvePopupWindowUrl(message);
    if (!finalUrl) {
      sendResponse({ success: false, error: 'missing_url' });
      return false;
    }

    const extensionOrigin = chrome.runtime.getURL('');
    if (!finalUrl.startsWith(extensionOrigin)) {
      sendResponse({ success: false, error: 'disallowed_url' });
      return false;
    }

    createExtensionPopupWindow(finalUrl, resolvePopupWindowSize(message), sendResponse);
    return true;
  } catch (e) {
    sendResponse({ success: false, error: e?.message || String(e) });
    return false;
  }
}

export function createWindowHandlerMap() {
  return {
    [A.PC_OPEN_POPUP_WINDOW]: handlePcOpenPopupWindow,
  };
}
