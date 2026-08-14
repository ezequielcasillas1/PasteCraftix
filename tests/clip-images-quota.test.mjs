import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  isChromeStorageQuotaError,
  putClipImage,
  getClipImage,
  stashPendingClipImage,
  reclaimPendingClipImages,
  resetClipImageMigrationState,
  LOCAL_STORAGE_LIMIT_MESSAGE,
} from '../extension/shared/clip-images.js';
import {
  applyClipImageCloudUrl,
  clipImageCloudPath,
  clipImageCloudUrlFromClip,
} from '../extension/shared/clip-images.cloud.js';

const originals = {
  chrome: globalThis.chrome,
  indexedDB: globalThis.indexedDB,
  location: globalThis.location,
};

const SAMPLE_PNG = 'data:image/png;base64,AAAABBBB';

function quotaError() {
  return new Error('Resource::kQuotaBytes quota exceeded');
}

function installLocation(protocol) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { protocol },
  });
}

function installChromeStorage({ state = {}, failSetTimes = 0, alwaysQuota = false } = {}) {
  let remainingFails = failSetTimes;
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys == null) return { ...state };
          if (typeof keys === 'string') return { [keys]: state[keys] };
          if (Array.isArray(keys)) {
            const out = {};
            for (const key of keys) out[key] = state[key];
            return out;
          }
          return { ...state };
        },
        async set(data) {
          if (alwaysQuota || remainingFails > 0) {
            if (remainingFails > 0) remainingFails -= 1;
            throw quotaError();
          }
          Object.assign(state, data);
        },
        async remove(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) delete state[key];
        },
      },
    },
    runtime: {
      async sendMessage(message) {
        return { success: false, error: 'clip_image_sw_put_failed', action: message?.action };
      },
    },
  };
  return state;
}

function installMemoryIndexedDB() {
  const databases = new Map();

  class MemStore {
    constructor() {
      this.map = new Map();
    }
    put(value, key) {
      this.map.set(String(key), value);
    }
    get(key) {
      return this.map.get(String(key));
    }
    delete(key) {
      this.map.delete(String(key));
    }
  }

  class MemDB {
    constructor() {
      this._stores = new Map();
      this.objectStoreNames = {
        contains: (name) => this._stores.has(name),
      };
    }
    createObjectStore(name) {
      const store = new MemStore();
      this._stores.set(name, store);
      return store;
    }
    transaction(storeName) {
      const store = this._stores.get(storeName);
      const tx = {
        oncomplete: null,
        onerror: null,
        objectStore: () => ({
          put: (value, key) => store.put(value, key),
          delete: (key) => store.delete(key),
          get: (key) => {
            const req = { result: store.get(key), onsuccess: null, onerror: null };
            queueMicrotask(() => {
              if (typeof req.onsuccess === 'function') req.onsuccess();
            });
            return req;
          },
          getAllKeys: () => {
            const req = { result: [...store.map.keys()], onsuccess: null, onerror: null };
            queueMicrotask(() => {
              if (typeof req.onsuccess === 'function') req.onsuccess();
            });
            return req;
          },
        }),
      };
      queueMicrotask(() => {
        if (typeof tx.oncomplete === 'function') tx.oncomplete();
      });
      return tx;
    }
    close() {}
  }

  globalThis.indexedDB = {
    open(name) {
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        let created = false;
        if (!databases.has(name)) {
          databases.set(name, new MemDB());
          created = true;
        }
        req.result = databases.get(name);
        if (created && typeof req.onupgradeneeded === 'function') {
          req.onupgradeneeded({ target: req });
        }
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      });
      return req;
    },
  };
  return databases;
}

afterEach(() => {
  resetClipImageMigrationState();
  globalThis.chrome = originals.chrome;
  globalThis.indexedDB = originals.indexedDB;
  if (originals.location) {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originals.location,
    });
  }
});

test('detects Chrome kQuotaBytes errors', () => {
  assert.equal(isChromeStorageQuotaError(quotaError()), true);
  assert.equal(isChromeStorageQuotaError(new Error('nope')), false);
});

test('stash still throws when chrome.storage stays over quota', async () => {
  installChromeStorage({ alwaysQuota: true });
  installLocation('https:');
  await assert.rejects(
    () => stashPendingClipImage(SAMPLE_PNG, 'image/png'),
    /quota/i,
  );
});

test('getClipImage adopts a nearby pending image left by a quota-stalled save', async () => {
  const clipId = 1786731144827.0256;
  const pendingKey = 'pc_pending_clip_img_1786731144812_3lhfnn';
  const state = installChromeStorage({
    state: {
      [pendingKey]: { dataUrl: SAMPLE_PNG, mime: 'image/png', updatedAt: 1786731144812 },
    },
  });
  installMemoryIndexedDB();
  installLocation('chrome-extension:');

  const stored = await getClipImage(clipId);
  assert.equal(stored?.dataUrl, SAMPLE_PNG);
  assert.equal(state[pendingKey], undefined);
});

test('reclaimPendingClipImages removes only pending keys', async () => {
  const state = installChromeStorage({
    state: {
      pc_pending_clip_img_a: { dataUrl: SAMPLE_PNG },
      pc_clip_img_v1_keep: { dataUrl: SAMPLE_PNG },
    },
  });
  const removed = await reclaimPendingClipImages();
  assert.equal(removed, 1);
  assert.equal(state.pc_pending_clip_img_a, undefined);
  assert.ok(state.pc_clip_img_v1_keep);
});

test('putClipImage falls back to IndexedDB on quota and getClipImage reads it', async () => {
  installChromeStorage({ alwaysQuota: true });
  installMemoryIndexedDB();
  installLocation('chrome-extension:');

  const clipId = 1786730517419.2935;
  const key = await putClipImage(clipId, SAMPLE_PNG, 'image/png');
  assert.match(key, /^pc_clip_img_v1_/);

  const stored = await getClipImage(clipId);
  assert.equal(stored?.dataUrl, SAMPLE_PNG);
  assert.equal(stored?.mime, 'image/png');
});

test('putClipImage throws local storage limit when IDB and chrome.storage both fail', async () => {
  installChromeStorage({ alwaysQuota: true });
  installLocation('https:');
  await assert.rejects(
    () => putClipImage(1786730517419.2935, SAMPLE_PNG, 'image/png'),
    (err) => err instanceof Error && err.message === LOCAL_STORAGE_LIMIT_MESSAGE,
  );
});

test('cloud URL helpers keep https src and user-folder path', () => {
  const path = clipImageCloudPath('user-1', 'clip-9', 'image/png');
  assert.equal(path, 'user-1/clip-9.png');
  const clip = applyClipImageCloudUrl(
    { id: 'clip-9', meta: { kind: 'image', image: { hasImage: true } } },
    'https://example.supabase.co/storage/v1/object/public/clip-images/user-1/clip-9.png',
    path,
  );
  assert.equal(
    clipImageCloudUrlFromClip(clip),
    'https://example.supabase.co/storage/v1/object/public/clip-images/user-1/clip-9.png',
  );
  assert.equal(clipImageCloudUrlFromClip({ meta: { image: { srcUrl: 'data:image/png;base64,AA' } } }), '');
});
