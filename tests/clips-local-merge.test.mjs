/**
 * Run: node --test tests/clips-local-merge.test.mjs
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  getClipMergeKey,
  getClipSortTime,
  mergeActiveClipsSources,
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

  test('merge skips clips without ids when unioning sources', () => {
    const idb = [{ text: 'orphan-idb' }, { id: 'ok', text: 'kept', updatedAt: 1 }];
    const local = [{ text: 'orphan-local' }];
    const merged = mergeActiveClipsSources(local, idb);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'ok');
  });

  test('merge handles empty and non-array inputs', () => {
    assert.deepEqual(mergeActiveClipsSources([], []), []);
    assert.deepEqual(mergeActiveClipsSources(null, [{ id: 'x', updatedAt: 1 }]), [{ id: 'x', updatedAt: 1 }]);
    assert.deepEqual(mergeActiveClipsSources([{ id: 'y', updatedAt: 2 }], null), [{ id: 'y', updatedAt: 2 }]);
  });
});
