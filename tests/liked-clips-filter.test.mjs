import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getClipIdKey } from '../extension/shared/clip-id.js';
import { filterLikedClips, normalizeLikedClipId } from '../extension/shared/liked-clips.js';

test('normalizeLikedClipId matches getClipIdKey for float clip ids', () => {
  const samples = [
    1783808104361.236,
    1783808104362.058,
    1783808104362.975,
    '1783808104361.236',
    '1783808104362.058',
    crypto.randomUUID(),
    42,
    'uuid-style-id',
  ];
  for (const id of samples) {
    assert.equal(normalizeLikedClipId(id), getClipIdKey(id), `id=${id}`);
  }
});

test('filterLikedClips finds float clips when liked via getClipIdKey', () => {
  const floatId = 1783808104361.236;
  const likedKey = getClipIdKey(floatId);
  assert.notEqual(likedKey, String(floatId), 'precondition: key differs from String(id)');

  const clips = [
    { id: floatId, text: 'number form' },
    { id: String(floatId), text: 'string form' },
  ];
  const matched = filterLikedClips(clips, [likedKey]);
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map((c) => c.text).sort(), ['number form', 'string form']);
});

test('filterLikedClips finds clips when liked ids were stored as plain String', () => {
  const floatId = 1783808104361.236;
  const clips = [{ id: floatId, text: 'hello' }];
  const matched = filterLikedClips(clips, [String(floatId)]);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].text, 'hello');
});

test('filterLikedClips still matches uuid clip ids', () => {
  const id = 'f3a40716-7f66-41aa-9850-6b2d81e4c2dc';
  const clips = [{ id, text: 'uuid clip' }];
  assert.equal(filterLikedClips(clips, [id]).length, 1);
  assert.equal(filterLikedClips(clips, [getClipIdKey(id)]).length, 1);
});
