/**
 * Run: node --test tests/custom-search-crud.test.mjs
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import '../extension/popup/shared/pastecraft-crud.js';
import {
  CUSTOM_SEARCH_MAX_ITEMS,
  CUSTOM_SEARCH_STORAGE_KEY,
  CUSTOM_SEARCH_USAGE_KEY,
} from '../extension/popup/features/clips/clips.custom-search.constants.js';
import {
  buildGoogleSearchUrl,
  buildQueryFromTemplate,
  createCustomSearch,
  deleteCustomSearch,
  loadCustomSearches,
  sanitizeCustomSearchQuery,
  sanitizeCustomSearchTemplate,
  templateUsesClipPlaceholder,
  updateCustomSearch,
} from '../extension/popup/features/clips/clips.custom-search.service.js';

const storageState = {};

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getStorageSubset(keys) {
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, clone(storageState[key])]));
  }
  if (typeof keys === 'string') {
    return { [keys]: clone(storageState[keys]) };
  }
  return clone(storageState);
}

function createStorageMock() {
  return {
    async get(keys) {
      return getStorageSubset(keys);
    },
    async set(values) {
      Object.assign(storageState, clone(values));
    },
  };
}

function createCustomSearchApp(initialSearches = []) {
  return {
    customSearches: clone(initialSearches),
    toasts: [],
    showToast(message, type) {
      this.toasts.push({ message, type });
    },
  };
}

beforeEach(() => {
  for (const key of Object.keys(storageState)) {
    delete storageState[key];
  }
  globalThis.chrome = {
    storage: {
      local: createStorageMock(),
    },
  };
});

test('buildQueryFromTemplate substitutes clip placeholder', () => {
  const query = buildQueryFromTemplate('what does {clip} mean', 'hello world');
  assert.equal(query, 'what does hello world mean');
});

test('buildQueryFromTemplate uses template as-is when placeholder missing', () => {
  const query = buildQueryFromTemplate('site:example.com', 'alpha');
  assert.equal(query, 'site:example.com');
});

test('buildQueryFromTemplate returns clip text when template empty', () => {
  const query = buildQueryFromTemplate('', 'alpha');
  assert.equal(query, 'alpha');
});

test('templateUsesClipPlaceholder detects {clip} token', () => {
  assert.equal(templateUsesClipPlaceholder('site:example.com {clip}'), true);
  assert.equal(templateUsesClipPlaceholder('site:example.com'), false);
});

test('sanitize strips unsafe schemes and control chars', () => {
  const template = sanitizeCustomSearchTemplate('javascript:alert(1) {clip}\u0007');
  assert.equal(template, 'alert(1) {clip}');
});

test('buildGoogleSearchUrl encodes query safely', () => {
  const url = buildGoogleSearchUrl('hello & world');
  assert.equal(url, 'https://www.google.com/search?q=hello%20%26%20world');
});

test('sanitizeCustomSearchQuery rejects empty after cleaning', () => {
  assert.equal(sanitizeCustomSearchQuery('   '), '');
});

test('buildQueryFromTemplate with site: prefix and extra terms', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com async await', '');
  assert.equal(query, 'site:stackoverflow.com async await');
});

test('buildQueryFromTemplate with site: prefix and {clip} appended via drag-insert', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com {clip}', 'async await');
  assert.equal(query, 'site:stackoverflow.com async await');
});

test('buildQueryFromTemplate with site: prefix and empty clip falls back to template', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com', '');
  assert.equal(query, 'site:stackoverflow.com');
});

test('custom search CRUD persists create, update, delete, and usage logs', async () => {
  const app = createCustomSearchApp();

  const created = await createCustomSearch(app, {
    name: ' Stack Overflow ',
    template: ' site:stackoverflow.com {clip} ',
  });

  assert.equal(created.success, true);
  assert.equal(app.customSearches.length, 1);
  assert.equal(app.customSearches[0].name, 'Stack Overflow');
  assert.equal(app.customSearches[0].template, 'site:stackoverflow.com {clip}');
  assert.equal(storageState[CUSTOM_SEARCH_STORAGE_KEY][0].id, created.entity.id);
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].action, 'create');

  const updated = await updateCustomSearch(app, created.entity.id, {
    name: 'MDN Docs',
    template: 'site:developer.mozilla.org {clip}',
  });

  assert.equal(updated.success, true);
  assert.equal(app.customSearches[0].name, 'MDN Docs');
  assert.equal(app.customSearches[0].template, 'site:developer.mozilla.org {clip}');
  assert.equal(storageState[CUSTOM_SEARCH_STORAGE_KEY][0].name, 'MDN Docs');
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].action, 'update');

  const deleted = await deleteCustomSearch(app, created.entity.id);

  assert.equal(deleted.success, true);
  assert.deepEqual(app.customSearches, []);
  assert.deepEqual(storageState[CUSTOM_SEARCH_STORAGE_KEY], []);
  assert.equal(storageState[CUSTOM_SEARCH_USAGE_KEY][0].action, 'delete');

  const deletedAgain = await deleteCustomSearch(app, created.entity.id, { silent: true });
  assert.equal(deletedAgain.success, true);
  assert.equal(deletedAgain.skipped, true);
});

test('custom search create rejects duplicate names and max item overflow', async () => {
  const app = createCustomSearchApp();

  const first = await createCustomSearch(app, {
    name: 'Docs',
    template: 'site:docs.example.com',
  }, { silent: true });
  assert.equal(first.success, true);

  const duplicate = await createCustomSearch(app, {
    name: 'docs',
    template: 'site:other.example.com',
  }, { silent: true });
  assert.equal(duplicate.success, false);
  assert.match(duplicate.error, /already exists/i);
  assert.equal(app.customSearches.length, 1);

  const fullApp = createCustomSearchApp(Array.from({ length: CUSTOM_SEARCH_MAX_ITEMS }, (_, index) => ({
    id: `cs_${index}`,
    name: `Search ${index}`,
    template: `site:${index}.example.com`,
    createdAt: index,
    updatedAt: index,
  })));

  const overflow = await createCustomSearch(fullApp, {
    name: 'Overflow',
    template: 'site:overflow.example.com',
  }, { silent: true });

  assert.equal(overflow.success, false);
  assert.match(overflow.error, /save up to 20 custom searches/i);
  assert.equal(fullApp.customSearches.length, CUSTOM_SEARCH_MAX_ITEMS);
});

test('loadCustomSearches filters invalid stored entries and sorts newest first', async () => {
  storageState[CUSTOM_SEARCH_STORAGE_KEY] = [
    null,
    { id: '', name: 'No ID', template: 'site:bad.example.com', updatedAt: 3000 },
    { id: 'missing-template', name: 'Missing Template', template: '', updatedAt: 2500 },
    {
      id: 'older',
      name: 'javascript:Docs\u0007',
      template: 'site:docs.example.com',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'newer',
      name: 'MDN',
      template: 'data:site:developer.mozilla.org {clip}\u0007',
      createdAt: 2000,
      updatedAt: 2000,
    },
  ];

  const loaded = await loadCustomSearches();

  assert.deepEqual(loaded.map((entry) => entry.id), ['newer', 'older']);
  assert.deepEqual(
    loaded.map((entry) => ({ name: entry.name, template: entry.template })),
    [
      { name: 'MDN', template: 'site:developer.mozilla.org {clip}' },
      { name: 'Docs', template: 'site:docs.example.com' },
    ]
  );

  storageState[CUSTOM_SEARCH_STORAGE_KEY] = { not: 'an array' };
  assert.deepEqual(await loadCustomSearches(), []);
});
