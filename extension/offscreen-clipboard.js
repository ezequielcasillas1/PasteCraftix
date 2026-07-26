/** Offscreen clipboard I/O — service workers lack reliable Clipboard DOM APIs. */
/** @forward-slice PDF capture read + popup image write (see capture.handler.js). */

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = Math.min(i + chunk, binary.length);
    for (let j = i; j < end; j++) bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
}

/** Decode data:image URL without fetch() (extension CSP blocks connect-src data:). */
function dataUrlToBlob(dataUrl) {
  const u = String(dataUrl || '');
  const comma = u.indexOf(',');
  if (comma < 0) throw new Error('invalid_data_url');
  const header = u.slice(0, comma);
  const payload = u.slice(comma + 1);
  const mimeMatch = header.match(/^data:([^;,]+)/i);
  const mime = (mimeMatch && mimeMatch[1]) || 'image/png';
  if (/;base64/i.test(header)) {
    return new Blob([base64ToUint8Array(payload)], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

async function writePngViaClipboardApi(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('clipboard_image_unsupported');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

async function writePngViaExecCommand(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_decode_failed'));
      el.src = url;
    });
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
    holder.appendChild(img);
    document.body.appendChild(holder);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(holder);
    selection.removeAllRanges();
    selection.addRange(range);

    const ok = document.execCommand('copy');
    selection.removeAllRanges();
    holder.remove();
    if (!ok) throw new Error('execCommand_copy_failed');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function writeClipboardImage(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  try {
    await writePngViaClipboardApi(blob);
  } catch (_) {
    await writePngViaExecCommand(blob);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.action !== 'string') return false;

  if (message.action === 'pcOffscreenReadClipboard') {
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
  }

  if (message.action === 'pcOffscreenWriteClipboardImage') {
    (async () => {
      try {
        const dataUrl = String(message.dataUrl || '');
        if (!dataUrl.startsWith('data:image/')) {
          sendResponse({ success: false, error: 'invalid_image_data_url' });
          return;
        }
        await writeClipboardImage(dataUrl);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({
          success: false,
          error: String(err?.message || err || 'write_image_failed'),
        });
      }
    })();
    return true;
  }

  return false;
});
