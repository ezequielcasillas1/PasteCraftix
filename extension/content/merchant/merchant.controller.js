import { MERCHANT_STORAGE_KEYS } from './merchant.constants.js';
import { MerchantTopStrip } from './merchant.top-strip.js';

async function isStripEnabled() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.STRIP_ENABLED]);
    if (stored[MERCHANT_STORAGE_KEYS.STRIP_ENABLED] === undefined) {
      return true;
    }
    return stored[MERCHANT_STORAGE_KEYS.STRIP_ENABLED] !== false;
  } catch (_) {
    return true;
  }
}

/**
 * Initialize Merchant content layer (Phase 1 — top strip foundation only).
 * Billing/gating deferred; strip defaults to enabled for user testing.
 */
export async function initMerchantLayer() {
  if (window.__pasteCraftMerchant?.isMounted?.()) {
    return window.__pasteCraftMerchant;
  }

  const enabled = await isStripEnabled();
  if (!enabled) return null;

  const strip = new MerchantTopStrip();
  strip.mount();
  window.__pasteCraftMerchant = strip;
  return strip;
}

export async function setMerchantStripEnabled(enabled) {
  await chrome.storage.local.set({
    [MERCHANT_STORAGE_KEYS.STRIP_ENABLED]: !!enabled,
  });
  if (!enabled && window.__pasteCraftMerchant) {
    window.__pasteCraftMerchant.unmount();
    window.__pasteCraftMerchant = null;
    return;
  }
  if (enabled && !window.__pasteCraftMerchant) {
    await initMerchantLayer();
  }
}
