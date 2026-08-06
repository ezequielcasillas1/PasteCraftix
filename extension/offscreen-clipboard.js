/** Offscreen clipboard I/O — classic script (no imports) so boot cannot fail on modules. */
/** @forward-slice PDF capture read + popup image write (see capture.handler.js). */

const CH = Object.freeze({
  WRITE_REQ: 'write-image',
  WRITE_RES: 'write-image-result',
  PING_REQ: 'ping',
  PING_RES: 'pong',
});

const BC_NAME = 'pastecraft-offscreen-clipboard';

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

async function ensurePngBlob(blob) {
  if (!blob) throw new Error('empty_blob');
  if (blob.type === 'image/png') return blob;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return blob;
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap.close?.();
  }
}

async function writePngViaClipboardApi(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('clipboard_image_unsupported');
  }
  const png = await ensurePngBlob(blob);
  const mime = png.type || 'image/png';
  await navigator.clipboard.write([
    new ClipboardItem({ [mime]: Promise.resolve(png) }),
  ]);
}

async function writePngViaExecCommand(blob) {
  const png = await ensurePngBlob(blob);
  const url = URL.createObjectURL(png);
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
  let apiErr = null;
  try {
    await writePngViaClipboardApi(blob);
    return;
  } catch (err) {
    apiErr = err;
  }
  try {
    await writePngViaExecCommand(blob);
  } catch (execErr) {
    const apiMsg = String(apiErr?.message || apiErr || 'clipboard_api_failed');
    const execMsg = String(execErr?.message || execErr || 'execCommand_copy_failed');
    throw new Error(`${apiMsg}|${execMsg}`);
  }
}

/** Inline data URLs only — chrome.storage is undefined in this offscreen context. */
async function resolveWriteDataUrl(message) {
  const inline = String(message?.dataUrl || '');
  if (inline.startsWith('data:image/')) return inline;
  throw new Error('invalid_image_data_url');
}

async function handleWriteRequest(message) {
  const dataUrl = await resolveWriteDataUrl(message);
  await writeClipboardImage(dataUrl);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.action !== 'string') return false;

  if (message.action === 'pcOffscreenClipboardPing') {
    sendResponse({ success: true, pong: true });
    return false;
  }

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
        await handleWriteRequest(message);
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

try {
  const bc = new BroadcastChannel(BC_NAME);
  bc.onmessage = async (ev) => {
    const msg = ev?.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === CH.PING_REQ) {
      bc.postMessage({ type: CH.PING_RES, id: msg.id, success: true });
      return;
    }

    if (msg.type !== CH.WRITE_REQ) return;
    try {
      await handleWriteRequest(msg);
      bc.postMessage({ type: CH.WRITE_RES, id: msg.id, success: true });
    } catch (err) {
      bc.postMessage({
        type: CH.WRITE_RES,
        id: msg.id,
        success: false,
        error: String(err?.message || err || 'write_image_failed'),
      });
    }
  };
} catch (_) {}
