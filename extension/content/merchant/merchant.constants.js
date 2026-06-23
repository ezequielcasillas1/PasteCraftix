/** PasteCraft Merchant — content-layer constants (Phase 1 foundation). */

/** ~1cm top strip height (37.8px at 96dpi; rounded for crisp layout). */
export const MERCHANT_STRIP_HEIGHT_PX = 38;

export const MERCHANT_STORAGE_KEYS = Object.freeze({
  /** User/settings toggle for on-page strip (gating deferred to Phase 3+). */
  STRIP_ENABLED: 'pc_merchant_strip_enabled_v1',
});

export const MERCHANT_ACTIONS = Object.freeze({
  SPOT: 'merchant-spot',
  IMAGE_TO_TEXT: 'merchant-image-to-text',
});

export const MERCHANT_BRAND = Object.freeze({
  LABEL: 'Merchant',
  SPOT_LABEL: 'Spot',
  IMAGE_TO_TEXT_LABEL: 'Image → Text',
});
