import { getUpgradeModal } from './billing.selectors.js';
import { meetsStripeMinimum, CHECKOUT_MIN_CREDITS, CUSTOM_CREDIT_MAX } from './credit-pricing.js';

export function openUpgradeModal(app) {
  const modal = getUpgradeModal();
  if (modal) modal.classList.add('active');
}

export function closeUpgradeModal(app) {
  const modal = getUpgradeModal();
  if (modal) modal.classList.remove('active');
}

export function openPricingPage() {
  chrome.tabs.create({ url: 'https://pastecraft.com/pricing.html' });
}

function _readConfig() {
  const cfg = PASTECRAFT_CONFIG?.supabase || {};
  return { supabaseUrl: String(cfg.url || ''), anonKey: String(cfg.anonKey || '') };
}

/**
 * Resolve the current Supabase access token (JWT) for the signed-in user.
 * PasteCraftSupabase has no getSession() helper — the session lives on the
 * underlying supabase-js client (client.auth.getSession()).
 */
async function _getAccessToken() {
  const result = await pasteCraftSupabase?.client?.auth?.getSession?.();
  const token = result?.data?.session?.access_token;
  return token ? String(token) : '';
}

/**
 * Visible user feedback. alert() is unreliable in an extension popup (it can
 * dismiss the popup and never render), so prefer the in-popup toast.
 */
function _notify(app, message, type = 'error') {
  const msg = String(message || '');
  if (type === 'error') console.error('[PasteCraft] Checkout:', msg);
  else console.log('[PasteCraft] Checkout:', msg);
  if (app && typeof app.showToast === 'function') {
    app.showToast(msg, type === 'error' ? 'error' : 'info');
  } else {
    alert(msg);
  }
}

function _sendCheckoutMessage({ priceId, creditAmount, accessToken, supabaseUrl, anonKey, mode = 'subscription' }) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: 'pcCreateCheckout',
        priceId,
        creditAmount,
        credit_amount: creditAmount,
        credits: creditAmount,
        accessToken,
        supabaseUrl,
        anonKey,
        mode,
      },
      resolve,
    );
  });
}

function _handleCheckoutResponse(app, response) {
  if (!response?.success) {
    const errorMsg = response?.error || 'Failed to create checkout session';
    _notify(app, errorMsg, 'error');
  }
}

async function _dispatchCheckout(app, { priceId, creditAmount, accessToken, supabaseUrl, anonKey, mode = 'subscription' }) {
  const response = await _sendCheckoutMessage({ priceId, creditAmount, accessToken, supabaseUrl, anonKey, mode });
  _handleCheckoutResponse(app, response);
}

export async function createCheckout(app, priceId) {
  if (!app.currentUser) {
    _notify(app, 'Please sign in to subscribe', 'info');
    return;
  }

  try {
    const accessToken = await _getAccessToken();
    const { supabaseUrl, anonKey } = _readConfig();

    if (!supabaseUrl || !anonKey) {
      _notify(app, 'Configuration error. Please try again later.', 'error');
      return;
    }

    await _dispatchCheckout(app, { priceId, accessToken, supabaseUrl, anonKey, mode: 'subscription' });
  } catch (error) {
    console.error('Checkout error:', error);
    _notify(app, 'Something went wrong. Please try again.', 'error');
  }
}

export async function createCreditPackCheckout(app, priceId) {
  if (!app.currentUser) {
    _notify(app, 'Please sign in to buy text credits', 'info');
    return;
  }

  try {
    const accessToken = await _getAccessToken();
    const { supabaseUrl, anonKey } = _readConfig();

    if (!supabaseUrl || !anonKey) {
      _notify(app, 'Configuration error. Please try again later.', 'error');
      return;
    }

    await _dispatchCheckout(app, { priceId, accessToken, supabaseUrl, anonKey, mode: 'payment' });
  } catch (error) {
    console.error('Credit pack checkout error:', error);
    _notify(app, 'Something went wrong. Please try again.', 'error');
  }
}

export async function createCustomCreditCheckout(app, creditAmount) {
  if (!app.currentUser) {
    _notify(app, 'Please sign in to buy text credits', 'info');
    return;
  }

  const credits = Math.floor(Number(creditAmount));
  if (!Number.isFinite(credits) || credits < CHECKOUT_MIN_CREDITS || credits > CUSTOM_CREDIT_MAX) {
    _notify(app, `Enter ${CHECKOUT_MIN_CREDITS}–${CUSTOM_CREDIT_MAX.toLocaleString()} text credits`, 'info');
    return;
  }

  if (!meetsStripeMinimum(credits)) {
    _notify(app, `Minimum checkout is ${CHECKOUT_MIN_CREDITS} credits ($0.50) due to Stripe limits`, 'info');
    return;
  }

  try {
    const accessToken = await _getAccessToken();
    const { supabaseUrl, anonKey } = _readConfig();

    if (!supabaseUrl || !anonKey) {
      _notify(app, 'Configuration error. Please try again later.', 'error');
      return;
    }

    await _dispatchCheckout(app, { creditAmount: credits, accessToken, supabaseUrl, anonKey, mode: 'payment' });
  } catch (error) {
    console.error('Custom credit checkout error:', error);
    _notify(app, 'Something went wrong. Please try again.', 'error');
  }
}
