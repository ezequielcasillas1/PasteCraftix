/**
 * Local-first merge utilities — clips and categories.
 * Run: node --test tests/local-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getClipMergeKey,
  getClipSortTime,
  mergeActiveClipsSources,
} from '../extension/shared/clips-local-merge.js';

import {
  getCategoryMergeKey,
  getCategorySortTime,
  mergeActiveCategoriesSources,
} from '../extension/shared/categories-local-merge.js';

describe('clips local merge', () => {
  test('getClipMergeKey accepts id, clip_id, and clipId', () => {
    assert.equal(getClipMergeKey({ id: 'a' }), 'a');
    assert.equal(getClipMergeKey({ clip_id: 'b' }), 'b');
    assert.equal(getClipMergeKey({ clipId: 'c' }), 'c');
    assert.equal(getClipMergeKey(null), '');
  });

  test('getClipSortTime prefers updatedAt over timestamp', () => {
    assert.equal(getClipSortTime({ updatedAt: 200, timestamp: 100 }), 200);
    assert.equal(getClipSortTime({ updated_at: 150, timestamp: 100 }), 150);
    assert.equal(getClipSortTime({ timestamp: 99 }), 99);
    assert.equal(getClipSortTime(null), 0);
  });

  test('mergeActiveClipsSources keeps newer local record for same id', () => {
    const idb = [{ id: '1', text: 'old', updatedAt: 100 }];
    const local = [{ id: '1', text: 'fresh', updatedAt: 200 }];

    const merged = mergeActiveClipsSources(local, idb);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].text, 'fresh');
  });

  test('mergeActiveClipsSources keeps newer idb record when local is stale', () => {
    const idb = [{ id: '1', text: 'cloud', updatedAt: 300 }];
    const local = [{ id: '1', text: 'stale', updatedAt: 100 }];

    const merged = mergeActiveClipsSources(local, idb);

    assert.equal(merged[0].text, 'cloud');
  });

  test('mergeActiveClipsSources unions distinct ids and sorts newest first', () => {
    const idb = [
      { id: 'a', text: 'a', updatedAt: 100 },
      { id: 'b', text: 'b', updatedAt: 50 },
    ];
    const local = [{ id: 'c', text: 'c', updatedAt: 200 }];

    const merged = mergeActiveClipsSources(local, idb);

    assert.deepEqual(merged.map((clip) => clip.id), ['c', 'a', 'b']);
  });

  test('mergeActiveClipsSources returns copy of sole source when other is empty', () => {
    const local = [{ id: '1', text: 'only-local' }];
    const fromLocal = mergeActiveClipsSources(local, []);
    const fromIdb = mergeActiveClipsSources([], local);

    assert.notEqual(fromLocal, local);
    assert.deepEqual(fromLocal, local);
    assert.deepEqual(fromIdb, local);
  });

  test('mergeActiveClipsSources skips entries without merge key', () => {
    const merged = mergeActiveClipsSources([{ text: 'no-id' }], [{ id: '1', text: 'ok' }]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, '1');
  });
});

describe('categories local merge', () => {
  test('getCategoryMergeKey accepts id aliases', () => {
    assert.equal(getCategoryMergeKey({ id: 'x' }), 'x');
    assert.equal(getCategoryMergeKey({ category_id: 'y' }), 'y');
    assert.equal(getCategoryMergeKey({ categoryId: 'z' }), 'z');
  });

  test('getCategorySortTime prefers updatedAt then createdAt then id', () => {
    assert.equal(getCategorySortTime({ updatedAt: 300, createdAt: 100, id: 1 }), 300);
    assert.equal(getCategorySortTime({ created_at: 120, id: 1 }), 120);
    assert.equal(getCategorySortTime({ id: 42 }), 42);
  });

  test('mergeActiveCategoriesSources keeps newer local category', () => {
    const idb = [{ id: 'cat-1', name: 'Old', updatedAt: 10 }];
    const local = [{ id: 'cat-1', name: 'New', updatedAt: 20 }];

    const merged = mergeActiveCategoriesSources(local, idb);

    assert.equal(merged[0].name, 'New');
  });

  test('mergeActiveCategoriesSources keeps newer record regardless of source', () => {
    const idb = [{ id: '1', name: 'A', updatedAt: 100 }];
    const local = [
      { id: '2', name: 'B', updatedAt: 300 },
      { id: '1', name: 'A-new', updatedAt: 200 },
    ];

    const merged = mergeActiveCategoriesSources(local, idb);

    assert.deepEqual(
      merged.map((category) => category.id),
      ['2', '1'],
    );
    assert.equal(merged[1].name, 'A-new');
  });
});
