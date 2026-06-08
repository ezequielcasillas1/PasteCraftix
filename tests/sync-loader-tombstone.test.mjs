/**
 * Run: node --test tests/sync-loader-tombstone.test.mjs
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loaderUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/sync/sync.loader.js')
).href;

const { fetchRawData } = await import(loaderUrl);

function createChromeStorage() {
  const data = {};
  return {
    data,
    get(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result = {};
      keyList.forEach((key) => {
        if (data[key] !== undefined) result[key] = data[key];
      });
      return Promise.resolve(result);
    },
    set(patch) {
      Object.assign(data, patch);
      return Promise.resolve();
    },
  };
}

function createApp(idbPayloads) {
  return {
    _idbReady: true,
    idb: {
      async getAllPayloads(storeName) {
        return Array.isArray(idbPayloads[storeName]) ? idbPayloads[storeName] : [];
      },
    },
  };
}

describe('sync.loader fetchRawData tombstone + IDB merge', () => {
  let storage;

  beforeEach(() => {
    storage = createChromeStorage();
    globalThis.chrome = {
      runtime: { id: 'test-extension' },
      storage: { local: storage },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test('filters tombstoned clips from IndexedDB', async () => {
    storage.data.clips = [{ id: 'keep', text: 'ok' }];
    storage.data.pc_deleted_clips = [{ id: 'gone', deletedAt: Date.now() }];
    const app = createApp({
      clips: [
        { id: 'keep', text: 'ok' },
        { id: 'gone', text: 'deleted but still in IDB' },
      ],
    });

    const raw = await fetchRawData(app);
    assert.equal(raw.clips.length, 1);
    assert.equal(raw.clips[0].id, 'keep');
  });

  test('prefers chrome.storage when it has more non-tombstoned clips after sync', async () => {
    storage.data.clips = [
      { id: 'a', text: 'one' },
      { id: 'b', text: 'two' },
      { id: 'c', text: 'three' },
    ];
    const app = createApp({
      clips: [
        { id: 'a', text: 'one' },
        { id: 'b', text: 'two' },
      ],
    });

    const raw = await fetchRawData(app);
    assert.equal(raw.clips.length, 3);
    assert.deepEqual(raw.clips.map((clip) => clip.id), ['a', 'b', 'c']);
  });

  test('filters tombstoned categories from chrome.storage', async () => {
    storage.data.categories = [
      { id: 'work', name: 'Work' },
      { id: 'old', name: 'Old' },
    ];
    storage.data.pc_deleted_categories = [{ id: 'old', deletedAt: Date.now() }];
    const app = createApp({ categories: [{ id: 'old', name: 'Old' }] });

    const raw = await fetchRawData(app);
    assert.equal(raw.categories.length, 1);
    assert.equal(raw.categories[0].id, 'work');
  });

  test('uses IndexedDB when it has more non-tombstoned items', async () => {
    storage.data.clips = [{ id: 'a', text: 'one' }];
    const app = createApp({
      clips: [
        { id: 'a', text: 'one' },
        { id: 'b', text: 'two' },
      ],
    });

    const raw = await fetchRawData(app);
    assert.equal(raw.clips.length, 2);
    assert.deepEqual(raw.clips.map((clip) => clip.id), ['a', 'b']);
  });
});
