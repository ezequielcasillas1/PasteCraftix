/** Offscreen clipboard reader — service workers cannot call navigator.clipboard.readText. */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.action !== 'pcOffscreenReadClipboard') return false;

  (async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = String(text || '').trim();
      sendResponse({ success: !!trimmed, text: trimmed });
    } catch (err) {
      sendResponse({ success: false, error: String(err?.message || err || 'read_failed') });
    }
  })();

  return true;
});
