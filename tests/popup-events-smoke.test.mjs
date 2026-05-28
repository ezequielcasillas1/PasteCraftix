/**
 * Smoke tests for popup event extraction (setupEventListeners → popup.events.js).
 * Run: node --test tests/popup-events-smoke.test.mjs
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, describe } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extensionDir = path.join(root, 'extension');
const popupDir = path.join(extensionDir, 'popup');

const EVENT_MODULES = [
  'popup.events.js',
  'events/billing-upgrade.events.js',
  'events/tab-nav.events.js',
  'events/clips-shell.events.js',
  'events/modals-shared.events.js',
  'events/craft-toolbar.events.js',
  'events/ai-lab-page.events.js',
];

const EXPORT_NAMES = {
  'events/billing-upgrade.events.js': 'registerBillingUpgradeEvents',
  'events/tab-nav.events.js': 'registerTabNavEvents',
  'events/clips-shell.events.js': 'registerClipsShellEvents',
  'events/modals-shared.events.js': 'registerSharedModalEvents',
  'events/craft-toolbar.events.js': 'registerCraftToolbarEvents',
  'events/ai-lab-page.events.js': 'registerAiLabPageEvents',
};

function assertFileExists(relativePath) {
  const full = path.join(popupDir, relativePath);
  assert.ok(fs.existsSync(full), `Missing: popup/${relativePath}`);
}

function createMockElement(id = '') {
  const listeners = [];
  return {
    id,
    style: { display: '' },
    disabled: false,
    value: '',
    textContent: '',
    classList: {
      _c: new Set(),
      add(...args) {
        args.forEach((c) => this._c.add(c));
      },
      remove(...args) {
        args.forEach((c) => this._c.delete(c));
      },
      toggle(cls, force) {
        if (force === true) this._c.add(cls);
        else if (force === false) this._c.delete(cls);
        else if (this._c.has(cls)) this._c.delete(cls);
        else this._c.add(cls);
      },
      contains(cls) {
        return this._c.has(cls);
      },
    },
    dataset: {},
    addEventListener(type, fn) {
      listeners.push({ type, fn });
    },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    click() {
      listeners.filter((l) => l.type === 'click').forEach((l) =>
        l.fn({ target: this, preventDefault() {}, stopPropagation() {} })
      );
    },
    closest() {
      return null;
    },
    contains() {
      return false;
    },
    focus() {},
    replaceWith() {},
    cloneNode() {
      return createMockElement(id);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function buildDocumentHarness() {
  const popupHtml = fs.readFileSync(path.join(extensionDir, 'popup.html'), 'utf8');
  const idMatches = popupHtml.matchAll(/\bid=["']([^"']+)["']/g);
  const byId = new Map();
  for (const [, id] of idMatches) {
    if (!byId.has(id)) byId.set(id, createMockElement(id));
  }

  const classStubs = {
    '.tab-nav': createMockElement('tab-nav'),
    '.breakdown-tabs': createMockElement('breakdown-tabs'),
    '.ai-lab-tabs': createMockElement('ai-lab-tabs'),
  };

  return {
    getElementById(id) {
      if (byId.has(id)) return byId.get(id);
      const el = createMockElement(id);
      byId.set(id, el);
      return el;
    },
    querySelector(sel) {
      if (classStubs[sel]) return classStubs[sel];
      if (sel === '.manual-input-header') return createMockElement('manual-input-header');
      if (sel === '.modal-text') return createMockElement('modal-text');
      return createMockElement(`qs-${sel}`);
    },
    querySelectorAll(sel) {
      if (sel === '.tab-btn') {
        return [
          Object.assign(createMockElement('tab-clips'), { dataset: { tab: 'clips' } }),
          Object.assign(createMockElement('tab-categories'), { dataset: { tab: 'categories' } }),
        ];
      }
      if (sel === '.tab-content') {
        return [createMockElement('clipsTab'), createMockElement('categoriesTab')];
      }
      if (sel === '.segment-btn') return [];
      if (sel === '.ai-history-filter-chip') return [];
      if (sel === '.level-chip') return [];
      if (sel === '.bd-inline-tab') return [];
      if (sel === '.followup-level-tab') return [];
      if (sel === '.breakdown-tab') return [];
      if (sel === '.category-option') return [];
      return [];
    },
  };
}

function createMockApp() {
  const noop = () => {};
  const asyncNoop = async () => {};

  return {
    _popupEventListenersRegistered: false,
    _categoryClipDelegationAttached: false,
    clips: [],
    searchOnlyClips: [],
    manualClipSaveInProgress: false,
    currentTab: 'clips',
    aiWorkflow: { provider: 'openai', preset: 'default' },
    breakdownCache: {},
    options: { deduplicate: false, sort: false, uppercase: false },
    delimiter: ',',
    _magicSelected: new Set(),
    clipsFeature: {
      events: {
        setupCategoryClipDelegation(app) {
          const container = document.getElementById('categoriesList');
          if (!container || app._categoryClipDelegationAttached) return;
          app._categoryClipDelegationAttached = true;
          container.addEventListener('click', asyncNoop);
        },
        registerClipEvents: noop,
      },
    },
    notesFeature: { events: { registerNotesEvents: noop } },
    categoriesFeature: { events: { registerCategoryModalEvents: noop } },
    settingsFeature: { events: { initSettingsEvents: noop } },
    activityFeature: { events: { initActivityEventListeners: noop } },
    aiLabFeature: {
      refactorization: {
        activateRefactorizationSection: noop,
        bindRefactorizationPanelUi: noop,
      },
    },
    setupCategoryClipDelegation() {
      this.clipsFeature.events.setupCategoryClipDelegation(this);
    },
    initPdfExtraction: noop,
    updateManualInputCategories: noop,
    showToast: noop,
    openUpgradeModal: noop,
    closeUpgradeModal: noop,
    _createCheckout: noop,
    loadData: asyncNoop,
    renderChips: noop,
    renderCategories: noop,
    updateCategoryBulkActions: noop,
    renderSearchResults: noop,
    updateSearchBulkActions: noop,
    loadAIGallery: noop,
    migrateProfileImageToGallery: noop,
    loadNotes: asyncNoop,
    renderNotes: noop,
    loadAiHistory: asyncNoop,
    renderAiHistoryList: noop,
    _saveActiveTabState: noop,
    showProfileModal: noop,
    hideProfileModal: noop,
    hideBreakdownModal: noop,
    copyBreakdownText: noop,
    toggleBreakdownItalics: noop,
    copyHistoryContent: noop,
    _startEditHistoryTitle: noop,
    _saveEditHistoryTitle: noop,
    _cancelEditHistoryTitle: noop,
    continueHistoryConversation: noop,
    clearAllAiHistory: noop,
    hideClipViewerModal: noop,
    copyClipViewerText: noop,
    updateLevelInfo: noop,
    generateBreakdown: noop,
    updatePreview: noop,
    updatePreviewFromSelection: noop,
    updateDelimiterExample: noop,
    copyToClipboard: noop,
    magicFormat: noop,
    _craftMagic: async () => ({}),
    _craftAllMagic: async () => ({}),
    _showMagicResults: noop,
    _undoMagic: noop,
    updateAiCreditsPills: noop,
    applyAiWorkflowToUi: noop,
    saveAiWorkflowFromUi: asyncNoop,
    startInlineBreakdown: noop,
    generateBreakdownInline: noop,
    sendInlineBreakdownFollowup: noop,
    generateSummaryQuestions: noop,
    generateSummary: noop,
    showSummarySection: noop,
    _resetSummaryToEmpty: noop,
    _saveSummaryState: noop,
    _saveBreakdownPageState: noop,
    handleSummaryFollowup: noop,
    handleBreakdownFollowup: noop,
    toggleFollowupLevelTabs: noop,
    generateAIImageFromProfile: noop,
    generateRandomAIImage: noop,
    hideAIGenerationTimer: noop,
    handleQuickCopy: noop,
    handleQuickDelete: noop,
    _wireBulkAiButtons: noop,
    setupImageViewer: noop,
    enforceClipLimit: asyncNoop,
    showCreateCategoryDialog: noop,
    hideCategoryModal: noop,
    showCreateCategoryFromModal: noop,
    handleClipDelete: noop,
    saveTextWithCategory: noop,
    selectedCategoryForSave: 'Uncategorized',
    previewIsManual: false,
  };
}

describe('popup events — static', () => {
  test('event module files exist', () => {
    for (const rel of EVENT_MODULES) assertFileExists(rel);
  });

  test('each module exports its registrar', () => {
    for (const [rel, exportName] of Object.entries(EXPORT_NAMES)) {
      const src = fs.readFileSync(path.join(popupDir, rel), 'utf8');
      assert.match(src, new RegExp(`export function ${exportName}`));
    }
  });

  test('popup.js delegates setupEventListeners to popup.events.js', () => {
    const popupJs = fs.readFileSync(path.join(extensionDir, 'popup.js'), 'utf8');
    assert.match(popupJs, /async setupEventListeners\(\)/);
    assert.match(popupJs, /registerPopupEventListeners/);
    assert.match(popupJs, /popup\/popup\.events\.js/);
    const methodBlock = popupJs.match(
      /async setupEventListeners\(\)\s*\{[\s\S]*?\n  \}\n/
    );
    assert.ok(methodBlock, 'setupEventListeners block not found');
    const lines = methodBlock[0].split('\n').length;
    assert.ok(lines <= 8, `setupEventListeners should be thin (got ${lines} lines)`);
    assert.ok(
      popupJs.split('\n').length < 5200,
      'popup.js should be smaller after extraction'
    );
  });

  test('popup.events.js imports all event slices', () => {
    const src = fs.readFileSync(path.join(popupDir, 'popup.events.js'), 'utf8');
    for (const rel of EVENT_MODULES) {
      if (rel === 'popup.events.js') continue;
      const importPath = rel.replace(/\.js$/, '');
      assert.match(src, new RegExp(importPath.replace(/\//g, '\\/')));
    }
  });

  test('event modules pass node syntax check', () => {
    for (const rel of EVENT_MODULES) {
      const full = path.join(popupDir, rel);
      execSync(`node --check "${full.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    }
  });
});

describe('popup events — runtime harness', () => {
  test('registerPopupEventListeners runs without throw', async () => {
    const priorDocument = globalThis.document;
    const priorChrome = globalThis.chrome;
    const priorPasteCraftSupabase = globalThis.pasteCraftSupabase;

    globalThis.document = buildDocumentHarness();
    globalThis.chrome = {
      storage: {
        local: {
          set: async () => {},
          get: async () => ({}),
        },
      },
      tabs: {
        query: (_q, cb) => cb([]),
        sendMessage: () => ({ catch: () => {} }),
      },
    };
    globalThis.pasteCraftSupabase = {
      syncWithQueue: async () => {},
      syncClipsToSupabase: async () => {},
      syncArchivedClipsToSupabase: async () => {},
      setAiWorkflowConfigDirect: () => {},
    };

    try {
      const modUrl = pathToFileURL(path.join(popupDir, 'popup.events.js')).href;
      const { registerPopupEventListeners } = await import(modUrl);
      const app = createMockApp();

      assert.doesNotThrow(() => registerPopupEventListeners(app));
      assert.equal(app._popupEventListenersRegistered, true);

      registerPopupEventListeners(app);
      assert.equal(app._popupEventListenersRegistered, true, 'idempotent second call');
    } finally {
      globalThis.document = priorDocument;
      globalThis.chrome = priorChrome;
      globalThis.pasteCraftSupabase = priorPasteCraftSupabase;
    }
  });

  test('upgrade banner click invokes openUpgradeModal', async () => {
    const priorDocument = globalThis.document;
    const priorChrome = globalThis.chrome;
    const priorPasteCraftSupabase = globalThis.pasteCraftSupabase;

    globalThis.document = buildDocumentHarness();
    globalThis.chrome = {
      storage: { local: { set: async () => {}, get: async () => ({}) } },
      tabs: { query: (_q, cb) => cb([]), sendMessage: () => ({ catch: () => {} }) },
    };
    globalThis.pasteCraftSupabase = {
      syncWithQueue: async () => {},
      setAiWorkflowConfigDirect: () => {},
    };

    try {
      const { registerPopupEventListeners } = await import(
        pathToFileURL(path.join(popupDir, 'popup.events.js')).href
      );
      const app = createMockApp();
      let upgradeOpened = false;
      app.openUpgradeModal = () => {
        upgradeOpened = true;
      };

      registerPopupEventListeners(app);
      document.getElementById('upgradeBanner').click();
      assert.equal(upgradeOpened, true);
    } finally {
      globalThis.document = priorDocument;
      globalThis.chrome = priorChrome;
      globalThis.pasteCraftSupabase = priorPasteCraftSupabase;
    }
  });
});
