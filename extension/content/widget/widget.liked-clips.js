/**
 * Liked clips storage for content/widget (same key as extension/shared/liked-clips.js).
 * Kept local so content module graph does not depend on shared/ WAR imports.
 * Float-id normalize must match extension/shared/clip-id.js getClipIdKey.
 */

export const LIKED_CLIPS_STORAGE_KEY = 'likedClipIds';

function normalizeFloatClipIdKey(num) {
  const rounded = Math.round(num * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

export function normalizeLikedClipId(clipId) {
  if (clipId == null || clipId === '') return '';
  if (typeof clipId === 'number') {
    if (Number.isInteger(clipId)) return String(clipId);
    if (clipId >= 1e12 && clipId < 1e16) return normalizeFloatClipIdKey(clipId);
    return String(clipId);
  }
  const raw = String(clipId).trim();
  if (!raw) return '';
  const num = Number(raw);
  if (raw.includes('.') && Number.isFinite(num) && num >= 1e12 && num < 1e16) {
    return normalizeFloatClipIdKey(num);
  }
  return raw;
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
