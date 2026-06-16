import {
  SESSION_STATE_KEYS,
  SETTINGS_CHANGE_KEYS,
  LOCAL_CHANGE_DEBOUNCE_MS,
  LOCAL_CHANGE_FLUSH_MS,
} from './auth.constants.js';

const TAB_LOADERS = Object.freeze({
  categories: (app) => {
    app.renderCategories();
    app.updateCategoryBulkActions();
  },
  search: (app) => {
    app.renderSearchResults();
    app.updateSearchBulkActions();
  },
  ai: (app) => {
    app.updateAiCreditsPills('ai-tab');
  },
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
    app.renderAiHistoryList();
  },
});

const AI_SUBTAB_SECTIONS = Object.freeze({
  summary: 'aiSummarySection',
  refactorization: 'aiRefactorizationSection',
  breakdown: 'aiBreakdownSection',
});

async function _dispatchTabLoad(app, savedTab) {
  const loader = TAB_LOADERS[savedTab];
  if (loader) await loader(app);
}

function _activateMainTab(app, savedTab, tabBtn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  tabBtn.classList.add('active');
  app.currentTab = savedTab;
  const tabEl = document.getElementById(savedTab + 'Tab');
  if (tabEl) tabEl.classList.add('active');
}

async function _restoreActiveTab(app, stored) {
  const savedTab = stored.pc_activeTab_v1;
  if (!savedTab || savedTab === 'clips') return savedTab;

  const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
  if (!tabBtn) return savedTab;

  _activateMainTab(app, savedTab, tabBtn);
  await _dispatchTabLoad(app, savedTab);
  return savedTab;
}

function _activateAiSubTabSection(savedAiSubTab) {
  const elId = AI_SUBTAB_SECTIONS[savedAiSubTab];
  if (!elId) return;
  const el = document.getElementById(elId);
  if (el) el.classList.add('active');
}

function _restoreAiSubTab(app, stored) {
  const savedAiSubTab = stored.pc_aiLabSubTab_v1;
  if (!savedAiSubTab || savedAiSubTab === 'summary') return savedAiSubTab;

  app._currentAiLabSubTab = savedAiSubTab;
  const subTabBtn = document.querySelector(`.ai-lab-tab[data-ai-tab="${savedAiSubTab}"]`);
  const sectionId = AI_SUBTAB_SECTIONS[savedAiSubTab];

  if (!subTabBtn && !sectionId) return savedAiSubTab;

  document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
  if (subTabBtn) subTabBtn.classList.add('active');
  _activateAiSubTabSection(savedAiSubTab);

  if (savedAiSubTab === 'refactorization' && app.aiLabFeature?.refactorization?.renderRefactorizationPanel) {
    app.aiLabFeature.refactorization.renderRefactorizationPanel.call(app);
  }

  return savedAiSubTab;
}

function _readBreakdownSavedTabId(stored) {
  const page = stored.pc_breakdownPageState_v1;
  if (page && page.tabId != null) return page.tabId;
  const modal = stored.pc_breakdownModalState_v1;
  return modal ? modal.tabId : null;
}

function _shouldRestoreBreakdown(currentTabId, stored) {
  const savedId = _readBreakdownSavedTabId(stored);
  return currentTabId != null && savedId != null && currentTabId === savedId;
}

function _shouldRestoreSummary(currentTabId, stored) {
  const summary = stored.pc_summaryState_v1;
  const savedId = summary ? summary.tabId : null;
  return currentTabId != null && savedId != null && currentTabId === savedId;
}

function _applyBreakdownInput(bdPage) {
  const breakdownInput = document.getElementById('breakdownInput');
  if (breakdownInput && bdPage.inputText) {
    breakdownInput.value = bdPage.inputText;
    breakdownInput.dispatchEvent(new Event('input'));
  }
}

function _activateLevelChip(level) {
  const chip = document.querySelector(`.level-chip[data-level="${level}"]`);
  if (!chip) return;
  document.querySelectorAll('.level-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function _applyBreakdownLevel(app, bdPage) {
  if (!bdPage.selectedLevel) return;
  app.selectedBreakdownLevel = bdPage.selectedLevel;
  _activateLevelChip(bdPage.selectedLevel);
  const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
  if (analyzeLevelBtn && bdPage.inputText) analyzeLevelBtn.disabled = false;
}

function _hasAnyBreakdownState(stored) {
  return !!(stored.pc_breakdownPageState_v1 || stored.pc_breakdownModalState_v1);
}

function _restoreBreakdownPage(app, stored, canRestore) {
  const bdPage = stored.pc_breakdownPageState_v1;
  if (bdPage && canRestore) {
    _applyBreakdownInput(bdPage);
    _applyBreakdownLevel(app, bdPage);
    return;
  }
  if (!canRestore && _hasAnyBreakdownState(stored)) {
    app._resetBreakdownToEmpty();
  }
}

function _hasValidBreakdownModalData(bdModal) {
  if (!bdModal || !bdModal.originalText) return false;
  const threads = bdModal.threads;
  return Array.isArray(threads) && threads.length > 0;
}

function _restoreBreakdownModal(app, stored, canRestore) {
  const bdModal = stored.pc_breakdownModalState_v1;
  if (!_hasValidBreakdownModalData(bdModal)) return;
  if (!canRestore) return;
  app.currentBreakdownText = bdModal.originalText;
  app.currentBreakdownLevel = bdModal.activeLevel;
  app.breakdownCache = bdModal.cache || {};
  app.breakdownThreads = bdModal.threads || [];
  app.currentBreakdownThreadIndex = bdModal.threadIndex || 0;
}

function _hydrateSummaryFields(app, sum) {
  const summaryInput = document.getElementById('summaryInput');
  if (summaryInput && sum.inputText) {
    summaryInput.value = sum.inputText;
    summaryInput.dispatchEvent(new Event('input'));
  }
  if (sum.currentSummaryText) app.currentSummaryText = sum.currentSummaryText;
  if (sum.generatedQuestions) app.generatedQuestions = sum.generatedQuestions;
  if (sum.currentQuestion) app.currentSummaryQuestion = sum.currentQuestion;
  if (sum.threads) app.summaryThreads = sum.threads;
  if (sum.threadIndex != null) app.currentSummaryThreadIndex = sum.threadIndex;
}

function _createSummaryQuestionChip(app, question, sum) {
  const chip = document.createElement('button');
  chip.className = 'question-chip';
  chip.textContent = question;
  chip.addEventListener('click', () => {
    app.currentSummaryQuestion = question;
    app.generateSummary(app.currentSummaryText || sum.inputText, question);
  });
  return chip;
}

function _renderSummaryQuestionsSection(app, sum) {
  app.showSummarySection('questions');
  const questionsList = document.getElementById('questionsList');
  if (!questionsList) return;
  questionsList.innerHTML = '';
  sum.generatedQuestions.forEach(question => {
    questionsList.appendChild(_createSummaryQuestionChip(app, question, sum));
  });
}

function _hasThreads(sum) {
  return Array.isArray(sum.threads) && sum.threads.length > 0;
}

function _showSummaryFollowupIfThreaded(sum) {
  const followupContainer = document.getElementById('summaryFollowupContainer');
  if (followupContainer && _hasThreads(sum)) {
    followupContainer.style.display = 'block';
  }
}

function _renderSummaryResultSection(app, sum) {
  app.showSummarySection('result');
  const summaryContent = document.getElementById('summaryResultContent');
  if (summaryContent) {
    app._renderAiResponse(sum.resultContent).then(html => {
      summaryContent.innerHTML = html;
    });
  }
  _showSummaryFollowupIfThreaded(sum);
  if (Array.isArray(sum.threads) && sum.threads.length >= 2) {
    app.renderThreadPagination('summary');
  }
}

function _hasGeneratedQuestions(sum) {
  return Array.isArray(sum.generatedQuestions) && sum.generatedQuestions.length > 0;
}

function _restoreSummarySection(app, sum) {
  if (!sum.activeSection || sum.activeSection === 'input') return;
  if (sum.activeSection === 'questions' && _hasGeneratedQuestions(sum)) {
    _renderSummaryQuestionsSection(app, sum);
  } else if (sum.activeSection === 'result' && sum.resultContent) {
    _renderSummaryResultSection(app, sum);
  }
}

function _restoreSummary(app, stored, canRestore) {
  const sum = stored.pc_summaryState_v1;
  if (!sum || !canRestore) {
    app._resetSummaryToEmpty();
    return;
  }
  _hydrateSummaryFields(app, sum);
  _restoreSummarySection(app, sum);
  if (!sum.activeSection || sum.activeSection === 'input') {
    app._renderOpenRecentConversation();
  }
}

function _logSessionRestore(_stored) {
  // Session restore is silent in production.
}

export async function _restoreSessionState(app) {
  try {
    const stored = await chrome.storage.local.get(SESSION_STATE_KEYS);

    await _restoreActiveTab(app, stored);
    _restoreAiSubTab(app, stored);

    const currentTabId = await app._getCurrentTabId();
    const canRestoreBreakdown = _shouldRestoreBreakdown(currentTabId, stored);
    const canRestoreSummary = _shouldRestoreSummary(currentTabId, stored);

    _restoreBreakdownPage(app, stored, canRestoreBreakdown);
    _restoreBreakdownModal(app, stored, canRestoreBreakdown);
    _restoreSummary(app, stored, canRestoreSummary);

    _logSessionRestore(stored);
  } catch (err) {
    console.warn('⚠️ Failed to restore session state:', err);
  }
}

function _initLocalChangeState(app) {
  app._handlingLocalChange = false;
  app._lastLocalChangeAt = 0;
  app._localChangeTimerId = null;
  app._isUpdating = {
    clips: false,
    categories: false,
    notes: false,
    ai: false,
    search: false,
  };
}

function _classifyStorageChanges(changes) {
  const clipsChanged = !!(changes.clips || changes.searchOnlyClips);
  const categoriesChanged = !!changes.categories;
  const notesChanged = !!changes.notes;
  const settingsChanged = SETTINGS_CHANGE_KEYS.some(key => !!changes[key]);
  const analysisHistoryChanged = !!changes.analysisHistory;
  const aiHistoryChanged = !!changes.pc_aiHistory_v1;
  const profileChanged = !!changes.userProfile;
  const aiDataChanged = analysisHistoryChanged || aiHistoryChanged || profileChanged;
  const relevant = clipsChanged || categoriesChanged || notesChanged || settingsChanged || aiDataChanged;
  return {
    clipsChanged,
    categoriesChanged,
    notesChanged,
    settingsChanged,
    analysisHistoryChanged,
    aiHistoryChanged,
    profileChanged,
    aiDataChanged,
    relevant,
  };
}

function _shouldProcessChange(app, now) {
  if (app._handlingLocalChange) return false;
  if (document.visibilityState !== 'visible') return false;
  return (now - app._lastLocalChangeAt) >= LOCAL_CHANGE_DEBOUNCE_MS;
}

async function _refreshDataStores(app, classification) {
  const {
    clipsChanged,
    categoriesChanged,
    notesChanged,
    analysisHistoryChanged,
    aiHistoryChanged,
    profileChanged,
  } = classification;
  if (clipsChanged || categoriesChanged) await app.loadData();
  if (notesChanged) await app.loadNotes();
  if (analysisHistoryChanged) await app.loadAnalysisHistory();
  if (aiHistoryChanged) await app.loadAiHistory();
  if (profileChanged) await app.loadUserProfile();
}

function _refreshClipsView(app) {
  if (app._isUpdating.clips) return;
  app._isUpdating.clips = true;
  try {
    app.renderChips();
    app.updateLastCapture();
    app.updatePreview();
  } finally {
    app._isUpdating.clips = false;
  }
}

function _refreshSearchView(app) {
  if (app._isUpdating.search) return;
  app._isUpdating.search = true;
  try {
    app.renderSearchResults();
    app.updateSearchBulkActions();
  } finally {
    app._isUpdating.search = false;
  }
}

function _refreshCategoriesView(app) {
  if (app._isUpdating.categories) return;
  app._isUpdating.categories = true;
  try {
    app.renderCategories();
    app.updateCategoryFilter();
    app.updateManualInputCategories();
    app.updateCategoryBulkActions();
  } finally {
    app._isUpdating.categories = false;
  }
}

function _refreshNotesView(app) {
  if (app._isUpdating.notes) return;
  app._isUpdating.notes = true;
  try {
    app.renderNotes();
  } finally {
    app._isUpdating.notes = false;
  }
}

function _refreshAiView(app) {
  if (app._isUpdating.ai) return;
  app._isUpdating.ai = true;
  try {
    app.updateAiCreditsPills('ai-tab');
  } finally {
    app._isUpdating.ai = false;
  }
}

const VIEW_REFRESHERS = Object.freeze({
  clips: { needs: (c) => c.clipsChanged, fn: _refreshClipsView },
  search: { needs: (c) => c.clipsChanged, fn: _refreshSearchView },
  categories: { needs: (c) => c.clipsChanged || c.categoriesChanged, fn: _refreshCategoriesView },
  notes: { needs: (c) => c.notesChanged, fn: _refreshNotesView },
  ai: { needs: (c) => c.aiDataChanged, fn: _refreshAiView },
  aiHistory: { needs: (c) => c.aiHistoryChanged, fn: async (app) => {
    await app.loadAiHistory();
    app.renderAiHistoryList();
  }},
});

function _refreshCurrentTabView(app, classification) {
  const entry = VIEW_REFRESHERS[app.currentTab];
  if (entry && entry.needs(classification)) entry.fn(app);
}

function _refreshSettingsModalIfOpen(app, classification) {
  if (!classification.settingsChanged) return;
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal && settingsModal.style.display !== 'none') {
    app.showSettingsModal();
  }
}

function _refreshProfileIdentity(app, classification) {
  if (!classification.profileChanged) return;
  app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
}

async function _handleStorageChange(app, changes, classification) {
  if (app._handlingLocalChange) return;
  app._handlingLocalChange = true;
  try {
    await app._mirrorChangedLocalStateToIndexedDb(changes);
    await _refreshDataStores(app, classification);
    _refreshCurrentTabView(app, classification);
    _refreshSettingsModalIfOpen(app, classification);
    _refreshProfileIdentity(app, classification);
  } finally {
    app._handlingLocalChange = false;
  }
}

export function setupLocalStorageListener(app) {
  try {
    _initLocalChangeState(app);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes) return;

      const classification = _classifyStorageChanges(changes);
      if (!classification.relevant) return;

      const now = Date.now();
      if (!_shouldProcessChange(app, now)) return;
      app._lastLocalChangeAt = now;

      if (app._localChangeTimerId) clearTimeout(app._localChangeTimerId);
      app._localChangeTimerId = setTimeout(() => {
        _handleStorageChange(app, changes, classification);
      }, LOCAL_CHANGE_FLUSH_MS);
    });
  } catch (_) {}
}
