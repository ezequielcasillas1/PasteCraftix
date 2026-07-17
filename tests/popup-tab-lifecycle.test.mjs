import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  activatePopupTab,
} from '../extension/popup/features/app/popup.tab-lifecycle.js';
import { POPUP_PERFORMANCE_NAMES } from '../extension/popup/features/app/popup.performance.js';
import { _restoreSessionState } from '../extension/popup/features/auth/auth.session.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalChrome = globalThis.chrome;
const originalPerformanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');

function installPerformanceRecorder(order = []) {
  const entries = [];
  const marks = new Map();
  const api = {
    clearMarks(name) {
      marks.delete(name);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (entries[i].entryType === 'mark' && entries[i].name === name) entries.splice(i, 1);
      }
    },
    clearMeasures(name) {
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (entries[i].entryType === 'measure' && entries[i].name === name) entries.splice(i, 1);
      }
    },
    mark(name) {
      const entry = { entryType: 'mark', name, startTime: entries.length };
      marks.set(name, entry);
      entries.push(entry);
      order.push(`mark:${name}`);
    },
    measure(name, start, end) {
      assert.ok(marks.has(start));
      assert.ok(marks.has(end));
      entries.push({ entryType: 'measure', name, start, end });
      order.push(`measure:${name}`);
    },
    getEntriesByType(type) {
      return entries.filter((entry) => entry.entryType === type);
    },
  };
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: api,
    writable: true,
  });
  return api;
}

function createElement(tab = null) {
  return {
    dataset: tab ? { tab } : {},
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); },
    },
  };
}

function installDom() {
  const buttons = new Map(['clips', 'categories', 'notes'].map((tab) => [tab, createElement(tab)]));
  const panels = new Map(['clips', 'categories', 'notes'].map((tab) => [`${tab}Tab`, createElement()]));
  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return [...buttons.values()];
      if (selector === '.tab-content') return [...panels.values()];
      return [];
    },
    querySelector(selector) {
      const match = selector.match(/^\[?\.tab-btn\[data-tab="(.+)"\]$/);
      return match ? buttons.get(match[1]) : null;
    },
    getElementById(id) {
      return panels.get(id) || null;
    },
  };
  globalThis.window = {
    __pcTabIconRendering: false,
    renderLucideIconsForActiveTab() {},
  };
  return { buttons, panels };
}

function createApp(overrides = {}) {
  return {
    currentTab: 'clips',
    loadDataCalls: 0,
    renderChips() {},
    updateManualInputCategories() {},
    renderCategories() {},
    updateCategoryBulkActions() {},
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
    loadData() { this.loadDataCalls += 1; },
    ...overrides,
  };
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.chrome = originalChrome;
  if (originalPerformanceDescriptor) {
    Object.defineProperty(globalThis, 'performance', originalPerformanceDescriptor);
  } else {
    delete globalThis.performance;
  }
});

test('activates and paints cached tab state before hydration settles', () => {
  const { buttons, panels } = installDom();
  let renderCount = 0;
  const app = createApp({
    renderCategories() { renderCount += 1; },
  });

  const hydration = activatePopupTab(app, 'categories');

  assert.equal(app.currentTab, 'categories');
  assert.equal(buttons.get('categories').classList.contains('active'), true);
  assert.equal(panels.get('categoriesTab').classList.contains('active'), true);
  assert.equal(renderCount, 1);
  return hydration;
});

test('revisiting shared tabs never calls loadData', async () => {
  installDom();
  const app = createApp();

  await activatePopupTab(app, 'categories');
  await activatePopupTab(app, 'clips');
  await activatePopupTab(app, 'categories');

  assert.equal(app.loadDataCalls, 0);
});

test('rapid activation shares one tab hydration promise', async () => {
  installDom();
  let resolveNotes;
  let loadCount = 0;
  const app = createApp({
    renderNotes() {},
    loadNotes() {
      loadCount += 1;
      return new Promise((resolve) => { resolveNotes = resolve; });
    },
  });

  const first = activatePopupTab(app, 'notes');
  const second = activatePopupTab(app, 'notes');
  await Promise.resolve();
  resolveNotes([]);
  await Promise.all([first, second]);

  assert.equal(loadCount, 1);
});

test('measures cached tab rendering before hydration completes', async () => {
  // Categories uses renderWhileHydrating — paints cached UI before async files hydrate.
  installDom();
  const order = [];
  const performanceApi = installPerformanceRecorder(order);
  let resolveFiles;
  let hydrationCompleted = false;
  const app = createApp({
    renderCategories() { order.push('cached-render'); },
    filesFeature: {
      initialize() {
        order.push('hydrate-start');
        return new Promise((resolve) => { resolveFiles = resolve; });
      },
    },
  });

  const hydration = activatePopupTab(app, 'categories');
  hydration.then(() => {
    hydrationCompleted = true;
    order.push('hydrate-end');
  });

  const measures = performanceApi.getEntriesByType('measure');
  assert.equal(measures.length, 1);
  assert.equal(measures[0].name, POPUP_PERFORMANCE_NAMES.TAB_CACHED_RENDER);
  assert.ok(order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.TAB_START}`) < order.indexOf('cached-render'));
  assert.ok(order.indexOf('cached-render') < order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.TAB_END}`));
  assert.ok(
    order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.TAB_END}`)
      < order.indexOf(`measure:${POPUP_PERFORMANCE_NAMES.TAB_CACHED_RENDER}`),
  );
  assert.equal(hydrationCompleted, false);

  await Promise.resolve();
  assert.equal(order.includes('hydrate-start'), true);
  assert.equal(hydrationCompleted, false);
  resolveFiles();
  await hydration;
  assert.equal(hydrationCompleted, true);

  await activatePopupTab(app, 'clips');
  assert.equal(performanceApi.getEntriesByType('measure').length, 1);
});

test('stale hydration completion cannot repaint a newer tab', async () => {
  // Notes shows loading (no paint) until hydrate; leaving before settle must not paint.
  installDom();
  let resolveNotes;
  let notesRenderCount = 0;
  const app = createApp({
    renderNotes() { notesRenderCount += 1; },
    loadNotes() {
      return new Promise((resolve) => { resolveNotes = resolve; });
    },
  });

  const notesHydration = activatePopupTab(app, 'notes');
  await Promise.resolve();
  assert.equal(notesRenderCount, 0, 'first visit shows loading, not a notes paint');
  await activatePopupTab(app, 'categories');
  resolveNotes([]);
  await notesHydration;

  assert.equal(app.currentTab, 'categories');
  assert.equal(notesRenderCount, 0, 'stale notes hydrate must not paint after tab change');
});
test('session restore defaults invalid saved tabs to Clips only', async () => {
  installDom();
  let clipsRenderCount = 0;
  let categoriesRenderCount = 0;
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_activeTab_v1: 'missing-tab' }; },
      },
    },
  };
  const app = createApp({
    renderChips() { clipsRenderCount += 1; },
    renderCategories() { categoriesRenderCount += 1; },
    _getCurrentTabId: async () => null,
    _resetBreakdownToEmpty() {},
    _resetSummaryToEmpty() {},
  });

  await _restoreSessionState(app);

  assert.equal(app.currentTab, 'clips');
  assert.ok(clipsRenderCount >= 1);
  assert.equal(categoriesRenderCount, 0);
});

test('session restore paints only the valid saved tab', async () => {
  installDom();
  let clipsRenderCount = 0;
  let categoriesRenderCount = 0;
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_activeTab_v1: 'categories' }; },
      },
    },
  };
  const app = createApp({
    renderChips() { clipsRenderCount += 1; },
    renderCategories() { categoriesRenderCount += 1; },
    _getCurrentTabId: async () => null,
    _resetBreakdownToEmpty() {},
    _resetSummaryToEmpty() {},
  });

  await _restoreSessionState(app);

  assert.equal(app.currentTab, 'categories');
  assert.equal(clipsRenderCount, 0);
  assert.ok(categoriesRenderCount >= 1);
});
