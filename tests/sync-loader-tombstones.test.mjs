import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchRawData } from '../extension/popup/features/sync/sync.loader.js';

function installChromeStorageMock(state) {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            result[key] = structuredClone(state[key]);
          }
          if (typeof callback === 'function') {
            callback(result);
            return;
          }
          return Promise.resolve(result);
        },
        set() {},
      },
    },
  };
  return () => {
    globalThis.chrome = previousChrome;
  };
}

test('fetchRawData filters tombstoned clips from chrome.storage and IDB', async () => {
  const restoreChrome = installChromeStorageMock({
    clips: [{ id: 'alive', text: 'keep me' }],
    categories: [{ id: 'cat-alive', name: 'Work' }],
    searchOnlyClips: [{ id: 'arch-alive', text: 'archive' }],
    pc_deleted_clips: [{ id: 'dead', deletedAt: Date.now() }],
    pc_deleted_categories: [{ id: 'cat-dead', deletedAt: Date.now() }],
    pc_deleted_archived_clips: [{ id: 'arch-dead', deletedAt: Date.now() }],
  });

  const app = {
    _idbReady: true,
    idb: {
      async getAllPayloads(store) {
        if (store === 'clips') {
          return [
            { id: 'alive', text: 'keep me' },
            { id: 'dead', text: 'stale idb copy' },
          ];
        }
        if (store === 'categories') {
          return [
            { id: 'cat-alive', name: 'Work' },
            { id: 'cat-dead', name: 'Stale category' },
          ];
        }
        return [];
      },
    },
  };

  try {
    const { clips, categories, searchOnlyClips } = await fetchRawData(app);
    assert.deepEqual(clips.map((clip) => clip.id), ['alive']);
    assert.deepEqual(categories.map((category) => category.id), ['cat-alive']);
    assert.deepEqual(searchOnlyClips.map((clip) => clip.id), ['arch-alive']);
  } finally {
    restoreChrome();
  }
});
