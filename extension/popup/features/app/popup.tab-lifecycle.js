/** Coordinates cached popup tab painting and first-use hydration. */

import { showTabLoadingState } from '../../shared/tab-loading.js';
import {
  markTabCachedActivationEnd,
  markTabCachedActivationStart,
} from './popup.performance.js';

const tabLifecycles = new WeakMap();

function createLifecycle() {
  return {
    activationId: 0,
    tabs: new Map(),
  };
}

function getLifecycle(app) {
  if (!tabLifecycles.has(app)) tabLifecycles.set(app, createLifecycle());
  return tabLifecycles.get(app);
}

function getTabState(lifecycle, tab) {
  if (!lifecycle.tabs.has(tab)) {
    lifecycle.tabs.set(tab, { status: 'idle', promise: null, readyOnce: false });
  }
  return lifecycle.tabs.get(tab);
}

/** First visit / never succeeded — avoid empty-state flash before hydrate. */
function shouldShowTabLoading(state, definition) {
  if (!definition?.hydrate) return false;
  if (state.readyOnce || state.status === 'hydrated') return false;
  return true;
}

function activateTabDom(app, tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

  document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`${tab}Tab`)?.classList.add('active');
  app.currentTab = tab;
}

function renderClips(app) {
  app.renderChips?.();
  app.updateManualInputCategories?.();
}

function renderCategories(app) {
  app.renderCategories?.();
  app.updateCategoryBulkActions?.();
  app.updateManualInputCategories?.();
}

function renderSearch(app) {
  app.renderSearchResults?.();
  app.updateSearchBulkActions?.();
}

function renderLiked(app) {
  app.likedFeature?.render?.renderLikedPage?.(app);
}

function renderNotes(app) {
  app.renderNotes?.();
}

function renderWidgets(app) {
  app.widgetsFeature?.render?.renderWidgetsGallery?.(app);
}

function renderAiHistory(app) {
  app.resetAiHistoryListPagination?.();
  app.renderAiHistoryList?.();
}

function renderActivity(app) {
  app.activityFeature?.render?.renderActivityList?.(app);
}

function hydrateCategories(app) {
  return app.filesFeature?.initialize?.(app);
}

function hydrateLiked(app) {
  return app.likedFeature?.render?.hydrateLikedTab?.(app);
}

function renderAi(app) {
  app.updateAiCreditsPills?.('ai-tab');
}

function hydrateNotes(app) {
  return app.loadNotes?.();
}

function hydrateWidgets(app) {
  return app.widgetsFeature?.service?.loadWidgets?.(app);
}

function hydrateAiHistory(app) {
  return app.loadAiHistory?.();
}

function hydrateActivity(app) {
  return app.activityFeature?.service?.loadActivityLog?.(app);
}

const TAB_REGISTRY = Object.freeze({
  clips: { render: renderClips },
  categories: {
    render: renderCategories,
    hydrate: hydrateCategories,
    // Categories list is already in memory; only files hydrate async.
    renderWhileHydrating: true,
  },
  search: { render: renderSearch },
  liked: {
    render: renderLiked,
    hydrate: hydrateLiked,
    // Re-read liked ids every visit so a heart click is never stuck behind readyOnce.
    canRevalidate: true,
  },
  ai: { render: renderAi },
  notes: {
    render: renderNotes,
    hydrate: hydrateNotes,
  },
  widgets: {
    render: renderWidgets,
    hydrate: hydrateWidgets,
  },
  aiHistory: {
    render: renderAiHistory,
    hydrate: hydrateAiHistory,
    canRevalidate: true,
  },
  activity: {
    render: renderActivity,
    hydrate: hydrateActivity,
    canRevalidate: true,
  },
});

function renderTab(app, tab) {
  TAB_REGISTRY[tab]?.render?.(app);
}

function isCurrentActivation(app, lifecycle, tab, activationId) {
  return app.currentTab === tab && lifecycle.activationId === activationId;
}

function renderActiveTabIcons(app, tab, source) {
  if (app.currentTab !== tab) return;
  window.renderLucideIconsForActiveTab?.(tab, source, { immediate: true });
}

function hydrateTab(app, lifecycle, tab, { revalidate = false } = {}) {
  const definition = TAB_REGISTRY[tab];
  if (!definition?.hydrate) return Promise.resolve();

  const state = getTabState(lifecycle, tab);
  if (state.promise) return state.promise;
  if (state.status === 'hydrated' && !revalidate) return Promise.resolve();
  if (revalidate && !definition.canRevalidate) return Promise.resolve();

  state.status = 'hydrating';
  const operation = Promise.resolve().then(() => definition.hydrate(app));
  state.promise = typeof app._withTimeout === 'function'
    ? app._withTimeout(operation, 3000, undefined, `${tab} tab hydration`)
    : operation;

  state.promise = state.promise.then(
    (result) => {
      state.status = 'hydrated';
      state.readyOnce = true;
      state.promise = null;
      return result;
    },
    (error) => {
      state.status = 'failed';
      state.promise = null;
      throw error;
    },
  );
  return state.promise;
}

function paintTabActivation(app, lifecycle, tab) {
  const definition = TAB_REGISTRY[tab];
  const state = getTabState(lifecycle, tab);
  if (shouldShowTabLoading(state, definition)) {
    showTabLoadingState(tab);
    if (definition.renderWhileHydrating) renderTab(app, tab);
    return;
  }
  renderTab(app, tab);
}

export function activatePopupTab(app, tab, options = {}) {
  const lifecycle = getLifecycle(app);
  const activationId = ++lifecycle.activationId;
  const definition = TAB_REGISTRY[tab];
  // Tabs with canRevalidate (Liked, Activity, AI History) refresh on every visit.
  const revalidate = options.revalidate === true
    || (!!definition?.canRevalidate && options.revalidate !== false);

  markTabCachedActivationStart();
  window.__pcTabIconRendering = true;
  activateTabDom(app, tab);
  app._saveActiveTabState?.();
  app.updateHeaderClipCount?.();
  paintTabActivation(app, lifecycle, tab);
  markTabCachedActivationEnd();

  const hydration = hydrateTab(app, lifecycle, tab, { ...options, revalidate });
  hydration
    .then(() => {
      if (isCurrentActivation(app, lifecycle, tab, activationId)) renderTab(app, tab);
    })
    .catch(() => {
      if (isCurrentActivation(app, lifecycle, tab, activationId)) renderTab(app, tab);
    })
    .finally(() => {
      window.__pcTabIconRendering = false;
      renderActiveTabIcons(app, tab, options.source || 'tab-activation');
    });

  return hydration;
}

export function restorePopupTab(app, tab) {
  const restoredTab = TAB_REGISTRY[tab] ? tab : 'clips';
  return activatePopupTab(app, restoredTab, { source: 'session-restore-tab' });
}

export function hydratePopupTabInBackground(app, tab, options = {}) {
  return hydrateTab(app, getLifecycle(app), tab, options);
}

export function revalidatePopupTab(app, tab) {
  if (!TAB_REGISTRY[tab]?.canRevalidate) return Promise.resolve();
  return activatePopupTab(app, tab, { revalidate: true, source: 'tab-revalidation' });
}
