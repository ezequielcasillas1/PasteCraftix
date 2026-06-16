import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areStorageValuesEqual,
  hasLocalStorageKeyConflict,
} from '../extension/supabase/storage-adapter.js';

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function installChromeStorageMock(initialState) {
  const state = cloneValue(initialState) || {};

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
          Object.assign(state, cloneValue(data));
          callback?.();
        },
      },
    },
  };

  return {
    readState() {
      return cloneValue(state);
    },
    write(key, value) {
      state[key] = cloneValue(value);
    },
    bumpUpdatedAt() {
      state.pc_local_updatedAt = Date.now();
    },
  };
}

test('per-key conflict ignores unrelated pc_local_updatedAt bumps', async () => {
  const previousChrome = globalThis.chrome;
  const clips = [{ id: 'clip-1', text: 'Example', timestamp: 1 }];

  try {
    const mock = installChromeStorageMock({ clips, pc_local_updatedAt: 100 });
    const conflictBefore = await hasLocalStorageKeyConflict('clips', clips);
    assert.equal(conflictBefore, false);

    mock.bumpUpdatedAt();
    const conflictAfter = await hasLocalStorageKeyConflict('clips', clips);
    assert.equal(conflictAfter, false);
    assert.deepEqual(mock.readState().clips, clips);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('per-key conflict detects same-key mutations during sync', async () => {
  const previousChrome = globalThis.chrome;
  const clips = [{ id: 'clip-1', text: 'Example', timestamp: 1 }];

  try {
    const mock = installChromeStorageMock({ clips });
    const conflictBefore = await hasLocalStorageKeyConflict('clips', clips);
    assert.equal(conflictBefore, false);

    mock.write('clips', [{ id: 'clip-2', text: 'New clip', timestamp: 2 }]);
    const conflictAfter = await hasLocalStorageKeyConflict('clips', clips);
    assert.equal(conflictAfter, true);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('areStorageValuesEqual treats equivalent clip arrays as equal', () => {
  const left = [{ id: 'clip-1', text: 'Example', meta: { tags: ['a'] } }];
  const right = [{ id: 'clip-1', text: 'Example', meta: { tags: ['a'] } }];
  assert.equal(areStorageValuesEqual(left, right), true);
});
