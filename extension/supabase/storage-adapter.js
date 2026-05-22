/** Vertical slice: storage-adapter.js
 *
 * Safe wrappers around chrome.storage.local + IndexedDB fallback used by
 * the realtime/full-sync slices. Restored from the pre-split supabase-client.js
 * which lost these helpers during the vertical-slice refactor.
 */
export const storageAdapterMixin = {
  async _safeStorageSet(data) {
    try {
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
