import {
  normalizeArray,
  safeTabsSendMessage,
  getExtensionPageUrl,
  saveTextDirectly,
  getQuickViewClips,
  deleteQuickViewClip,
} from '../../shared.js';
import { INTERNAL_MESSAGE_ACTIONS as A } from '../../messaging/message-types.js';

export function handlePcCopyText(message, { sendResponse }) {
  const text = String(message.text || '');
  (async () => {
    try {
      await navigator.clipboard.writeText(text);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handlePcOpenPopupWindow(message, { sendResponse }) {
  try {
    const rawUrl = message && typeof message.url === 'string' ? message.url : '';
    const page = message && typeof message.page === 'string' ? message.page : '';
    const width = Number.isFinite(message?.width) ? Math.max(200, Math.round(message.width)) : 980;
    const height = Number.isFinite(message?.height) ? Math.max(200, Math.round(message.height)) : 720;

    const extensionOrigin = chrome.runtime.getURL('');
    const finalUrl = rawUrl || (page ? getExtensionPageUrl(page) : '');

    if (!finalUrl) {
      sendResponse({ success: false, error: 'missing_url' });
      return false;
    }

    if (!finalUrl.startsWith(extensionOrigin)) {
      sendResponse({ success: false, error: 'disallowed_url' });
      return false;
    }

    chrome.windows.create({ url: finalUrl, type: 'popup', width, height, focused: true }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  } catch (e) {
    sendResponse({ success: false, error: e?.message || String(e) });
    return false;
  }
}

export function handlePcRefreshSupabaseToken(message, { sendResponse, isExtensionPage }) {
  if (!isExtensionPage) {
    sendResponse({ success: false, error: 'forbidden_context' });
    return false;
  }
  (async () => {
    try {
      const supabaseUrl = String(message.supabaseUrl || '');
      const anonKey = String(message.anonKey || '');
      const refreshToken = String(message.refreshToken || '');
      if (!supabaseUrl || !anonKey || !refreshToken) {
        sendResponse({ success: false, status: 400, error: 'Missing token params' });
        return;
      }

      if (!/^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl)) {
        sendResponse({ success: false, status: 400, error: 'Invalid supabaseUrl' });
        return;
      }

      const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const status = resp.status;
      const ok = resp.ok;
      const data = await resp.json().catch(() => ({}));
      sendResponse({ success: true, ok, status, data });
    } catch (error) {
      sendResponse({ success: false, status: 0, error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleSaveClip(message, { sendResponse }) {
  saveTextDirectly(
    message.text,
    message.category || 'Uncategorized',
    message.autoShow !== false,
    message.meta || null
  )
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((error) => {
      console.error('❌ Failed to save clip:', error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
}

export function handlePcGetQuickViewClips(_message, { sendResponse }) {
  getQuickViewClips()
    .then((clips) => {
      sendResponse({ success: true, clips });
    })
    .catch((error) => {
      console.error('❌ Failed to get Quick View clips:', error);
      sendResponse({ success: false, error: error?.message || String(error), clips: [] });
    });
  return true;
}

export function handlePcDeleteQuickViewClip(message, { sendResponse }) {
  deleteQuickViewClip({
    clipId: message.clipId,
    archived: message.archived === true,
    index: message.index,
  })
    .then((clips) => {
      chrome.runtime.sendMessage({ action: A.CLIPS_UPDATED }).catch(() => {});
      sendResponse({ success: true, clips });
    })
    .catch((error) => {
      console.error('❌ Failed to delete Quick View clip:', error);
      sendResponse({ success: false, error: error?.message || String(error), clips: [] });
    });
  return true;
}

export function handleClipsBroadcast(_message, { sendResponse }) {
  chrome.tabs.query({}, (tabs) => {
    normalizeArray(tabs).forEach((tab) => {
      const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
      if (tabId == null) return;
      safeTabsSendMessage(tabId, { action: A.CLIPS_UPDATED }).catch(() => {});
    });
  });
  sendResponse({ success: true });
  return false;
}

export function handlePcCreateCheckout(message, { sendResponse, isExtensionPage }) {
  if (!isExtensionPage) {
    sendResponse({ success: false, error: 'forbidden_context' });
    return false;
  }
  (async () => {
    try {
      const priceId = String(message.priceId || '');
      const rawCreditAmount = message.creditAmount ?? message.credit_amount ?? message.credits;
      const creditAmount = rawCreditAmount != null ? Math.floor(Number(rawCreditAmount)) : null;
      const accessToken = String(message.accessToken || '');
      const supabaseUrl = String(message.supabaseUrl || '');
      const anonKey = String(message.anonKey || '');
      const checkoutMode = String(message.mode || 'subscription');

      if ((!priceId && !Number.isFinite(creditAmount)) || !supabaseUrl || !anonKey) {
        sendResponse({
          success: false,
          error: 'Missing checkout params',
          details: {
            hasPriceId: !!priceId,
            hasCreditAmount: Number.isFinite(creditAmount),
            hasSupabaseUrl: !!supabaseUrl,
            hasAnonKey: !!anonKey,
            mode: checkoutMode,
          },
        });
        return;
      }

      const url = `${supabaseUrl}/functions/v1/create-checkout`;
      const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`;

      const payload = {
        successUrl: 'https://pastecraft.com/success.html?session_id={CHECKOUT_SESSION_ID}',
        success_url: 'https://pastecraft.com/success.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://pastecraft.com/pricing.html',
        cancel_url: 'https://pastecraft.com/pricing.html',
        mode: checkoutMode,
        quantity: 1,
      };

      if (priceId) {
        payload.priceId = priceId;
        payload.price_id = priceId;
      }
      if (Number.isFinite(creditAmount)) {
        payload.creditAmount = creditAmount;
        payload.credit_amount = creditAmount;
        payload.credits = creditAmount;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      const sessionId = data?.sessionId || data?.session?.id;
      const sessionUrl = typeof (data?.url || data?.session?.url) === 'string'
        ? String(data?.url || data?.session?.url)
        : '';

      if (!resp.ok || (!sessionId && !sessionUrl)) {
        const errorMsg = data?.error || data?.message || `HTTP ${resp.status}`;
        sendResponse({ success: false, error: errorMsg });
        return;
      }

      const checkoutUrl = sessionUrl || (sessionId ? `https://checkout.stripe.com/c/pay/${sessionId}` : '');
      if (!checkoutUrl) {
        sendResponse({ success: false, error: 'No checkout URL returned' });
        return;
      }

      chrome.tabs.create({ url: checkoutUrl }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({ success: false, error: err.message || String(err) });
        } else {
          sendResponse({ success: true, sessionId, checkoutUrl });
        }
      });
    } catch (error) {
      console.error('❌ Checkout error:', error);
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();
  return true;
}

export function createInternalHandlerMap() {
  return {
    [A.PC_COPY_TEXT]: handlePcCopyText,
    [A.PC_OPEN_POPUP_WINDOW]: handlePcOpenPopupWindow,
    [A.PC_REFRESH_SUPABASE_TOKEN]: handlePcRefreshSupabaseToken,
    [A.SAVE_CLIP]: handleSaveClip,
    [A.PC_GET_QUICK_VIEW_CLIPS]: handlePcGetQuickViewClips,
    [A.PC_DELETE_QUICK_VIEW_CLIP]: handlePcDeleteQuickViewClip,
    [A.REFRESH_CLIPS]: handleClipsBroadcast,
    [A.CLIPS_UPDATED]: handleClipsBroadcast,
    [A.PC_CREATE_CHECKOUT]: handlePcCreateCheckout,
  };
}
