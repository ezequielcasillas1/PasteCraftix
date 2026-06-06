/**
 * Run: node --test tests/crud-id-match.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const crudSource = readFileSync(join(root, 'extension/popup/shared/pastecraft-crud.js'), 'utf8');
const sandbox = { window: {}, globalScope: {} };
vm.runInNewContext(crudSource, sandbox);
const { PasteCraftCRUD } = sandbox.window;

test('PasteCraftCRUD.idsMatch treats numeric ids and dataset strings as equal', () => {
  assert.equal(PasteCraftCRUD.idsMatch(1704123456789, '1704123456789'), true);
  assert.equal(PasteCraftCRUD.idsMatch('cs_1_abcd', 'cs_1_abcd'), true);
  assert.equal(PasteCraftCRUD.idsMatch(1, '2'), false);
});

test('updateOperation entity lookup succeeds for numeric note ids from DOM strings', async () => {
  const notes = [{ id: 1704123456789, title: 'Before', body: 'x' }];
  const result = await PasteCraftCRUD.updateOperation({
    entityId: '1704123456789',
    updates: { title: 'After', body: 'y' },
    stateGetter: () => ({ notes }),
    stateSetter: async (state) => { notes.splice(0, notes.length, ...state.notes); },
    stateKeys: ['notes'],
    updateInArray: (items, targetId, updates) =>
      items.map((item) => (PasteCraftCRUD.idsMatch(item.id, targetId) ? { ...item, ...updates } : item)),
    successMessage: () => '',
    showToast: () => {},
  });

  assert.equal(result.success, true);
  assert.equal(notes[0].title, 'After');
});
