import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeFreshLocalForFullSync } from '../extension/shared/full-sync-guard.js';

function installChromeStorageMock(initialState) {
  const state = structuredClone(initialState);

  globalThis.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            result[key] = structuredClone(state[key]);
          }
          callback(result);
        },
      },
    },
  };

  return {
    patch(key, value) {
      state[key] = structuredClone(value);
    },
  };
}

test('full sync guard skips when local changed after snapshot', async () => {
  const previousChrome = globalThis.chrome;

  try {
    installChromeStorageMock({
      categories: [{ id: 1, name: 'Work' }],
      pc_local_updatedAt: 200,
    });

    const result = await mergeFreshLocalForFullSync({
      storageKey: 'categories',
      fallbackLocal: [{ id: 1, name: 'Work' }],
      remoteData: [{ id: 2, name: 'Remote' }],
      mergeFn: async (local, remote) => [...local, ...remote],
      hasNewerLocalWrites: async () => true,
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'newer-local-before-merge');
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('full sync guard re-reads fresh local before merge write', async () => {
  const previousChrome = globalThis.chrome;

  try {
    const mock = installChromeStorageMock({
      categories: [
        { id: 1, name: 'Work' },
        { id: 2, name: 'Created during sync', updatedAt: 150 },
      ],
      pc_local_updatedAt: 100,
    });

    const result = await mergeFreshLocalForFullSync({
      storageKey: 'categories',
      fallbackLocal: [{ id: 1, name: 'Work' }],
      remoteData: [{ id: 3, name: 'Remote' }],
      mergeFn: async (local, remote) => {
        const byId = new Map();
        for (const item of [...local, ...remote]) {
          byId.set(String(item.id), item);
        }
        return Array.from(byId.values());
      },
      hasNewerLocalWrites: async () => false,
    });

    assert.equal(result.skipped, false);
    assert.deepEqual(
      result.merged.map((item) => item.id).sort(),
      [1, 2, 3],
    );
    assert.ok(result.merged.some((item) => item.name === 'Created during sync'));

    mock.patch('categories', [{ id: 99, name: 'Late edit' }]);
    const late = await mergeFreshLocalForFullSync({
      storageKey: 'categories',
      fallbackLocal: [{ id: 1, name: 'Work' }],
      remoteData: [{ id: 3, name: 'Remote' }],
      mergeFn: async (local, remote) => [...local, ...remote],
      hasNewerLocalWrites: async () => false,
    });

    assert.equal(late.skipped, false);
    assert.equal(late.merged[0].id, 99);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('full sync guard skips late local edit detected after merge', async () => {
  const previousChrome = globalThis.chrome;

  try {
    installChromeStorageMock({
      clips: [{ id: 'a', text: 'one' }],
      pc_local_updatedAt: 100,
    });

    let checks = 0;
    const result = await mergeFreshLocalForFullSync({
      storageKey: 'clips',
      fallbackLocal: [{ id: 'a', text: 'one' }],
      remoteData: [{ id: 'b', text: 'two' }],
      mergeFn: async (local, remote) => [...local, ...remote],
      hasNewerLocalWrites: async () => {
        checks += 1;
        return checks > 1;
      },
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'newer-local-after-merge');
  } finally {
    globalThis.chrome = previousChrome;
  }
});
