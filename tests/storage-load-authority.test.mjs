import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEntityLoadFromStores,
  shouldPreferChromeStorageForEntityLoad,
} from '../extension/shared/storage-load-authority.js';

test('prefers chrome.storage when pc_local_updatedAt is set (delete-all case)', () => {
  const prefer = shouldPreferChromeStorageForEntityLoad([], [], Date.now());
  assert.equal(prefer, true);

  const resolved = resolveEntityLoadFromStores({
    clips: [],
    categories: [],
    idbClips: [{ id: 'stale-1', text: 'ghost clip' }],
    idbCategories: [{ id: 'stale-cat', name: 'Ghost' }],
    pcLocalUpdatedAt: Date.now(),
  });

  assert.deepEqual(resolved.clips, []);
  assert.deepEqual(resolved.categories, []);
});

test('prefers chrome.storage when it has rows even without updatedAt marker', () => {
  const resolved = resolveEntityLoadFromStores({
    clips: [{ id: '1', text: 'live' }],
    categories: [],
    idbClips: [{ id: 'stale-1', text: 'ghost' }],
    idbCategories: [],
    pcLocalUpdatedAt: null,
  });

  assert.equal(resolved.clips.length, 1);
  assert.equal(resolved.clips[0].id, '1');
});

test('falls back to IDB when chrome.storage is empty and no updatedAt marker', () => {
  const resolved = resolveEntityLoadFromStores({
    clips: [],
    categories: [],
    idbClips: [{ id: 'idb-1', text: 'migrated' }],
    idbCategories: [{ id: 'idb-cat', name: 'Migrated' }],
    pcLocalUpdatedAt: null,
  });

  assert.equal(resolved.clips[0].id, 'idb-1');
  assert.equal(resolved.categories[0].id, 'idb-cat');
});
