import { CAPTURE_STORAGE_KEYS } from '../../../content/capture/capture.constants.js';

export { CAPTURE_STORAGE_KEYS as SPOT_STORAGE_KEYS };

export const SPOT_DEFAULT_MATCHER_PREFS = Object.freeze({
  visibleMatch: true,
  focusMatch: false,
  manualScanGate: false,
  strictAutocomplete: false,
});

export const SPOT_ACTIONS = Object.freeze({
  ADD_CATEGORY: 'spot-add-category',
  ADD_ITEM: 'spot-add-item',
  DELETE_ITEM: 'spot-delete-item',
});
