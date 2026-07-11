import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  setupRealtimeListeners,
  updateSyncProgress,
} from '../extension/popup/features/sync/sync.listener.js';

const originals = {
  clearTimeout: globalThis.clearTimeout,
  document: globalThis.document,
  setTimeout: globalThis.setTimeout,
  window: globalThis.window,
};

afterEach(() => {
  Object.assign(globalThis, originals);
});

test('realtime dataChanged events preserve feature refresh behavior', async () => {
  let dataChangedHandler;
  globalThis.window = {
    addEventListener(name, handler) {
      assert.equal(name, 'dataChanged');
      dataChangedHandler = handler;
    },
  };
  const calls = [];
  const app = {
    loadData: async () => { calls.push('load-data'); },
    renderChips: () => { calls.push('render-clips'); },
    updateLastCapture: () => { calls.push('last-capture'); },
    renderSearchResults: () => { calls.push('render-search'); },
    maybeRefreshRefactorizationPanel: () => { calls.push('refactor-panel'); },
    renderCategories: () => { calls.push('render-categories'); },
    updateCategoryFilter: () => { calls.push('category-filter'); },
    updateManualInputCategories: () => { calls.push('manual-categories'); },
    loadSettings: async () => { calls.push('load-settings'); },
    loadUserProfile: async () => {
      calls.push('load-profile');
      app.userProfile = { profileImageUrl: 'local-image' };
    },
    updateTopBarIdentity: (image) => { calls.push(`identity:${image}`); },
  };

  setupRealtimeListeners(app);
  await dataChangedHandler({ detail: { type: 'archivedClips' } });
  assert.deepEqual(calls, [
    'load-data',
    'render-clips',
    'last-capture',
    'render-search',
    'refactor-panel',
  ]);

  calls.length = 0;
  await dataChangedHandler({ detail: { type: 'categories' } });
  assert.deepEqual(calls, [
    'load-data',
    'render-categories',
    'category-filter',
    'manual-categories',
  ]);

  calls.length = 0;
  await dataChangedHandler({ detail: { type: 'settings' } });
  await dataChangedHandler({ detail: { type: 'profile' } });
  assert.deepEqual(calls, [
    'load-settings',
    'load-profile',
    'identity:local-image',
  ]);
});

function createProgressElement() {
  const classes = new Set();
  return {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    style: {},
    textContent: '',
  };
}

test('sync progress keeps visibility and auto-refresh thresholds unchanged', () => {
  const progressContainer = createProgressElement();
  const progressFill = createProgressElement();
  const progressText = createProgressElement();
  const elements = new Map([
    ['syncProgressContainer', progressContainer],
    ['syncProgressFill', progressFill],
    ['syncProgressText', progressText],
  ]);
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
  };
  let scheduledDelay = null;
  let clearedTimer = null;
  globalThis.setTimeout = (_callback, delay) => {
    scheduledDelay = delay;
    return 17;
  };
  globalThis.clearTimeout = (timerId) => {
    clearedTimer = timerId;
  };
  const app = {
    _syncAutoRefreshIntervalMs: 250,
    _syncAutoRefreshTimeout: null,
  };

  updateSyncProgress(app, 25, 200, 12);
  assert.equal(progressContainer.classList.contains('is-visible'), true);
  assert.equal(progressFill.style.width, '12%');
  assert.equal(progressText.textContent, '25 / 200 (12%)');
  assert.equal(scheduledDelay, 250);

  updateSyncProgress(app, 100, 100, 100);
  assert.equal(progressContainer.classList.contains('is-visible'), false);
  assert.equal(progressFill.style.width, '0%');
  assert.equal(progressText.textContent, '0 / 0 (0%)');
  assert.equal(clearedTimer, 17);
  assert.equal(app._syncAutoRefreshTimeout, null);
});
