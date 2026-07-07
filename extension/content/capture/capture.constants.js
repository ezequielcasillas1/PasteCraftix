/** @forward-slice Shared capture infra — used by Scholar widget + Merchant strip. */

export const CAPTURE_MAX_REGION_PX = 4096;
export const CAPTURE_MAX_TEXT = 50000;
export const CAPTURE_OCR_PHASE = 1;

export const CAPTURE_STORAGE_KEYS = Object.freeze({
  SPOT_PRESETS: 'pc_spot_presets_v1',
  SPOT_MATCHER_PREFS: 'pc_spot_matcher_prefs_v1',
});

export const CAPTURE_MESSAGE_ACTIONS = Object.freeze({
  CAPTURE_REGION: 'pcCaptureRegion',
  COPY_TEXT: 'pcCopyText',
  SAVE_CLIP: 'saveClip',
});

export const DEFAULT_SPOT_PRESETS = Object.freeze([
  {
    id: 'tags',
    label: 'Tags',
    items: ['study', 'research', 'notes', 'reference'],
  },
  {
    id: 'address',
    label: 'Address',
    items: [],
  },
]);
