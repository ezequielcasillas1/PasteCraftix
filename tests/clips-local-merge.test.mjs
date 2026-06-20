/**
 * Run: node --test tests/clips-local-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  getClipMergeKey,
  getClipSortTime,
  mergeActiveClipsSources,
  filterTombstonedClips,
  isClipTombstoned,
  buildClipTombstoneMap,
} from '../extension/shared/clips-local-merge.js';

describe('clips local merge', () => {
  test('getClipMergeKey resolves id aliases', () => {
    assert.equal(getClipMergeKey({ id: 'a' }), 'a');
    assert.equal(getClipMergeKey({ clip_id: 'b' }), 'b');
    assert.equal(getClipMergeKey({ clipId: 'c' }), 'c');
    assert.equal(getClipMergeKey(null), '');
    assert.equal(getClipMergeKey({ text: 'no id' }), '');
  });

  test('getClipSortTime prefers updatedAt over timestamp', () => {
    assert.equal(getClipSortTime({ updatedAt: 500, timestamp: 100 }), 500);
    assert.equal(getClipSortTime({ updated_at: 600 }), 600);
    assert.equal(getClipSortTime({ timestamp: 200 }), 200);
    assert.equal(getClipSortTime(null), 0);
  });

  test('merge keeps fresher local clip over stale IDB copy', () => {
    const idb = [{ id: '1', text: 'old', updatedAt: 100 }];
    const local = [{ id: '1', text: 'fresh', updatedAt: 200 }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].text, 'fresh');
  });

  test('merge keeps fresher IDB clip when local is older', () => {
    const idb = [{ id: '1', text: 'idb-new', updatedAt: 300 }];
    const local = [{ id: '1', text: 'local-old', updatedAt: 100 }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged[0].text, 'idb-new');
  });

  test('merge unions distinct ids from both sources', () => {
    const idb = [{ id: 'a', text: 'from-idb', updatedAt: 50 }];
    const local = [{ id: 'b', text: 'from-local', updatedAt: 60 }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((c) => c.id).sort(),
      ['a', 'b'],
    );
  });

  test('merge sorts by newest first when both sources present', () => {
    const idb = [{ id: 'old', updatedAt: 10 }, { id: 'new', updatedAt: 99 }];
    const local = [{ id: 'mid', updatedAt: 50 }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged[0].id, 'new');
    assert.equal(merged[1].id, 'mid');
    assert.equal(merged[2].id, 'old');
  });

  test('merge keeps keyless local clips and idb rows with ids', () => {
    const idb = [{ text: 'orphan-idb' }, { id: 'ok', text: 'kept', updatedAt: 1 }];
    const local = [{ text: 'orphan-local' }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged.length, 2);
    assert.equal(merged.some((clip) => clip.text === 'orphan-local'), true);
    assert.equal(merged.some((clip) => clip.id === 'ok'), true);
  });

  test('merge handles empty and non-array inputs', () => {
    assert.deepEqual(mergeActiveClipsSources([], []), []);
    assert.deepEqual(mergeActiveClipsSources(null, [{ id: 'x', updatedAt: 1 }]), [{ id: 'x', updatedAt: 1 }]);
    assert.deepEqual(mergeActiveClipsSources([{ id: 'y', updatedAt: 2 }], null), [{ id: 'y', updatedAt: 2 }]);
  });

  test('merge drops tombstoned IDB clip when storage delete succeeded', () => {
    const local = [];
    const idb = [{ id: 'dead', text: 'ghost', updatedAt: 500, timestamp: 500 }];
    const tombstones = [{ id: 'dead', deletedAt: 600 }];
    const merged = mergeActiveClipsSources(local, idb, tombstones);
    assert.equal(merged.length, 0);
  });

  test('merge keeps clip when edit is newer than tombstone', () => {
    const local = [{ id: 'revived', text: 'edited', updatedAt: 900, timestamp: 900 }];
    const idb = [];
    const tombstones = [{ id: 'revived', deletedAt: 800 }];
    const merged = mergeActiveClipsSources(local, idb, tombstones);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].text, 'edited');
  });

  test('merge preserves legacy string clips when IDB has data', () => {
    const local = ['legacy note'];
    const idb = [{ id: 'x', text: 'idb clip', updatedAt: 100, timestamp: 100 }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged.length, 2);
    assert.equal(merged.some((clip) => clip === 'legacy note'), true);
  });

  test('isClipTombstoned respects deletedAt vs updatedAt ordering', () => {
    const map = buildClipTombstoneMap([{ id: '1', deletedAt: 1000 }]);
    assert.equal(isClipTombstoned({ id: '1', updatedAt: 999 }, map), true);
    assert.equal(isClipTombstoned({ id: '1', updatedAt: 1000 }, map), true);
    assert.equal(isClipTombstoned({ id: '1', updatedAt: 1001 }, map), false);
  });

  test('filterTombstonedClips is a no-op without tombstones', () => {
    const clips = [{ id: '1', text: 'a' }];
    assert.deepEqual(filterTombstonedClips(clips, []), clips);
  });
});

