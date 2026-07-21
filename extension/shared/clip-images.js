/**
 * Side-store for clip image payloads.
 * Keeps large dataUrls out of clip.meta (sanitizeClipMeta 140KB cap).
 */

const KEY_PREFIX = 'pc_clip_img_v1_';

export function clipImageStorageKey(clipId) {
  return `${KEY_PREFIX}${String(clipId)}`;
}

export function isClipImageStorageKey(key) {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX);
}

export async function putClipImage(clipId, dataUrl, mime = 'image/png') {
  const id = clipId != null ? String(clipId) : '';
  const url = typeof dataUrl === 'string' ? dataUrl : '';
  if (!id || !url.startsWith('data:image/')) {
    throw new Error('invalid_clip_image');
  }
  const key = clipImageStorageKey(id);
  await chrome.storage.local.set({
    [key]: {
      dataUrl: url,
      mime: String(mime || 'image/png').slice(0, 128),
      updatedAt: Date.now(),
    },
  });
  return key;
}

export async function getClipImage(clipId) {
  const id = clipId != null ? String(clipId) : '';
  if (!id) return null;
  const key = clipImageStorageKey(id);
  const bag = await chrome.storage.local.get(key);
  const row = bag?.[key];
  if (!row || typeof row !== 'object') return null;
  const dataUrl = typeof row.dataUrl === 'string' ? row.dataUrl : '';
  if (!dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl,
    mime: typeof row.mime === 'string' ? row.mime : 'image/png',
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  };
}

export async function removeClipImages(clipIds) {
  const keys = (Array.isArray(clipIds) ? clipIds : [clipIds])
    .map((id) => (id != null ? clipImageStorageKey(id) : ''))
    .filter(Boolean);
  if (!keys.length) return;
  await chrome.storage.local.remove(keys);
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
