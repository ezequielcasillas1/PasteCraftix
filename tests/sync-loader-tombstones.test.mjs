/**
 * Run: node --test tests/sync-loader-tombstones.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectTombstoneIds,
  filterTombstonedEntities,
} from '../extension/popup/features/sync/sync.loader.js';

test('collectTombstoneIds merges tombstone lists', () => {
  const ids = collectTombstoneIds([
    [{ id: 1 }, { id: '2' }],
    [{ id: '2' }, { id: 3 }],
  ]);
  assert.deepEqual([...ids].sort(), ['1', '2', '3']);
});

test('filterTombstonedEntities removes tombstoned clips before IDB merge', () => {
  const clips = [
    { id: 10, text: 'keep' },
    { id: 20, text: 'deleted' },
  ];
  const deleted = collectTombstoneIds([[{ id: 20 }]]);
  const filtered = filterTombstonedEntities(clips, deleted);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 10);
});

test('filterTombstonedEntities keeps archived clips not in archived tombstones', () => {
  const archived = [{ id: 'a1', text: 'archived' }];
  const deleted = collectTombstoneIds([[{ id: 'other' }]]);
  assert.equal(filterTombstonedEntities(archived, deleted).length, 1);
});
