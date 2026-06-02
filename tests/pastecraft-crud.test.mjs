import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, test } from 'node:test';

await import('../extension/popup/shared/pastecraft-crud.js');

let originalChrome;
let originalWindow;
let originalConsoleError;
let originalConsoleWarn;

function createStorage(initial = {}) {
  const data = structuredClone(initial);

  function pick(keys) {
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, data[key]]));
    }
    if (typeof keys === 'string') {
      return { [keys]: data[keys] };
    }
    if (keys && typeof keys === 'object') {
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [
          key,
          data[key] === undefined ? fallback : data[key],
        ])
      );
    }
    return { ...data };
  }

  return {
    data,
    get(keys, callback) {
      const result = pick(keys);
      if (typeof callback === 'function') callback(result);
      return Promise.resolve(result);
    },
    set(update, callback) {
      Object.assign(data, update);
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },
  };
}

function createCrudState(seed) {
  const state = structuredClone(seed);
  return {
    state,
    stateGetter: () => state,
    stateSetter: async (nextState) => {
      Object.keys(nextState).forEach((key) => {
        state[key] = nextState[key];
      });
    },
  };
}

before(() => {
  assert.ok(globalThis.PasteCraftCRUD, 'PasteCraftCRUD should register globally');
});

beforeEach(() => {
  originalChrome = globalThis.chrome;
  originalWindow = globalThis.window;
  originalConsoleError = console.error;
  originalConsoleWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  globalThis.chrome = { storage: { local: createStorage() } };
  globalThis.window = { pasteCraftIndexedDB: null };
});

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.window = originalWindow;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

test('deleteOperation rolls back in-memory state when persistence fails', async () => {
  const { state, stateGetter, stateSetter } = createCrudState({
    clips: [{ id: 'clip-1', text: 'keep me' }],
  });
  let storageCalls = 0;

  const result = await globalThis.PasteCraftCRUD.deleteOperation({
    entityId: 'clip-1',
    entityName: 'clip',
    entityType: 'clip',
    stateGetter,
    stateSetter,
    stateKeys: ['clips'],
    validator: () => ({ valid: true }),
    storageKeys: ['clips'],
    storageWriter: async () => {
      storageCalls += 1;
      if (storageCalls <= 3) throw new Error('storage unavailable');
    },
    deleteFromArray: (items, entityId) => items.filter((item) => item.id !== entityId),
  });

  assert.equal(result.success, false);
  assert.deepEqual(state.clips, [{ id: 'clip-1', text: 'keep me' }]);
  assert.equal(storageCalls, 4, 'three failed writes plus successful rollback write');
});

test('deleteOperation writes local tombstone before background sync starts', async () => {
  const storage = createStorage({ pc_deleted_categories: [] });
  globalThis.chrome = { storage: { local: storage } };
  const { stateGetter, stateSetter } = createCrudState({
    categories: [{ id: 'cat-1', name: 'Work' }],
  });
  const order = [];

  const result = await globalThis.PasteCraftCRUD.deleteOperation({
    entityId: 'cat-1',
    entityName: 'Work',
    entityType: 'category',
    stateGetter,
    stateSetter,
    stateKeys: ['categories'],
    validator: () => ({ valid: true }),
    storageKeys: ['categories'],
    storageWriter: async (data) => storage.set(data),
    deleteFromArray: (items, entityId) => items.filter((item) => item.id !== entityId),
    tombstoneStorageKey: 'pc_deleted_categories',
    backgroundSync: async () => {
      order.push('backgroundSync');
      assert.deepEqual(storage.data.pc_deleted_categories.map((item) => item.id), ['cat-1']);
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(storage.data.pc_deleted_categories.map((item) => item.id), ['cat-1']);

  await Promise.resolve();
  assert.deepEqual(order, ['backgroundSync']);
});

test('deleteManyOperation normalizes duplicate ids and deletes matching string ids', async () => {
  const storage = createStorage();
  globalThis.chrome = { storage: { local: storage } };
  const { state, stateGetter, stateSetter } = createCrudState({
    clips: [
      { id: 1, text: 'first' },
      { id: '2', text: 'second' },
      { id: '3', text: 'third' },
    ],
  });

  const result = await globalThis.PasteCraftCRUD.deleteManyOperation({
    entityIds: [1, '1', '2', null, ''],
    entityType: 'clip',
    stateGetter,
    stateSetter,
    stateKeys: ['clips'],
    validator: () => ({ valid: true }),
    resolveEntities: (ids) => ids.map((id) => ({ id })),
    storageKeys: ['clips'],
    storageWriter: async (data) => storage.set(data),
    deleteFromArray: (items, idSet) => items.filter((item) => !idSet.has(String(item.id))),
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.entities.map((item) => item.id), ['1', '2']);
  assert.deepEqual(state.clips, [{ id: '3', text: 'third' }]);
  assert.deepEqual(storage.data.clips, [{ id: '3', text: 'third' }]);
});

test('deleteOperation uses loose id matching for note deletion verification', async () => {
  const { stateGetter, stateSetter } = createCrudState({
    notes: [{ id: 42, title: 'numeric note id' }],
  });

  const result = await globalThis.PasteCraftCRUD.deleteOperation({
    entityId: '42',
    entityName: 'numeric note id',
    entityType: 'note',
    stateGetter,
    stateSetter,
    stateKeys: ['notes'],
    validator: () => ({ valid: true }),
    storageKeys: ['notes'],
    storageWriter: async () => {},
    deleteFromArray: (items, entityId) => items.filter((item) => item.id != entityId),
  });

  assert.equal(result.success, true);
});
