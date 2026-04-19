// PasteCraft IndexedDB data layer for primary local entities.
(function initPasteCraftIndexedDB(globalScope) {
  const DB_NAME = 'pastecraft_local_v1';
  const DB_VERSION = 1;
  const STORES = ['clips', 'categories', 'notes'];

  class PasteCraftIndexedDB {
    constructor() {
      this._db = null;
      this._openPromise = null;
      this._migrateFlagKey = 'pc_idb_migrated_v1';
      this._deviceIdKey = 'pc_device_id_v1';
    }

    async open() {
      if (this._db) return this._db;
      if (this._openPromise) return this._openPromise;

      this._openPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const storeName of STORES) {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'pk' });
              store.createIndex('by_id', 'id', { unique: false });
              store.createIndex('by_hash', 'content_hash', { unique: false });
              store.createIndex('by_origin_item', 'origin_item_key', { unique: false });
              store.createIndex('by_updated_at', 'updated_at', { unique: false });
            }
          }
        };
        req.onsuccess = () => {
          this._db = req.result;
          resolve(this._db);
        };
        req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
      });

      return this._openPromise;
    }

    async ensureDeviceId() {
      const result = await chrome.storage.local.get([this._deviceIdKey]);
      if (result[this._deviceIdKey]) return String(result[this._deviceIdKey]);
      const deviceId = (globalScope.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await chrome.storage.local.set({ [this._deviceIdKey]: deviceId });
      return deviceId;
    }

    async hasAnyData(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.count();
        req.onsuccess = () => resolve((req.result || 0) > 0);
        req.onerror = () => reject(req.error || new Error('Count failed'));
      });
    }

    async getAllPayloads(storeName) {
      const records = await this.getAllRecords(storeName);
      return records.map((record) => record.payload).filter(Boolean);
    }

    async getAllRecords(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error || new Error('Read failed'));
      });
    }

    async deleteByIds(storeName, ids) {
      if (!Array.isArray(ids) || ids.length === 0) return 0;
      const db = await this.open();
      const idSet = new Set(ids.map((id) => String(id)));
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let removed = 0;
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const payloadId = cursor.value && cursor.value.payload ? String(cursor.value.payload.id || '') : '';
            const recordId = cursor.value ? String(cursor.value.id || '') : '';
            if (idSet.has(payloadId) || idSet.has(recordId)) {
              cursor.delete();
              removed++;
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve(removed);
        tx.onerror = () => reject(tx.error || new Error(`Delete-by-ids failed for ${storeName}`));
      });
    }

    async replaceFromAppItems(storeName, items, toRecord) {
      const db = await this.open();
      const normalized = Array.isArray(items) ? items : [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const newPks = new Set();
        for (const item of normalized) {
          const record = toRecord(item);
          if (record && record.pk) {
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
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error(`Replace failed for ${storeName}`));
      });
    }

    async importIfNeededFromStorage({ clips = [], categories = [], notes = [] }) {
      const result = await chrome.storage.local.get([this._migrateFlagKey]);
      const alreadyMigrated = result[this._migrateFlagKey] === true;
      if (alreadyMigrated) return false;

      const deviceId = await this.ensureDeviceId();
      const nowIso = new Date().toISOString();
      const hashOf = async (value) => this.sha256(String(value || ''));

      await this.replaceFromAppItems('clips', clips, (clip) => {
        const text = typeof clip === 'string' ? clip : String(clip?.text || '');
        const timestampMs = Number(clip?.timestamp || Date.now());
        const clipId = String(clip?.id ?? clip?.clip_id ?? `${timestampMs}_${Math.random().toString(36).slice(2)}`);
        const category = String(clip?.category || 'Uncategorized');
        const createdIso = new Date(timestampMs).toISOString();
        return {
          pk: `clips:${clipId}`,
          id: clipId,
          origin_device_id: String(clip?.origin_device_id || deviceId),
          content_hash: String(clip?.content_hash || clip?.contentHash || ''),
          created_at: clip?.created_at || createdIso,
          updated_at: clip?.updated_at || createdIso,
          origin_item_key: `${clip?.origin_device_id || deviceId}:${clipId}`,
          payload: {
            ...(typeof clip === 'object' && clip ? clip : {}),
            id: clipId,
            text,
            category,
            timestamp: timestampMs
          }
        };
      });

      await this.replaceFromAppItems('categories', categories, (category) => {
        const id = String(category?.id ?? category?.category_id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const createdMs = Number(category?.createdAt || category?.created_at || Date.now());
        const updatedMs = Number(category?.updatedAt || category?.updated_at || createdMs);
        return {
          pk: `categories:${id}`,
          id,
          origin_device_id: String(category?.origin_device_id || deviceId),
          content_hash: '',
          created_at: new Date(createdMs).toISOString(),
          updated_at: new Date(updatedMs).toISOString(),
          origin_item_key: `${category?.origin_device_id || deviceId}:${id}`,
          payload: {
            ...(category || {}),
            id,
            name: String(category?.name || 'Category'),
            icon: String(category?.icon || '📁'),
            createdAt: createdMs,
            updatedAt: updatedMs
          }
        };
      });

      await this.replaceFromAppItems('notes', notes, (note) => {
        const id = String(note?.id ?? note?.note_id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const createdMs = Number(note?.createdAt || note?.created_at || Date.now());
        const updatedMs = Number(note?.updatedAt || note?.updated_at || createdMs);
        return {
          pk: `notes:${id}`,
          id,
          origin_device_id: String(note?.origin_device_id || deviceId),
          content_hash: '',
          created_at: new Date(createdMs).toISOString(),
          updated_at: new Date(updatedMs).toISOString(),
          origin_item_key: `${note?.origin_device_id || deviceId}:${id}`,
          payload: {
            ...(note || {}),
            id,
            type: String(note?.type || 'note'),
            createdAt: createdMs,
            updatedAt: updatedMs
          }
        };
      });

      // Backfill missing clip hashes in a second pass.
      const clipRecords = await this.getAllRecords('clips');
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('clips', 'readwrite');
        const store = tx.objectStore('clips');
        Promise.all(clipRecords.map(async (record) => {
          if (record.content_hash) return;
          const text = String(record?.payload?.text || '');
          const hash = await hashOf(text);
          store.put({ ...record, content_hash: hash, payload: { ...(record.payload || {}), contentHash: hash, content_hash: hash } });
        })).then(() => {
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error('Clip hash backfill failed'));
        }).catch(reject);
      });

      await chrome.storage.local.set({ [this._migrateFlagKey]: true, pc_local_updatedAt: Date.now() });
      return true;
    }

    async syncEntityFromLocalStorage(storeName, items) {
      const deviceId = await this.ensureDeviceId();
      const nowIso = new Date().toISOString();
      if (storeName === 'clips') {
        await this.replaceFromAppItems('clips', items, (clip) => {
          const text = String(clip?.text || '');
          const id = String(clip?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
          const ts = Number(clip?.timestamp || Date.now());
          const hash = String(clip?.contentHash || clip?.content_hash || '');
          return {
            pk: `clips:${id}`,
            id,
            origin_device_id: String(clip?.origin_device_id || deviceId),
            content_hash: hash,
            created_at: clip?.created_at || new Date(ts).toISOString(),
            updated_at: clip?.updated_at || nowIso,
            origin_item_key: `${clip?.origin_device_id || deviceId}:${id}`,
            payload: { ...(clip || {}), id, text, timestamp: ts, contentHash: hash || clip?.contentHash || null }
          };
        });
        return;
      }

      if (storeName === 'categories') {
        await this.replaceFromAppItems('categories', items, (category) => {
          const id = String(category?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
          const createdMs = Number(category?.createdAt || Date.now());
          const updatedMs = Number(category?.updatedAt || createdMs);
          return {
            pk: `categories:${id}`,
            id,
            origin_device_id: String(category?.origin_device_id || deviceId),
            content_hash: '',
            created_at: new Date(createdMs).toISOString(),
            updated_at: new Date(updatedMs).toISOString(),
            origin_item_key: `${category?.origin_device_id || deviceId}:${id}`,
            payload: { ...(category || {}), id, createdAt: createdMs, updatedAt: updatedMs }
          };
        });
        return;
      }

      if (storeName === 'notes') {
        await this.replaceFromAppItems('notes', items, (note) => {
          const id = String(note?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
          const createdMs = Number(note?.createdAt || Date.now());
          const updatedMs = Number(note?.updatedAt || createdMs);
          return {
            pk: `notes:${id}`,
            id,
            origin_device_id: String(note?.origin_device_id || deviceId),
            content_hash: '',
            created_at: new Date(createdMs).toISOString(),
            updated_at: new Date(updatedMs).toISOString(),
            origin_item_key: `${note?.origin_device_id || deviceId}:${id}`,
            payload: { ...(note || {}), id, createdAt: createdMs, updatedAt: updatedMs }
          };
        });
      }
    }

    async sha256(value) {
      const text = String(value || '');
      if (!globalScope.crypto || !crypto.subtle || !globalScope.TextEncoder) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
          h ^= text.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return `fnv_${(h >>> 0).toString(16)}`;
      }
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  }

  globalScope.pasteCraftIndexedDB = new PasteCraftIndexedDB();
})(typeof window !== 'undefined' ? window : globalThis);
