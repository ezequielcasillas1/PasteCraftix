/**
 * Run: node --test tests/local-merge.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCategoryMergeKey,
  getCategorySortTime,
  mergeActiveCategoriesSources,
} from '../extension/shared/categories-local-merge.js';
import {
  getClipMergeKey,
  getClipSortTime,
  mergeActiveClipsSources,
} from '../extension/shared/clips-local-merge.js';

test('getClipMergeKey resolves id aliases', () => {
  assert.equal(getClipMergeKey({ id: 'clip-a' }), 'clip-a');
  assert.equal(getClipMergeKey({ clip_id: 'clip-b' }), 'clip-b');
  assert.equal(getClipMergeKey({ clipId: 'clip-c' }), 'clip-c');
  assert.equal(getClipMergeKey(null), '');
});

test('getClipSortTime prefers updatedAt over timestamp', () => {
  assert.equal(getClipSortTime({ updatedAt: 500, timestamp: 100 }), 500);
  assert.equal(getClipSortTime({ updated_at: 700 }), 700);
  assert.equal(getClipSortTime({ timestamp: 300 }), 300);
  assert.equal(getClipSortTime({}), 0);
});

test('mergeActiveClipsSources returns local when idb is empty', () => {
  const local = [{ id: '1', text: 'alpha', updatedAt: 10 }];
  assert.deepEqual(mergeActiveClipsSources(local, []), local);
});

test('mergeActiveClipsSources returns idb when local is empty', () => {
  const idb = [{ id: '1', text: 'beta', updatedAt: 10 }];
  assert.deepEqual(mergeActiveClipsSources([], idb), idb);
});

test('mergeActiveClipsSources keeps fresher local clip for same id', () => {
  const local = [{ id: '1', text: 'fresh local', updatedAt: 200 }];
  const idb = [{ id: '1', text: 'stale idb', updatedAt: 100 }];

  const merged = mergeActiveClipsSources(local, idb);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'fresh local');
});

test('mergeActiveClipsSources keeps fresher idb clip when idb is newer', () => {
  const local = [{ id: '1', text: 'stale local', updatedAt: 50 }];
  const idb = [{ id: '1', text: 'fresh idb', updatedAt: 150 }];

  const merged = mergeActiveClipsSources(local, idb);

  assert.equal(merged[0].text, 'fresh idb');
});

test('mergeActiveClipsSources unions clips by id and sorts newest first', () => {
  const local = [
    { id: '1', text: 'one', updatedAt: 100 },
    { id: '2', text: 'two-local', updatedAt: 300 },
  ];
  const idb = [
    { id: '2', text: 'two-idb', updatedAt: 200 },
    { id: '3', text: 'three', updatedAt: 50 },
  ];

  const merged = mergeActiveClipsSources(local, idb);

  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((clip) => clip.id), ['2', '1', '3']);
  assert.equal(merged[0].text, 'two-local');
});

test('mergeActiveClipsSources skips local clips without id', () => {
  const local = [{ text: 'orphan' }, { id: '1', text: 'kept', updatedAt: 10 }];
  const idb = [{ id: '2', text: 'idb', updatedAt: 5 }];

  const merged = mergeActiveClipsSources(local, idb);

  assert.equal(merged.length, 2);
  assert.ok(merged.some((clip) => clip.id === '1'));
  assert.ok(merged.some((clip) => clip.id === '2'));
});

test('getCategoryMergeKey resolves id aliases', () => {
  assert.equal(getCategoryMergeKey({ id: 'cat-a' }), 'cat-a');
  assert.equal(getCategoryMergeKey({ category_id: 'cat-b' }), 'cat-b');
  assert.equal(getCategoryMergeKey({ categoryId: 'cat-c' }), 'cat-c');
});

test('getCategorySortTime prefers updatedAt then createdAt then id', () => {
  assert.equal(getCategorySortTime({ updatedAt: 900, createdAt: 100, id: 1 }), 900);
  assert.equal(getCategorySortTime({ created_at: 400, id: 2 }), 400);
  assert.equal(getCategorySortTime({ id: 7 }), 7);
});

test('mergeActiveCategoriesSources keeps fresher local category for same id', () => {
  const local = [{ id: 'work', name: 'Work', updatedAt: 500 }];
  const idb = [{ id: 'work', name: 'Work (stale)', updatedAt: 100 }];

  const merged = mergeActiveCategoriesSources(local, idb);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, 'Work');
});

test('mergeActiveCategoriesSources unions categories and sorts newest first', () => {
  const local = [{ id: 'a', name: 'A', updatedAt: 100 }];
  const idb = [
    { id: 'b', name: 'B', updatedAt: 300 },
    { id: 'c', name: 'C', updatedAt: 50 },
  ];

  const merged = mergeActiveCategoriesSources(local, idb);

  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((category) => category.id), ['b', 'a', 'c']);
});
