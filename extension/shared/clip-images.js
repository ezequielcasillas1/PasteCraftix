/**
 * Side-store for clip image payloads.
 * Keeps large dataUrls out of clip.meta (sanitizeClipMeta 140KB cap).
 */

import { getClipIdKey } from './clip-id.js';

const KEY_PREFIX = 'pc_clip_img_v1_';
const PENDING_PREFIX = 'pc_pending_clip_img_';
const DEBUG_LOG_KEY = 'pc_debug_af03f9';

export function clipImageStorageKey(clipId) {
  const keyId = getClipIdKey(clipId) || (clipId != null ? String(clipId) : '');
  return keyId ? `${KEY_PREFIX}${keyId}` : '';
}

/** Legacy keys used String(id) before getClipIdKey normalization. */
function clipImageStorageKeyCandidates(clipId) {
  const keys = [];
  const normalized = clipImageStorageKey(clipId);
  if (normalized) keys.push(normalized);
  if (clipId != null && clipId !== '') {
    const raw = `${KEY_PREFIX}${String(clipId)}`;
    if (raw !== normalized) keys.push(raw);
  }
  return keys;
}

export function isClipImageStorageKey(key) {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX);
}

export async function putClipImage(clipId, dataUrl, mime = 'image/png') {
  const key = clipImageStorageKey(clipId);
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!key || !url.startsWith('data:image/')) {
    // #region agent log
    void pcDebugAf03f9('H7', 'clip-images.js:putClipImage', 'invalid_clip_image', {
      hasKey: !!key,
      urlKind: url.slice(0, 16),
      urlLen: url.length,
      clipIdType: typeof clipId,
    });
    // #endregion
    throw new Error('invalid_clip_image');
  }
  const payload = {
    dataUrl: url,
    mime: String(mime || 'image/png').slice(0, 128),
    updatedAt: Date.now(),
  };
  // Write canonical key; drop legacy String(id) duplicate if it differs.
  const legacy = `${KEY_PREFIX}${String(clipId)}`;
  const bag = { [key]: payload };
  try {
    await chrome.storage.local.set(bag);
  } catch (err) {
    // #region agent log
    void pcDebugAf03f9('H7', 'clip-images.js:putClipImage', 'storage set failed', {
      keySuffix: key.slice(-28),
      urlLen: url.length,
      error: String(err?.message || err).slice(0, 120),
    });
    // #endregion
    throw err;
  }
  if (legacy !== key) {
    try {
      await chrome.storage.local.remove(legacy);
    } catch (_) {}
  }
  // #region agent log
  void pcDebugAf03f9('H6', 'clip-images.js:putClipImage', 'stored', {
    keySuffix: key.slice(-28),
    urlLen: url.length,
    mime: payload.mime,
  });
  // #endregion
  return key;
}

export async function stashPendingClipImage(dataUrl, mime = 'image/png') {
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!url.startsWith('data:image/')) throw new Error('invalid_clip_image');
  const key = `${PENDING_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.local.set({
    [key]: {
      dataUrl: url,
      mime: String(mime || 'image/png').slice(0, 128),
      updatedAt: Date.now(),
    },
  });
  return key;
}

export async function takePendingClipImage(pendingKey) {
  const key = typeof pendingKey === 'string' ? pendingKey : '';
  if (!key.startsWith(PENDING_PREFIX)) return null;
  const bag = await chrome.storage.local.get(key);
  const row = bag?.[key];
  if (!row || typeof row !== 'object') return null;
  const dataUrl = typeof row.dataUrl === 'string' ? row.dataUrl : '';
  if (!dataUrl.startsWith('data:image/')) return null;
  return {
    key,
    dataUrl,
    mime: typeof row.mime === 'string' ? row.mime : 'image/png',
  };
}

export async function clearPendingClipImage(pendingKey) {
  const key = typeof pendingKey === 'string' ? pendingKey : '';
  if (!key.startsWith(PENDING_PREFIX)) return;
  try {
    await chrome.storage.local.remove(key);
  } catch (_) {}
}

// #region agent log
export async function pcDebugAf03f9(hypothesisId, location, message, data) {
  const payload = {
    sessionId: 'af03f9',
    runId: 'post-fix-save',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify(payload));
  try {
    const bag = await chrome.storage.local.get(DEBUG_LOG_KEY);
    const prev = Array.isArray(bag?.[DEBUG_LOG_KEY]) ? bag[DEBUG_LOG_KEY] : [];
    prev.push(payload);
    await chrome.storage.local.set({ [DEBUG_LOG_KEY]: prev.slice(-20) });
  } catch (_) {}
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function readDebugAf03f9() {
  try {
    const bag = await chrome.storage.local.get(DEBUG_LOG_KEY);
    return Array.isArray(bag?.[DEBUG_LOG_KEY]) ? bag[DEBUG_LOG_KEY] : [];
  } catch (_) {
    return [];
  }
}
// #endregion

export async function getClipImage(clipId) {
  const keys = clipImageStorageKeyCandidates(clipId);
  if (!keys.length) return null;
  const bag = await chrome.storage.local.get(keys);
  for (const key of keys) {
    const row = bag?.[key];
    if (!row || typeof row !== 'object') continue;
    const dataUrl = typeof row.dataUrl === 'string' ? row.dataUrl : '';
    if (!dataUrl.startsWith('data:image/')) continue;
    return {
      dataUrl,
      mime: typeof row.mime === 'string' ? row.mime : 'image/png',
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    };
  }
  return null;
}

export async function removeClipImages(clipIds) {
  const keys = (Array.isArray(clipIds) ? clipIds : [clipIds])
    .flatMap((id) => clipImageStorageKeyCandidates(id))
    .filter(Boolean);
  if (!keys.length) return;
  await chrome.storage.local.remove([...new Set(keys)]);
}

function _metaImage(meta) {
  return meta?.image && typeof meta.image === 'object' ? meta.image : null;
}

function _isRenderableImageSrc(value) {
  const src = typeof value === 'string' ? value.trim() : '';
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  return '';
}

function _imageMetaHasPayload(image) {
  if (!image) return false;
  if (image.hasImage === true || image.tooLarge === true) return true;
  if (_isRenderableImageSrc(image.dataUrl)) return true;
  return !!String(image.srcUrl || '').trim();
}

/** True when a clip carries or references an image payload. */
export function isImageBearingClip(clip) {
  const meta = clip?.meta;
  if (!meta || typeof meta !== 'object') return false;
  if (meta.kind === 'image' || meta.captureSource === 'image-picker') return true;
  return _imageMetaHasPayload(_metaImage(meta));
}

const SOURCE_LABELS = Object.freeze({
  'image-picker': 'Image Picker',
  spot: 'Spot',
});

/** Label for capture/upload source shown in pickers. */
export function clipImageSourceLabel(clip) {
  const meta = clip?.meta;
  const labeled = SOURCE_LABELS[meta?.captureSource];
  if (labeled) return labeled;
  if (meta?.kind === 'image') return 'Image clip';
  if (_metaImage(meta)?.hasImage) return 'Captured image';
  return 'Image';
}

function _defaultMime(meta) {
  return _metaImage(meta)?.mime || 'image/png';
}

async function _sideStoreSrc(clipId) {
  try {
    const stored = await getClipImage(clipId);
    if (stored?.dataUrl) return { src: stored.dataUrl, mime: stored.mime || 'image/png' };
  } catch (_) {}
  return null;
}

/** Resolve a renderable image src from meta and/or side-store. */
export async function resolveClipImageSrc(clip) {
  const meta = clip?.meta && typeof clip.meta === 'object' ? clip.meta : null;
  const mime = _defaultMime(meta);
  const inline = _isRenderableImageSrc(_metaImage(meta)?.dataUrl);
  if (inline) return { src: inline, mime };

  const stored = await _sideStoreSrc(clip?.id);
  if (stored) return { src: stored.src, mime: stored.mime || mime };

  return { src: _isRenderableImageSrc(_metaImage(meta)?.srcUrl), mime };
}

/** Pull dataUrl out of meta for side-storage; leave a light meta.image stub. */
export function peelImageDataUrlFromMeta(meta) {
  if (!meta || typeof meta !== 'object' || !meta.image || typeof meta.image !== 'object') {
    return { meta, dataUrl: '', mime: 'image/png' };
  }
  const dataUrl = typeof meta.image.dataUrl === 'string' ? meta.image.dataUrl : '';
  const mime = typeof meta.image.mime === 'string' && meta.image.mime
    ? meta.image.mime
    : 'image/png';
  if (!dataUrl.startsWith('data:image/')) {
    return { meta, dataUrl: '', mime };
  }
  const nextImage = { ...meta.image };
  delete nextImage.dataUrl;
  nextImage.hasImage = true;
  nextImage.mime = mime;
  return {
    meta: { ...meta, image: nextImage },
    dataUrl,
    mime,
  };
}
