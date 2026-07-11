import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderChips } from '../extension/popup/features/clips/clips.render.js';
import {
  buildClipTextIndex,
  getSelectedPreviewTexts,
} from '../extension/popup/features/clips/clips.preview.js';
import { registerClipSearchEvents } from '../extension/popup/features/clips/clips.events.js';
import {
  indexClipsByCategory,
  renderCategories,
} from '../extension/popup/features/categories/categories.render.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
  };
}

function createNode() {
  const queryNodes = new Map();
  return {
    attributes: {},
    children: [],
    classList: createClassList(),
    className: '',
    dataset: {},
    hidden: false,
    innerHTML: '',
    style: {},
    textContent: '',
    addEventListener() {},
    appendChild(child) {
      this.appendCount = (this.appendCount || 0) + 1;
      this.children.push(child);
    },
    querySelector(selector) {
      if (!queryNodes.has(selector)) queryNodes.set(selector, createNode());
      return queryNodes.get(selector);
    },
    querySelectorAll() { return []; },
    replaceChildren(...children) {
      this.replaceCount = (this.replaceCount || 0) + 1;
      this.children = children.flatMap((child) => child?.children || [child]);
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
}

function installClipDom() {
  const chipContainer = createNode();
  const headerClipCount = createNode();
  const paginationControls = createNode();
  const elements = new Map([
    ['chipContainer', chipContainer],
    ['headerClipCount', headerClipCount],
    ['paginationControls', paginationControls],
  ]);
  globalThis.document = {
    createDocumentFragment: () => createNode(),
    createElement: () => createNode(),
    getElementById: (id) => elements.get(id) || null,
  };
  return { chipContainer };
}

function createClipApp(overrides = {}) {
  return {
    clips: [],
    totalClipsCount: 0,
    currentPage: 0,
    clipsPerPage: 20,
    maxPages: 10,
    currentTab: 'clips',
    selectedChips: new Set(),
    likedClipIds: new Set(),
    quickPasteSettings: {},
    escapeHtml: (value) => String(value ?? ''),
    getTimeAgo: () => 'now',
    renderPagination() {},
    updateQuickCopyButton() {},
    toggleChip() {},
    ...overrides,
  };
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

test('clip container starts with a neutral accessible status', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../extension/popup.html'), 'utf8');
  const start = html.indexOf('id="chipContainer"');
  const snippet = html.slice(start, start + 400);
  assert.match(snippet, /aria-live="polite"/);
  assert.match(snippet, /aria-busy="true"/);
  assert.match(snippet, /Loading clips/);
  assert.doesNotMatch(snippet, /No clips yet/);
});

test('zero clips stays neutral until local and cloud hydration finalize', () => {
  const { chipContainer } = installClipDom();
  const app = createClipApp();

  renderChips(app);
  assert.match(chipContainer.innerHTML, /Loading clips/);
  assert.doesNotMatch(chipContainer.innerHTML, /No clips yet/);

  app._coreHydrationState = 'failed';
  renderChips(app);
  assert.match(chipContainer.innerHTML, /Clips unavailable/);
  assert.doesNotMatch(chipContainer.innerHTML, /No clips yet/);

  app._coreHydrationState = 'ready';
  app.currentUser = { id: 'user-1' };
  app._coreCloudHydrationState = 'pending';
  renderChips(app);
  assert.match(chipContainer.innerHTML, /Syncing clips/);
  assert.doesNotMatch(chipContainer.innerHTML, /No clips yet/);

  app._coreCloudHydrationState = 'failed';
  renderChips(app);
  assert.match(chipContainer.innerHTML, /No clips yet/);
  assert.equal(chipContainer.attributes['aria-busy'], 'false');
});

test('guest empty state finalizes after local hydration', () => {
  const { chipContainer } = installClipDom();
  const app = createClipApp({
    _isFreemiumGuest: true,
    _coreHydrationState: 'ready',
    _coreCloudHydrationState: 'ready',
  });

  renderChips(app);

  assert.match(chipContainer.innerHTML, /No clips yet/);
  assert.equal(chipContainer.attributes['aria-busy'], 'false');
});

test('clip pages replace atomically and reuse markup analysis', () => {
  const { chipContainer } = installClipDom();
  let detectionCalls = 0;
  let previewCalls = 0;
  globalThis.window = {
    PCMarkup: {
      detectMarkupType() {
        detectionCalls += 1;
        return 'markdown';
      },
      getMarkupBadge: () => '<span>MD</span>',
      renderMarkupPreview(_text, _meta, _length, type) {
        previewCalls += 1;
        assert.equal(type, 'markdown');
        return '<strong>preview</strong>';
      },
    },
    renderLucideIconsSync() {},
  };
  const clip = {
    id: 'clip-1',
    text: '**cached**',
    category: 'Uncategorized',
    timestamp: 1,
    meta: { source: 'test' },
  };
  const app = createClipApp({ clips: [clip] });

  renderChips(app);
  renderChips(app);

  assert.equal(chipContainer.replaceCount, 2);
  assert.equal(chipContainer.children.length, 1);
  assert.equal(chipContainer.children[0].className, 'chip');
  assert.equal(detectionCalls, 1);
  assert.equal(previewCalls, 1);

  clip.text = '**changed**';
  renderChips(app);
  assert.equal(detectionCalls, 2);
});

test('preview indexing preserves UI order and active clip precedence', () => {
  const app = {
    clips: [
      { id: 1, text: 'active-one' },
      { id: 2, text: 'active-two' },
    ],
    searchOnlyClips: [
      { id: 1, text: 'archived-duplicate' },
      { id: 3, text: 'archived-three' },
    ],
    _clipIdKey: (id) => String(id),
    getSelectedClipIdsInUiOrder: () => ['3', '1', 'missing', '2'],
  };

  const index = buildClipTextIndex(app);
  assert.equal(index.get('1'), 'active-one');
  assert.deepEqual(getSelectedPreviewTexts(app), [
    'archived-three',
    'active-one',
    'active-two',
  ]);
});

test('category index groups clips once while preserving clip order', () => {
  const first = { id: 1, category: 'Work' };
  const second = { id: 2, category: 'Personal' };
  const third = { id: 3, category: 'Work' };

  const index = indexClipsByCategory([first, second, third]);

  assert.deepEqual(index.get('Work'), [first, third]);
  assert.deepEqual(index.get('Personal'), [second]);
});

test('category rendering replaces one fragment atomically', () => {
  const categoriesList = createNode();
  globalThis.document = {
    createDocumentFragment: () => createNode(),
    createElement: () => createNode(),
    getElementById: (id) => id === 'categoriesList' ? categoriesList : null,
  };
  const app = {
    categories: [
      { id: 1, name: 'Older', created: 1, icon: '1' },
      { id: 2, name: 'Newer', created: 2, icon: '2' },
    ],
    clips: [
      { id: 'a', category: 'Older' },
      { id: 'b', category: 'Newer' },
    ],
    searchOnlyClips: [],
    selectedFileId: null,
    expandedCategoryIds: new Set(),
    _categoryIdKey: (category) => String(category.id),
    createCategoryClipsHTML: (clips) => `${clips.length} clips`,
    escapeHtml: (value) => String(value),
    toggleCategoryDropdown() {},
    editCategory() {},
    deleteCategory() {},
  };

  renderCategories(app);

  assert.equal(categoriesList.replaceCount, 1);
  assert.equal(categoriesList.appendCount || 0, 0);
  assert.equal(categoriesList.children.length, 2);
  assert.equal(categoriesList.children[0].dataset.categoryId, '2');
});

test('search typing is debounced while clearing renders immediately', () => {
  const listeners = new Map();
  const searchInput = {
    value: '',
    addEventListener(type, handler) { listeners.set(type, handler); },
  };
  const elements = new Map([['searchInput', searchInput]]);
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
  };
  let pendingRender = null;
  globalThis.setTimeout = (callback) => {
    pendingRender = callback;
    return 1;
  };
  globalThis.clearTimeout = () => { pendingRender = null; };
  let renderCalls = 0;
  const app = {
    searchQuery: '',
    renderSearchResults() { renderCalls += 1; },
    updateSearchBulkActions() {},
  };

  registerClipSearchEvents(app);
  listeners.get('input')({ target: { value: 'a' } });
  listeners.get('input')({ target: { value: 'ab' } });
  assert.equal(renderCalls, 0);

  pendingRender();
  assert.equal(renderCalls, 1);

  listeners.get('input')({ target: { value: '' } });
  assert.equal(renderCalls, 2);
  assert.equal(app.searchQuery, '');
});
