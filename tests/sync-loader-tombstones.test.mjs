import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchRawData } from '../extension/popup/features/sync/sync.loader.js';

function installChromeStorageMock(state) {
  const storage = structuredClone(state);
  globalThis.chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        async get(keys) {
          if (Array.isArray(keys)) {
            const result = {};
            for (const key of keys) result[key] = structuredClone(storage[key]);
            return result;
          }
          return structuredClone(storage);
        },
      },
    },
  };
  return storage;
}

test('fetchRawData ignores tombstoned clips resurrected from IndexedDB', async () => {
  const previousChrome = globalThis.chrome;
  installChromeStorageMock({
    clips: [{ id: 'clip-b', text: 'kept', category: 'General', timestamp: 2 }],
    categories: [],
    searchOnlyClips: [],
    pc_deleted_clips: [{ id: 'clip-a', deletedAt: Date.now() }],
  });

  const app = {
    _idbReady: true,
    idb: {
      async getAllPayloads(storeName) {
        if (storeName === 'clips') {
          return [
            { id: 'clip-a', text: 'deleted', category: 'General', timestamp: 1 },
            { id: 'clip-b', text: 'kept', category: 'General', timestamp: 2 },
          ];
        }
        return [];
      },
    },
  };

  try {
    const result = await fetchRawData(app);
    assert.equal(result.clips.length, 1);
    assert.equal(result.clips[0].id, 'clip-b');
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('fetchRawData prefers chrome.storage when IndexedDB has fewer live clips', async () => {
  const previousChrome = globalThis.chrome;
  installChromeStorageMock({
    clips: [
      { id: 'clip-a', text: 'one', category: 'General', timestamp: 1 },
      { id: 'clip-b', text: 'two', category: 'General', timestamp: 2 },
    ],
    categories: [],
    searchOnlyClips: [],
    pc_deleted_clips: [],
  });

  const app = {
    _idbReady: true,
    idb: {
      async getAllPayloads(storeName) {
        if (storeName === 'clips') {
          return [{ id: 'clip-a', text: 'one', category: 'General', timestamp: 1 }];
        }
        return [];
      },
    },
  };

  try {
    const result = await fetchRawData(app);
    assert.equal(result.clips.length, 2);
  } finally {
    globalThis.chrome = previousChrome;
  }
});
