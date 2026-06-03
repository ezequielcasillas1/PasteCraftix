import test from 'node:test';
import assert from 'node:assert/strict';
import { pickChromeOrIdbEntities } from '../extension/popup/features/sync/sync.loader.js';

test('prefers chrome.storage clips when both chrome and IDB have data', () => {
  const chrome = [{ id: '1', text: 'kept' }];
  const idb = [{ id: '1', text: 'kept' }, { id: '2', text: 'stale ghost' }];
  assert.deepEqual(pickChromeOrIdbEntities(chrome, idb), chrome);
});

test('falls back to IDB when chrome.storage entity list is empty', () => {
  const idb = [{ id: '9', text: 'from idb' }];
  assert.deepEqual(pickChromeOrIdbEntities([], idb), idb);
});

test('returns empty array when neither store has entities', () => {
  assert.deepEqual(pickChromeOrIdbEntities([], []), []);
  assert.deepEqual(pickChromeOrIdbEntities(null, undefined), []);
});
