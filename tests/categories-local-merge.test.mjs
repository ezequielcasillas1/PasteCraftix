/**
 * Run: node --test tests/categories-local-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  getCategoryMergeKey,
  getCategorySortTime,
  mergeActiveCategoriesSources,
  filterTombstonedCategories,
} from '../extension/shared/categories-local-merge.js';

describe('categories local merge', () => {
  test('getCategoryMergeKey resolves id aliases', () => {
    assert.equal(getCategoryMergeKey({ id: '1' }), '1');
    assert.equal(getCategoryMergeKey({ category_id: '2' }), '2');
    assert.equal(getCategoryMergeKey({ categoryId: '3' }), '3');
    assert.equal(getCategoryMergeKey(undefined), '');
  });

  test('getCategorySortTime prefers updatedAt then createdAt', () => {
    assert.equal(getCategorySortTime({ updatedAt: 500, createdAt: 100 }), 500);
    assert.equal(getCategorySortTime({ created_at: 200 }), 200);
    assert.equal(getCategorySortTime({ id: 42 }), 42);
  });

  test('merge keeps fresher local category over stale IDB copy', () => {
    const idb = [{ id: 'cat-1', name: 'Old', updatedAt: 100 }];
    const local = [{ id: 'cat-1', name: 'Fresh', updatedAt: 250 }];
    const merged = mergeActiveCategoriesSources(local, idb);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].name, 'Fresh');
  });

  test('merge unions distinct categories from both sources', () => {
    const idb = [{ id: 'a', name: 'IDB', updatedAt: 10 }];
    const local = [{ id: 'b', name: 'Local', updatedAt: 20 }];
    const merged = mergeActiveCategoriesSources(local, idb);
    assert.equal(merged.length, 2);
  });

  test('merge sorts categories newest first when both sources present', () => {
    const idb = [{ id: 'slow', updatedAt: 5 }];
    const local = [{ id: 'fast', updatedAt: 500 }];
    const merged = mergeActiveCategoriesSources(local, idb);
    assert.equal(merged[0].id, 'fast');
    assert.equal(merged[1].id, 'slow');
  });

  test('merge handles empty inputs', () => {
    assert.deepEqual(mergeActiveCategoriesSources([], []), []);
    assert.deepEqual(
      mergeActiveCategoriesSources(null, [{ id: 'x', updatedAt: 1 }]),
      [{ id: 'x', updatedAt: 1 }],
    );
  });

  test('merge drops tombstoned IDB category', () => {
    const local = [];
    const idb = [{ id: 'gone', name: 'Ghost', updatedAt: 300 }];
    const tombstones = [{ id: 'gone', deletedAt: 400 }];
    const merged = mergeActiveCategoriesSources(local, idb, tombstones);
    assert.equal(merged.length, 0);
  });

  test('filterTombstonedCategories keeps categories without tombstone match', () => {
    const categories = [{ id: 'ok', name: 'Keep', updatedAt: 1 }];
    assert.equal(filterTombstonedCategories(categories, [{ id: 'other', deletedAt: 9 }]).length, 1);
  });
});
