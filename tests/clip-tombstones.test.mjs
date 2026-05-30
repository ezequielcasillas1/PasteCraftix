/**
 * @see extension/shared/clip-tombstones.js
 * Run: node --test tests/clip-tombstones.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendClipTombstones,
  pickClipsByIdKeys,
  CLIP_TOMBSTONE_KEYS,
} from '../extension/shared/clip-tombstones.js';

function mockChromeStorage() {
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach((k) => {
            if (store[k] !== undefined) out[k] = store[k];
          });
          cb(out);
        },
        set(patch, cb) {
          Object.assign(store, patch);
          if (cb) cb();
        },
      },
    },
  };
  return store;
}

test('pickClipsByIdKeys returns only matching clips', () => {
  const clips = [
    { id: 'a', text: 'one' },
    { id: 'b', text: 'two' },
  ];
  const picked = pickClipsByIdKeys(clips, ['b']);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].id, 'b');
});

test('appendClipTombstones writes pc_deleted_clips', async () => {
  const store = mockChromeStorage();
  await appendClipTombstones([{ id: 'x', text: 'deleted' }], { deletedAt: 1000 });
  assert.ok(Array.isArray(store[CLIP_TOMBSTONE_KEYS.ACTIVE]));
  assert.equal(store[CLIP_TOMBSTONE_KEYS.ACTIVE].length, 1);
  assert.equal(store[CLIP_TOMBSTONE_KEYS.ACTIVE][0].id, 'x');
  assert.equal(store[CLIP_TOMBSTONE_KEYS.ACTIVE][0].deletedAt, 1000);
});

test('appendClipTombstones dedupes by id', async () => {
  mockChromeStorage();
  await appendClipTombstones([{ id: 'z', text: 'a' }], { deletedAt: 1 });
  await appendClipTombstones([{ id: 'z', text: 'b' }], { deletedAt: 2 });
  const { [CLIP_TOMBSTONE_KEYS.ACTIVE]: tombs } = await new Promise((resolve) => {
    chrome.storage.local.get([CLIP_TOMBSTONE_KEYS.ACTIVE], resolve);
  });
  assert.equal(tombs.length, 1);
});
