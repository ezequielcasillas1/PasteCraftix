/**
 * mergeClips / mergeArchivedClips must not collapse distinct clips that share text.
 * Run: node --test tests/merge-clips.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncClipsMixin } from '../extension/supabase/sync-clips.js';

globalThis.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const k of keyList) {
          if (k === 'pc_deleted_clips' || k === 'pc_deleted_archived_clips') out[k] = [];
        }
        cb(out);
      },
    },
  },
};

const merger = { ...syncClipsMixin };

test('mergeClips keeps two clips with same text but different ids', async () => {
  const text = 'duplicate body text';
  const localClips = [
    { id: 'clip-a', text, category: 'Quick', timestamp: 1000, updatedAt: 1000 },
    { id: 'clip-b', text, category: 'Quick', timestamp: 1000, updatedAt: 1000 },
  ];
  const remoteClips = [];

  const merged = await merger.mergeClips(localClips, remoteClips);
  assert.equal(merged.length, 2);
  const ids = new Set(merged.map((c) => String(c.id)));
  assert.ok(ids.has('clip-a'));
  assert.ok(ids.has('clip-b'));
});

test('mergeArchivedClips keeps two archived clips with same text but different ids', async () => {
  const text = 'archived duplicate';
  const localArchived = [
    { id: 'arch-a', text, category: 'Quick', timestamp: 2000, updatedAt: 2000 },
    { id: 'arch-b', text, category: 'Quick', timestamp: 2000, updatedAt: 2000 },
  ];

  const merged = await merger.mergeArchivedClips(localArchived, []);
  assert.equal(merged.length, 2);
});

test('mergeClips still collapses legacy clips without ids in same content bucket', async () => {
  const text = 'legacy only';
  const localClips = [
    { text, category: 'Quick', timestamp: 5000, updatedAt: 5000 },
    { text, category: 'Quick', timestamp: 5001, updatedAt: 5001 },
  ];

  const merged = await merger.mergeClips(localClips, []);
  assert.equal(merged.length, 1);
});
