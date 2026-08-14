/**
 * @forward-slice Upload picked/captured clip images to Supabase Storage.
 * Local IDB remains the cache. Cloud URL is stored on clip.meta.image.srcUrl
 * and clips.image_url. Failures are warnings — they must not wipe local bytes.
 */

import { isImageBearingClip, getClipImage } from '../../shared/clip-images.js';
import {
  CLIP_IMAGES_BUCKET,
  applyClipImageCloudUrl,
  clipImageCloudPath,
  clipImageCloudUrlFromClip,
  dataUrlToImageBlob,
} from '../../shared/clip-images.cloud.js';

async function persistPatchedClipLists(updatedClips) {
  const bag = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  const byId = new Map(
    (Array.isArray(updatedClips) ? updatedClips : [])
      .filter((c) => c && clipImageCloudUrlFromClip(c))
      .map((c) => [String(c.id), c]),
  );
  if (!byId.size) return;
  const patchList = (list) => (Array.isArray(list) ? list : []).map((clip) => {
    const next = byId.get(String(clip?.id));
    const url = clipImageCloudUrlFromClip(next);
    if (!url) return clip;
    return applyClipImageCloudUrl(clip, url, next?.meta?.image?.storagePath);
  });
  await chrome.storage.local.set({
    clips: patchList(bag.clips),
    searchOnlyClips: patchList(bag.searchOnlyClips),
  });
}

async function localDataUrlForClip(clip) {
  const fallbackMime = clip?.meta?.image?.mime || 'image/png';
  try {
    const stored = await getClipImage(clip.id);
    if (stored?.dataUrl) return { dataUrl: stored.dataUrl, mime: stored.mime || fallbackMime };
  } catch (_) {}
  const inline = clip?.meta?.image?.dataUrl;
  if (typeof inline === 'string' && inline.startsWith('data:image/')) {
    return { dataUrl: inline, mime: fallbackMime };
  }
  return { dataUrl: '', mime: fallbackMime };
}

async function preserveOneClipImage(uploader, clip, userId) {
  if (!isImageBearingClip(clip) || clipImageCloudUrlFromClip(clip)) {
    return { clip, changed: false };
  }
  const { dataUrl, mime } = await localDataUrlForClip(clip);
  if (!dataUrl.startsWith('data:image/')) return { clip, changed: false };
  const uploaded = await uploader.uploadClipImageDataUrl(dataUrl, userId, clip.id, mime);
  if (uploaded?.url) {
    return { clip: applyClipImageCloudUrl(clip, uploaded.url, uploaded.path), changed: true };
  }
  console.warn('[clip-images-cloud] preserve failed; local image kept for clip', String(clip?.id || '').slice(-16));
  return { clip, changed: false };
}

export const clipImagesCloudMixin = {
  async uploadClipImageDataUrl(dataUrl, userId, clipId, mime) {
    if (!this.client || !userId || !dataUrl) return null;
    const blob = dataUrlToImageBlob(dataUrl);
    if (!blob) return null;
    const path = clipImageCloudPath(userId, clipId, mime || blob.type);
    if (!path) return null;
    try {
      const { error } = await this.client.storage
        .from(CLIP_IMAGES_BUCKET)
        .upload(path, blob, { contentType: blob.type || 'image/png', upsert: true });
      if (error) throw error;
      const { data } = this.client.storage.from(CLIP_IMAGES_BUCKET).getPublicUrl(path);
      const url = data?.publicUrl || '';
      if (!url.startsWith('https://')) return null;
      return { url, path };
    } catch (err) {
      console.warn('[clip-images-cloud] upload failed:', err?.message || err);
      return null;
    }
  },

  async persistClipImageCloudUrls(updatedClips) {
    try {
      await persistPatchedClipLists(updatedClips);
    } catch (err) {
      console.warn('[clip-images-cloud] local URL patch failed:', err?.message || err);
    }
  },

  async preserveClipImagesForCloud(localClips, userId) {
    const clips = Array.isArray(localClips) ? localClips : [];
    if (!this.client || !userId || clips.length === 0) {
      return { clips, changed: false };
    }
    let changed = false;
    const next = [];
    for (const clip of clips) {
      const preserved = await preserveOneClipImage(this, clip, userId);
      if (preserved.changed) changed = true;
      next.push(preserved.clip);
    }
    return { clips: next, changed };
  },
};
