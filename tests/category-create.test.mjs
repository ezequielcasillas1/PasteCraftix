import assert from 'node:assert/strict';
import { test } from 'node:test';

// Minimal chrome + CRUD globals so the real createCategory runs in node.
const store = {};
globalThis.chrome = {
  storage: { local: {
    async get(keys) { const o = {}; [].concat(keys).forEach((k) => { if (k in store) o[k] = store[k]; }); return o; },
    async set(obj) { Object.assign(store, obj); },
  } },
};
const { createOperation } = await import('../extension/popup/shared/crud/crud.create.js');
globalThis.window = globalThis.window || globalThis;
window.PasteCraftCRUD = { createOperation };
window.pasteCraftSupabase = { async syncCategoriesToSupabase() {} };
globalThis.document = { getElementById: () => null };
globalThis.Element = globalThis.Element || class {};

const {
  createCategory, findDuplicateCategory, nextCategoryId,
} = await import('../extension/popup/features/categories/categories.service.js');

function makeApp(extra = {}) {
  const toasts = [];
  let renders = 0;
  return {
    categories: [], fileCategories: [], selectedFileId: null, toasts,
    get renders() { return renders; },
    setActionButtonLoading() {}, renderCategories() { renders += 1; },
    updateCategoryFilter() {}, updateManualInputCategories() {}, populateCategoryOptions() {},
    showToast(m, t) { toasts.push([m, t]); },
    ...extra,
  };
}

test('regression: category created while a file filter is active is linked to that file', async () => {
  const app = makeApp({ selectedFileId: 'file-1', fileCategories: [{ id: 'm0', fileId: 'file-1', categoryId: 42 }] });
  app.categories = [{ id: 42, name: 'Existing', icon: 'x' }];
  const res = await createCategory(app, 'Work', '💼');
  assert.equal(res.success, true);
  const ids = app.fileCategories.filter((m) => m.fileId === 'file-1').map((m) => String(m.categoryId));
  assert.deepEqual(ids.sort(), ['42', String(res.entity.id)].sort(), 'new category must be visible in the selected file');
  assert.ok(store.file_categories?.some((m) => m.categoryId === res.entity.id), 'mapping persisted');
});

test('create works when app.categories is not yet an array', async () => {
  const app = makeApp({ categories: undefined });
  const res = await createCategory(app, 'Home', '🏠');
  assert.equal(res.success, true);
  assert.deepEqual(app.categories.map((c) => c.name), ['Home']);
});

test('duplicate check is case-insensitive and null-safe', async () => {
  const cats = [{ id: 1, name: 'Work' }, { id: 2 }];
  assert.ok(findDuplicateCategory(cats, ' work '));
  assert.equal(findDuplicateCategory(cats, 'Other'), null);
  assert.equal(findDuplicateCategory(cats, 'Work', 1), null);
  const app = makeApp({ categories: cats.slice() });
  const dup = await createCategory(app, 'WORK', '');
  assert.equal(dup.success, false);
  const ok = await createCategory(app, 'Other', '');
  assert.equal(ok.success, true);
});

test('ids stay unique for creates in the same millisecond', () => {
  assert.equal(nextCategoryId([{ id: 100 }, { id: 101 }], 100), 102);
  assert.equal(nextCategoryId([], 7), 7);
});
