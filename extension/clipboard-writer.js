/** Focused writer window — real image/png clipboard write via ClipboardItem.
 * Action popups are Permissions-Policy blocked (crbug.com/414348233); offscreen
 * documents fail "Document is not focused". This window is focused and is a full
 * extension page, so neither restriction applies.
 * Classic script (no imports) so boot cannot fail on module resolution.
 */

const WB = Object.freeze({
  JOB: 'pc_clipboard_writer_job',
  RESULT: 'pc_clipboard_writer_result',
});

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

async function readWriterJob() {
  try {
    const stored = await chrome.storage.local.get([WB.JOB]);
    return stored?.[WB.JOB] || null;
  } catch (_) {
    return null;
  }
}

/** Wait for real OS focus — poll hasFocus() and resolve early on 'focus' event. */
function waitForWindowFocus(maxMs = 2000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { window.removeEventListener('focus', onFocus); } catch (_) {}
      clearInterval(timer);
      let focused = false;
      try { focused = document.hasFocus(); } catch (_) {}
      resolve({ waitedMs: Date.now() - t0, focused });
    };
    const onFocus = () => finish();
    try { window.addEventListener('focus', onFocus); } catch (_) {}
    const timer = setInterval(() => {
      let focused = false;
      try { focused = document.hasFocus(); } catch (_) {}
      if (focused || Date.now() - t0 >= maxMs) finish();
    }, 50);
  });
}

async function runClipboardWriter() {
  const job = await readWriterJob();
  const id = String(job?.id || '');
  const storageKey = String(job?.storageKey || '');

  const finish = async (result) => {
    try {
      await chrome.storage.local.set({
        [WB.RESULT]: { id, success: !!result.success, error: String(result.error || ''), ts: Date.now() },
      });
    } catch (_) {}
    try { window.close(); } catch (_) {}
  };

  if (!id || !storageKey.startsWith('pc_clipboard_img_')) {
    await finish({ success: false, error: 'invalid_writer_job' });
    return;
  }

  let dataUrl = '';
  try {
    const stored = await chrome.storage.local.get([storageKey]);
    dataUrl = String(stored?.[storageKey] || '');
  } catch (_) {}
  if (!dataUrl.startsWith('data:image/')) {
    await finish({ success: false, error: 'invalid_image_data_url' });
    return;
  }

  await waitForWindowFocus(2000);
  try {
    const blob = dataUrlToBlob(dataUrl);
    await writePngViaClipboardApi(blob);
    await finish({ success: true });
  } catch (err) {
    const name = String(err?.name || '');
    const msg = String(err?.message || err || 'write_image_failed');
    await finish({ success: false, error: name ? `${name}: ${msg}` : msg });
  }
}

runClipboardWriter();

// Safety self-close if the write path hangs.
setTimeout(() => {
  try { window.close(); } catch (_) {}
}, 8000);
