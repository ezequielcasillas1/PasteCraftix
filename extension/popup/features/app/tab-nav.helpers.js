/** Fast tab switch: paint from in-memory state, refresh storage in background when needed. */

const TAB_DATA_REFRESH_MS = 8000;

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

/** Background refresh for tabs that may need storage/IDB reload. Clips/categories/search use storage listener. */
export function refreshTabDataInBackground(app, tabName) {
  const asyncTabs = new Set(['notes', 'aiHistory', 'activity']);
  if (!asyncTabs.has(tabName)) return;
  if (!_shouldRefreshTabData(app, tabName)) return;

  _markTabDataFetched(app, tabName);
  const repaint = () => {
    if (app.currentTab !== tabName) return;
    renderTabFromCache(app, tabName);
    paintTabIcons(tabName);
  };

  if (tabName === 'notes') {
    app.loadNotes().then(repaint).catch(() => {});
  } else if (tabName === 'aiHistory') {
    app.loadAiHistory().then(repaint).catch(() => {});
  } else if (tabName === 'activity') {
    app.activityFeature.service.loadActivityLog(app).then(repaint).catch(() => {});
  }
}

export function paintTabIcons(tabName) {
  window.renderLucideIconsForActiveTab?.(tabName, 'tab-nav-click', { immediate: true });
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
