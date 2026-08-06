import { createInternalMessageRouter, listRouterActions } from '../messaging/router.js';
import {
  INTERNAL_MESSAGE_ACTIONS as A,
  getInternalActionCoverage,
  isDeferredInternalAction,
  isSwallowInternalAction,
} from '../messaging/message-types.js';
import { createCaptureHandlerMap } from './capture.handler.js';
import { createWindowHandlerMap } from './window.handler.js';
import { createClipsHandlerMap } from './clips.handler.js';

const routedHandlers = {
  ...createCaptureHandlerMap(),
  ...createWindowHandlerMap(),
  ...createClipsHandlerMap(),
};

const routeRoutedMessage = createInternalMessageRouter(routedHandlers);

function isRoutedAction(action) {
  return Object.prototype.hasOwnProperty.call(routedHandlers, action);
}

// Coverage gate (dev): every ROUTED action must be registered on the Mediator map.
const __coverage = getInternalActionCoverage(listRouterActions(routedHandlers));
if (!__coverage.ok) {
  console.warn('[PasteCraft] internal message coverage gap:', __coverage.missingFromRouter);
}

// INTERNAL MESSAGE LISTENER (Content Script Messages)
// =====================================================
// Routed families: capture, window, clips/quickview/broadcast.
// Deferred in-file: pcRefreshSupabaseToken, pcCreateCheckout (auth/billing).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message && typeof message.action === 'string' ? message.action : '';

  // Offscreen document owns this action — do not sendResponse / do not log.
  if (isSwallowInternalAction(action)) {
    return false;
  }

  if (isRoutedAction(action)) {
    return routeRoutedMessage(message, sender, sendResponse);
  }

  if (!sender || (sender.id && sender.id !== chrome.runtime.id)) {
    sendResponse?.({ success: false, error: 'invalid_sender' });
    return false;
  }

  // Deferred auth/billing only — unknown actions log then fall through (parity).
  if (!isDeferredInternalAction(action)) {
    console.log('📨 Internal message received:', action);
    return false;
  }

  const isExtensionPage = (() => {
    try {
      const url = String(sender.url || sender.tab?.url || '');
      return url.startsWith(chrome.runtime.getURL(''));
    } catch (_) {
      return false;
    }
  })();

  console.log('📨 Internal message received:', action);

  if (action === A.PC_REFRESH_SUPABASE_TOKEN) {
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

        // Single-flight: coalesce concurrent refresh calls for the same token.
        // Prevents "Invalid Refresh Token: Already Used" from parallel POSTs.
        globalThis.__pcRefreshInflight = globalThis.__pcRefreshInflight || new Map();
        const inflight = globalThis.__pcRefreshInflight;
        if (inflight.has(refreshToken)) {
          sendResponse(await inflight.get(refreshToken));
          return;
        }

        const refreshPromise = (async () => {
          const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          const status = resp.status;
          const ok = resp.ok;
          const data = await resp.json().catch(() => ({}));
          return { success: true, ok, status, data };
        })();

        inflight.set(refreshToken, refreshPromise);
        try {
          sendResponse(await refreshPromise);
        } finally {
          inflight.delete(refreshToken);
        }
      } catch (error) {
        sendResponse({ success: false, status: 0, error: error?.message || String(error) });
      }
    })();

    return true;
  }

  if (action === A.PC_CREATE_CHECKOUT) {
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
            'Authorization': authHeader,
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

        // Prefer the hosted checkout URL returned by Stripe. The hand-built
        // /c/pay/{id} form is not a valid landing URL and fails to open.
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

  return false;
});
