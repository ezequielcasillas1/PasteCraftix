/**
 * Side-store for clip image payloads.
 * Keeps large dataUrls out of clip.meta (sanitizeClipMeta 140KB cap).
 */

import { getClipIdKey } from './clip-id.js';
import {
  canUseExtensionClipImageIdb,
  idbGetAllKeys,
  idbGetClipImage,
  idbPutClipImage,
  idbRemoveClipImages,
} from './clip-images.idb.js';

const KEY_PREFIX = 'pc_clip_img_v1_';
const PENDING_PREFIX = 'pc_pending_clip_img_';
const MIGRATE_FLAG = 'pc_clip_img_migrated_v1';
const PUT_CLIP_IMAGE_ACTION = 'pcPutClipImage';

export const CLIP_IMAGE_CARRY_MAX = 8000000;
export const LOCAL_STORAGE_LIMIT_MESSAGE = 'You have reached the limits of the providing local storage.';

export function isChromeStorageQuotaError(err) {
  return /quota|QUOTA_BYTES/i.test(String(err?.message || err || ''));
}

export function localStorageLimitError(cause) {
  const err = new Error(LOCAL_STORAGE_LIMIT_MESSAGE);
  if (cause) err.cause = cause;
  return err;
}

export async function reclaimPendingClipImages() {
  try {
    const bag = await chrome.storage.local.get(null);
    const keys = Object.keys(bag || {}).filter((k) => k.startsWith(PENDING_PREFIX));
    if (!keys.length) return 0;
    await chrome.storage.local.remove(keys);
    return keys.length;
  } catch (_) {
    return 0;
  }
}

async function writeChromeStorageImage(bag) {
  await chrome.storage.local.set(bag);
}

function isClipImageBlobKey(key) {
  return typeof key === 'string'
    && (key.startsWith(KEY_PREFIX) || key.startsWith(PENDING_PREFIX));
}

async function persistPayloadToIdb(key, payload) {
  await idbPutClipImage(key, payload);
  try {
    await chrome.storage.local.remove(key);
  } catch (_) {}
  return key;
}

async function putClipImageViaBackground(clipId, dataUrl, mime) {
  if (canUseExtensionClipImageIdb()) {
    throw localStorageLimitError();
  }
  if (typeof chrome?.runtime?.sendMessage !== 'function') {
    throw new Error('clip_image_sw_put_unavailable');
  }
  const res = await chrome.runtime.sendMessage({
    action: PUT_CLIP_IMAGE_ACTION,
    clipId,
    dataUrl,
    mime,
  });
  if (!res?.success) throw new Error(res?.error || 'clip_image_sw_put_failed');
  return typeof res.key === 'string' ? res.key : clipImageStorageKey(clipId);
}

export async function migrateClipImagesFromChromeStorage() {
  if (!canUseExtensionClipImageIdb()) return { moved: 0, skipped: true };
  let bag = {};
  try {
    bag = await chrome.storage.local.get(null);
  } catch (err) {
    return { moved: 0, error: String(err?.message || err).slice(0, 120) };
  }
  if (bag?.[MIGRATE_FLAG] === true) return { moved: 0, already: true };
  const keys = Object.keys(bag || {}).filter(isClipImageBlobKey);
  const movedKeys = [];
  for (const key of keys) {
    const parsed = clipImagePayloadFromRow(bag[key]);
    if (!parsed) continue;
    await idbPutClipImage(key, parsed);
    movedKeys.push(key);
  }
  if (movedKeys.length) {
    await chrome.storage.local.remove(movedKeys);
  }
  try {
    await chrome.storage.local.set({ [MIGRATE_FLAG]: true });
  } catch (_) {}
  return { moved: movedKeys.length };
}

let migratePromise = null;

export function resetClipImageMigrationState() {
  migratePromise = null;
}

export function ensureClipImagesMigrated() {
  if (!canUseExtensionClipImageIdb()) return Promise.resolve({ moved: 0, skipped: true });
  if (!migratePromise) {
    migratePromise = migrateClipImagesFromChromeStorage().catch((err) => {
      migratePromise = null;
      return { moved: 0, error: String(err?.message || err).slice(0, 120) };
    });
  }
  return migratePromise;
}

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

function clipImagePayloadFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const dataUrl = typeof row.dataUrl === 'string' ? row.dataUrl : '';
  if (!dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl,
    mime: typeof row.mime === 'string' ? row.mime : 'image/png',
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  };
}

async function persistViaChromeOrBackground(key, payload, clipId) {
  try {
    await writeChromeStorageImage({ [key]: payload });
    return key;
  } catch (err) {
    if (!isChromeStorageQuotaError(err)) throw err;
    try {
      return await putClipImageViaBackground(clipId, payload.dataUrl, payload.mime);
    } catch (swErr) {
      throw localStorageLimitError(swErr);
    }
  }
}

async function persistClipImagePayload(key, payload, clipId) {
  if (!canUseExtensionClipImageIdb()) {
    return persistViaChromeOrBackground(key, payload, clipId);
  }
  try {
    return await persistPayloadToIdb(key, payload);
  } catch (idbErr) {
    try {
      await writeChromeStorageImage({ [key]: payload });
      return key;
    } catch (_) {
      throw localStorageLimitError(idbErr);
    }
  }
}

export async function putClipImage(clipId, dataUrl, mime = 'image/png') {
  await ensureClipImagesMigrated();
  const key = clipImageStorageKey(clipId);
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!key || !url.startsWith('data:image/')) {
    throw new Error('invalid_clip_image');
  }
  const payload = {
    dataUrl: url,
    mime: String(mime || 'image/png').slice(0, 128),
    updatedAt: Date.now(),
  };
  const storedKey = await persistClipImagePayload(key, payload, clipId);
  const legacy = `${KEY_PREFIX}${String(clipId)}`;
  if (legacy !== key) {
    try {
      await chrome.storage.local.remove(legacy);
    } catch (_) {}
    if (canUseExtensionClipImageIdb()) {
      try {
        await idbRemoveClipImages([legacy]);
      } catch (_) {}
    }
  }
  return storedKey;
}

export async function stashPendingClipImage(dataUrl, mime = 'image/png') {
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!url.startsWith('data:image/')) throw new Error('invalid_clip_image');
  const key = `${PENDING_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await writeChromeStorageImage({
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
  try {
    const bag = await chrome.storage.local.get(key);
    const parsed = clipImagePayloadFromRow(bag?.[key]);
    if (parsed) return { key, dataUrl: parsed.dataUrl, mime: parsed.mime };
  } catch (_) {}
  if (canUseExtensionClipImageIdb()) {
    try {
      const stored = await idbGetClipImage([key]);
      if (stored?.dataUrl) return { key, dataUrl: stored.dataUrl, mime: stored.mime };
    } catch (_) {}
  }
  return null;
}

export async function clearPendingClipImage(pendingKey) {
  const key = typeof pendingKey === 'string' ? pendingKey : '';
  if (!key.startsWith(PENDING_PREFIX)) return;
  try {
    await chrome.storage.local.remove(key);
  } catch (_) {}
  if (!canUseExtensionClipImageIdb()) return;
  try {
    await idbRemoveClipImages([key]);
  } catch (_) {}
}

const PENDING_MATCH_MS = 30000;

function pendingTimestampFromKey(key) {
  const rest = String(key || '').slice(PENDING_PREFIX.length);
  const ts = Number(rest.split('_')[0]);
  return Number.isFinite(ts) ? ts : 0;
}

function clipTimestampHint(clipId) {
  if (typeof clipId === 'number' && Number.isFinite(clipId)) return clipId;
  const parsed = Number(clipId);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function persistAdoptedPending(clipId, parsed, pendingKey) {
  try {
    if (canUseExtensionClipImageIdb()) {
      await idbPutClipImage(clipImageStorageKey(clipId), {
        dataUrl: parsed.dataUrl,
        mime: parsed.mime,
        updatedAt: Date.now(),
      });
    } else {
      await putClipImage(clipId, parsed.dataUrl, parsed.mime);
    }
    await clearPendingClipImage(pendingKey);
  } catch (_) {}
}

async function collectPendingKeys(bag) {
  const chromeKeys = Object.keys(bag || {}).filter((k) => k.startsWith(PENDING_PREFIX));
  if (!canUseExtensionClipImageIdb()) return chromeKeys;
  try {
    const idbKeys = await idbGetAllKeys();
    return [...new Set([...chromeKeys, ...idbKeys.filter((k) => k.startsWith(PENDING_PREFIX))])];
  } catch (_) {
    return chromeKeys;
  }
}

async function pendingPayloadForKey(bag, key) {
  const fromChrome = clipImagePayloadFromRow(bag?.[key]);
  if (fromChrome) return fromChrome;
  if (!canUseExtensionClipImageIdb()) return null;
  try {
    return await idbGetClipImage([key]);
  } catch (_) {
    return null;
  }
}

export async function adoptNearbyPendingClipImage(clipId) {
  const clipTs = clipTimestampHint(clipId);
  if (!clipTs) return null;
  let bag = {};
  try {
    bag = await chrome.storage.local.get(null);
  } catch (_) {
    bag = {};
  }
  const pendingKeys = await collectPendingKeys(bag);
  let bestKey = '';
  let bestDelta = PENDING_MATCH_MS;
  for (const key of pendingKeys) {
    const ts = pendingTimestampFromKey(key);
    if (!ts) continue;
    const delta = Math.abs(ts - clipTs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  const parsed = await pendingPayloadForKey(bag, bestKey);
  if (!parsed) return null;
  await persistAdoptedPending(clipId, parsed, bestKey);
  return parsed;
}

async function readClipImageFromIdb(keys) {
  if (!canUseExtensionClipImageIdb()) return null;
  try {
    const stored = await idbGetClipImage(keys);
    if (!stored?.dataUrl) return null;
    return stored;
  } catch (_) {
    return null;
  }
}

async function readClipImageFromChrome(keys) {
  try {
    const bag = await chrome.storage.local.get(keys);
    for (const key of keys) {
      const parsed = clipImagePayloadFromRow(bag?.[key]);
      if (!parsed) continue;
      if (canUseExtensionClipImageIdb()) {
        try { await persistPayloadToIdb(key, parsed); } catch (_) {}
      }
      return parsed;
    }
  } catch (_) {}
  return null;
}

export async function getClipImage(clipId) {
  await ensureClipImagesMigrated();
  const keys = clipImageStorageKeyCandidates(clipId);
  if (!keys.length) return null;
  const fromIdb = await readClipImageFromIdb(keys);
  if (fromIdb) return fromIdb;
  const fromChrome = await readClipImageFromChrome(keys);
  if (fromChrome) return fromChrome;
  return adoptNearbyPendingClipImage(clipId);
}

export async function removeClipImages(clipIds) {
  const keys = (Array.isArray(clipIds) ? clipIds : [clipIds])
    .flatMap((id) => clipImageStorageKeyCandidates(id))
    .filter(Boolean);
  if (!keys.length) return;
  const unique = [...new Set(keys)];
  await chrome.storage.local.remove(unique);
  if (!canUseExtensionClipImageIdb()) return;
  try {
    await idbRemoveClipImages(unique);
  } catch (_) {}
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
