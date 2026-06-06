/**
 * Run: node --test tests/custom-search-action-menu.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CUSTOM_SEARCH_SAVED_ACTION_PREFIX, CUSTOM_SEARCH_USAGE_KEY } from '../extension/popup/features/clips/clips.custom-search.constants.js';
import { runGoogleSearchAction } from '../extension/popup/features/clips/clips.action-menu.js';

function installBrowserHarness() {
  const storage = new Map();
  const navigations = [];
  const openedWindows = [];

  globalThis.window = {
    open(url, target, features) {
      openedWindows.push({ url, target, features });
    },
  };

  globalThis.chrome = {
    runtime: {},
    storage: {
      local: {
        async get(keys) {
          const names = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(names.map((key) => [key, storage.get(key)]));
        },
        async set(values) {
          Object.entries(values).forEach(([key, value]) => storage.set(key, value));
        },
      },
    },
    tabs: {
      query(_query, callback) {
        callback([{ id: 42 }]);
      },
      update(tabId, update, callback) {
        navigations.push({ tabId, ...update });
        callback?.();
      },
    },
  };

  return { storage, navigations, openedWindows };
}

function createApp(overrides = {}) {
  return {
    customSearches: [],
    toasts: [],
    getSelectedOrCurrentText: (_fallback) => _fallback,
    showToast(message, type) {
      this.toasts.push({ message, type });
    },
    ...overrides,
  };
}

test('saved custom search builds encoded Google URL and logs usage', async () => {
  const harness = installBrowserHarness();
  const app = createApp({
    customSearches: [
      {
        id: 'stack',
        name: 'Stack Overflow',
        template: 'site:stackoverflow.com {clip}',
      },
    ],
    getSelectedOrCurrentText: () => 'async await & promises',
  });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}stack`, {
    clip: { id: 'clip-1', text: 'fallback text' },
    context: 'clips',
  });

  assert.deepEqual(harness.navigations, [
    {
      tabId: 42,
      url: 'https://www.google.com/search?q=site%3Astackoverflow.com%20async%20await%20%26%20promises',
    },
  ]);
  assert.equal(harness.openedWindows.length, 0);
  assert.equal(app.toasts.length, 0);

  const usage = harness.storage.get(CUSTOM_SEARCH_USAGE_KEY);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].action, 'search');
  assert.equal(usage[0].templateId, 'stack');
  assert.equal(usage[0].name, 'Stack Overflow');
});

test('saved custom search with missing template does not navigate', async () => {
  const harness = installBrowserHarness();
  const app = createApp({ customSearches: [] });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}missing`, {
    clip: { id: 'clip-1', text: 'lookup text' },
    context: 'clips',
  });

  assert.deepEqual(harness.navigations, []);
  assert.deepEqual(app.toasts, [{ message: 'Saved search not found', type: 'error' }]);
});

test('placeholder saved search blocks empty clip text', async () => {
  const harness = installBrowserHarness();
  const app = createApp({
    customSearches: [
      {
        id: 'docs',
        name: 'Docs',
        template: 'site:developer.mozilla.org {clip}',
      },
    ],
    getSelectedOrCurrentText: () => '   ',
  });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}docs`, {
    clip: { id: 'clip-1', text: '' },
    context: 'clips',
  });

  assert.deepEqual(harness.navigations, []);
  assert.equal(harness.storage.get(CUSTOM_SEARCH_USAGE_KEY), undefined);
  assert.deepEqual(app.toasts, [{ message: 'No clip text to search', type: 'error' }]);
});

test('base Google search action blocks empty clip text', async () => {
  const harness = installBrowserHarness();
  const app = createApp({
    getSelectedOrCurrentText: () => '\n\t ',
  });

  await runGoogleSearchAction(app, 'vague-search', {
    clip: { id: 'clip-1', text: '' },
    context: 'clips',
  });

  assert.deepEqual(harness.navigations, []);
  assert.deepEqual(app.toasts, [{ message: 'No clip text to search', type: 'error' }]);
});
