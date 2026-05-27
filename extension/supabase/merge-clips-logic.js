/** Pure clip merge for local ↔ remote sync (unit-testable). */

function hashText(t) {
  const s = String(t || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function clipUpdatedAtMs(clip) {
  if (Number.isFinite(clip?.updatedAt)) return clip.updatedAt;
  if (typeof clip?.timestamp === 'number') return clip.timestamp;
  return 0;
}

function contentKey(clip) {
  if (!clip) return '';
  const text = String(clip.text || '');
  const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
  const bucket = Math.floor(ts / 3000);
  const cat = clip.category != null ? String(clip.category) : '';
  return `${hashText(text)}:${bucket}:${cat}`;
}

function isNewerClip(candidate, existing) {
  const nextMs = clipUpdatedAtMs(candidate);
  const prevMs = clipUpdatedAtMs(existing);
  if (nextMs > prevMs) return true;
  if (nextMs < prevMs) return false;
  return (candidate.timestamp || 0) > (existing.timestamp || 0);
}

/**
 * Merge local and remote clips. Rows with distinct ids are kept separately.
 * Content-key dedupe applies only to id-less / legacy rows (accidental dupes).
 */
export function mergeClipArrays(localClips, remoteClips, deletedById = new Map()) {
  const mergedById = new Map();
  const contentMerged = new Map();

  const isDroppedByTombstone = (clip, id) => {
    if (!id) return false;
    const deletedAt = deletedById.get(id);
    if (!deletedAt) return false;
    return deletedAt >= clipUpdatedAtMs(clip);
  };

  const addWithId = (clip) => {
    if (!clip || !clip.text) return;
    const id = clip?.id != null ? String(clip.id).trim() : '';
    if (!id) return;
    if (isDroppedByTombstone(clip, id)) return;

    const prev = mergedById.get(id);
    if (!prev || isNewerClip(clip, prev)) {
      mergedById.set(id, clip);
    }
  };

  const addByContentKey = (clip) => {
    if (!clip || !clip.text) return;
    const id = clip?.id != null ? String(clip.id).trim() : '';
    if (id) return;

    const k = contentKey(clip);
    const prev = contentMerged.get(k);
    if (!prev || isNewerClip(clip, prev)) {
      contentMerged.set(k, clip);
    }
  };

  const ingest = (clip) => {
    const id = clip?.id != null ? String(clip.id).trim() : '';
    if (id) addWithId(clip);
    else addByContentKey(clip);
  };

  (Array.isArray(localClips) ? localClips : []).forEach(ingest);
  (Array.isArray(remoteClips) ? remoteClips : []).forEach(ingest);

  return [...mergedById.values(), ...contentMerged.values()].sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  );
}
