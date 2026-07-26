/**
 * @forward-slice Thin chrome.storage helpers for workspace ownership.
 */

function storageArea(kind) {
  return globalThis.chrome?.storage?.[kind] || null;
}

function callStorage(area, method, arg) {
  return new Promise((resolve) => {
    if (!area?.[method]) {
      resolve(method === 'get' ? {} : undefined);
      return;
    }
    try {
      area[method](arg, (result) => {
        resolve(method === 'get' ? (result || {}) : undefined);
      });
    } catch (_) {
      resolve(method === 'get' ? {} : undefined);
    }
  });
}

export async function localGet(keys) {
  return callStorage(storageArea('local'), 'get', keys);
}

export async function localSet(data) {
  return callStorage(storageArea('local'), 'set', data);
}

export async function localRemove(keys) {
  if (!keys?.length) return;
  return callStorage(storageArea('local'), 'remove', keys);
}

export async function syncGet(keys) {
  return callStorage(storageArea('sync'), 'get', keys);
}

export function resolveIndexedDb() {
  return globalThis.pasteCraftIndexedDB
    ?? globalThis.window?.pasteCraftIndexedDB
    ?? null;
}

/** Empty one IDB entity store that mirrors chrome.storage library data. */
export async function clearOneIdbStore(idb, storeName) {
  if (typeof idb?.syncEntityFromLocalStorage === 'function') {
    await idb.syncEntityFromLocalStorage(storeName, []);
    return;
  }
  if (typeof idb?.replaceFromAppItems === 'function') {
    await idb.replaceFromAppItems(storeName, [], () => null);
  }
}
