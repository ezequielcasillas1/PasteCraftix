/** Merge chrome.storage clips with IndexedDB payloads — never let stale IDB shadow fresh local writes. */

import { getClipIdKey } from './clip-id.js';

export function getClipMergeKey(clip) {
  if (clip == null) return '';
  const id = clip.id ?? clip.clip_id ?? clip.clipId;
  return id != null ? getClipIdKey(id) : '';
}

export function getClipSortTime(clip) {
  if (!clip || typeof clip !== 'object') return 0;
  const updated = Number(clip.updatedAt ?? clip.updated_at);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const ts = Number(clip.timestamp);
  return Number.isFinite(ts) ? ts : 0;
}

export function filterTombstonedClips(clips, deletedIds) {
  if (!deletedIds?.size) return Array.isArray(clips) ? clips : [];
  return (Array.isArray(clips) ? clips : []).filter((clip) => {
    const key = getClipMergeKey(clip);
    return key && !deletedIds.has(key);
  });
}

/**
 * Union active clips by id; when both sources have the same id, keep the newer record.
 * Tombstoned ids are excluded so IDB-only rows cannot resurrect a local delete.
 */
export function mergeActiveClipsSources(localClips, idbClips, deletedIds = null) {
  const local = filterTombstonedClips(localClips, deletedIds);
  const idb = filterTombstonedClips(idbClips, deletedIds);

  if (idb.length === 0) return [...local];
  if (local.length === 0) return [...idb];

  const byId = new Map();

  for (const clip of idb) {
    const key = getClipMergeKey(clip);
    if (key) byId.set(key, clip);
  }

  for (const clip of local) {
    const key = getClipMergeKey(clip);
    if (!key) continue;
    const existing = byId.get(key);
    if (!existing || getClipSortTime(clip) >= getClipSortTime(existing)) {
      byId.set(key, clip);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => getClipSortTime(b) - getClipSortTime(a));
  return merged;
}
