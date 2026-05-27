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
        const idb = typeof globalThis !== 'undefined' ? globalThis.pasteCraftIndexedDB : null;
        if (idb && typeof idb.syncEntityFromLocalStorage === 'function') {
          console.warn('⚠️ Chrome storage quota exceeded, saving entity data to primary IndexedDB');
          for (const [key, value] of Object.entries(data)) {
            if (key !== 'clips' && key !== 'categories' && key !== 'notes') continue;
            try {
              await idb.syncEntityFromLocalStorage(key, Array.isArray(value) ? value : []);
            } catch (idbErr) {
              console.error(`Failed to save ${key} to IndexedDB:`, idbErr);
              return false;
            }
          }
          return true;
        }
        console.error('Chrome storage quota exceeded and primary IndexedDB is unavailable');
        return false;
      }
      console.error('Failed to save to chrome.storage.local:', err);
      return false;
    }
  },
};
