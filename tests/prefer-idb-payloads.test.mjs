import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPreferIndexedDbOverChromeStorage } from '../extension/shared/prefer-idb-payloads.js';

test('prefers chrome.storage when pc_local_updatedAt is newer than IDB payloads', () => {
  const chrome = [{ id: '1', text: 'new', timestamp: 100 }];
  const idb = [{ id: '2', text: 'stale', timestamp: 50 }];
  assert.equal(shouldPreferIndexedDbOverChromeStorage(200, chrome, idb), false);
});

test('prefers IDB when empty chrome.storage (recovery)', () => {
  const idb = [{ id: '1', text: 'only', timestamp: 10 }];
  assert.equal(shouldPreferIndexedDbOverChromeStorage(0, [], idb), true);
});

test('prefers IDB when payload updatedAt exceeds pc_local_updatedAt', () => {
  const chrome = [{ id: '1', text: 'old', timestamp: 100 }];
  const idb = [{ id: '1', text: 'newer', updatedAt: 500 }];
  assert.equal(shouldPreferIndexedDbOverChromeStorage(400, chrome, idb), true);
});

test('prefers chrome.storage when IDB is empty', () => {
  const chrome = [{ id: '1', text: 'x', timestamp: 1 }];
  assert.equal(shouldPreferIndexedDbOverChromeStorage(99, chrome, []), false);
});

test('prefers chrome.storage when pc_local_updatedAt is missing', () => {
  const chrome = [{ id: '1', text: 'x', timestamp: 1 }];
  const idb = [{ id: '2', text: 'y', timestamp: 999 }];
  assert.equal(shouldPreferIndexedDbOverChromeStorage(undefined, chrome, idb), false);
});
