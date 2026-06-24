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

export const MERCHANT_PLATFORM_PRESETS = Object.freeze({
  etsy: Object.freeze({ id: 'etsy', label: 'Etsy', maxTags: 13, maxChars: 20 }),
  /** Shopify product tags — no hard API cap; 250 is the documented practical per-product limit. */
  shopify: Object.freeze({ id: 'shopify', label: 'Shopify', maxTags: 250, maxChars: 255 }),
  printify: Object.freeze({ id: 'printify', label: 'Printify', maxTags: 20, maxChars: 40 }),
  /** Amazon backend search terms — ~249 bytes total; 50 chars per keyword is a practical per-term cap. */
  amazon: Object.freeze({ id: 'amazon', label: 'Amazon', maxTags: 30, maxChars: 50 }),
  /** eBay item specifics — typical category cap ~45 pairs; value length up to 65 chars. */
  ebay: Object.freeze({ id: 'ebay', label: 'eBay', maxTags: 12, maxChars: 65 }),
  /** Redbubble Help Center — 15 tags, 39 characters each. */
  redbubble: Object.freeze({ id: 'redbubble', label: 'Redbubble', maxTags: 15, maxChars: 39 }),
  /** TeePublic seller docs — up to 32 tags per design. */
  teepublic: Object.freeze({ id: 'teepublic', label: 'TeePublic', maxTags: 32, maxChars: 255 }),
  /** WooCommerce product tags — no hard WP cap; 250 matches Shopify practical guidance. */
  woocommerce: Object.freeze({ id: 'woocommerce', label: 'WooCommerce', maxTags: 250, maxChars: 255 }),
  generic: Object.freeze({ id: 'generic', label: 'Generic', maxTags: 30, maxChars: 50 }),
  custom: Object.freeze({ id: 'custom', label: 'Custom', maxTags: 30, maxChars: 50 }),
});

/** Presets shown in Listing Dock tag-limit Options popover (scroll list + custom row). */
export const MERCHANT_TAG_LIMIT_PRESET_IDS = Object.freeze([
  'etsy',
  'shopify',
  'printify',
  'amazon',
  'ebay',
  'redbubble',
  'teepublic',
  'woocommerce',
  'custom',
]);

export const MERCHANT_CUSTOM_TAG_LIMIT = Object.freeze({
  MIN: 1,
  MAX: 500,
  DEFAULT: 30,
});

export const MERCHANT_DEFAULT_SNIPPETS = Object.freeze([
  Object.freeze({
    id: 'personalization',
    label: 'Personalization prompt',
    text: 'Please leave your personalization details in the order notes at checkout.',
  }),
  Object.freeze({
    id: 'care',
    label: 'Care instructions',
    text: 'Hand wash cold. Lay flat to dry. Do not bleach.',
  }),
  Object.freeze({
    id: 'shipping',
    label: 'Shipping note',
    text: 'Ships within 1–3 business days via USPS.',
  }),
  Object.freeze({
    id: 'compliance',
    label: 'Color disclaimer',
    text: 'Colors may vary slightly due to monitor settings.',
  }),
]);

export const MERCHANT_DEFAULT_PREFS = Object.freeze({
  tagsOnlyMode: true,
  platformPreset: 'etsy',
  customMaxTags: MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT,
  queueAutoAdvance: true,
  snippetLibrary: [...MERCHANT_DEFAULT_SNIPPETS],
});

/** Future Supabase merchant_listing_staging table shape (Phase 2 prep only). */
export const MERCHANT_SUPABASE_STAGING_SHAPE = Object.freeze({
  table: 'merchant_listing_staging',
  fields: ['user_id', 'title', 'description', 'tags', 'materials', 'source', 'updated_at', 'expires_at'],
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
  TAG_QUEUE_TOGGLE: 'merchant-tag-queue-toggle',
  SNIPPETS_TOGGLE: 'merchant-snippets-toggle',
  SNIPPET_INSERT: 'merchant-snippet-insert',
  DOCK_TOGGLE: 'merchant-dock-toggle',
  DOCK_SAVE: 'merchant-dock-save',
  DOCK_CLIPBOARD: 'merchant-dock-clipboard',
  DOCK_COPY_TAGS: 'merchant-dock-copy-tags',
  DOCK_NEXT_TAG: 'merchant-dock-next-tag',
  DOCK_COPY_MATERIALS: 'merchant-dock-copy-materials',
  DOCK_CLEAR: 'merchant-dock-clear',
  DOCK_CLOSE: 'merchant-dock-close',
  DOCK_ADVANCED_TOGGLE: 'merchant-dock-advanced-toggle',
  DOCK_TAG_OPTIONS_TOGGLE: 'merchant-dock-tag-options-toggle',
  DOCK_TAG_LIMIT_APPLY: 'merchant-dock-tag-limit-apply',
  DOCK_TAG_LIMIT_CUSTOM_SELECT: 'merchant-dock-tag-limit-custom-select',
  SEAL_SHIP: 'merchant-seal-ship',
  SEAL_CONFIRM: 'merchant-seal-confirm',
  SEAL_CANCEL: 'merchant-seal-cancel',
});

export const MERCHANT_BRAND = Object.freeze({
  LABEL: 'Merchant',
  SPOT_LABEL: 'Spot',
  IMAGE_TO_TEXT_LABEL: 'Image → Text',
  TAG_QUEUE_LABEL: 'Tag Queue',
  SNIPPETS_LABEL: 'Snippets',
  SEAL_SHIP_LABEL: 'Seal & Ship',
  DOCK_LABEL: 'Listing Dock',
});
