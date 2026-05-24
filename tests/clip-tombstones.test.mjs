/**
 * Run: node --test tests/clip-tombstones.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const storage = new Map();

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const out = {};
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((k) => {
          if (storage.has(k)) out[k] = storage.get(k);
        });
        return out;
      },
      async set(data) {
        Object.entries(data).forEach(([k, v]) => storage.set(k, v));
      },
    },
  },
};

const { recordClipDeletionTombstones } = await import('../extension/shared/clip-tombstones.js');

test('recordClipDeletionTombstones writes local tombstones and sync queue', async () => {
  storage.clear();
  await recordClipDeletionTombstones({
    activeIds: [{
      id: 'clip-1',
      text: 'hello',
      category: 'Work',
      timestamp: 1000,
    }],
  });

  const local = await chrome.storage.local.get(['pc_deleted_clips', 'syncQueue']);
  assert.equal(local.pc_deleted_clips.length, 1);
  assert.equal(local.pc_deleted_clips[0].id, 'clip-1');
  assert.equal(local.syncQueue.length, 1);
  assert.equal(local.syncQueue[0].type, 'syncDeletedClips');
  assert.equal(local.syncQueue[0].data[0].text, 'hello');
});
