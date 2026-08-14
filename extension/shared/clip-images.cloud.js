/**
 * Cloud URL helpers for picked/captured clip images.
 * Bytes upload via supabase/sync/clip-images-cloud.js (popup/auth context).
 */

import { getClipIdKey } from './clip-id.js';

export const CLIP_IMAGES_BUCKET = 'clip-images';

export function isHttpsClipImageUrl(value) {
  const src = typeof value === 'string' ? value.trim() : '';
  return src.startsWith('https://');
}

export function clipImageCloudUrlFromClip(clip) {
  if (isHttpsClipImageUrl(clip?.image_url)) return clip.image_url.trim();
  const src = clip?.meta?.image?.srcUrl;
  return isHttpsClipImageUrl(src) ? src.trim() : '';
}

export function mimeToClipImageExt(mime) {
  const ct = String(mime || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'png';
}

export function clipImageCloudPath(userId, clipId, mime) {
  const uid = String(userId || '').trim();
  const key = getClipIdKey(clipId) || (clipId != null ? String(clipId) : '');
  if (!uid || !key) return '';
  return `${uid}/${key}.${mimeToClipImageExt(mime)}`;
}

export function dataUrlToImageBlob(dataUrl) {
  const u = typeof dataUrl === 'string' ? dataUrl : '';
  if (!u.startsWith('data:image/')) return null;
  const comma = u.indexOf(',');
  if (comma < 0) return null;
  const header = u.slice(0, comma);
  const b64 = u.slice(comma + 1);
  const m = header.match(/^data:([^;]+);base64$/i);
  const ct = m && m[1] ? m[1] : 'image/png';
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: ct });
  } catch (_) {
    return null;
  }
}

export function applyClipImageCloudUrl(clip, url, path) {
  if (!clip || !isHttpsClipImageUrl(url)) return clip;
  const meta = clip.meta && typeof clip.meta === 'object' ? { ...clip.meta } : { kind: 'image' };
  const image = meta.image && typeof meta.image === 'object' ? { ...meta.image } : {};
  image.srcUrl = url.trim();
  image.hasImage = true;
  if (path) image.storagePath = String(path).slice(0, 400);
  delete image.tooLarge;
  meta.kind = meta.kind || 'image';
  meta.image = image;
  return { ...clip, meta };
}
