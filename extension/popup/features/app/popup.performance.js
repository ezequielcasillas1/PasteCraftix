export const POPUP_PERFORMANCE_NAMES = Object.freeze({
  BOOT_START: 'pastecraft:popup:boot-start',
  CONTENT_READY: 'pastecraft:popup:content-ready',
  BOOT_TO_CONTENT: 'pastecraft:popup:boot-to-content',
  TAB_START: 'pastecraft:tab:cached-activation-start',
  TAB_END: 'pastecraft:tab:cached-activation-end',
  TAB_CACHED_RENDER: 'pastecraft:tab:click-to-cached-render',
});

function getPerformanceApi() {
  const api = globalThis.performance;
  if (typeof api?.mark !== 'function' || typeof api?.measure !== 'function') return null;
  if (typeof api.clearMarks !== 'function' || typeof api.clearMeasures !== 'function') return null;
  return api;
}

function clearMarks(api, names) {
  if (typeof api.clearMarks !== 'function') return;
  names.forEach((name) => {
    try { api.clearMarks(name); } catch (_) {}
  });
}

function clearMeasures(api, names) {
  if (typeof api.clearMeasures !== 'function') return;
  names.forEach((name) => {
    try { api.clearMeasures(name); } catch (_) {}
  });
}

function mark(api, name) {
  try { api.mark(name); } catch (_) {}
}

function measure(api, name, start, end) {
  try { api.measure(name, start, end); } catch (_) {}
}

function beginMeasurement(startName, endName, measureName) {
  const api = getPerformanceApi();
  if (!api) return;
  clearMarks(api, [startName, endName]);
  clearMeasures(api, [measureName]);
  mark(api, startName);
}

function completeMeasurement(startName, endName, measureName) {
  const api = getPerformanceApi();
  if (!api) return;
  clearMarks(api, [endName]);
  clearMeasures(api, [measureName]);
  mark(api, endName);
  measure(api, measureName, startName, endName);
}

export function markPopupBootStart() {
  beginMeasurement(
    POPUP_PERFORMANCE_NAMES.BOOT_START,
    POPUP_PERFORMANCE_NAMES.CONTENT_READY,
    POPUP_PERFORMANCE_NAMES.BOOT_TO_CONTENT,
  );
}

export function markPopupContentReady() {
  completeMeasurement(
    POPUP_PERFORMANCE_NAMES.BOOT_START,
    POPUP_PERFORMANCE_NAMES.CONTENT_READY,
    POPUP_PERFORMANCE_NAMES.BOOT_TO_CONTENT,
  );
}

export function markTabCachedActivationStart() {
  beginMeasurement(
    POPUP_PERFORMANCE_NAMES.TAB_START,
    POPUP_PERFORMANCE_NAMES.TAB_END,
    POPUP_PERFORMANCE_NAMES.TAB_CACHED_RENDER,
  );
}

export function markTabCachedActivationEnd() {
  completeMeasurement(
    POPUP_PERFORMANCE_NAMES.TAB_START,
    POPUP_PERFORMANCE_NAMES.TAB_END,
    POPUP_PERFORMANCE_NAMES.TAB_CACHED_RENDER,
  );
}
