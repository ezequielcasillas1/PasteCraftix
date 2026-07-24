/** @forward-slice Clipboard read helpers for PDF viewer capture (plugin selections). */

import {
  PDF_CLIPBOARD_MAX_TEXT,
  PDF_PERMISSION_DENIED_COOLDOWN_MS,
} from './pdf.constants.js';

let _permissionDeniedHandler = null;
let _lastDeniedAt = 0;

function trimText(value, max = PDF_CLIPBOARD_MAX_TEXT) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function notifyPermissionDenied(message) {
  const now = Date.now();
  if (now - _lastDeniedAt < PDF_PERMISSION_DENIED_COOLDOWN_MS) return;
  _lastDeniedAt = now;
  try {
    _permissionDeniedHandler?.(
      message || 'PasteCraft needs clipboard permission for PDF capture',
    );
  } catch (_) {}
}

/** Optional toast/callback when clipboard/offscreen grant is denied. */
export function setClipboardPermissionDeniedHandler(handler) {
  _permissionDeniedHandler = typeof handler === 'function' ? handler : null;
}

/**
 * Read plain text from the system clipboard.
 * Prefer page clipboard; fall back to offscreen document via background
 * when the PDF plugin steals focus ("Document is not focused").
 */
export async function readClipboardPlainText() {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return trimText(text);
    }
  } catch (_) {}

  try {
    const response = await chrome.runtime.sendMessage({ action: 'pcReadClipboard' });
    if (response?.success && response.text) {
      return trimText(response.text);
    }
    if (response?.error === 'permission_denied') {
      notifyPermissionDenied(response.message);
    }
  } catch (_) {}

  return '';
}

export function textFromClipboardEvent(event) {
  try {
    const cd = event?.clipboardData;
    if (!cd) return '';
    return trimText(cd.getData('text/plain') || '');
  } catch (_) {
    return '';
  }
}
