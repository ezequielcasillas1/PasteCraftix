/** @forward-slice Clipboard read helpers for PDF viewer capture (plugin selections). */

const MAX_TEXT = 30000;

function trimText(value, max = MAX_TEXT) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
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
