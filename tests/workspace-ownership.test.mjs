import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  assertWorkspaceOwnerForSync,
  canMergeOrUploadForOwner,
  clearWorkspaceLibrary,
  ensureWorkspaceOwner,
  getWorkspaceOwnerUserId,
  resolveOwnershipDecision,
  WORKSPACE_LIBRARY_KEYS,
  WORKSPACE_OWNER_KEY,
  WORKSPACE_OWNERSHIP_ACTIONS,
} from '../extension/bridges/workspace/workspace.facade.js';

const originals = {
  chrome: globalThis.chrome,
  pasteCraftIndexedDB: globalThis.pasteCraftIndexedDB,
  pasteCraftSupabase: globalThis.pasteCraftSupabase,
};

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function installChromeStorageMock({ local = {}, sync = {} } = {}) {
  const localState = cloneValue(local);
  const syncState = cloneValue(sync);

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            result[key] = cloneValue(localState[key]);
          }
          callback(result);
        },
        set(data, callback) {
          Object.assign(localState, cloneValue(data));
          callback?.();
        },
        remove(keys, callback) {
          for (const key of keys) delete localState[key];
          callback?.();
        },
      },
      sync: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            result[key] = cloneValue(syncState[key]);
          }
          callback(result);
        },
      },
    },
  };

  return {
    readLocal: () => cloneValue(localState),
  };
}

afterEach(() => {
  globalThis.chrome = originals.chrome;
  globalThis.pasteCraftIndexedDB = originals.pasteCraftIndexedDB;
  globalThis.pasteCraftSupabase = originals.pasteCraftSupabase;
});

test('owner mismatch resolves to clear-and-bind (not merge)', () => {
  const decision = resolveOwnershipDecision({
    stamp: 'user-a',
    sessionUserId: 'user-b',
  });
  assert.equal(decision.action, WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_AND_BIND);
  assert.equal(decision.reason, 'owner-mismatch');
  assert.equal(canMergeOrUploadForOwner('user-a', 'user-b'), false);
});

test('matching stamp allows merge/upload', () => {
  const decision = resolveOwnershipDecision({
    stamp: 'user-a',
    sessionUserId: 'user-a',
  });
  assert.equal(decision.action, WORKSPACE_OWNERSHIP_ACTIONS.OK);
  assert.equal(canMergeOrUploadForOwner('user-a', 'user-a'), true);
});

test('missing stamp with guest leftovers clears before bind', () => {
  const decision = resolveOwnershipDecision({
    stamp: null,
    sessionUserId: 'user-b',
    legacyAccountUserId: null,
  });
  assert.equal(decision.action, WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_AND_BIND);
  assert.equal(decision.reason, 'stamp-missing');
});

test('legacy accountUserId match binds without clear', () => {
  const decision = resolveOwnershipDecision({
    stamp: null,
    sessionUserId: 'user-a',
    legacyAccountUserId: 'user-a',
  });
  assert.equal(decision.action, WORKSPACE_OWNERSHIP_ACTIONS.BIND_ONLY);
});

test('ensureWorkspaceOwner clears foreign clips and stamps new owner', async () => {
  const mock = installChromeStorageMock({
    local: {
      [WORKSPACE_OWNER_KEY]: 'user-a',
      clips: [{ id: 'a1', text: 'secret-a' }],
      categories: [{ id: 'c1', name: 'A' }],
      notes: [{ id: 'n1' }],
      syncQueue: [{ type: 'syncClips', data: [] }],
      theme: 'dark',
    },
  });

  const result = await ensureWorkspaceOwner('user-b');
  assert.equal(result.ok, true);
  assert.equal(result.cleared, true);
  assert.equal(result.owner, 'user-b');

  const state = mock.readLocal();
  assert.equal(state[WORKSPACE_OWNER_KEY], 'user-b');
  assert.equal(state.clips, undefined);
  assert.equal(state.categories, undefined);
  assert.equal(state.notes, undefined);
  assert.equal(state.syncQueue, undefined);
  assert.equal(state.theme, 'dark', 'global theme preference is kept');
});

test('assertWorkspaceOwnerForSync refuses merge path until owner bound', async () => {
  installChromeStorageMock({
    local: {
      [WORKSPACE_OWNER_KEY]: 'user-a',
      clips: [{ id: 'bleed' }],
    },
  });

  assert.equal(canMergeOrUploadForOwner('user-a', 'user-b'), false);
  const gate = await assertWorkspaceOwnerForSync('user-b');
  assert.equal(gate.ok, true);
  assert.equal(gate.cleared, true);
  assert.equal(await getWorkspaceOwnerUserId(), 'user-b');
});

test('clearWorkspaceLibrary removes all documented library keys', async () => {
  const seeded = { theme: 'light' };
  for (const key of WORKSPACE_LIBRARY_KEYS) {
    seeded[key] = key === 'clips' ? [{ id: 'x' }] : true;
  }
  seeded[WORKSPACE_OWNER_KEY] = 'user-a';
  const mock = installChromeStorageMock({ local: seeded });

  await clearWorkspaceLibrary({ keepStamp: false });
  const state = mock.readLocal();
  assert.equal(state[WORKSPACE_OWNER_KEY], undefined);
  for (const key of WORKSPACE_LIBRARY_KEYS) {
    assert.equal(state[key], undefined, `expected ${key} cleared`);
  }
  assert.equal(state.theme, 'light');
});
