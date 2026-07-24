/**
 * @forward-slice ACL — IndexedDB for popup/content slices.
 * Thin facade over pasteCraftIndexedDB; does not absorb business rules.
 */

function resolveIndexedDb() {
  return globalThis.pasteCraftIndexedDB
    ?? globalThis.window?.pasteCraftIndexedDB
    ?? null;
}

export function hasIndexedDb() {
  return !!resolveIndexedDb();
}

export function getIndexedDb() {
  return resolveIndexedDb();
}

export async function openIndexedDb() {
  const idb = resolveIndexedDb();
  if (!idb?.open) throw new Error('pasteCraftIndexedDB not loaded');
  return idb.open();
}

export async function ensureIndexedDbDeviceId() {
  const idb = resolveIndexedDb();
  if (!idb?.ensureDeviceId) return null;
  return idb.ensureDeviceId();
}

export async function importIndexedDbIfNeededFromStorage(seed) {
  const idb = resolveIndexedDb();
  if (!idb?.importIfNeededFromStorage) return false;
  return idb.importIfNeededFromStorage(seed || {});
}

export async function syncIndexedDbEntityFromLocalStorage(storeName, items) {
  const idb = resolveIndexedDb();
  if (!idb?.syncEntityFromLocalStorage) return;
  return idb.syncEntityFromLocalStorage(storeName, items);
}

export async function getIndexedDbPayloads(storeName) {
  const idb = resolveIndexedDb();
  if (!idb?.getAllPayloads) return [];
  return idb.getAllPayloads(storeName);
}

export async function getIndexedDbRecords(storeName) {
  const idb = resolveIndexedDb();
  if (!idb?.getAllRecords) return [];
  return idb.getAllRecords(storeName);
}

export async function deleteIndexedDbByIds(storeName, ids) {
  const idb = resolveIndexedDb();
  if (!idb?.deleteByIds) return 0;
  return idb.deleteByIds(storeName, ids);
}
