import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeActiveCategoriesSources,
  filterTombstonedCategories,
} from '../extension/shared/categories-local-merge.js';

test('mergeActiveCategoriesSources prefers newer local category', () => {
  const local = [{ id: '1', name: 'Local', updatedAt: 200 }];
  const idb = [{ id: '1', name: 'Stale', updatedAt: 100 }];
  const merged = mergeActiveCategoriesSources(local, idb);
  assert.equal(merged[0].name, 'Local');
});

test('mergeActiveCategoriesSources drops tombstoned IDB category', () => {
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
