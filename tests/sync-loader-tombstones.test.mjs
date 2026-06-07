/**
 * Run: node --test tests/sync-loader-tombstones.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterTombstonedEntities,
  preferIdbWhenLarger,
  tombstoneIdsFromList,
} from '../extension/popup/features/sync/sync.loader.js';

test('tombstoneIdsFromList normalizes ids to strings', () => {
  const ids = tombstoneIdsFromList([{ id: 42 }, { id: 'clip-a' }, { id: '' }]);
  assert.deepEqual(ids, new Set(['42', 'clip-a']));
});

test('filterTombstonedEntities removes tombstoned clips', () => {
  const deleted = new Set(['2']);
  const clips = [
    { id: 1, text: 'keep' },
    { id: 2, text: 'gone' },
    { id: '3', text: 'also keep' },
  ];
  const filtered = filterTombstonedEntities(clips, deleted);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((clip) => String(clip.id)), ['1', '3']);
});

test('preferIdbWhenLarger keeps chrome.storage when IDB is stale but larger', () => {
  const chromeClips = [{ id: '1' }, { id: '2' }];
  const idbClips = [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
  ];
  const deleted = new Set(['3', '4']);
  const idbFiltered = filterTombstonedEntities(idbClips, deleted);
  const chromeFiltered = filterTombstonedEntities(chromeClips, deleted);
  const chosen = preferIdbWhenLarger(idbFiltered, chromeFiltered);
  assert.equal(chosen.length, 2);
  assert.deepEqual(chosen.map((clip) => clip.id), ['1', '2']);
});

test('preferIdbWhenLarger uses IDB when it has more non-tombstoned rows', () => {
  const chromeClips = [{ id: '1' }];
  const idbClips = [{ id: '1' }, { id: '2' }];
  const chosen = preferIdbWhenLarger(idbClips, chromeClips);
  assert.equal(chosen.length, 2);
});
