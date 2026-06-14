/** Vertical slice: storage-adapter.js
 *
 * Safe wrappers around chrome.storage.local + IndexedDB fallback used by
 * the realtime/full-sync slices. Restored from the pre-split supabase-client.js
 * which lost these helpers during the vertical-slice refactor.
 */
export const storageAdapterMixin = {
  async _readLocalUpdatedAt() {
    try {
      const latest = await chrome.storage.local.get(['pc_local_updatedAt']);
      return Number.isFinite(latest?.pc_local_updatedAt) ? latest.pc_local_updatedAt : 0;
    } catch (_) {
      return 0;
    }
  },

  async _hasNewerLocalWritesSince(snapshotLocalUpdatedAt) {
    const latestUpdatedAt = await this._readLocalUpdatedAt();
    return latestUpdatedAt > snapshotLocalUpdatedAt;
  },

  async _safeStorageSet(data) {
    const keys = Object.keys(data || {});
    if (keys.length === 0) return false;

    try {
      const current = await new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(items || {});
          }
        });
      });

      const hasChanges = keys.some((key) => !areStorageValuesEqual(current[key], data[key]));
      if (!hasChanges) return false;

      await new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('QUOTA') || msg.includes('quota')) {
        console.warn('⚠️ Chrome storage quota exceeded, saving to IndexedDB only');
        if (typeof indexedDB !== 'undefined') {
          for (const [key, value] of Object.entries(data)) {
            try {
              await this._saveToIdb(key, value);
            } catch (idbErr) {
              console.error(`Failed to save ${key} to IndexedDB:`, idbErr);
            }
          }
        }
        return true;
      }
      console.error('Failed to save to chrome.storage.local:', err);
      return false;
    }
  },

  async _saveToIdb(key, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PasteCraftFallback', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('fallback')) {
          db.createObjectStore('fallback');
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('fallback', 'readwrite');
        const store = tx.objectStore('fallback');
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  },
};

function areStorageValuesEqual(left, right) {
  if (Object.is(left, right)) return true;

  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);
  if (leftIsArray || rightIsArray) {
    if (!leftIsArray || !rightIsArray || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!areStorageValuesEqual(left[index], right[index])) return false;
    }
    return true;
  }

  if (!isObjectLike(left) || !isObjectLike(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!areStorageValuesEqual(left[key], right[key])) return false;
  }

  return true;
}

function isObjectLike(value) {
  return value !== null && typeof value === 'object';
}
