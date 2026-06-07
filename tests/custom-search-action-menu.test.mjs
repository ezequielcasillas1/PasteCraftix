/**
 * Run: node --test tests/custom-search-action-menu.test.mjs
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { CUSTOM_SEARCH_USAGE_KEY } from '../extension/popup/features/clips/clips.custom-search.constants.js';

const { runGoogleSearchAction } = await import(
  '../extension/popup/features/clips/clips.action-menu.js'
);

let tabUpdates;
let openedWindows;
let storageWrites;
let lastQueryResult;

beforeEach(() => {
  tabUpdates = [];
  openedWindows = [];
  storageWrites = [];
  lastQueryResult = [{ id: 42 }];

  globalThis.window = {
    innerHeight: 800,
    innerWidth: 1200,
    open(url, target, features) {
      openedWindows.push({ url, target, features });
    },
  };

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        async get() {
          return { [CUSTOM_SEARCH_USAGE_KEY]: [] };
        },
        async set(data) {
          storageWrites.push(data);
        },
      },
    },
    tabs: {
      query(_query, callback) {
        callback(lastQueryResult);
      },
      update(tabId, updateInfo, callback) {
        tabUpdates.push({ tabId, updateInfo });
        callback?.();
      },
    },
  };
});

function createApp(customSearches, overrides = {}) {
  const toasts = [];
  return {
    customSearches,
    showToast(message, type) {
      toasts.push({ message, type });
    },
    getSelectedOrCurrentText: (fallback) => fallback,
    toasts,
    ...overrides,
  };
}

test('saved custom search navigates active tab with encoded clip query and usage log', async () => {
  const app = createApp([
    { id: 'docs', name: 'Docs', template: 'site:developer.mozilla.org {clip}' },
  ]);

  await runGoogleSearchAction(app, 'saved:docs', {
    clip: { id: 'clip-1', text: 'async await & promises' },
    context: 'clips',
  });

  assert.deepEqual(tabUpdates, [
    {
      tabId: 42,
      updateInfo: {
        url: 'https://www.google.com/search?q=site%3Adeveloper.mozilla.org%20async%20await%20%26%20promises',
      },
    },
  ]);
  assert.deepEqual(openedWindows, []);
  assert.equal(storageWrites.length, 1);
  assert.equal(storageWrites[0][CUSTOM_SEARCH_USAGE_KEY][0].action, 'search');
  assert.equal(storageWrites[0][CUSTOM_SEARCH_USAGE_KEY][0].templateId, 'docs');
});

test('saved placeholder search blocks empty clip text before navigation', async () => {
  const app = createApp(
    [{ id: 'stack', name: 'StackOverflow', template: 'site:stackoverflow.com {clip}' }],
    { getSelectedOrCurrentText: () => '   ' },
  );

  await runGoogleSearchAction(app, 'saved:stack', {
    clip: { id: 'clip-1', text: '' },
    context: 'clips',
  });

  assert.deepEqual(tabUpdates, []);
  assert.deepEqual(storageWrites, []);
  assert.deepEqual(app.toasts, [{ message: 'No clip text to search', type: 'error' }]);
});

test('saved static site search works without clip text', async () => {
  const app = createApp(
    [{ id: 'mdn', name: 'MDN', template: 'site:developer.mozilla.org' }],
    { getSelectedOrCurrentText: () => '' },
  );

  await runGoogleSearchAction(app, 'saved:mdn', {
    clip: { id: 'clip-1', text: '' },
    context: 'clips',
  });

  assert.equal(
    tabUpdates[0].updateInfo.url,
    'https://www.google.com/search?q=site%3Adeveloper.mozilla.org',
  );
  assert.equal(storageWrites[0][CUSTOM_SEARCH_USAGE_KEY][0].templateId, 'mdn');
  assert.deepEqual(app.toasts, []);
});

test('saved search falls back to opening a new window when active tab update fails', async () => {
  const app = createApp([{ id: 'docs', name: 'Docs', template: 'site:example.com {clip}' }]);
  chrome.tabs.update = (tabId, updateInfo, callback) => {
    tabUpdates.push({ tabId, updateInfo });
    chrome.runtime.lastError = { message: 'cannot update tab' };
    callback?.();
    chrome.runtime.lastError = null;
  };

  await runGoogleSearchAction(app, 'saved:docs', {
    clip: { id: 'clip-1', text: 'tabs api' },
    context: 'clips',
  });

  assert.equal(tabUpdates.length, 1);
  assert.deepEqual(openedWindows, [
    {
      url: 'https://www.google.com/search?q=site%3Aexample.com%20tabs%20api',
      target: '_blank',
      features: 'noopener,noreferrer',
    },
  ]);
});

test('missing saved search shows an error and does not navigate', async () => {
  const app = createApp([]);

  await runGoogleSearchAction(app, 'saved:missing', {
    clip: { id: 'clip-1', text: 'alpha' },
    context: 'clips',
  });

  assert.deepEqual(tabUpdates, []);
  assert.deepEqual(storageWrites, []);
  assert.deepEqual(app.toasts, [{ message: 'Saved search not found', type: 'error' }]);
});
