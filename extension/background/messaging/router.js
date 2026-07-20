/**
 * Mediator-style router for chrome.runtime.onMessage internal actions.
 * Handlers may return true (async sendResponse) or a Promise (payload reply).
 */
export function createInternalMessageRouter(handlers) {
  const routeMap = handlers && typeof handlers === 'object' ? handlers : {};

  return function routeInternalMessage(message, sender, sendResponse) {
    if (!sender || (sender.id && sender.id !== chrome.runtime.id)) {
      sendResponse?.({ success: false, error: 'invalid_sender' });
      return false;
    }

    const action = message && typeof message.action === 'string' ? message.action : '';
    const handler = routeMap[action];
    if (typeof handler !== 'function') {
      return false;
    }

    console.log('📨 Internal message received:', action);

    return handler(message, {
      sender,
      sendResponse,
      isExtensionPage: isExtensionPageSender(sender),
    });
  };
}

function isExtensionPageSender(sender) {
  try {
    const url = String(sender?.url || sender?.tab?.url || '');
    return url.startsWith(chrome.runtime.getURL(''));
  } catch (_) {
    return false;
  }
}
