/** Map Supabase clip rows to local clip shape. */

import { clipImageCloudUrlFromClip, applyClipImageCloudUrl } from '../../shared/clip-images.cloud.js';

function metaFromDbClip(clip) {
  const base = clip?.meta && typeof clip.meta === 'object' ? { ...clip.meta } : {};
  const url = clipImageCloudUrlFromClip({ image_url: clip?.image_url, meta: base });
  if (!url) return Object.keys(base).length ? base : undefined;
  return applyClipImageCloudUrl({ meta: base }, url, base.image?.storagePath).meta;
}

export function mapDbClipToLocal(clip) {
  return {
    id: clip.clip_id,
    text: clip.text,
    title: clip.title || '',
    category: clip.category,
    timestamp: clip.timestamp,
    updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
    deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
    deviceId: clip.device_id || null,
    meta: metaFromDbClip(clip)
  };
}

/** Page fetch shape (active clips): includes meta, omits deletedAt. */
export function mapDbClipToLocalPage(clip) {
  return {
    id: clip.clip_id,
    text: clip.text,
    title: clip.title || '',
    category: clip.category,
    timestamp: clip.timestamp,
    updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
    deviceId: clip.device_id || null,
    meta: metaFromDbClip(clip)
  };
}
