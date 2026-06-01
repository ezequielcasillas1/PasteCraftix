import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

await import(pathToFileURL(new URL('../extension/popup/shared/pastecraft-crud.js', import.meta.url).pathname));

const PasteCraftCRUD = globalThis.PasteCraftCRUD;

function createStorageMock(initial = {}) {
  const data = structuredClone(initial);
  const calls = [];

  return {
    data,
    calls,
    local: {
      get(keys, callback) {
        calls.push({ type: 'get', keys });
        const names = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const key of names) result[key] = data[key];
        if (callback) {
          callback(result);
          return undefined;
        }
        return Promise.resolve(result);
      },
      set(values, callback) {
        calls.push({ type: 'set', values: structuredClone(values) });
        Object.assign(data, structuredClone(values));
        if (callback) callback();
        return Promise.resolve();
      },
    },
  };
}

function withGlobals(globals, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, globalThis[key]);
    globalThis[key] = value;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    });
}

test('PasteCraftCRUD is available to popup modules', () => {
  assert.equal(typeof PasteCraftCRUD?.createOperation, 'function');
  assert.equal(typeof PasteCraftCRUD?.deleteOperation, 'function');
  assert.equal(typeof PasteCraftCRUD?.deleteManyOperation, 'function');
});

test('createOperation rolls back state and storage when persistence fails', async () => {
  const state = { categories: [{ id: 'existing', name: 'Inbox' }] };
  const original = structuredClone(state.categories);
  const toastMessages = [];
  const uiStates = [];
  let setCount = 0;
  let storageAttempts = 0;

  const result = await PasteCraftCRUD.createOperation({
    entity: { id: 'new', name: 'Projects' },
    stateGetter: () => state,
    stateSetter: async (nextState) => {
      setCount += 1;
      state.categories = nextState.categories;
    },
    stateKeys: ['categories'],
    validator: () => ({ valid: true }),
    duplicateCheck: (entity, currentState) =>
      currentState.categories.some((category) => category.name === entity.name),
    storageKeys: ['categories'],
    storageWriter: async () => {
      storageAttempts += 1;
      if (storageAttempts <= 3) throw new Error('quota exceeded');
    },
    addToArray: (items, entity) => [...items, entity],
    uiUpdater: () => {
      uiStates.push(state.categories.map((category) => category.id));
    },
    backgroundSync: async () => {
      throw new Error('background sync should not run after persistence failure');
    },
    successMessage: () => 'created',
    errorMessage: (error) => `failed: ${error.message}`,
    showToast: (message, type) => toastMessages.push({ message, type }),
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'quota exceeded');
  assert.deepEqual(state.categories, original);
  assert.equal(storageAttempts, 4, 'initial write plus rollback write retries');
  assert.equal(setCount, 2, 'optimistic set plus rollback set');
  assert.deepEqual(uiStates, [['existing', 'new'], ['existing']]);
  assert.deepEqual(toastMessages, [{ message: 'failed: quota exceeded', type: 'error' }]);
});

test('deleteOperation records tombstones before non-blocking background sync', async () => {
  const storage = createStorageMock({
    pc_deleted_categories: [{ id: 'old', name: 'Old' }],
  });
  const idbCalls = [];
  const backgroundCalls = [];
  const state = {
    categories: [{ id: 'cat-1', name: 'Work' }],
    clips: [{ id: 'clip-1', category: 'Work' }],
    searchOnlyClips: [{ id: 'clip-2', category: 'Work' }],
  };

  await withGlobals({
    chrome: { storage: { local: storage.local } },
    window: {
      pasteCraftIndexedDB: {
        deleteByIds: async (storeName, ids) => {
          idbCalls.push({ type: 'deleteByIds', storeName, ids });
        },
        syncEntityFromLocalStorage: async (storeName, items) => {
          idbCalls.push({ type: 'syncEntityFromLocalStorage', storeName, items });
        },
      },
    },
  }, async () => {
    const result = await PasteCraftCRUD.deleteOperation({
      entityId: 'cat-1',
      entityName: 'Work',
      entityType: 'category',
      stateGetter: () => state,
      stateSetter: async (nextState) => {
        state.categories = nextState.categories;
        state.clips = nextState.clips;
        state.searchOnlyClips = nextState.searchOnlyClips;
      },
      stateKeys: ['categories', 'clips', 'searchOnlyClips'],
      validator: (entity, currentState) => ({
        valid: currentState.categories.some((category) => category.id === entity.id),
      }),
      idempotencyCheck: (entityId, currentState) =>
        !currentState.categories.some((category) => category.id === entityId),
      storageKeys: ['categories', 'clips', 'searchOnlyClips'],
      storageWriter: async (data) => storage.local.set(data),
      deleteFromArray: (items, entityId) =>
        items.filter((item) => item.id !== entityId),
      updateRelatedEntities: (currentState, entity) => {
        currentState.clips.forEach((clip) => {
          if (clip.category === entity.name) clip.category = 'Uncategorized';
        });
        currentState.searchOnlyClips.forEach((clip) => {
          if (clip.category === entity.name) clip.category = 'Uncategorized';
        });
      },
      idbStoreName: 'categories',
      tombstoneStorageKey: 'pc_deleted_categories',
      verifier: async () => true,
      backgroundSync: async (entity, deletedAt) => {
        backgroundCalls.push({ entity, deletedAt, tombstones: storage.data.pc_deleted_categories });
      },
      successMessage: () => 'deleted',
      showToast: () => {},
    });

    assert.equal(result.success, true);
    assert.deepEqual(state.categories, []);
    assert.equal(state.clips[0].category, 'Uncategorized');
    assert.equal(state.searchOnlyClips[0].category, 'Uncategorized');
    assert.deepEqual(idbCalls, [
      { type: 'deleteByIds', storeName: 'categories', ids: ['cat-1'] },
      { type: 'syncEntityFromLocalStorage', storeName: 'categories', items: [] },
    ]);
    assert.equal(storage.data.pc_deleted_categories.length, 2);
    assert.equal(storage.data.pc_deleted_categories[1].id, 'cat-1');

    await delay(0);
    assert.equal(backgroundCalls.length, 1);
    assert.equal(backgroundCalls[0].entity.id, 'cat-1');
    assert.equal(backgroundCalls[0].tombstones.length, 2);
  });
});

test('deleteManyOperation deduplicates ids, deletes both stores, and writes tombstones once', async () => {
  const storage = createStorageMock();
  const idbDeletedIds = [];
  const writtenTombstones = [];
  const state = {
    clips: [{ id: 1, text: 'one' }, { id: 2, text: 'two' }],
    searchOnlyClips: [{ id: 3, text: 'three' }],
  };

  await withGlobals({
    chrome: { storage: { local: storage.local } },
    window: {
      pasteCraftIndexedDB: {
        deleteByIds: async (_storeName, ids) => idbDeletedIds.push(...ids),
        syncEntityFromLocalStorage: async () => {},
      },
    },
  }, async () => {
    const result = await PasteCraftCRUD.deleteManyOperation({
      entityIds: [1, '1', 3],
      entityType: 'clip',
      stateGetter: () => state,
      stateSetter: async (nextState) => {
        state.clips = nextState.clips;
        state.searchOnlyClips = nextState.searchOnlyClips;
      },
      stateKeys: ['clips', 'searchOnlyClips'],
      validator: () => ({ valid: true }),
      resolveEntities: (ids, currentState, deletedAt) => [
        ...currentState.clips
          .filter((clip) => ids.includes(String(clip.id)))
          .map((clip) => ({ ...clip, id: String(clip.id), source: 'active', deletedAt })),
        ...currentState.searchOnlyClips
          .filter((clip) => ids.includes(String(clip.id)))
          .map((clip) => ({ ...clip, id: String(clip.id), source: 'archived', deletedAt })),
      ],
      storageKeys: ['clips', 'searchOnlyClips'],
      storageWriter: async (data) => storage.local.set(data),
      deleteFromArray: (items, idSet) => items.filter((item) => !idSet.has(String(item.id))),
      itemIdGetter: (item) => String(item.id),
      idbStoreName: 'clips',
      idbIdsResolver: (entities) => entities.map((entity) => entity.id),
      writeTombstones: async (entities) => {
        writtenTombstones.push(...entities);
      },
      successMessage: () => 'deleted',
      showToast: () => {},
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.entities.map((entity) => entity.id), ['1', '3']);
    assert.deepEqual(state.clips, [{ id: 2, text: 'two' }]);
    assert.deepEqual(state.searchOnlyClips, []);
    assert.deepEqual(idbDeletedIds, ['1', '3']);
    assert.deepEqual(writtenTombstones.map((entity) => entity.source), ['active', 'archived']);
  });
});

test('saveOperation treats verifier and background sync failures as non-blocking diagnostics', async () => {
  const state = { settings: { theme: 'light' } };
  const warnings = [];
  const errors = [];
  const previousConsole = {
    warn: console.warn,
    error: console.error,
  };
  console.warn = (...args) => warnings.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));

  try {
    const result = await PasteCraftCRUD.saveOperation({
      stateGetter: () => state,
      stateSetter: async (nextState) => {
        state.settings = nextState.settings;
      },
      stateKeys: ['settings'],
      validator: () => ({ valid: true }),
      mutateState: async (currentState) => {
        currentState.settings.theme = 'dark';
        return { changed: true };
      },
      storageKeys: ['settings'],
      storageWriter: async () => {},
      verifier: async () => false,
      backgroundSync: async () => {
        throw new Error('network down');
      },
      successMessage: () => '',
      showToast: () => {},
    });

    assert.equal(result.success, true);
    assert.equal(state.settings.theme, 'dark');

    await delay(0);
    assert.ok(warnings.some((line) => line.includes('Post-write verification failed')));
    assert.ok(errors.some((line) => line.includes('Background sync failed')));
  } finally {
    console.warn = previousConsole.warn;
    console.error = previousConsole.error;
  }
});
