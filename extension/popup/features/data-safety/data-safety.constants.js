/** @forward-slice Freemium / local-only data durability guards. */

export const DATA_SAFETY_STORAGE_KEYS = Object.freeze({
  META_LOCAL: 'pc_data_safety_meta_v1',
  META_SYNC: 'pc_data_safety_hint_v1',
  CANARY: 'pc_storage_canary_v1',
  UNHEALTHY: 'pc_storage_unhealthy_v1',
});

export const DATA_SAFETY_ELEMENT_IDS = Object.freeze({
  BANNER: 'dataSafetyBanner',
  BANNER_TEXT: 'dataSafetyBannerText',
  EXPORT_BTN: 'dataSafetyExportBtn',
  ACCOUNT_BTN: 'dataSafetyAccountBtn',
  DISMISS_BTN: 'dataSafetyDismissBtn',
});

export const DATA_SAFETY_LIMITS = Object.freeze({
  /** Min prior clip count that triggers empty-state recovery. */
  MIN_PRIOR_CLIPS_FOR_RECOVERY: 1,
  /** Sync hint is tiny — counts + flags only. */
  SYNC_HINT_MAX_BYTES: 512,
});
