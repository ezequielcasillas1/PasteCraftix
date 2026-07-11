/**
 * Liked / loved clips — shared chrome.storage CRUD.
 * ID-based only (never list index). Idempotent toggle.
 * Uses getClipIdKey so float Date.now()+Math.random ids match Clips hearts.
 */

import { getClipIdKey } from './clip-id.js';

export const LIKED_CLIPS_STORAGE_KEY = 'likedClipIds';

export function normalizeLikedClipId(clipId) {
  return getClipIdKey(clipId);
}

function toIdList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = normalizeLikedClipId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function getLikedClipIds() {
  const result = await chrome.storage.local.get([LIKED_CLIPS_STORAGE_KEY]);
  return toIdList(result?.[LIKED_CLIPS_STORAGE_KEY]);
}

export async function isClipLiked(clipId) {
  const id = normalizeLikedClipId(clipId);
  if (!id) return false;
  const ids = await getLikedClipIds();
  return ids.includes(id);
}

export async function setClipLiked(clipId, liked) {
  const id = normalizeLikedClipId(clipId);
  const ids = await getLikedClipIds();
  if (!id) return { liked: false, ids };

  const set = new Set(ids);
  if (liked) set.add(id);
  else set.delete(id);

  const next = [...set];
  await chrome.storage.local.set({ [LIKED_CLIPS_STORAGE_KEY]: next });
  return { liked: set.has(id), ids: next };
}

export async function toggleClipLiked(clipId) {
  const id = normalizeLikedClipId(clipId);
  if (!id) return { liked: false, ids: await getLikedClipIds() };
  const ids = await getLikedClipIds();
  return setClipLiked(id, !ids.includes(id));
}

/** Strategy: keep only clips whose id is in the liked set. */
export function filterLikedClips(clips, likedIds) {
  const set = new Set(toIdList(likedIds));
  if (set.size === 0) return [];
  return (Array.isArray(clips) ? clips : []).filter((clip) => {
    const id = normalizeLikedClipId(clip?.id ?? clip?.clip_id ?? clip?.clipId);
    return id && set.has(id);
  });
}
