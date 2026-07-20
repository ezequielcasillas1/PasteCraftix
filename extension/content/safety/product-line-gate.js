/**
 * Scholar vs Merchant content gate — entry-point only, no slice cross-imports.
 * Scholar is the default in developer mode; Merchant strip is explicit opt-in.
 */

export const PRODUCT_LINE_STORAGE_KEYS = Object.freeze({
  MERCHANT_STRIP_ENABLED: 'pc_merchant_strip_enabled_v1',
});

export async function readMerchantLayerEnabled() {
  try {
    const stored = await chrome.storage.local.get([PRODUCT_LINE_STORAGE_KEYS.MERCHANT_STRIP_ENABLED]);
    return stored[PRODUCT_LINE_STORAGE_KEYS.MERCHANT_STRIP_ENABLED] === true;
  } catch (_) {
    return false;
  }
}

export async function shouldInitMerchantLayer() {
  return readMerchantLayerEnabled();
}
