/** PasteCraft Merchant — content-layer constants. */

/** ~1cm top strip height (37.8px at 96dpi; rounded for crisp layout). */
export const MERCHANT_STRIP_HEIGHT_PX = 38;

/** html class set while Merchant strip reserves viewport top space. */
export const MERCHANT_LAYOUT_HTML_CLASS = 'pc-merchant-strip-active';

/** Default ephemeral TTL for listing dock staging (24h). */
export const MERCHANT_DOCK_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const MERCHANT_STORAGE_KEYS = Object.freeze({
  /** User/settings toggle for on-page strip (gating deferred to Phase 6). */
  STRIP_ENABLED: 'pc_merchant_strip_enabled_v1',
  /** Ephemeral listing dock — corruptible, never Scholar archive. */
  DOCK_STAGING: 'pc_merchant_dock_staging_v1',
  /** Merchant prefs (platform preset, tags-only UI, TTL overrides). */
  PREFS: 'pc_merchant_prefs_v1',
});

/** Etsy listing tag limits (Spot Phase A). */
export const ETSY_TAG_PROFILE = Object.freeze({
  MAX_TAGS: 13,
  MAX_CHARS: 20,
});

export const MERCHANT_DEFAULT_PREFS = Object.freeze({
  tagsOnlyMode: true,
  platformPreset: 'etsy',
});

/** Future Supabase merchant_listing_staging table shape (Phase 2 prep only). */
export const MERCHANT_SUPABASE_STAGING_SHAPE = Object.freeze({
  table: 'merchant_listing_staging',
  fields: ['user_id', 'title', 'description', 'tags', 'source', 'updated_at', 'expires_at'],
});

export const MERCHANT_PULSE_STATES = Object.freeze({
  EMPTY: 'empty',
  LIVE: 'live',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
});

export const MERCHANT_ACTIONS = Object.freeze({
  SPOT: 'merchant-spot',
  IMAGE_TO_TEXT: 'merchant-image-to-text',
  DOCK_TOGGLE: 'merchant-dock-toggle',
  DOCK_SAVE: 'merchant-dock-save',
  DOCK_CLIPBOARD: 'merchant-dock-clipboard',
  DOCK_CLEAR: 'merchant-dock-clear',
  DOCK_CLOSE: 'merchant-dock-close',
  DOCK_ADVANCED_TOGGLE: 'merchant-dock-advanced-toggle',
  SEAL_SHIP: 'merchant-seal-ship',
});

export const MERCHANT_BRAND = Object.freeze({
  LABEL: 'Merchant',
  SPOT_LABEL: 'Spot',
  IMAGE_TO_TEXT_LABEL: 'Image → Text',
  DOCK_LABEL: 'Listing Dock',
});
