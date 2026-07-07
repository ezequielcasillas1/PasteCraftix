/** @forward-slice Page text selection helpers. */

export function getPageSelectionText() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return '';
    return selection.toString().trim();
  } catch (_) {
    return '';
  }
}

export async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) {
    return { ok: false, error: 'Nothing to copy.' };
  }

  try {
    await navigator.clipboard.writeText(value);
    return { ok: true };
  } catch (_) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'pcCopyText',
        text: value,
      });
      if (response?.success) return { ok: true };
      return { ok: false, error: response?.error || 'Clipboard unavailable.' };
    } catch (err) {
      return { ok: false, error: err?.message || 'Clipboard unavailable.' };
    }
  }
}
