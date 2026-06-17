import assert from 'node:assert/strict';
import test from 'node:test';

import '../extension/popup/shared/pastecraft-crud.js';

test('pastecraft-crud module loads without syntax errors', () => {
  assert.equal(typeof globalThis.PasteCraftCRUD, 'function');
  assert.equal(typeof globalThis.PasteCraftCRUD.deleteManyOperation, 'function');
});

test('deleteManyOperation rejects empty entityIds', async () => {
  const toasts = [];
  const result = await globalThis.PasteCraftCRUD.deleteManyOperation({
    entityIds: [],
    entityType: 'clip',
    stateGetter: () => ({ clips: [] }),
    stateSetter: async () => {},
    stateKeys: ['clips'],
    storageKeys: ['clips'],
    showToast: (msg, type) => toasts.push({ msg, type }),
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid entity IDs');
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'error');
});
