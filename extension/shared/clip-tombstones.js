/** Tombstone + sync-queue helpers for clip deletes (popup + content scripts). */

const CLIP_TOMBSTONE_KEYS = Object.freeze({
  DELETED_ACTIVE: 'pc_deleted_clips',
  DELETED_ARCHIVED: 'pc_deleted_archived_clips',
});

export function getClipIdKey(id) {
  if (id == null) return '';
  return String(id);
}

export async function loadDeletedClipIdSets() {
  try {
    const keys = [CLIP_TOMBSTONE_KEYS.DELETED_ACTIVE, CLIP_TOMBSTONE_KEYS.DELETED_ARCHIVED];
    const stored = await chrome.storage.local.get(keys);
    const toSet = (list) => new Set(
      (Array.isArray(list) ? list : [])
        .map((t) => getClipIdKey(t?.id))
        .filter(Boolean),
    );
    return {
      active: toSet(stored[CLIP_TOMBSTONE_KEYS.DELETED_ACTIVE]),
      archived: toSet(stored[CLIP_TOMBSTONE_KEYS.DELETED_ARCHIVED]),
    };
  } catch (_) {
    return { active: new Set(), archived: new Set() };
  }
}

export function filterTombstonedClips(clips, deletedIds) {
  if (!deletedIds?.size) return Array.isArray(clips) ? clips : [];
  return (Array.isArray(clips) ? clips : []).filter((clip) => {
    const id = getClipIdKey(clip?.id ?? clip?.clip_id ?? clip?.clipId);
    return id && !deletedIds.has(id);
  });
}

async function mergeTombstoneList(storageKey, clipIds, deletedAt) {
  if (!storageKey || !clipIds.length) return;
  const current = await chrome.storage.local.get([storageKey]);
  const existing = Array.isArray(current[storageKey]) ? current[storageKey] : [];
  const byId = new Map();
  existing.forEach((item) => {
    const id = getClipIdKey(item?.id);
    if (id) byId.set(id, item);
  });
  clipIds.forEach((id) => {
    const key = getClipIdKey(id);
    if (!key) return;
    byId.set(key, { id: key, deletedAt, updatedAt: deletedAt });
  });
  await chrome.storage.local.set({ [storageKey]: Array.from(byId.values()) });
}

/**
 * Record local tombstones so merge/load paths cannot resurrect deleted clips.
 * @param {{ active?: Array<{id: unknown}>, archived?: Array<{id: unknown}> }} payload
 */
export async function appendClipTombstones({ active = [], archived = [] } = {}) {
  const deletedAt = Date.now();
  const activeIds = active.map((c) => getClipIdKey(c?.id ?? c?.clip_id ?? c?.clipId)).filter(Boolean);
  const archivedIds = archived.map((c) => getClipIdKey(c?.id ?? c?.clip_id ?? c?.clipId)).filter(Boolean);
  if (activeIds.length) {
    await mergeTombstoneList(CLIP_TOMBSTONE_KEYS.DELETED_ACTIVE, activeIds, deletedAt);
  }
  if (archivedIds.length) {
    await mergeTombstoneList(CLIP_TOMBSTONE_KEYS.DELETED_ARCHIVED, archivedIds, deletedAt);
  }
}

function withDeletedTimestamps(clips, deletedAt) {
  return (Array.isArray(clips) ? clips : []).map((clip) => ({
    ...clip,
    deletedAt,
    updatedAt: deletedAt,
  }));
}

/** Queue cloud soft-delete ops (processed when popup/supabase client runs). */
export async function enqueueDeletedClipsSync({ active = [], archived = [] } = {}) {
  const deletedAt = Date.now();
  const ops = [];
  if (active.length) {
    ops.push({
      type: 'syncDeletedClips',
      data: withDeletedTimestamps(active, deletedAt),
      timestamp: deletedAt,
      id: `${deletedAt}_del_active_${Math.random().toString(36).slice(2, 8)}`,
    });
  }
  if (archived.length) {
    ops.push({
      type: 'syncDeletedArchivedClips',
      data: withDeletedTimestamps(archived, deletedAt),
      timestamp: deletedAt,
      id: `${deletedAt}_del_arch_${Math.random().toString(36).slice(2, 8)}`,
    });
  }
  if (!ops.length) return;

  const { syncQueue } = await chrome.storage.local.get(['syncQueue']);
  const queue = Array.isArray(syncQueue) ? syncQueue : [];
  await chrome.storage.local.set({ syncQueue: [...queue, ...ops] });
}

/**
 * Full delete side-effects: tombstones + sync queue (storage arrays already updated by caller).
 */
export async function recordClipDeletions({ active = [], archived = [] } = {}) {
  await appendClipTombstones({ active, archived });
  await enqueueDeletedClipsSync({ active, archived });
}
