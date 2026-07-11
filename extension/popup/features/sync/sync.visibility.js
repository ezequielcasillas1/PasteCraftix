/**
 * Refreshes popup UI when the extension panel becomes visible again.
 */

const DATA_VERSION_KEY = 'pc_local_updatedAt';

function renderCachedCurrentState(app) {
  const renderers = {
    clips: () => {
      app.renderChips();
      app.updateLastCapture();
      app.updatePreview();
    },
    categories: () => {
      app.renderCategories();
      app.updateCategoryFilter();
    },
    search: () => app.renderSearchResults(),
    liked: () => app.likedFeature?.render?.renderLikedPage?.(app),
    notes: () => app.renderNotes(),
    widgets: () => app.widgetsFeature?.render?.renderWidgetsGallery?.(app),
    ai: () => app.updateAiCreditsPills?.('visibility'),
    aiHistory: () => app.renderAiHistoryList(),
    activity: () => app.activityFeature?.render?.renderActivityList?.(app),
  };
  renderers[app.currentTab]?.();
}

async function readStorageVersion() {
  const stored = await chrome.storage.local.get([DATA_VERSION_KEY]);
  return Number.isFinite(stored?.[DATA_VERSION_KEY]) ? stored[DATA_VERSION_KEY] : 0;
}

async function refreshVisibleState(app) {
  const storageVersion = await readStorageVersion();
  const versionChanged = storageVersion !== (app._popupStorageVersion ?? storageVersion);

  if (app._popupDataStale || versionChanged) {
    await app.loadData();
    app._popupDataStale = false;
  }
  app._popupStorageVersion = storageVersion;

  if (app._popupProfileStale) {
    await app.loadUserProfile();
    app._popupProfileStale = false;
    app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
  }
  renderCachedCurrentState(app);
}

export function setupVisibilityListener(app) {
  if (app._popupVisibilityListenerRegistered) return;
  app._popupVisibilityListenerRegistered = true;
  readStorageVersion()
    .then((version) => { app._popupStorageVersion = version; })
    .catch(() => {});

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshVisibleState(app).catch((error) => {
      console.warn('Popup visibility refresh failed:', error);
    });
  });
}
