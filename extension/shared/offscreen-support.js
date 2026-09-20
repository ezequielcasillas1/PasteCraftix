/**
 * Chromium Offscreen Documents are not available in Firefox.
 * Callers must use the focused clipboard-writer window instead.
 */

export function hasOffscreenDocuments(api = globalThis.chrome) {
  return typeof api?.offscreen?.createDocument === 'function';
}
