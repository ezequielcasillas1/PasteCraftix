/** Fast tab switch: paint from cache, skip stale re-renders, defer heavy work. */

import {
  finishUxInteractionAfterPaint,
  startUxInteraction,
} from '../../shared/ux-perf-capture.js';

const TAB_DATA_REFRESH_MS = 8000;
const TAB_STATE_SAVE_MS = 250;

const RENDERABLE_TABS = new Set([
  'clips', 'categories', 'search', 'ai', 'notes', 'aiHistory', 'activity',
]);

export function markAllTabsDirty(app) {
  app._tabDirty = {
    clips: true,
    categories: true,
    search: true,
    ai: true,
    notes: true,
    aiHistory: true,
    activity: true,
  };
}

export function markTabDirty(app, tabName) {
  if (!tabName) return;
  app._tabDirty = app._tabDirty || {};
  app._tabDirty[tabName] = true;
  const tabEl = document.getElementById?.(`${tabName}Tab`);
  if (tabEl?.dataset) delete tabEl.dataset.pcIconsReady;
}

export function markTabsDirtyForStorageChange(app, classification) {
  app._tabDirty = app._tabDirty || {};
  if (classification.clipsChanged) {
    app._tabDirty.clips = true;
    app._tabDirty.categories = true;
    app._tabDirty.search = true;
  }
  if (classification.categoriesChanged) {
    app._tabDirty.categories = true;
  }
  if (classification.notesChanged) {
    app._tabDirty.notes = true;
  }
  if (classification.aiDataChanged) {
    app._tabDirty.ai = true;
    app._tabDirty.aiHistory = true;
  }
}

function isTabDirty(app, tabName) {
  if (!RENDERABLE_TABS.has(tabName)) return false;
  app._tabEverRendered = app._tabEverRendered || {};
  if (!app._tabEverRendered[tabName]) return true;
  return !!(app._tabDirty && app._tabDirty[tabName]);
}

export function clearTabRenderDirty(app, tabName) {
  app._tabDirty = app._tabDirty || {};
  app._tabDirty[tabName] = false;
  app._tabEverRendered = app._tabEverRendered || {};
  app._tabEverRendered[tabName] = true;
}

export function activateMainTabUI(app, tabName, tabBtn) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
  tabBtn.classList.add('active');
  app.currentTab = tabName;
  const tabEl = document.getElementById(`${tabName}Tab`);
  if (tabEl) tabEl.classList.add('active');
}

export function renderTabFromCache(app, tabName) {
  switch (tabName) {
    case 'clips':
      app.renderChips();
      app.updateManualInputCategories();
      break;
    case 'categories':
      app.renderCategories();
      app.updateCategoryBulkActions();
      app.updateManualInputCategories();
      break;
    case 'search':
      app.renderSearchResults();
      app.updateSearchBulkActions();
      break;
    case 'ai':
      app.updateAiCreditsPills('ai-tab');
      break;
    case 'notes':
      app.renderNotes();
      break;
    case 'aiHistory':
      app.resetAiHistoryListPagination?.();
      app.renderAiHistoryList();
      break;
    case 'activity':
      app.activityFeature.render.renderActivityList(app);
      break;
    default:
      break;
  }
}

function _shouldRefreshTabData(app, tabName) {
  app._tabDataFetchedAt = app._tabDataFetchedAt || {};
  const last = app._tabDataFetchedAt[tabName] || 0;
  return (Date.now() - last) > TAB_DATA_REFRESH_MS;
}

function _markTabDataFetched(app, tabName) {
  app._tabDataFetchedAt = app._tabDataFetchedAt || {};
  app._tabDataFetchedAt[tabName] = Date.now();
}

export function refreshTabDataInBackground(app, tabName) {
  const asyncTabs = new Set(['notes', 'aiHistory', 'activity']);
  if (!asyncTabs.has(tabName)) return;
  if (!_shouldRefreshTabData(app, tabName)) return;

  _markTabDataFetched(app, tabName);
  const repaint = () => {
    if (app.currentTab !== tabName) return;
    markTabDirty(app, tabName);
    renderTabFromCache(app, tabName);
    clearTabRenderDirty(app, tabName);
    paintTabIconsDeferred(tabName);
  };

  if (tabName === 'notes') {
    app.loadNotes().then(repaint).catch(() => {});
  } else if (tabName === 'aiHistory') {
    app.loadAiHistory().then(repaint).catch(() => {});
  } else if (tabName === 'activity') {
    app.activityFeature.service.loadActivityLog(app).then(repaint).catch(() => {});
  }
}

export function paintTabIconsDeferred(tabName, { force = false } = {}) {
  requestAnimationFrame(() => {
    window.renderLucideIconsForActiveTab?.(tabName, 'tab-nav-click', { immediate: false, force });
  });
}

export function scheduleActiveTabStateSave(app) {
  if (app._tabStateSaveTimer) {
    clearTimeout(app._tabStateSaveTimer);
  }
  app._tabStateSaveTimer = setTimeout(() => {
    app._tabStateSaveTimer = null;
    app._saveActiveTabState?.().catch(() => {});
  }, TAB_STATE_SAVE_MS);
}

/** Main entry: instant tab chrome, deferred render + perf probes. */
export function switchMainTab(app, nextTab, tabBtn) {
  const fromTab = app.currentTab;
  if (!nextTab || nextTab === fromTab) return;

  const perf = startUxInteraction('nav-tab', `${fromTab || '?'}→${nextTab}`, { fromTab, nextTab });

  window.__pcTabIconRendering = true;
  activateMainTabUI(app, nextTab, tabBtn);

  scheduleActiveTabStateSave(app);

  const needsRender = isTabDirty(app, nextTab);

  if (app._tabSwitchRaf) {
    cancelAnimationFrame(app._tabSwitchRaf);
  }

  app._tabSwitchRaf = requestAnimationFrame(() => {
    app._tabSwitchRaf = 0;
    let renderError = null;
    try {
      if (needsRender) {
        renderTabFromCache(app, nextTab);
        clearTabRenderDirty(app, nextTab);
        paintTabIconsDeferred(nextTab, { force: true });
      } else if (nextTab === 'ai') {
        app.updateAiCreditsPills?.('ai-tab');
      }
      refreshTabDataInBackground(app, nextTab);
    } catch (err) {
      renderError = err?.message || String(err);
    } finally {
      window.__pcTabIconRendering = false;
      finishUxInteractionAfterPaint(perf, {
        location: 'tab-nav.helpers:switchMainTab',
        skippedRender: !needsRender,
        renderError,
      });
    }
  });
}

export const TAB_ASYNC_LOADERS = Object.freeze({
  notes: async (app) => {
    await app._withTimeout(app.loadNotes(), 3000, undefined, 'loadNotes');
    app.renderNotes();
  },
  activity: async (app) => {
    await app._withTimeout(app.activityFeature.service.loadActivityLog(app), 3000, undefined, 'loadActivityLog');
    app.activityFeature.render.renderActivityList(app);
  },
  aiHistory: async (app) => {
    await app._withTimeout(app.loadAiHistory(), 3000, undefined, 'loadAiHistory');
    app.resetAiHistoryListPagination?.();
    app.renderAiHistoryList();
  },
});

export async function loadTabDataForRestore(app, tabName) {
  const loader = TAB_ASYNC_LOADERS[tabName];
  if (loader) await loader(app);
}
