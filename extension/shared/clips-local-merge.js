/** Merge chrome.storage clips with IndexedDB payloads — never let stale IDB shadow fresh local writes. */

export function buildClipTombstoneMap(tombstones) {
  const deletedById = new Map();
  const list = Array.isArray(tombstones) ? tombstones : [];
  for (const tombstone of list) {
    const id = tombstone?.id != null ? String(tombstone.id) : '';
    if (!id) continue;
    const when = Number.isFinite(tombstone?.deletedAt) ? tombstone.deletedAt : Date.now();
    const prev = deletedById.get(id) || 0;
    if (when > prev) deletedById.set(id, when);
  }
  return deletedById;
}

export function isClipTombstoned(clip, tombstoneMap) {
  if (!clip || !tombstoneMap || tombstoneMap.size === 0) return false;
  const id = getClipMergeKey(clip);
  if (!id) return false;
  const deletedAt = tombstoneMap.get(id);
  if (!deletedAt) return false;
  return deletedAt >= getClipSortTime(clip);
}

export function filterTombstonedClips(clips, tombstones) {
  const tombstoneMap = buildClipTombstoneMap(tombstones);
  if (tombstoneMap.size === 0) return Array.isArray(clips) ? [...clips] : [];
  return (Array.isArray(clips) ? clips : []).filter((clip) => !isClipTombstoned(clip, tombstoneMap));
}

export function getClipMergeKey(clip) {
  if (clip == null) return '';
  const id = clip.id ?? clip.clip_id ?? clip.clipId;
  return id != null ? String(id) : '';
}

export function getClipSortTime(clip) {
  if (!clip || typeof clip !== 'object') return 0;
  const updated = Number(clip.updatedAt ?? clip.updated_at);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const ts = Number(clip.timestamp);
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Union active clips by id; when both sources have the same id, keep the newer record.
 * Honors pc_deleted_* tombstones so a stale IndexedDB row cannot resurrect a deleted clip.
 * Preserves legacy local rows without ids (string clips) when IndexedDB is non-empty.
 */
export function mergeActiveClipsSources(localClips, idbClips, tombstones = []) {
  const local = Array.isArray(localClips) ? localClips : [];
  const idb = Array.isArray(idbClips) ? idbClips : [];
  const tombstoneMap = buildClipTombstoneMap(tombstones);

  if (idb.length === 0) {
    return filterTombstonedClips(local, tombstones);
  }
  if (local.length === 0) {
    return filterTombstonedClips(idb, tombstones);
  }

  const byId = new Map();
  const keylessLocal = [];

  for (const clip of idb) {
    const key = getClipMergeKey(clip);
    if (key) byId.set(key, clip);
  }

  for (const clip of local) {
    const key = getClipMergeKey(clip);
    if (!key) {
      keylessLocal.push(clip);
      continue;
    }
    const existing = byId.get(key);
    if (!existing || getClipSortTime(clip) >= getClipSortTime(existing)) {
      byId.set(key, clip);
    }
  }

  const merged = [...keylessLocal, ...Array.from(byId.values())];
  merged.sort((a, b) => getClipSortTime(b) - getClipSortTime(a));

  if (tombstoneMap.size === 0) return merged;
  return merged.filter((clip) => !isClipTombstoned(clip, tombstoneMap));
}
