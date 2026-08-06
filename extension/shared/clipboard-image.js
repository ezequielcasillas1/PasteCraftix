/**
 * Copy image-bearing clips to the system clipboard as image/png.
 * Data URLs must not use fetch() — extension CSP blocks connect-src data:.
 * Popup documents block navigator.clipboard.write for images (Permissions Policy);
 * those contexts fall back to background → offscreen ClipboardItem write.
 */

import { isImageBearingClip, resolveClipImageSrc } from './clip-images.js';

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

/** Decode a data:image URL to a Blob without fetch(). */
export function dataUrlToBlob(dataUrl) {
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

function isHttpImageUrl(src) {
  return typeof src === 'string' && /^https?:\/\//i.test(src.trim());
}

function isImageBlob(blob) {
  return !!(blob && String(blob.type || '').startsWith('image/'));
}

/** Extension popup pages apply a Permissions-Policy that blocks clipboard.write for images. */
function isExtensionPopupDocument() {
  try {
    const path = String(globalThis?.location?.pathname || '');
    return /(^|\/)popup\.html$/i.test(path);
  } catch (_) {
    return false;
  }
}

function isClipboardPermissionsPolicyError(err) {
  const msg = String(err?.message || err || '');
  return (
    err?.name === 'NotAllowedError' ||
    /permissions policy|clipboard api has been blocked|notallowederror/i.test(msg)
  );
}

function canFallbackClipboardWrite(err) {
  return !!(chrome?.runtime?.id && isClipboardPermissionsPolicyError(err));
}

async function blobToDataUrl(blob) {
  if (typeof FileReader === 'undefined') {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('blob_to_data_url_failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchHttpBlobDirect(src) {
  const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`image_fetch_${res.status}`);
  const blob = await res.blob();
  if (!isImageBlob(blob)) throw new Error('not_image_response');
  return blob;
}

async function fetchHttpBlobViaBackground(src) {
  if (!chrome?.runtime?.id) throw new Error('no_runtime');
  const resp = await chrome.runtime.sendMessage({
    action: 'pcFetchImageAsDataUrl',
    url: src,
  });
  if (!resp?.success || typeof resp.dataUrl !== 'string') {
    throw new Error(resp?.error || 'background_image_fetch_failed');
  }
  return dataUrlToBlob(resp.dataUrl);
}

async function fetchUrlAsBlob(url) {
  const src = String(url || '').trim();
  if (!isHttpImageUrl(src)) throw new Error('unsupported_image_src');
  try {
    return await fetchHttpBlobDirect(src);
  } catch (directErr) {
    try {
      return await fetchHttpBlobViaBackground(src);
    } catch (_) {
      throw directErr;
    }
  }
}

async function blobFromHtmlImage(img) {
  if (!img || !img.naturalWidth) throw new Error('image_element_empty');
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas_to_blob_failed'))),
      'image/png',
    );
  });
}

async function pngViaOffscreenCanvas(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap.close?.();
  }
}

async function pngViaHtmlCanvas(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_decode_failed'));
      el.src = url;
    });
    return blobFromHtmlImage(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function ensurePngBlob(blob) {
  if (!blob) throw new Error('empty_blob');
  if (blob.type === 'image/png') return blob;
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
    return pngViaOffscreenCanvas(blob);
  }
  if (typeof document === 'undefined') throw new Error('png_convert_unavailable');
  return pngViaHtmlCanvas(blob);
}

async function writeImageBlobDirect(png) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('clipboard_image_unsupported');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/**
 * execCommand image copy inside the current document.
 * Works in popup pages where Permissions Policy blocks clipboard.write(image).
 */
async function writeImageBlobViaExecCommand(png) {
  if (typeof document === 'undefined' || !document.body || !document.execCommand) {
    throw new Error('execCommand_unavailable');
  }
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
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
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

async function stageClipboardDataUrl(dataUrl) {
  const storageKey = `pc_clipboard_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.local.set({ [storageKey]: dataUrl });
  return storageKey;
}

async function clearStagedDataUrl(storageKey) {
  if (!storageKey) return;
  try {
    await chrome.storage.local.remove(storageKey);
  } catch (_) {}
}

/**
 * Real image/png write via a tiny focused helper window.
 * Action popups are Permissions-Policy blocked (crbug.com/414348233) and
 * offscreen documents are focus-blocked; a focused extension window is neither.
 * Result comes back through chrome.storage (writer window can use it).
 */
async function writeImageBlobViaHelperWindow(png) {
  if (!chrome?.runtime?.id) throw new Error('no_runtime');
  const dataUrl = await blobToDataUrl(png);
  if (!dataUrl.startsWith('data:image/')) throw new Error('invalid_png_data_url');

  const { CLIPBOARD_WRITER_BRIDGE: WB } = await import('./offscreen-clipboard-channel.js');
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storageKey = await stageClipboardDataUrl(dataUrl);
  try {
    await chrome.storage.local.remove([WB.RESULT]);
    chrome.runtime.sendMessage(
      { action: 'pcOpenClipboardWriter', id, storageKey },
      () => { void chrome.runtime.lastError; },
    );
    for (let i = 0; i < 60; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      const stored = await chrome.storage.local.get([WB.RESULT]);
      const res = stored?.[WB.RESULT];
      if (!res || res.id !== id) continue;
      if (res.success) return;
      throw new Error(res.error || 'background_image_copy_failed');
    }
    throw new Error('offscreen_write_timeout');
  } finally {
    await clearStagedDataUrl(storageKey);
  }
}

export async function writeImageBlobToClipboard(blob) {
  const png = await ensurePngBlob(blob);

  // Popup: Permissions Policy blocks clipboard.write(image) (crbug.com/414348233)
  // and offscreen docs are focus-blocked — a focused helper window is neither.
  // execCommand only puts an HTML flavor on the clipboard, which image-drop
  // targets (chat uploaders) ignore, so it stays the last resort.
  if (isExtensionPopupDocument()) {
    try {
      await writeImageBlobViaHelperWindow(png);
      return true;
    } catch (_) {}
    await writeImageBlobViaExecCommand(png);
    return true;
  }

  try {
    await writeImageBlobDirect(png);
    return true;
  } catch (directErr) {
    if (!canFallbackClipboardWrite(directErr)) throw directErr;
    try {
      await writeImageBlobViaExecCommand(png);
      return true;
    } catch (_) {}
    await writeImageBlobViaHelperWindow(png);
    return true;
  }
}

async function tryDomImageBlob(imageElement) {
  if (!imageElement) return null;
  try {
    return await blobFromHtmlImage(imageElement);
  } catch (_) {
    return null;
  }
}

async function resolveImageBlob(clip, { imageElement } = {}) {
  // Prefer the visible viewer bitmap first — survives side-store key drift.
  const fromDomFirst = await tryDomImageBlob(imageElement);
  if (fromDomFirst) return fromDomFirst;

  const { src } = await resolveClipImageSrc(clip);
  if (src?.startsWith('data:image/')) return dataUrlToBlob(src);

  if (isHttpImageUrl(src)) {
    try {
      return await fetchUrlAsBlob(src);
    } catch (fetchErr) {
      throw fetchErr?.message ? fetchErr : new Error('image_fetch_failed');
    }
  }

  throw new Error('no_image_src');
}

/** Map internal copy error codes to short toast-friendly reasons. */
export function formatClipboardImageError(error) {
  const raw = String(error?.message || error || '').trim();
  // Combined API|execCommand failures from offscreen — use first segment for map.
  const code = raw.includes('|') ? raw.split('|')[0] : raw;
  const map = {
    no_image_src: 'no image found',
    not_image_clip: 'not an image clip',
    invalid_data_url: 'invalid image data',
    invalid_png_data_url: 'invalid image data',
    invalid_image_data_url: 'invalid image data',
    image_element_empty: 'image not loaded',
    canvas_unavailable: 'image render failed',
    canvas_to_blob_failed: 'image render failed',
    image_decode_failed: 'image decode failed',
    clipboard_image_unsupported: 'clipboard blocked',
    background_image_copy_failed: 'clipboard blocked',
    offscreen_write_image_failed: 'clipboard blocked',
    offscreen_write_timeout: 'clipboard timed out',
    offscreen_create_failed: 'clipboard blocked',
    invalid_writer_job: 'clipboard blocked',
    execCommand_copy_failed: 'clipboard blocked',
    write_image_failed: 'clipboard blocked',
    no_runtime: 'extension context lost',
    unsupported_image_src: 'unsupported image source',
    not_image_response: 'not an image',
    empty_blob: 'no image found',
    png_convert_unavailable: 'image convert failed',
  };
  if (map[code]) return map[code];
  if (/permissions policy|notallowederror|clipboard api has been blocked/i.test(raw)) {
    return 'clipboard blocked';
  }
  if (/image_fetch_/i.test(raw)) return 'image download failed';
  if (/timeout/i.test(raw)) return 'clipboard timed out';
  if (/offscreen/i.test(raw)) return 'clipboard blocked';
  return raw.length > 60 ? 'copy failed' : raw || 'copy failed';
}

/**
 * Write only the image bitmap for image-picker / image clips (never text/OCR).
 * @param {object} clip
 * @param {{ imageElement?: HTMLImageElement }} [options]
 */
export async function copyImageBearingClipToClipboard(clip, options = {}) {
  if (!isImageBearingClip(clip)) throw new Error('not_image_clip');
  const blob = await resolveImageBlob(clip, options);
  await writeImageBlobToClipboard(blob);
}

export { isImageBearingClip };
