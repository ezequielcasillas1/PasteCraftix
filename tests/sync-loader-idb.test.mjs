/**
 * sync.loader IndexedDB vs chrome.storage resolution tests.
 * Run: node --test tests/sync-loader-idb.test.mjs
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loaderUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/sync/sync.loader.js')
).href;

const { resolveIdbOrChromeStorage } = await import(loaderUrl);

describe('resolveIdbOrChromeStorage', () => {
  test('prefers chrome.storage when it has more items than IDB', () => {
    const chrome = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const idb = [{ id: 1 }];
    assert.deepEqual(resolveIdbOrChromeStorage(idb, chrome), chrome);
  });

  test('prefers IDB when it has more items than chrome.storage', () => {
    const chrome = [{ id: 1 }];
    const idb = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(resolveIdbOrChromeStorage(idb, chrome), idb);
  });

  test('prefers IDB when counts are equal and IDB is non-empty', () => {
    const chrome = [{ id: 1 }];
    const idb = [{ id: 1 }];
    assert.deepEqual(resolveIdbOrChromeStorage(idb, chrome), idb);
  });

  test('falls back to chrome.storage when IDB is empty', () => {
    const chrome = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(resolveIdbOrChromeStorage([], chrome), chrome);
    assert.deepEqual(resolveIdbOrChromeStorage(null, chrome), chrome);
  });

  test('returns empty array when both sources are empty', () => {
    assert.deepEqual(resolveIdbOrChromeStorage([], []), []);
  });
});
