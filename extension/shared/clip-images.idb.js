/**
 * Extension-origin IndexedDB overflow for clip image blobs.
 * Content scripts must not use this (page-origin IDB). Check canUseExtensionClipImageIdb().
 */

const IDB_NAME = 'pc_clip_images_v1';
const IDB_STORE = 'images';
const IDB_VERSION = 1;

export function canUseExtensionClipImageIdb() {
  try {
    if (typeof indexedDB === 'undefined') return false;
    if (typeof ServiceWorkerGlobalScope !== 'undefined'
      && typeof self !== 'undefined'
      && self instanceof ServiceWorkerGlobalScope) {
      return true;
    }
    const protocol = String(globalThis.location?.protocol || '');
    return protocol === 'chrome-extension:';
  } catch (_) {
    return false;
  }
}

function openClipImageIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('clip_image_idb_open_failed'));
  });
}

function idbRequest(fn) {
  return new Promise((resolve, reject) => {
    const req = fn();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutClipImage(key, payload) {
  if (!key || !payload) throw new Error('invalid_clip_image');
  const db = await openClipImageIdb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(IDB_STORE).put(payload, key);
    });
  } finally {
    db.close();
  }
}

function clipImagePayloadFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const dataUrl = typeof row.dataUrl === 'string' ? row.dataUrl : '';
  if (!dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl,
    mime: typeof row.mime === 'string' ? row.mime : 'image/png',
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  };
}

export async function idbGetClipImage(keys) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!list.length) return null;
  const db = await openClipImageIdb();
  try {
    for (const key of list) {
      const row = await idbRequest(() => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        return tx.objectStore(IDB_STORE).get(key);
      });
      const parsed = clipImagePayloadFromRow(row);
      if (parsed) return parsed;
    }
    return null;
  } finally {
    db.close();
  }
}

export async function idbGetAllKeys() {
  const db = await openClipImageIdb();
  try {
    const keys = await idbRequest(() => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      return tx.objectStore(IDB_STORE).getAllKeys();
    });
    return Array.isArray(keys) ? keys.map(String) : [];
  } finally {
    db.close();
  }
}

export async function idbRemoveClipImages(keys) {
  const list = [...new Set((Array.isArray(keys) ? keys : [keys]).filter(Boolean))];
  if (!list.length) return;
  const db = await openClipImageIdb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(IDB_STORE);
      for (const key of list) store.delete(key);
    });
  } finally {
    db.close();
  }
}
