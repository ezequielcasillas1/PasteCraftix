/**
 * Run: node --test tests/custom-search-action-menu.test.mjs
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOM_SEARCH_SAVED_ACTION_PREFIX,
  CUSTOM_SEARCH_USAGE_KEY,
} from '../extension/popup/features/clips/clips.custom-search.constants.js';
import { runGoogleSearchAction } from '../extension/popup/features/clips/clips.action-menu.js';

const storageState = {};
let navigations;
let fallbackOpens;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createStorageMock() {
  return {
    async get(keys) {
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, clone(storageState[key])]));
      }
      if (typeof keys === 'string') {
        return { [keys]: clone(storageState[keys]) };
      }
      return clone(storageState);
    },
    async set(values) {
      Object.assign(storageState, clone(values));
    },
  };
}

function createActionApp({ customSearches, selectedText = '' } = {}) {
  return {
    customSearches: customSearches || [
      {
        id: 'docs',
        name: 'Docs',
        template: 'site:developer.mozilla.org {clip}',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    toasts: [],
    getSelectedOrCurrentText() {
      return selectedText;
    },
    showToast(message, type) {
      this.toasts.push({ message, type });
    },
  };
}

beforeEach(() => {
  for (const key of Object.keys(storageState)) {
    delete storageState[key];
  }
  navigations = [];
  fallbackOpens = [];

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: createStorageMock(),
    },
    tabs: {
      query(_query, callback) {
        callback([{ id: 42 }]);
      },
      update(tabId, props, callback) {
        navigations.push({ tabId, url: props.url });
        callback?.();
      },
    },
  };

  globalThis.window = {
    innerHeight: 900,
    innerWidth: 1200,
    open(url, target, features) {
      fallbackOpens.push({ url, target, features });
    },
  };
});

test('saved custom search menu action navigates with selected clip text and logs usage', async () => {
  const app = createActionApp({ selectedText: ' async   await ' });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}docs`, {
    clip: { id: 'clip-1', text: 'fallback clip text' },
    context: 'clips',
  });

  assert.deepEqual(navigations, [
    {
      tabId: 42,
      url: 'https://www.google.com/search?q=site%3Adeveloper.mozilla.org%20async%20await',
    },
  ]);
  assert.deepEqual(fallbackOpens, []);
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].action, 'search');
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].templateId, 'docs');
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].name, 'Docs');
  assert.deepEqual(app.toasts, []);
});

test('saved custom search requiring clip text blocks empty searches', async () => {
  const app = createActionApp({ selectedText: '   ' });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}docs`, {
    clip: { id: 'clip-1', text: 'fallback clip text' },
    context: 'clips',
  });

  assert.deepEqual(navigations, []);
  assert.deepEqual(storageState[CUSTOM_SEARCH_USAGE_KEY], undefined);
  assert.deepEqual(app.toasts, [
    { message: 'No clip text to search', type: 'error' },
  ]);
});

test('saved site-only custom search can run without clip text', async () => {
  const app = createActionApp({
    selectedText: '',
    customSearches: [
      {
        id: 'site-only',
        name: 'Stack Overflow',
        template: 'site:stackoverflow.com',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}site-only`, {
    clip: { id: 'clip-1', text: '' },
    context: 'clips',
  });

  assert.deepEqual(navigations, [
    {
      tabId: 42,
      url: 'https://www.google.com/search?q=site%3Astackoverflow.com',
    },
  ]);
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].templateId, 'site-only');
});

test('saved custom search reports missing templates without navigation', async () => {
  const app = createActionApp({
    selectedText: 'hello',
    customSearches: [],
  });

  await runGoogleSearchAction(app, `${CUSTOM_SEARCH_SAVED_ACTION_PREFIX}missing`, {
    clip: { id: 'clip-1', text: 'hello' },
    context: 'clips',
  });

  assert.deepEqual(navigations, []);
  assert.deepEqual(app.toasts, [
    { message: 'Saved search not found', type: 'error' },
  ]);
});
