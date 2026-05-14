import { getUpgradeModal } from './billing.selectors.js';

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

function _sendCheckoutMessage(priceId, accessToken, supabaseUrl, anonKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'pcCreateCheckout', priceId, accessToken, supabaseUrl, anonKey },
      resolve,
    );
  });
}

function _handleCheckoutResponse(response) {
  if (!response?.success) {
    const errorMsg = response?.error || 'Failed to create checkout session';
    alert(`Error: ${errorMsg}`);
  }
}

async function _dispatchCheckout(priceId, accessToken, supabaseUrl, anonKey) {
  const response = await _sendCheckoutMessage(priceId, accessToken, supabaseUrl, anonKey);
  _handleCheckoutResponse(response);
}

export async function createCheckout(app, priceId) {
  if (!app.currentUser) {
    alert('Please sign in to subscribe');
    return;
  }

  try {
    const session = await pasteCraftSupabase.getSession();
    const accessToken = session?.access_token || '';
    const { supabaseUrl, anonKey } = _readConfig();

    if (!supabaseUrl || !anonKey) {
      alert('Configuration error. Please try again later.');
      return;
    }

    await _dispatchCheckout(priceId, accessToken, supabaseUrl, anonKey);
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Something went wrong. Please try again.');
  }
}
