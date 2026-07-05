/** PasteCraft Merchant — content-layer constants. */

/** Main toolbar row height. */
export const MERCHANT_STRIP_MAIN_HEIGHT_PX = 38;

/** Dock-target selector row below Spot / Image → Text. */
export const MERCHANT_STRIP_DOCK_TARGET_HEIGHT_PX = 34;

/** Total fixed strip height (main + dock-target row). */
export const MERCHANT_STRIP_HEIGHT_PX = MERCHANT_STRIP_MAIN_HEIGHT_PX + MERCHANT_STRIP_DOCK_TARGET_HEIGHT_PX;

/** html class set while Merchant strip reserves viewport top space. */
export const MERCHANT_LAYOUT_HTML_CLASS = 'pc-merchant-strip-active';

/** Default ephemeral TTL for listing dock staging (24h). */
export const MERCHANT_DOCK_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const MERCHANT_STORAGE_KEYS = Object.freeze({
  /** On-page strip visibility — persisted in chrome.storage.local; see merchant.strip-preference.js */
  STRIP_ENABLED: 'pc_merchant_strip_enabled_v1',
  /** Ephemeral listing dock — corruptible, never Scholar archive. */
  DOCK_STAGING: 'pc_merchant_dock_staging_v1',
  /** Merchant prefs (platform preset, tags-only UI, TTL overrides). */
  PREFS: 'pc_merchant_prefs_v1',
  /** QA override: force_on | force_off — see merchant.gating.js */
  GATE_OVERRIDE: 'pc_merchant_gate_override_v1',
});

/** Phase 6 subscription gating — ENFORCE stays false until Stripe Merchant tier ships. */
export const MERCHANT_GATING = Object.freeze({
  ENFORCE_SUBSCRIPTION: false,
  TEST_LAB_BYPASS: true,
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
  /** Spot / Image → Text staging destination (dock field key). */
  captureDockTarget: 'tags',
});

/** Canonical dock field keys for Spot / Image → Text routing. */
export const MERCHANT_DOCK_TARGET_IDS = Object.freeze([
  'materials',
  'title',
  'description',
  'tags',
  'keywords',
  'bullets',
  'hashtags',
]);

/** UI labels — Title/Description map to variant queues in Listing Dock. */
export const MERCHANT_DOCK_TARGETS = Object.freeze([
  Object.freeze({ id: 'materials', label: 'Materials' }),
  Object.freeze({ id: 'title', label: 'Title' }),
  Object.freeze({ id: 'description', label: 'Description' }),
  Object.freeze({ id: 'tags', label: 'Tags' }),
  Object.freeze({ id: 'keywords', label: 'Keywords' }),
  Object.freeze({ id: 'bullets', label: 'Bullets' }),
  Object.freeze({ id: 'hashtags', label: 'Hashtags' }),
]);

/** Future Supabase merchant_listing_staging table shape (Phase 2 prep only). */
export const MERCHANT_SUPABASE_STAGING_SHAPE = Object.freeze({
  table: 'merchant_listing_staging',
  fields: ['user_id', 'title', 'description', 'tags', 'materials', 'keywords', 'bullets', 'hashtags', 'source', 'updated_at', 'expires_at'],
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
  MATERIAL_QUEUE_TOGGLE: 'merchant-material-queue-toggle',
  TITLE_QUEUE_TOGGLE: 'merchant-title-queue-toggle',
  DESCRIPTION_QUEUE_TOGGLE: 'merchant-description-queue-toggle',
  KEYWORD_QUEUE_TOGGLE: 'merchant-keyword-queue-toggle',
  BULLET_QUEUE_TOGGLE: 'merchant-bullet-queue-toggle',
  HASHTAG_QUEUE_TOGGLE: 'merchant-hashtag-queue-toggle',
  SNIPPETS_TOGGLE: 'merchant-snippets-toggle',
  SNIPPET_INSERT: 'merchant-snippet-insert',
  SNIPPET_DELETE: 'merchant-snippet-delete',
  SNIPPET_SAVE: 'merchant-snippet-save',
  DOCK_TOGGLE: 'merchant-dock-toggle',
  DOCK_SAVE: 'merchant-dock-save',
  DOCK_CLIPBOARD: 'merchant-dock-clipboard',
  DOCK_COPY_TAGS: 'merchant-dock-copy-tags',
  DOCK_COPY_MATERIALS: 'merchant-dock-copy-materials',
  DOCK_CLEAR: 'merchant-dock-clear',
  DOCK_CLOSE: 'merchant-dock-close',
  DOCK_ADVANCED_TOGGLE: 'merchant-dock-advanced-toggle',
  DOCK_TAG_OPTIONS_TOGGLE: 'merchant-dock-tag-options-toggle',
  DOCK_TAG_LIMIT_APPLY: 'merchant-dock-tag-limit-apply',
  DOCK_TAG_LIMIT_CUSTOM_SELECT: 'merchant-dock-tag-limit-custom-select',
  DOCK_TAG_REMOVE: 'merchant-dock-tag-remove',
  DOCK_CHIP_REMOVE: 'merchant-dock-chip-remove',
  DOCK_TARGET_SELECT: 'merchant-dock-target-select',
  VISIBILITY_TOGGLE: 'merchant-visibility-toggle',
  ONE_SHOT_PASTE: 'merchant-one-shot-paste',
});

export const MERCHANT_BRAND = Object.freeze({
  LABEL: 'Merchant',
  SPOT_LABEL: 'Spot',
  IMAGE_TO_TEXT_LABEL: 'Image → Text',
  TAG_QUEUE_LABEL: 'Tag Queue',
  MATERIAL_QUEUE_LABEL: 'Material Queue',
  TITLE_QUEUE_LABEL: 'Title Queue',
  DESCRIPTION_QUEUE_LABEL: 'Desc Queue',
  KEYWORD_QUEUE_LABEL: 'Keyword Queue',
  BULLET_QUEUE_LABEL: 'Bullet Queue',
  HASHTAG_QUEUE_LABEL: 'Hashtag Queue',
  SNIPPETS_LABEL: 'Snippets',
  DOCK_LABEL: 'Listing Dock',
  ONE_SHOT_LABEL: 'Fill All',
});

/** Queue list item caps for dock normalization (Phase 2). */
export const MERCHANT_QUEUE_LIMITS = Object.freeze({
  TITLE: Object.freeze({ maxItems: 20, maxChars: 500 }),
  DESCRIPTION: Object.freeze({ maxItems: 10, maxChars: 5000 }),
  KEYWORD: Object.freeze({ maxItems: 30, maxChars: 50 }),
  BULLET: Object.freeze({ maxItems: 5, maxChars: 500 }),
  HASHTAG: Object.freeze({ maxItems: 15, maxChars: 100 }),
});
