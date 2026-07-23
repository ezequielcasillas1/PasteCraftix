/** @forward-slice Local IDB hard-delete + chrome.storage tombstone paths (no Supabase). */

function resolveIndexedDb() {
  if (typeof window === 'undefined') return null;
  return window.pasteCraftIndexedDB || null;
}

const IDB_STATE_KEY_BY_STORE = {
  notes: 'notes',
  categories: 'categories',
  clips: 'clips',
};

/**
 * Hard-delete rows from IndexedDB and optionally re-sync the store from local state.
 * Non-throwing: logs and continues if IDB fails after chrome.storage succeeded.
 */
export async function hardDeleteFromIndexedDb({
  idbStoreName,
  ids,
  currentState = null,
}) {
  const idb = resolveIndexedDb();
  if (!idbStoreName || !idb) return;

  const normalizedIds = Array.from(
    new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)),
  );
  if (normalizedIds.length === 0) return;

  try {
    await idb.deleteByIds(idbStoreName, normalizedIds);
    const idbStateKey = IDB_STATE_KEY_BY_STORE[idbStoreName];
    if (
      idbStateKey
      && currentState
      && Array.isArray(currentState[idbStateKey])
      && typeof idb.syncEntityFromLocalStorage === 'function'
    ) {
      await idb.syncEntityFromLocalStorage(idbStoreName, currentState[idbStateKey]);
    }
  } catch (idbErr) {
    console.warn(
      `?? IDB hard-delete failed for ${idbStoreName} (chrome.storage delete succeeded):`,
      idbErr?.message || idbErr,
    );
  }
}

export async function appendLocalTombstone({
  tombstoneStorageKey,
  entityId,
  entityName,
  deletedAt,
}) {
  if (!tombstoneStorageKey) return;
  try {
    const existing = await new Promise((resolve) => {
      chrome.storage.local.get([tombstoneStorageKey], (res) => resolve(res || {}));
    });
    const prev = Array.isArray(existing[tombstoneStorageKey])
      ? existing[tombstoneStorageKey]
      : [];
    const already = prev.some((t) => t && String(t.id) === String(entityId));
    if (already) return;
    const tombstone = { id: entityId, name: entityName, deletedAt, updatedAt: deletedAt };
    await new Promise((resolve) => {
      chrome.storage.local.set({ [tombstoneStorageKey]: [...prev, tombstone] }, resolve);
    });
  } catch (tombErr) {
    console.warn(`?? Tombstone write failed:`, tombErr?.message || tombErr);
  }
}

export async function appendLocalTombstones({
  tombstoneStorageKey,
  entities,
  deletedAt,
}) {
  if (!tombstoneStorageKey || !Array.isArray(entities) || entities.length === 0) return;
  try {
    const existing = await new Promise((resolve) => {
      chrome.storage.local.get([tombstoneStorageKey], (res) => resolve(res || {}));
    });
    const prev = Array.isArray(existing[tombstoneStorageKey])
      ? existing[tombstoneStorageKey]
      : [];
    const prevIds = new Set(prev.map((t) => String(t?.id || '')).filter(Boolean));
    const next = entities
      .filter((entity) => !prevIds.has(String(entity?.id || '')))
      .map((entity) => ({
        ...entity,
        deletedAt,
        updatedAt: deletedAt,
      }));
    if (next.length === 0) return;
    await new Promise((resolve) => {
      chrome.storage.local.set({ [tombstoneStorageKey]: [...prev, ...next] }, resolve);
    });
  } catch (tombErr) {
    console.warn(`?? Tombstone batch write failed:`, tombErr?.message || tombErr);
  }
}
