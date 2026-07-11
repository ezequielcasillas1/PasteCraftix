import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { initializeAllPopupFeatures } from '../extension/popup/features/app/popup.features.js';
import { runPopupInit } from '../extension/popup/features/app/popup.init.js';
import { POPUP_PERFORMANCE_NAMES } from '../extension/popup/features/app/popup.performance.js';
import { loadData } from '../extension/popup/features/sync/sync.loader.js';
import {
  initializeTieredStorage,
  maybeMigrateTieredStorage,
} from '../extension/popup/features/sync/sync.storage.js';
import { setupVisibilityListener } from '../extension/popup/features/sync/sync.visibility.js';

const originals = {
  chrome: globalThis.chrome,
  document: globalThis.document,
  window: globalThis.window,
  pasteCraftSupabase: globalThis.pasteCraftSupabase,
  StorageMeter: globalThis.StorageMeter,
  tieredStorageManager: globalThis.tieredStorageManager,
};
const originalPerformanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('loading overlay hides synchronously without a fade timer', () => {
  let timeoutCalls = 0;
  const overlay = { style: {} };
  const context = {
    document: {
      getElementById: (id) => id === 'loadingOverlay' ? overlay : null,
    },
    globalThis: null,
    setTimeout() {
      timeoutCalls += 1;
    },
  };
  context.window = context;
  context.globalThis = context;
  const source = fs.readFileSync(
    path.resolve(__dirname, '../extension/popup/shared/popup-ui.js'),
    'utf8',
  );
  vm.runInNewContext(source, context);

  context.PasteCraftPopupUi.hideLoadingOverlay();
  context.PasteCraftPopupUi.hideLoadingOverlay();

  assert.equal(timeoutCalls, 0);
  assert.equal(overlay.style.display, 'none');
  assert.equal(overlay.style.transition, 'none');
  assert.equal(overlay.style.opacity, '1');
});

afterEach(() => {
  Object.assign(globalThis, originals);
  if (originalPerformanceDescriptor) {
    Object.defineProperty(globalThis, 'performance', originalPerformanceDescriptor);
  } else {
    delete globalThis.performance;
  }
});

test('feature imports start together and initialize in registry order once', async () => {
  const imports = [];
  const initOrder = [];
  const pending = [];
  const importModule = (url) => {
    imports.push(url);
    const gate = deferred();
    pending.push({
      gate,
      module: new Proxy({}, {
        get: (_target, initName) => {
          if (initName === 'then') return undefined;
          return () => {
            initOrder.push(String(initName));
            return { initName };
          };
        },
      }),
    });
    return gate.promise;
  };
  const app = {};

  const first = initializeAllPopupFeatures(app, { importModule });
  const second = initializeAllPopupFeatures(app, { importModule });

  assert.equal(first, second);
  assert.equal(imports.length, 13);
  assert.deepEqual(initOrder, []);

  pending.slice().reverse().forEach(({ gate, module }) => gate.resolve(module));
  await first;

  assert.deepEqual(initOrder, [
    'initClipsFeature',
    'initLikedFeature',
    'initCategoriesFeature',
    'initFilesFeature',
    'initNotesFeature',
    'initWidgetsFeature',
    'initAiLabFeature',
    'initSettingsFeature',
    'initActivityFeature',
    'initAuthFeature',
    'initProfileFeature',
    'initBillingFeature',
    'initSyncFeature',
  ]);
});

test('loadData coalesces concurrent storage reads', async () => {
  const storageGate = deferred();
  let storageReads = 0;
  globalThis.chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        async get() {
          storageReads += 1;
          await storageGate.promise;
          return {
            clips: [{ id: 'clip-1', text: 'cached', timestamp: 1 }],
            categories: [{ id: 'cat-1', name: 'Saved' }],
            searchOnlyClips: [],
          };
        },
        async set() {},
      },
    },
  };
  const app = {
    _idbReady: false,
    idb: null,
    _ensureIndexedDbReadyAndMigrate: async () => {},
    _clipTitle: () => '',
    enforceClipLimit: async () => {},
  };

  const first = loadData(app);
  const second = loadData(app);
  assert.equal(first, second);
  assert.equal(app._coreHydrationState, 'loading');
  storageGate.resolve();
  await Promise.all([first, second]);
  assert.equal(storageReads, 1);
  assert.equal(app._coreHydrationState, 'ready');

  await loadData(app);
  assert.equal(storageReads, 2);
});

test('loadData exposes failed core hydration after local read errors', async () => {
  globalThis.chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        async get() { throw new Error('offline storage failure'); },
      },
    },
  };
  const app = {
    _ensureIndexedDbReadyAndMigrate: async () => {},
  };

  await assert.rejects(() => loadData(app), /offline storage failure/);

  assert.equal(app._coreHydrationState, 'failed');
});

test('tiered initialization and migration each run once per app', async () => {
  let storeInitializations = 0;
  let migrationReports = 0;
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_tiered_storage_migrated_v1: 0 }; },
        async set() {},
      },
    },
  };
  globalThis.tieredStorageManager = {
    getStore() {
      return {
        async initialize() { storeInitializations += 1; },
      };
    },
  };
  globalThis.StorageMeter = {
    async getStorageReport() {
      migrationReports += 1;
      return {
        total: { percentage: 0.1 },
        budgets: { clips: 100, notes: 100, archived: 100 },
      };
    },
  };
  globalThis.pasteCraftSupabase = {
    isAuthenticated: () => true,
    getClipsCount: async () => 0,
    getArchivedClipsCount: async () => 0,
  };
  const app = {
    clips: [],
    notes: [],
    searchOnlyClips: [],
    clipsPerPage: 20,
    updateHeaderClipCount() {},
  };

  await Promise.all([initializeTieredStorage(app), initializeTieredStorage(app)]);
  await Promise.all([maybeMigrateTieredStorage(app), maybeMigrateTieredStorage(app)]);
  await initializeTieredStorage(app);
  await maybeMigrateTieredStorage(app);

  assert.equal(storeInitializations, 2);
  assert.equal(migrationReports, 1);
});

test('authenticated reveal completes before deferred cloud work starts', async () => {
  const order = [];
  const deferredCallbacks = [];
  const marks = new Set();
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: {
      clearMarks(name) { marks.delete(name); },
      clearMeasures() {},
      mark(name) {
        marks.add(name);
        order.push(`mark:${name}`);
      },
      measure(name, start, end) {
        assert.ok(marks.has(start));
        assert.ok(marks.has(end));
        order.push(`measure:${name}`);
      },
    },
    writable: true,
  });
  globalThis.window = {
    location: { search: '', hash: '' },
    finishBootLucideIcons: () => order.push('icons'),
  };
  globalThis.document = {
    getElementById: () => ({ style: {} }),
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_freemium_guest: false }; },
        async set() {},
      },
    },
  };
  globalThis.pasteCraftSupabase = {
    getCurrentUser: async () => ({ id: 'user-1', email: '' }),
    getCachedSubscription: async () => null,
    getUserSubscription: async () => null,
    syncUserProfileFromSupabase: async () => null,
  };
  const record = (name) => () => { order.push(name); };
  const asyncRecord = (name) => async () => { order.push(name); };
  const app = {
    currentTab: 'clips',
    setupAuthModalEvents: record('auth-events'),
    _setupSupportFormEvents: record('support-events'),
    checkPasswordResetCallback: async () => false,
    checkOAuthCallback: asyncRecord('oauth'),
    clearLegacyAuthPrefs: asyncRecord('clear-auth'),
    restoreSupabaseSessionFromBridge: asyncRecord('restore-auth'),
    setupLocalStorageListener: record('storage-listener'),
    _ensureIndexedDbReadyAndMigrate: asyncRecord('idb-ready'),
    loadData: asyncRecord('load-data'),
    loadSettings: asyncRecord('load-settings'),
    loadUserProfile: asyncRecord('load-profile'),
    updateAiCreditsPills: record('credits'),
    updateUpgradeUI: record('upgrade'),
    updateTopBarIdentity: record('identity'),
    setupEventListeners: asyncRecord('ui-events'),
    renderChips: record('clips-render'),
    updateLastCapture: record('capture-render'),
    updatePreview: record('preview-render'),
    renderCategories: record('categories-render'),
    updateCategoryFilter: record('category-filter'),
    _restoreSessionState: async () => {
      order.push('tab-restore');
      app.currentTab = 'categories';
      app.renderCategories();
    },
    hideLoadingOverlay: record('reveal'),
    setupVisibilityListener: record('visibility'),
    setupRealtimeListeners: record('realtime'),
    setupSyncStatusListeners: record('sync-listeners'),
    loadAiWorkflow: asyncRecord('ai-workflow'),
    loadAnalysisHistory: asyncRecord('analysis-history'),
    loadAiHistory: asyncRecord('ai-history'),
    _initializeTieredStorage: asyncRecord('tiered-init'),
    _maybeMigrateTieredStorage: asyncRecord('tiered-migrate'),
    maybeCreateDailyRestorePoint: asyncRecord('restore-point'),
    cleanupOldClips: asyncRecord('cleanup'),
    performBackgroundSync: asyncRecord('full-sync'),
  };

  await runPopupInit(app, {
    initializeFeatures: asyncRecord('features'),
    defer: (callback) => deferredCallbacks.push(callback),
  });

  const revealIndex = order.indexOf('reveal');
  assert.ok(order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.BOOT_START}`) < order.indexOf('features'));
  assert.ok(order.indexOf('icons') < revealIndex);
  assert.ok(revealIndex < order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.CONTENT_READY}`));
  assert.ok(
    order.indexOf(`mark:${POPUP_PERFORMANCE_NAMES.CONTENT_READY}`)
      < order.indexOf(`measure:${POPUP_PERFORMANCE_NAMES.BOOT_TO_CONTENT}`),
  );
  assert.ok(revealIndex > order.indexOf('tab-restore'));
  assert.ok(order.indexOf('load-data') > order.indexOf('restore-auth'));
  assert.equal(order.slice(0, revealIndex).includes('clips-render'), false);
  assert.equal(order.slice(0, revealIndex).filter((entry) => entry === 'categories-render').length, 1);
  assert.equal(order.includes('ai-history'), false);
  assert.equal(order.includes('full-sync'), false);
  assert.equal(deferredCallbacks.length, 1);

  deferredCallbacks[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(order.indexOf('ai-history') > revealIndex);
  assert.ok(order.indexOf('full-sync') > revealIndex);
});

test('default deferred work waits for an idle paint opportunity', async () => {
  let idleCallback;
  let idleOptions;
  let visibilityCalls = 0;
  globalThis.window = {
    location: { search: '', hash: '' },
    finishBootLucideIcons() {},
    requestIdleCallback(callback, options) {
      idleCallback = callback;
      idleOptions = options;
    },
  };
  globalThis.document = {
    getElementById: () => ({ style: {} }),
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_freemium_guest: true }; },
        async remove() {},
      },
    },
  };
  globalThis.pasteCraftSupabase = {
    signOutFast: async () => {},
  };
  const app = {
    currentTab: 'clips',
    setupAuthModalEvents() {},
    _setupSupportFormEvents() {},
    loadData: async () => {},
    loadSettings: async () => {},
    updateTopBarIdentity() {},
    setupEventListeners: async () => {},
    updateLastCapture() {},
    updatePreview() {},
    updateCategoryFilter() {},
    renderChips() {},
    hideLoadingOverlay() {},
    setupVisibilityListener: () => { visibilityCalls += 1; },
    _initializeTieredStorage: async () => {},
    cleanupOldClips: async () => {},
  };

  await runPopupInit(app, { initializeFeatures: async () => {} });
  await Promise.resolve();

  assert.equal(typeof idleCallback, 'function');
  assert.ok(idleOptions.timeout > 0);
  assert.equal(visibilityCalls, 0);

  idleCallback();
  await Promise.resolve();
  assert.equal(visibilityCalls, 1);
});

test('unauthenticated startup never loads or paints cached clips', async () => {
  let loadDataCalls = 0;
  let clipRenderCalls = 0;
  let authModalCalls = 0;
  globalThis.window = {
    location: { search: '', hash: '' },
  };
  globalThis.document = {
    getElementById: () => ({ style: {} }),
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_freemium_guest: false }; },
      },
    },
  };
  globalThis.pasteCraftSupabase = {
    getCurrentUser: async () => null,
  };
  const app = {
    setupAuthModalEvents() {},
    _setupSupportFormEvents() {},
    checkPasswordResetCallback: async () => false,
    checkOAuthCallback: async () => {},
    clearLegacyAuthPrefs: async () => {},
    restoreSupabaseSessionFromBridge: async () => {},
    loadSettings: async () => {},
    _ensureIndexedDbReadyAndMigrate: async () => {},
    loadData: async () => { loadDataCalls += 1; },
    renderChips: () => { clipRenderCalls += 1; },
    showAuthModal: () => { authModalCalls += 1; },
  };

  await runPopupInit(app, {
    initializeFeatures: async () => {},
    defer: () => {},
  });

  assert.equal(authModalCalls, 1);
  assert.equal(loadDataCalls, 0);
  assert.equal(clipRenderCalls, 0);
});

test('visibility uses cached state when storage version is unchanged', async () => {
  let visibilityHandler;
  let loadCalls = 0;
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener(_type, handler) { visibilityHandler = handler; },
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get() { return { pc_local_updatedAt: 7 }; },
      },
    },
  };
  const app = {
    currentTab: 'clips',
    async loadData() { loadCalls += 1; },
    renderChips() {},
    updateLastCapture() {},
    updatePreview() {},
  };

  setupVisibilityListener(app);
  await Promise.resolve();
  visibilityHandler();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loadCalls, 0);

  app._popupDataStale = true;
  visibilityHandler();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loadCalls, 1);
});
