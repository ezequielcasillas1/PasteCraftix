import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeActiveClipsSources,
  filterTombstonedClips,
  isClipTombstoned,
  buildClipTombstoneMap,
} from '../extension/shared/clips-local-merge.js';

test('mergeActiveClipsSources prefers newer local clip over stale IDB', () => {
  const local = [{ id: 'a', text: 'local', updatedAt: 200, timestamp: 200 }];
  const idb = [{ id: 'a', text: 'stale', updatedAt: 100, timestamp: 100 }];
  const merged = mergeActiveClipsSources(local, idb);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'local');
});

test('mergeActiveClipsSources drops tombstoned IDB clip when storage delete succeeded', () => {
  const local = [];
  const idb = [{ id: 'dead', text: 'ghost', updatedAt: 500, timestamp: 500 }];
  const tombstones = [{ id: 'dead', deletedAt: 600 }];
  const merged = mergeActiveClipsSources(local, idb, tombstones);
  assert.equal(merged.length, 0);
});

test('mergeActiveClipsSources keeps clip when edit is newer than tombstone', () => {
  const local = [{ id: 'revived', text: 'edited', updatedAt: 900, timestamp: 900 }];
  const idb = [];
  const tombstones = [{ id: 'revived', deletedAt: 800 }];
  const merged = mergeActiveClipsSources(local, idb, tombstones);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'edited');
});

test('mergeActiveClipsSources preserves legacy string clips when IDB has data', () => {
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
