/** Merge chrome.storage clips with IndexedDB payloads — never let stale IDB shadow fresh local writes. */

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
 */
export function mergeActiveClipsSources(localClips, idbClips) {
  const local = Array.isArray(localClips) ? localClips : [];
  const idb = Array.isArray(idbClips) ? idbClips : [];

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
