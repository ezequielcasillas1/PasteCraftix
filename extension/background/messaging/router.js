/**
 * Mediator-style router for chrome.runtime.onMessage internal actions.
 * Handlers may return true (async sendResponse) or a Promise (payload reply).
 * Promise replies are converted to return-true + sendResponse so the port
 * stays open on all Chromium builds (raw Promise return is flaky).
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

    const result = handler(message, {
      sender,
      sendResponse,
      isExtensionPage: isExtensionPageSender(sender),
    });

    if (result && typeof result.then === 'function') {
      Promise.resolve(result).then(
        (payload) => {
          try { sendResponse(payload); } catch (_) {}
        },
        (err) => {
          try {
            sendResponse({
              success: false,
              ok: false,
              error: err?.message || 'handler_failed',
            });
          } catch (_) {}
        },
      );
      return true;
    }

    return result;
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
