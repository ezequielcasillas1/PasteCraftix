/** @forward-slice Shared capture infra — Scholar widget + Merchant strip. */

export const CAPTURE_MAX_REGION_PX = 4096;
export const CAPTURE_MAX_TEXT = 50000;
export const CAPTURE_OCR_PHASE = 1;

export const CAPTURE_STORAGE_KEYS = Object.freeze({
  SPOT_PRESETS: 'pc_spot_presets_v1',
  SPOT_MATCHER_PREFS: 'pc_spot_matcher_prefs_v1',
  TOOLS_COUNT: 'pc_capture_tools_count_v1',
  TOOLS_DATE: 'pc_capture_tools_date_v1',
  TOOLS_SPOT_COUNT: 'pc_capture_tools_spot_v1',
  TOOLS_IMAGE_COUNT: 'pc_capture_tools_image_v1',
});

export const CAPTURE_COLORS = Object.freeze({
  SPOT: '#4ade80',
  IMAGE: '#fbbf24',
});

/** Above Merchant strip (2147483646) so Scholar region snip + preview stay interactive. */
export const CAPTURE_LAYER_Z = Object.freeze({
  PREVIEW: 2147483647,
  REGION_OVERLAY: 2147483647,
});

/** Valid mount target — body only (documentElement siblings are dropped by some SPAs). */
export function getCaptureMountRoot() {
  return document.body || document.documentElement;
}

export function mountCaptureLayer(el, zIndex = CAPTURE_LAYER_Z.PREVIEW) {
  const root = getCaptureMountRoot();
  if (!el || !root) return root;
  root.appendChild(el);
  el.style.setProperty('position', 'fixed', 'important');
  el.style.setProperty('z-index', String(zIndex), 'important');
  el.style.setProperty('pointer-events', 'auto', 'important');
  return root;
}

export function awaitCapturePaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export const DEFAULT_SPOT_PRESETS = Object.freeze([
  { id: 'tags', label: 'Tags', items: ['study', 'research', 'notes', 'reference'] },
  { id: 'address', label: 'Address', items: [] },
]);
