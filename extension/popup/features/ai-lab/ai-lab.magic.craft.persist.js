// @forward-slice AI Lab magic — craft state persist + UI refresh

function _arrayLen(value) {
  return Array.isArray(value) ? value.length : 0;
}

function _storageMatchesAppLengths(stored, app) {
  return (
    _arrayLen(stored.clips) === _arrayLen(app.clips) &&
    _arrayLen(stored.categories) === _arrayLen(app.categories) &&
    _arrayLen(stored.searchOnlyClips) === _arrayLen(app.searchOnlyClips)
  );
}

export async function _verifyMagicState(app) {
  const stored = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
  return _storageMatchesAppLengths(stored, app);
}

async function _syncMagicToSupabase(app) {
  try {
    await pasteCraftSupabase.syncClipsToSupabase(app.clips);
    await pasteCraftSupabase.syncCategoriesToSupabase(app.categories);
    if (Array.isArray(app.searchOnlyClips) && app.searchOnlyClips.length > 0) {
      await pasteCraftSupabase.syncArchivedClipsToSupabase(app.searchOnlyClips);
    }
  } catch (_) { /* don't block on sync failures */ }
}

function _refactorAttempted(stats) {
  const pipeline = stats.refactorPipeline;
  if (!pipeline) return false;
  if (pipeline.aiResultCount > 0) return true;
  if (pipeline.error) return true;
  return Boolean(pipeline.blockedBeforeCall);
}

export function _didUseAiCredits(stats) {
  if (stats.aiCategorized) return true;
  if (stats.aiFormatted > 0) return true;
  if (stats.aiRefactored > 0) return true;
  return _refactorAttempted(stats);
}

export function _refreshMagicCreditsAndUi(app, stats) {
  if (_didUseAiCredits(stats)) {
    app.updateAiCreditsPills('fresh');
  }
  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
}

export async function _saveMagicState(app, { uiUpdater = null, syncToCloud = true } = {}) {
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      clips: app.clips,
      categories: app.categories,
      searchOnlyClips: app.searchOnlyClips,
      currentPage: app.currentPage,
    }),
    stateSetter: async (newState) => {
      app.clips = Array.isArray(newState.clips) ? newState.clips : [];
      app.categories = Array.isArray(newState.categories) ? newState.categories : [];
      app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
      app.currentPage = typeof newState.currentPage === 'number' ? newState.currentPage : app.currentPage;
    },
    stateKeys: ['clips', 'categories', 'searchOnlyClips', 'currentPage'],
    mutateState: async () => {},
    storageKeys: ['clips', 'categories', 'searchOnlyClips'],
    buildStorageData: async (state) => ({
      clips: state.clips,
      categories: state.categories,
      searchOnlyClips: state.searchOnlyClips,
      pc_local_updatedAt: Date.now(),
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async () => _verifyMagicState(app),
    uiUpdater: () => {
      if (typeof uiUpdater === 'function') uiUpdater();
    },
    backgroundSync: syncToCloud ? async () => {
      await _syncMagicToSupabase(app);
    } : null,
    successMessage: () => '',
    errorMessage: (error) => `Failed to persist crafted clips: ${error.message || 'Unknown error'}`,
    showToast: null,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to persist crafted clips');
  }
}
