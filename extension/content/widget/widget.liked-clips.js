/**
 * Liked clips storage for content/widget (same key as extension/shared/liked-clips.js).
 * Kept local so content module graph does not depend on shared/ WAR imports.
 */

export const LIKED_CLIPS_STORAGE_KEY = 'likedClipIds';

export function normalizeLikedClipId(clipId) {
  return clipId != null && clipId !== '' ? String(clipId) : '';
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

export async function toggleClipLiked(clipId) {
  const id = normalizeLikedClipId(clipId);
  const ids = await getLikedClipIds();
  if (!id) return { liked: false, ids };

  const set = new Set(ids);
  const liked = !set.has(id);
  if (liked) set.add(id);
  else set.delete(id);

  const next = [...set];
  await chrome.storage.local.set({ [LIKED_CLIPS_STORAGE_KEY]: next });
  return { liked, ids: next };
}
