/**
 * Local tombstone bookkeeping for clip deletes (popup + content scripts).
 * Prevents mergeClips from resurrecting rows still alive on Supabase.
 */

export const CLIP_TOMBSTONE_KEYS = Object.freeze({
  ACTIVE: 'pc_deleted_clips',
  ARCHIVED: 'pc_deleted_archived_clips',
});

function clipIdKey(clip) {
  if (!clip || clip.id == null) return '';
  return String(clip.id);
}

/**
 * @param {Array<object>} clips
 * @param {Set<string>|Array<string>} idKeys
 * @returns {Array<object>}
 */
export function pickClipsByIdKeys(clips, idKeys) {
  const idSet = idKeys instanceof Set ? idKeys : new Set((idKeys || []).map((k) => String(k)));
  if (!idSet.size) return [];
  const arr = Array.isArray(clips) ? clips : [];
  return arr.filter((c) => idSet.has(clipIdKey(c)));
}

/**
 * Append tombstones for deleted clips (deduped by id).
 * @param {Array<object>} removedClips - full clip objects (need id + text)
 * @param {{ archived?: boolean, deletedAt?: number }} options
 */
export async function appendClipTombstones(removedClips, { archived = false, deletedAt } = {}) {
  const items = Array.isArray(removedClips) ? removedClips.filter((c) => clipIdKey(c)) : [];
  if (items.length === 0) return;

  const when = Number.isFinite(deletedAt) ? deletedAt : Date.now();
  const storageKey = archived ? CLIP_TOMBSTONE_KEYS.ARCHIVED : CLIP_TOMBSTONE_KEYS.ACTIVE;

  const existing = await new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (res) => resolve(res || {}));
  });
  const prev = Array.isArray(existing[storageKey]) ? existing[storageKey] : [];
  const seen = new Set(prev.map((t) => String(t?.id ?? '')));

  const additions = [];
  for (const clip of items) {
    const id = clipIdKey(clip);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    additions.push({
      id,
      text: clip.text != null ? String(clip.text) : '',
      category: clip.category || 'Uncategorized',
      timestamp: clip.timestamp,
      deletedAt: when,
      updatedAt: when,
    });
  }

  if (additions.length === 0) return;

  await new Promise((resolve) => {
    chrome.storage.local.set({ [storageKey]: [...prev, ...additions] }, resolve);
  });
}

/**
 * Build payloads for syncDeletedClipsToSupabase / syncDeletedArchivedClipsToSupabase.
 */
export function toDeletedClipSyncPayload(removedClips, deletedAt) {
  const when = Number.isFinite(deletedAt) ? deletedAt : Date.now();
  return (Array.isArray(removedClips) ? removedClips : [])
    .filter((c) => clipIdKey(c))
    .map((clip) => ({
      ...clip,
      deletedAt: when,
      updatedAt: when,
    }));
}
