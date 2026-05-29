import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTombstonedClips, getClipIdKey } from '../extension/shared/clip-tombstones.js';

test('getClipIdKey stringifies ids', () => {
  assert.equal(getClipIdKey(42), '42');
  assert.equal(getClipIdKey('abc'), 'abc');
});

test('filterTombstonedClips removes tombstoned ids', () => {
  const deleted = new Set(['1', '3']);
  const clips = [
    { id: 1, text: 'a' },
    { id: 2, text: 'b' },
    { id: '3', text: 'c' },
  ];
  const out = filterTombstonedClips(clips, deleted);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test('filterTombstonedClips is no-op without tombstones', () => {
  const clips = [{ id: 1, text: 'a' }];
  assert.deepEqual(filterTombstonedClips(clips, new Set()), clips);
});
