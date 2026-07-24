/**
 * @forward-slice Quick View IndexedDB read/sync helpers (background).
 * Read path must open at schema v3 — opening at v1 throws VersionError.
 */

const IDB_NAME = 'pastecraft_local_v1';
const IDB_VERSION = 3;
const IDB_DEVICE_KEY = 'pc_device_id_v1';
const IDB_READ_VERSION = 3;

async function ensureBackgroundDeviceId() {
  const result = await chrome.storage.local.get([IDB_DEVICE_KEY]);
  if (result[IDB_DEVICE_KEY]) return String(result[IDB_DEVICE_KEY]);
  const deviceId = (globalThis.crypto?.randomUUID?.())
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await chrome.storage.local.set({ [IDB_DEVICE_KEY]: deviceId });
  return deviceId;
}

function clipToIndexedDbRecord(clip, deviceId) {
  const text = String(clip?.text || '');
  const clipId = String(clip?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const timestampMs = Number(clip?.timestamp || Date.now());
  const createdIso = new Date(timestampMs).toISOString();
  const nowIso = new Date().toISOString();
  return {
    pk: `clips:${clipId}`,
    id: clipId,
    origin_device_id: String(clip?.origin_device_id || deviceId),
    content_hash: String(clip?.content_hash || clip?.contentHash || ''),
    created_at: clip?.created_at || createdIso,
    updated_at: clip?.updated_at || nowIso,
    origin_item_key: `${clip?.origin_device_id || deviceId}:${clipId}`,
    payload: {
      ...(clip && typeof clip === 'object' ? clip : {}),
      id: clipId,
      text,
      category: String(clip?.category || 'Uncategorized'),
      timestamp: timestampMs,
    },
  };
}

export async function readIndexedDbPayloads(storeName) {
  if (typeof indexedDB === 'undefined') return [];

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let request;
    try {
      request = indexedDB.open('pastecraft_local_v1', IDB_READ_VERSION);
    } catch (_) {
      finish([]);
      return;
    }

    request.onerror = () => {
      finish([]);
    };
    request.onupgradeneeded = () => {
      // Read path must not create/upgrade schema — abort and treat as empty.
      try { request.transaction.abort(); } catch (_) {}
      finish([]);
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          finish([]);
          return;
        }

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const records = Array.isArray(getAll.result) ? getAll.result : [];
          db.close();
          finish(records.map((record) => record && record.payload).filter(Boolean));
        };
        getAll.onerror = () => {
          db.close();
          finish([]);
        };
      } catch (_) {
        try { db.close(); } catch (_) {}
        finish([]);
      }
    };
  });
}

export async function syncClipsToIndexedDb(clips) {
  if (typeof indexedDB === 'undefined') return false;
  const normalized = Array.isArray(clips) ? clips : [];
  const deviceId = await ensureBackgroundDeviceId();

  return new Promise((resolve) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => resolve(false);
    request.onupgradeneeded = () => {
      try { request.transaction?.abort(); } catch (_) {}
      resolve(false);
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (!db.objectStoreNames.contains('clips')) {
          db.close();
          resolve(false);
          return;
        }

        const tx = db.transaction('clips', 'readwrite');
        const store = tx.objectStore('clips');
        const newPks = new Set();

        for (const clip of normalized) {
          const record = clipToIndexedDbRecord(clip, deviceId);
          if (record?.pk) {
            newPks.add(record.pk);
            store.put(record);
          }
        }

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            if (!newPks.has(cursor.key)) cursor.delete();
            cursor.continue();
          }
        };

        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch (_) {
        try { db.close(); } catch (_) {}
        resolve(false);
      }
    };
  });
}
