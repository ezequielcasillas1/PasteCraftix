const DELETED_ACTIVE = 'pc_deleted_clips';
const DELETED_ARCHIVED = 'pc_deleted_archived_clips';
const SYNC_QUEUE_KEY = 'syncQueue';

function normalizeTombstoneEntries(entries) {
  const now = Date.now();
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (entry == null) return null;
      if (typeof entry === 'object') {
        const id = String(entry.id ?? entry.clip_id ?? entry.clipId ?? '').trim();
        if (!id) return null;
        const deletedAt = Number.isFinite(entry.deletedAt) ? entry.deletedAt : now;
        const record = {
          id,
          deletedAt,
          updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : deletedAt,
        };
        if (entry.text != null) record.text = String(entry.text);
        if (entry.category != null) record.category = String(entry.category);
        if (entry.timestamp != null) record.timestamp = entry.timestamp;
        return record;
      }
      const id = String(entry).trim();
      return id ? { id, deletedAt: now, updatedAt: now } : null;
    })
    .filter(Boolean);
}

async function mergeTombstonesIntoStorage(storageKey, records) {
  if (!storageKey || records.length === 0) return;

  const existing = await chrome.storage.local.get([storageKey]);
  const prev = Array.isArray(existing[storageKey]) ? existing[storageKey] : [];
  const byId = new Map();
  prev.forEach((item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (id) byId.set(id, item);
  });
  records.forEach((item) => {
    byId.set(String(item.id), item);
  });
  await chrome.storage.local.set({ [storageKey]: Array.from(byId.values()) });
}

async function enqueueSyncDeleted(operationType, records) {
  if (!records.length) return;

  const existing = await chrome.storage.local.get([SYNC_QUEUE_KEY]);
  const queue = Array.isArray(existing[SYNC_QUEUE_KEY]) ? existing[SYNC_QUEUE_KEY] : [];
  queue.push({
    type: operationType,
    data: records,
    timestamp: Date.now(),
    id: Date.now() + Math.random(),
  });
  await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: queue });
}

/**
 * Record local clip tombstones and queue cloud soft-delete sync.
 * Pass clip objects (id + text) when available so Supabase upsert can set deleted_at.
 */
export async function recordClipDeletionTombstones({ activeIds = [], archivedIds = [] } = {}) {
  const activeRecords = normalizeTombstoneEntries(activeIds);
  const archivedRecords = normalizeTombstoneEntries(archivedIds);

  if (activeRecords.length) {
    await mergeTombstonesIntoStorage(DELETED_ACTIVE, activeRecords);
  }
  if (archivedRecords.length) {
    await mergeTombstonesIntoStorage(DELETED_ARCHIVED, archivedRecords);
  }

  const supa = typeof globalThis !== 'undefined' ? globalThis.pasteCraftSupabase : null;

  if (activeRecords.length) {
    if (supa?.syncWithQueue) {
      await supa.syncWithQueue(
        'syncDeletedClips',
        activeRecords,
        supa.syncDeletedClipsToSupabase.bind(supa),
      );
    } else {
      await enqueueSyncDeleted('syncDeletedClips', activeRecords);
    }
  }

  if (archivedRecords.length) {
    if (supa?.syncWithQueue) {
      await supa.syncWithQueue(
        'syncDeletedArchivedClips',
        archivedRecords,
        supa.syncDeletedArchivedClipsToSupabase.bind(supa),
      );
    } else {
      await enqueueSyncDeleted('syncDeletedArchivedClips', archivedRecords);
    }
  }
}
