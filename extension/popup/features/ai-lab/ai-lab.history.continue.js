// @forward-slice AI Lab history — continue conversation
import {
  deriveEntryOriginalText,
  serializeBreakdownThreads,
  serializeSummaryThreads,
} from './ai-lab.history.persist.js';
import {
  getHistoryEntryImage,
  renderSummaryImageAttach,
} from './ai-lab.summary-modal.js';

function _hasContinuableEntry(entry) {
  return Boolean(entry && entry.threads && entry.threads.length > 0);
}

function _closeAiHistoryModal() {
  const modal = document.getElementById('aiHistoryModal');
  if (modal) modal.style.display = 'none';
}

function _activateAiTab(app) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const aiTab = document.querySelector('[data-tab="ai"]');
  if (aiTab) aiTab.classList.add('active');
  const aiTabEl = document.getElementById('aiTab');
  if (aiTabEl) aiTabEl.classList.add('active');
  app.currentTab = 'ai';
}

function _activateAiLabSubTab(app, subTab, sectionId) {
  document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
  const tabEl = document.querySelector(`[data-ai-tab="${subTab}"]`);
  if (tabEl) tabEl.classList.add('active');
  const sectionEl = document.getElementById(sectionId);
  if (sectionEl) sectionEl.classList.add('active');
  app._currentAiLabSubTab = subTab;
}

function _restoreSummaryState(app, entry) {
  app.currentSummaryText = entry.originalText || '';
  app.summaryThreads = serializeSummaryThreads(entry.threads);
  app.currentSummaryThreadIndex = app.summaryThreads.length - 1;
  app._activeSummaryHistoryId = entry.id;
  app.currentSummaryImageBase64 = getHistoryEntryImage(entry) || null;
}

async function _renderRestoredSummaryView(app) {
  app.showSummarySection('result');
  renderSummaryImageAttach(app);
  const lastThread = app.summaryThreads[app.currentSummaryThreadIndex];
  const summaryContent = document.getElementById('summaryResultContent');
  if (summaryContent && lastThread) {
    summaryContent.innerHTML = await app._renderAiResponse(lastThread.answer);
  }
}

function _showSummaryFollowupAndPagination(app) {
  const followupContainer = document.getElementById('summaryFollowupContainer');
  if (followupContainer) followupContainer.style.display = 'block';
  app.aiLabFeature?.summaryClipsOverview?.mountSummaryClipsOverview?.(app);
  if (app.summaryThreads.length >= 2) {
    app.renderThreadPagination('summary');
  }
}

function _persistSummaryRestore(app) {
  app._currentSummarySection = 'result';
  app._saveSummaryState();
  app._saveActiveTabState();
  app.showToast('Conversation restored — ask a follow-up!');
}

async function _continueSummaryConversation(app, entry) {
  _restoreSummaryState(app, entry);
  _activateAiTab(app);
  _activateAiLabSubTab(app, 'summary', 'aiSummarySection');
  await _renderRestoredSummaryView(app);
  _showSummaryFollowupAndPagination(app);
  _persistSummaryRestore(app);
}

function _restoreBreakdownState(app, entry) {
  app.currentBreakdownText = deriveEntryOriginalText(entry);
  app.breakdownThreads = serializeBreakdownThreads(entry.threads);
  app.currentBreakdownThreadIndex = app.breakdownThreads.length - 1;
  app._activeBreakdownHistoryId = entry.id;
  app.currentBreakdownLevel = entry.threads[0]?.level || null;
}

function _openBreakdownModal() {
  const modal = document.getElementById('breakdownModal');
  if (!modal) return;
  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
}

function _populateBreakdownOriginalText(app) {
  if (typeof app.setBreakdownOriginalText === 'function') {
    app.setBreakdownOriginalText(app.currentBreakdownText, { sourceMode: 'continue', collapsed: true });
    return;
  }

  const originalEl = document.getElementById('breakdownOriginalText');
  if (originalEl) originalEl.textContent = app.currentBreakdownText;

  const lengthEl = document.getElementById('breakdownTextLength');
  if (lengthEl && app.currentBreakdownText) {
    const wordCount = app.currentBreakdownText.trim().split(/\s+/).length;
    lengthEl.textContent = `${wordCount} words`;
  }
}

async function _renderRestoredBreakdownView(app) {
  const resultEl = document.getElementById('breakdownResult');
  const lastThread = app.breakdownThreads[app.currentBreakdownThreadIndex];
  if (resultEl && lastThread) {
    resultEl.innerHTML = await app._renderAiResponse(lastThread.answer);
  }
}

function _showBreakdownFollowupAndPagination(app) {
  const followupContainer = document.getElementById('breakdownFollowupContainer');
  if (followupContainer) followupContainer.style.display = 'block';
  if (app.breakdownThreads.length >= 2) {
    app.renderThreadPagination('breakdown');
  }
}

function _persistBreakdownRestore(app) {
  app._saveBreakdownModalState();
  app._saveActiveTabState();
  app.showToast('Conversation restored — ask a follow-up!');
}

async function _continueBreakdownConversation(app, entry) {
  _restoreBreakdownState(app, entry);
  _activateAiTab(app);
  _activateAiLabSubTab(app, 'breakdown', 'aiBreakdownSection');
  _openBreakdownModal();
  _populateBreakdownOriginalText(app);
  await _renderRestoredBreakdownView(app);
  _showBreakdownFollowupAndPagination(app);
  _persistBreakdownRestore(app);
}

export async function continueHistoryConversation() {
  const app = this;
  const entry = app.currentHistoryEntry;
  if (!_hasContinuableEntry(entry)) {
    app.showToast('No conversation to continue');
    return;
  }

  _closeAiHistoryModal();

  if (entry.type === 'summary') {
    await _continueSummaryConversation(app, entry);
  } else if (entry.type === 'breakdown') {
    await _continueBreakdownConversation(app, entry);
  }
}
