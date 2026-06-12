import assert from 'node:assert/strict';
import test from 'node:test';

import { storageAdapterMixin } from '../extension/supabase/storage-adapter.js';

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function installChromeStorageMock(initialState) {
  const state = cloneValue(initialState) || {};
  let setCalls = 0;

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            result[key] = cloneValue(state[key]);
          }
          callback(result);
        },
        set(data, callback) {
          setCalls += 1;
          Object.assign(state, cloneValue(data));
          callback?.();
        },
      },
    },
  };

  return {
    getSetCalls() {
      return setCalls;
    },
    readState() {
      return cloneValue(state);
    },
  };
}

test('storage adapter skips identical writes', async () => {
  const previousChrome = globalThis.chrome;
  const initial = {
    clips: [
      { id: 'clip-1', text: 'Example', meta: { tags: ['code'], score: 1 } },
    ],
  };

  try {
    const mock = installChromeStorageMock(initial);
    const didWrite = await storageAdapterMixin._safeStorageSet.call(
      { _saveToIdb: async () => {} },
      { clips: cloneValue(initial.clips) },
    );

    assert.equal(didWrite, false);
    assert.equal(mock.getSetCalls(), 0);
    assert.deepEqual(mock.readState(), initial);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('storage adapter writes changed values', async () => {
  const previousChrome = globalThis.chrome;

  try {
    const mock = installChromeStorageMock({
      settings: { theme: 'light', quickPasteSettings: { oneClickCopy: false } },
    });

    const didWrite = await storageAdapterMixin._safeStorageSet.call(
      { _saveToIdb: async () => {} },
      { settings: { theme: 'dark', quickPasteSettings: { oneClickCopy: true } } },
    );

    assert.equal(didWrite, true);
    assert.equal(mock.getSetCalls(), 1);
    assert.deepEqual(mock.readState(), {
      settings: { theme: 'dark', quickPasteSettings: { oneClickCopy: true } },
    });
  } finally {
    globalThis.chrome = previousChrome;
  }
});
