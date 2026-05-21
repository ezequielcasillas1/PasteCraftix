export async function saveActiveTabState(app) {
  try {
    await chrome.storage.local.set({
      pc_activeTab_v1: app.currentTab || 'clips',
      pc_aiLabSubTab_v1: app._currentAiLabSubTab || 'generator'
    });
  } catch (_) {}
}

export async function getCurrentTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id ?? null;
  } catch (_) {
    return null;
  }
}

export async function saveBreakdownPageState(app) {
  try {
    const breakdownInput = document.getElementById('breakdownInput');
    const tabId = await getCurrentTabId();
    const state = {
      inputText: breakdownInput ? breakdownInput.value : '',
      selectedLevel: app.selectedBreakdownLevel || null,
      tabId
    };
    await chrome.storage.local.set({ pc_breakdownPageState_v1: state });
  } catch (_) {}
}

export async function saveBreakdownModalState(app) {
  try {
    const tabId = await getCurrentTabId();
    const state = {
      originalText: app.currentBreakdownText || null,
      activeLevel: app.currentBreakdownLevel || null,
      cache: app.breakdownCache || {},
      threads: (app.breakdownThreads || []).slice(0, 20),
      threadIndex: app.currentBreakdownThreadIndex || 0,
      timestamp: Date.now(),
      tabId
    };
    await chrome.storage.local.set({ pc_breakdownModalState_v1: state });
  } catch (_) {}
}

export async function saveSummaryState(app) {
  try {
    const summaryInput = document.getElementById('summaryInput');
    const tabId = await getCurrentTabId();
    const currentThread = app.summaryThreads?.[app.currentSummaryThreadIndex];
    const rawResult = currentThread?.answer || app._currentRawSummary || '';
    const state = {
      inputText: summaryInput ? summaryInput.value : '',
      currentSummaryText: app.currentSummaryText || null,
      generatedQuestions: (app.generatedQuestions || []).slice(0, 20),
      currentQuestion: app.currentSummaryQuestion || null,
      resultContent: rawResult,
      threads: (app.summaryThreads || []).slice(0, 20),
      threadIndex: app.currentSummaryThreadIndex || 0,
      activeSection: app._currentSummarySection || 'input',
      timestamp: Date.now(),
      tabId
    };
    await chrome.storage.local.set({ pc_summaryState_v1: state });
  } catch (_) {}
}

export function resetSummaryToEmpty(app) {
  app.currentSummaryText = null;
  app.generatedQuestions = [];
  app.currentSummaryQuestion = null;
  app._activeSummaryHistoryId = null;
  app.summaryThreads = [];
  app.currentSummaryThreadIndex = 0;
  app._currentRawSummary = null;
  app._currentSummarySection = 'input';
  const summaryInput = document.getElementById('summaryInput');
  const summaryCharCounter = document.getElementById('summaryCharCounter');
  const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
  const followupContainer = document.getElementById('summaryFollowupContainer');
  const paginationContainer = document.getElementById('summaryThreadPagination');
  if (summaryInput) summaryInput.value = '';
  if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
  if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
  if (followupContainer) followupContainer.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'none';
  app.showSummarySection('input');
  renderOpenRecentConversation(app);
}

export function resetBreakdownToEmpty(app) {
  app.currentBreakdownText = null;
  app.currentBreakdownLevel = null;
  app.breakdownCache = {};
  app.breakdownThreads = [];
  app.currentBreakdownThreadIndex = 0;
  app.selectedBreakdownLevel = null;
  const breakdownInput = document.getElementById('breakdownInput');
  const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
  const levelChips = document.querySelectorAll('.level-chip');
  if (breakdownInput) {
    breakdownInput.value = '';
    breakdownInput.dispatchEvent(new Event('input'));
  }
  if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
  levelChips.forEach(c => {
    c.classList.remove('selected');
    c.disabled = true;
  });
  const breakdownCharCounter = document.getElementById('breakdownCharCounter');
  if (breakdownCharCounter) breakdownCharCounter.textContent = '0 characters';
}

export async function renderOpenRecentConversation(app) {
  await app._initializeAiLabFeature();
  const renderFn =
    app.aiLabFeature?.summary?.renderOpenRecentConversation
    || app.aiLabFeature?.history?.renderOpenRecentConversation;
  if (typeof renderFn === 'function') {
    return renderFn(app);
  }
  return renderOpenRecentConversationFallback(app);
}

export async function renderOpenRecentConversationFallback(app) {
  const container = document.getElementById('openRecentConversationContainer');
  if (!container) return;

  const entries = typeof app.loadAiHistory === 'function'
    ? await app.loadAiHistory()
    : (await chrome.storage.local.get(['pc_aiHistory_v1'])).pc_aiHistory_v1 || [];
  const recent = (entries || []).slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
      <div class="open-recent-header">
        <span class="open-recent-icon" aria-hidden="true">\u2192</span>
        <span>Open recent conversation</span>
      </div>
      <div class="open-recent-list">
        ${recent.map((e) => {
          const label = e.type === 'breakdown' ? 'Breakdown' : 'Summary';
          const title = (e.title || 'Untitled').substring(0, 40) + (e.title?.length > 40 ? '\u2026' : '');
          const timeStr = e.createdAt ? app.getTimeAgo(e.createdAt) : '';
          return `<button class="open-recent-item" data-history-id="${e.id}" type="button">
            <span class="open-recent-item-title">${app.escapeHtml(title)}</span>
            <span class="open-recent-item-meta">${label} \u00b7 ${timeStr}</span>
          </button>`;
        }).join('')}
      </div>
    `;

  app.aiHistoryEntries = entries;
  container.querySelectorAll('.open-recent-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.historyId, 10);
      const entry = app.aiHistoryEntries?.find((x) => x.id === id);
      if (entry && typeof app.openAiHistoryModal === 'function') {
        app.openAiHistoryModal(entry);
      }
    });
  });
}
