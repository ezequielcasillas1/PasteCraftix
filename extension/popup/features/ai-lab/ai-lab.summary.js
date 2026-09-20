import { AI_STORAGE_KEYS, OPEN_RECENT_CONVERSATION_TOOLTIPS } from './ai-lab.constants.js';
import {
  assertModelCapableForAction,
  clearAiLabErrorBanner,
  getSummaryErrorBannerHost,
  presentAiLabError,
} from './ai-lab.model-error.js';
import { downscaleImageForHistory, renderSummaryImageAttach } from './ai-lab.summary-modal.js';
import { mountSummaryClipsOverview } from './ai-lab.summary-clips-overview.js';
import {
  applyCitationMarkup,
  attachSourceLabels,
  ensureSummarySources,
  mergeSummarySources,
  renderSourcesPanelHtml,
  resolveSourcesForDisplay,
} from '../../../shared/summary-sources.js';

export async function generateBreakdownInline(level) {
  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
    return;
  }

  const loadingEl = document.getElementById('bdInlineLoading');
  const resultEl = document.getElementById('bdInlineResult');
  const cached = this.inlineBreakdownCache && this.inlineBreakdownCache[level];
  if (cached) {
    if (resultEl) resultEl.innerHTML = await this._renderAiResponse(cached);
    _emitAiArtifact(this, {
      source: 'ai-lab.inline-breakdown',
      taskType: 'breakdown',
      title: 'AI Breakdown',
      sourceText: this.currentBreakdownText || '',
      question: `Breakdown at ${level} level`,
      level,
      outputText: cached,
      metadata: { inline: true, cached: true },
    });
    return;
  }

  try {
    _setInlineBreakdownLoading(loadingEl, resultEl, true);
    const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);
    const formatted = this._formatAiOutput(explanation);
    _cacheInlineBreakdown(this, level, formatted);

    if (resultEl) resultEl.innerHTML = await this._renderAiResponse(formatted);
    if (loadingEl) loadingEl.style.display = 'none';

    _appendInlineBreakdownThread(this, level, formatted);
    _emitAiArtifact(this, {
      source: 'ai-lab.inline-breakdown',
      taskType: 'breakdown',
      title: 'AI Breakdown',
      sourceText: this.currentBreakdownText || '',
      question: `Breakdown at ${level} level`,
      level,
      outputText: formatted,
      metadata: { inline: true },
    });
    _showInlineFollowup();
    if (this.inlineBreakdownThreads.length >= 2) this.renderInlineBreakdownPagination();
    _mirrorInlineBreakdownState(this);
    await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);
  } catch (error) {
    console.error('Failed to generate inline breakdown:', error);
    presentAiLabError(this, error, {
      resultEl,
      loadingEl,
      fallbackMessage: 'Failed to generate explanation. Please try again.',
    });
  }
}

export async function sendInlineBreakdownFollowup(question) {
  const loadingEl = document.getElementById('bdInlineLoading');
  const resultEl = document.getElementById('bdInlineResult');
  const inputEl = document.getElementById('bdInlineFollowupInput');
  const btnEl = document.getElementById('bdInlineFollowupBtn');

  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
    applyFollowupComposerAfterSend({ inputEl, btnEl, success: false });
    return false;
  }

  if (inputEl) inputEl.disabled = true;
  if (btnEl) btnEl.disabled = true;

  try {
    _setInlineBreakdownLoading(loadingEl, resultEl, true);
    const contextPrompt = _buildInlineFollowupPrompt(this, question);
    const level = this.currentBreakdownLevel || 'college';
    const explanation = await pasteCraftSupabase.breakdownText(contextPrompt, level);
    const formatted = this._formatAiOutput(explanation);

    if (resultEl) resultEl.innerHTML = await this._renderAiResponse(formatted);
    if (loadingEl) loadingEl.style.display = 'none';

    this.inlineBreakdownThreads.push({ question, answer: formatted, level, timestamp: Date.now() });
    _emitAiArtifact(this, {
      source: 'ai-lab.inline-breakdown-followup',
      taskType: 'breakdown',
      title: 'AI Breakdown Follow-up',
      sourceText: this.currentBreakdownText || '',
      question,
      level,
      outputText: formatted,
      metadata: { followup: true, inline: true },
    });
    this.currentInlineBreakdownThreadIndex = this.inlineBreakdownThreads.length - 1;
    this.renderInlineBreakdownPagination();
    _mirrorInlineBreakdownState(this);
    await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);
    applyFollowupComposerAfterSend({ inputEl, btnEl, success: true });
    return true;
  } catch (error) {
    console.error('Failed to send inline follow-up:', error);
    presentAiLabError(this, error, {
      resultEl,
      loadingEl,
      fallbackMessage: 'Failed to generate follow-up',
    });
    applyFollowupComposerAfterSend({ inputEl, btnEl, success: false });
    return false;
  }
}

export function renderInlineBreakdownPagination() {
  const container = document.getElementById('bdInlineThreadPagination');
  if (!container || !this.inlineBreakdownThreads || this.inlineBreakdownThreads.length < 2) {
    if (container) container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';
  this.inlineBreakdownThreads.forEach((thread, idx) => {
    container.appendChild(_createInlineThreadBox(this, container, thread, idx));
  });
}

export function showSummarySection(section) {
  const inputSection = document.getElementById('summaryInputSection');
  const questionsSection = document.getElementById('summaryQuestionsSection');
  const resultSection = document.getElementById('summaryResultSection');

  if (inputSection) inputSection.style.display = 'none';
  if (questionsSection) questionsSection.style.display = 'none';
  if (resultSection) resultSection.style.display = 'none';

  if (section === 'input' && inputSection) inputSection.style.display = 'block';
  if (section === 'questions' && questionsSection) questionsSection.style.display = 'block';
  if (section === 'result' && resultSection) {
    resultSection.style.display = 'block';
    window.renderLucideIcons?.(resultSection);
  }

  // Keep reference image visible across input → questions → paginated result chat.
  if (section === 'questions' || section === 'result') {
    renderSummaryImageAttach(this);
  }
}

export async function generateSummaryQuestions(text) {
  let premiumOk = true;
  if (this.currentUser) {
    premiumOk = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary');
  }
  if (!premiumOk) return;

  try {
    this.showSummarySection('questions');
    const questionsLoading = document.getElementById('questionsLoading');
    const questionsList = document.getElementById('questionsList');
    if (questionsLoading) questionsLoading.style.display = 'flex';
    if (questionsList) questionsList.innerHTML = '';

    const imageBase64 = this.currentSummaryImageBase64 || null;
    if (imageBase64) assertModelCapableForAction(this, 'vision');
    const questions = await pasteCraftSupabase.generateSummaryQuestions(text, imageBase64);
    this.generatedQuestions = questions;
    if (questionsLoading) questionsLoading.style.display = 'none';
    _renderQuestionChips(this, questionsList, text, questions);
    _resetCustomQuestionInput();
    renderSummaryImageAttach(this);
    clearAiLabErrorBanner();

    this._currentSummarySection = 'questions';
    this._saveSummaryState();
  } catch (error) {
    console.error('Failed to generate questions:', error);
    // Stay on input — never pass summaryInputSection as resultEl (that wiped the workspace).
    this.showSummarySection('input');
    presentAiLabError(this, error, {
      bannerHost: getSummaryErrorBannerHost(),
      loadingEl: document.getElementById('questionsLoading'),
      fallbackMessage: 'Failed to generate questions. Please try again.',
    });
  }
}

export async function generateSummary(text, question) {
  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
    return false;
  }

  const summaryLoading = document.getElementById('summaryLoading');
  const summaryContent = document.getElementById('summaryResultContent');

  try {
    this.showSummarySection('result');
    if (summaryLoading) summaryLoading.style.display = 'flex';
    if (summaryContent) summaryContent.innerHTML = '';

    const imageBase64 = this.currentSummaryImageBase64 || null;
    if (imageBase64) assertModelCapableForAction(this, 'vision');
    const { formatted, mergedSources } = await _loadGroundedSummary(this, text, question, imageBase64);
    if (summaryLoading) summaryLoading.style.display = 'none';
    if (summaryContent) summaryContent.innerHTML = await this._renderAiResponse(formatted, text, mergedSources);

    _appendSummaryThread(this, question, formatted);
    _emitAiArtifact(this, {
      source: 'ai-lab.summary',
      taskType: 'summary',
      title: 'AI Summary',
      sourceText: text || this.currentSummaryText || '',
      question,
      outputText: formatted,
      metadata: { threadCount: this.summaryThreads.length + 1 },
    });
    clearAiLabErrorBanner();
    _showSummaryFollowup(this);
    renderSummaryImageAttach(this);
    mountSummaryClipsOverview(this);
    if (this.summaryThreads.length >= 2) this.renderThreadPagination('summary');
    this._currentSummarySection = 'result';
    this._saveSummaryState();
    await _persistGeneratedSummary(this, formatted, text, mergedSources);
    return true;
  } catch (error) {
    console.error('Failed to generate summary:', error);
    presentAiLabError(this, error, {
      bannerHost: getSummaryErrorBannerHost(),
      loadingEl: summaryLoading,
      fallbackMessage: 'Failed to generate summary',
    });
    await _restoreSummaryWorkspaceAfterError(this, summaryContent, question);
    return false;
  }
}

/** Keep result box + follow-up + clip join usable after model/send failures. */
async function _restoreSummaryWorkspaceAfterError(app, summaryContent, question) {
  app.showSummarySection('result');
  const last = app.summaryThreads?.[app.currentSummaryThreadIndex];
  if (summaryContent) {
    if (last) {
      const extras = app.currentSummarySources;
      summaryContent.innerHTML = await app._renderAiResponse(
        last.answer,
        app.currentSummaryText,
        extras,
      );
    } else if (!summaryContent.innerHTML.trim()) {
      // Empty output box stays mounted so clip-append / retry have a target surface.
      summaryContent.innerHTML = '';
    }
  }
  if (question || (app.summaryThreads && app.summaryThreads.length > 0)) {
    _showSummaryFollowup(app);
  }
  const followupInput = document.getElementById('summaryFollowupInput');
  const followupBtn = document.getElementById('summaryFollowupBtn');
  if (followupInput && question && !String(followupInput.value || '').trim()) {
    followupInput.value = question;
    if (followupBtn) followupBtn.disabled = false;
  }
  renderSummaryImageAttach(app);
  mountSummaryClipsOverview(app);
  if (app.summaryThreads?.length >= 2) app.renderThreadPagination?.('summary');
}

async function _historyImageForSummary(app) {
  if (!app.currentSummaryImageBase64) return '';
  const historyImage = await downscaleImageForHistory(app.currentSummaryImageBase64);
  if (historyImage) return historyImage;
  const raw = String(app.currentSummaryImageBase64).trim();
  return raw.startsWith('data:image/') && raw.length <= 220_000 ? raw : '';
}

async function _persistGeneratedSummary(app, formatted, text, extraSources) {
  const persistedSources = resolveSourcesForDisplay(formatted, text, extraSources).sources;
  await app.saveAiHistory('summary', app.currentSummaryText, app.summaryThreads, {
    imageBase64: await _historyImageForSummary(app),
    sources: persistedSources,
  });
}

function _formatSummaryWithSources(app, summary, text, extraSources) {
  return ensureSummarySources(
    app._formatAiOutput(summary),
    text || app.currentSummaryText || '',
    extraSources || app.currentSummarySources,
  );
}

async function _loadGroundedSummary(app, text, question, imageBase64) {
  const extraSources = app.currentSummarySources || [];
  const result = await pasteCraftSupabase.generateSummaryResult(
    attachSourceLabels(text, extraSources),
    question,
    imageBase64,
  );
  const mergedSources = mergeSummarySources(extraSources, result?.sources);
  app.currentSummarySources = mergedSources;
  return {
    formatted: _formatSummaryWithSources(app, result?.summary, text, mergedSources),
    mergedSources,
  };
}

export function _formatAiOutput(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return '';
  const cleaned = s.split(/\r?\n/).map(_cleanAiOutputLine);
  return _collapseBlankLines(cleaned).join('\n').trim();
}

async function _renderMarkdownChunk(text) {
  const chunk = String(text || '').trim();
  if (!chunk) return '';
  if (typeof PCMarkup === 'undefined') return chunk;
  const rendered = PCMarkup.renderMarkup(chunk, null, { type: 'markdown' });
  return rendered && typeof rendered.then === 'function' ? await rendered : rendered;
}

export async function _renderAiResponse(rawText, sourceText, extraSources) {
  const raw = String(rawText || '').trim();
  if (!raw) return '';

  const extras = extraSources !== undefined ? extraSources : this?.currentSummarySources;
  const { body, sources } = resolveSourcesForDisplay(raw, sourceText || '', extras);
  const bodyHtml = await _renderMarkdownChunk(body);
  const citedHtml = _wrapAiTablesForScroll(applyCitationMarkup(bodyHtml || raw, sources));
  const sourcesHtml = renderSourcesPanelHtml(sources);
  if (!sourcesHtml) return citedHtml;
  return `${citedHtml}${sourcesHtml}`;
}

/**
 * Wrap bare markdown <table> output in a horizontal-scroll container so
 * narrow-popup tables scroll instead of squeezing cells mid-word.
 * Idempotent: skips tables already inside .pc-table-scroll.
 */
function _wrapAiTablesForScroll(html) {
  const input = String(html || '');
  if (!input.includes('<table')) return input;
  if (input.includes('pc-table-scroll')) return input;
  return input
    .replace(/<table(\s[^>]*)?>/gi, '<div class="pc-table-scroll"><table$1>')
    .replace(/<\/table>/gi, '</table></div>');
}

/**
 * After a follow-up send: clear the composer only on success.
 * Model-incompatible / network / credit failures keep the question for retry.
 */
export function applyFollowupComposerAfterSend({
  inputEl,
  btnEl,
  success,
  toggleLevelTabs,
} = {}) {
  if (inputEl) {
    if (success) inputEl.value = '';
    inputEl.disabled = false;
  }
  const hasText = Boolean(String(inputEl?.value || '').trim());
  if (btnEl) btnEl.disabled = !hasText;
  if (typeof toggleLevelTabs === 'function') toggleLevelTabs(hasText);
  return { cleared: success === true, preserved: success !== true && hasText };
}

export async function handleBreakdownFollowup(followupQuestion) {
  const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
  const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');
  if (breakdownFollowupInput) breakdownFollowupInput.disabled = true;
  if (breakdownFollowupBtn) breakdownFollowupBtn.disabled = true;
  this.toggleFollowupLevelTabs(false);

  let ok = false;
  try {
    ok = await _runBreakdownFollowup(this, followupQuestion);
  } finally {
    applyFollowupComposerAfterSend({
      inputEl: breakdownFollowupInput,
      btnEl: breakdownFollowupBtn,
      success: ok,
      toggleLevelTabs: (enable) => this.toggleFollowupLevelTabs(enable),
    });
  }
}

export function formatClipViewerPlainText(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return '<div class="clip-viewer-empty">This clip is empty.</div>';
  }

  let paragraphs = normalized
    .split(/\n\s*\n+/)
    .map(part => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 1 && !normalized.includes('\n') && normalized.length > 220) {
    paragraphs = _splitLongPlainText(normalized);
  }

  const html = paragraphs.map((paragraph) => {
    const lineHtml = this.escapeHtml(paragraph).replace(/\n/g, '<br>');
    return `<p>${lineHtml}</p>`;
  }).join('');

  return `<div class="clip-viewer-message">${html}</div>`;
}

function _splitLongPlainText(normalized) {
  const sentences = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [normalized];
  const paragraphs = [];
  let current = '';

  sentences.forEach((sentence) => {
    const next = sentence.trim();
    if (!next) return;
    if (current && (current.length + next.length) > 260) {
      paragraphs.push(current);
      current = next;
      return;
    }
    current = current ? `${current} ${next}` : next;
  });

  if (current) paragraphs.push(current);
  return paragraphs;
}

function _setInlineBreakdownLoading(loadingEl, resultEl, isLoading) {
  if (loadingEl) loadingEl.style.display = isLoading ? 'flex' : 'none';
  if (resultEl && isLoading) resultEl.innerHTML = '';
}

function _cacheInlineBreakdown(app, level, formatted) {
  if (!app.inlineBreakdownCache) app.inlineBreakdownCache = {};
  app.inlineBreakdownCache[level] = formatted;
}

function _appendInlineBreakdownThread(app, level, formatted) {
  if (!app.inlineBreakdownThreads) app.inlineBreakdownThreads = [];
  app.inlineBreakdownThreads.push({
    question: `Breakdown at ${level} level`,
    answer: formatted,
    level,
    timestamp: Date.now(),
  });
  app.currentInlineBreakdownThreadIndex = app.inlineBreakdownThreads.length - 1;
}

function _showInlineFollowup() {
  const followupContainer = document.getElementById('bdInlineFollowup');
  if (followupContainer) followupContainer.style.display = 'block';
}

function _mirrorInlineBreakdownState(app) {
  app.breakdownCache = app.inlineBreakdownCache;
  app.breakdownThreads = app.inlineBreakdownThreads;
  app.currentBreakdownThreadIndex = app.currentInlineBreakdownThreadIndex;
  app._saveBreakdownModalState();
}

function _buildInlineFollowupPrompt(app, question) {
  const prevThread = app.inlineBreakdownThreads[app.currentInlineBreakdownThreadIndex];
  return prevThread
    ? `Previous explanation:\n${prevThread.answer}\n\nUser follow-up: ${question}`
    : question;
}

function _createInlineThreadBox(app, container, thread, idx) {
  const box = document.createElement('button');
  box.className = 'thread-box' + (idx === app.currentInlineBreakdownThreadIndex ? ' active' : '');
  box.textContent = idx + 1;
  box.setAttribute('data-tooltip', thread.question || `Thread ${idx + 1}`);
  box.addEventListener('click', async () => {
    app.currentInlineBreakdownThreadIndex = idx;
    const resultEl = document.getElementById('bdInlineResult');
    if (resultEl) resultEl.innerHTML = await app._renderAiResponse(thread.answer);
    container.querySelectorAll('.thread-box').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });
  });
  return box;
}

function _renderQuestionChips(app, questionsList, text, questions) {
  if (!questionsList) return;
  questions.forEach(question => {
    const chip = document.createElement('button');
    chip.className = 'question-chip';
    chip.textContent = question;
    chip.addEventListener('click', () => {
      app.currentSummaryQuestion = question;
      app.generateSummary(text, question);
    });
    questionsList.appendChild(chip);
  });
}

function _resetCustomQuestionInput() {
  const customInput = document.getElementById('customQuestionInput');
  const customButton = document.getElementById('customQuestionBtn');
  if (customInput) customInput.value = '';
  if (customButton) customButton.disabled = true;
}

function _appendSummaryThread(app, question, formatted) {
  app._currentRawSummary = formatted;
  app.summaryThreads.push({ question, answer: formatted, timestamp: Date.now() });
  app.currentSummaryThreadIndex = app.summaryThreads.length - 1;
}

function _showSummaryFollowup(app) {
  const followupContainer = document.getElementById('summaryFollowupContainer');
  if (followupContainer) followupContainer.style.display = 'block';
  if (app) mountSummaryClipsOverview(app);
}

function _cleanAiOutputLine(line) {
  let next = line;
  if (/^\s*\/\/\s?/.test(next) && !/^\s*\/\/\s*https?:\/\//i.test(next)) {
    next = next.replace(/^\s*\/\/\s?/, '');
  }
  next = next.replace(/^\s*\\\\+\s?/, '');
  return next.replace(/[ \t]+$/, '');
}

function _collapseBlankLines(lines) {
  const out = [];
  let blankRun = 0;
  for (const line of lines) {
    const isBlank = !String(line).trim();
    if (isBlank) {
      blankRun += 1;
      if (blankRun <= 2) out.push('');
      continue;
    }
    blankRun = 0;
    out.push(line);
  }
  return out;
}

async function _runBreakdownFollowup(app, followupQuestion) {
  const loadingEl = document.getElementById('breakdownLoading');
  const resultEl = document.getElementById('breakdownResult');
  const followupContainer = document.getElementById('breakdownFollowupContainer');

  try {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (resultEl) resultEl.innerHTML = '';
    const answer = await _generateBreakdownFollowupAnswer(app, followupQuestion);
    const formatted = app._formatAiOutput(answer);
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultEl) resultEl.innerHTML = await app._renderAiResponse(formatted);

    _emitAiArtifact(app, {
      source: 'ai-lab.breakdown-followup',
      taskType: 'breakdown',
      title: 'AI Breakdown Follow-up',
      sourceText: app.currentBreakdownText || '',
      question: followupQuestion,
      level: app.selectedFollowupLevel || 'standard',
      outputText: formatted,
      metadata: { followup: true },
    });

    app.breakdownThreads.push({
      question: followupQuestion,
      answer: formatted,
      level: app.selectedFollowupLevel || 'standard',
      timestamp: Date.now(),
    });
    app.currentBreakdownThreadIndex = app.breakdownThreads.length - 1;
    if (app.breakdownThreads.length >= 2) app.renderThreadPagination('breakdown');
    app.selectedFollowupLevel = null;
    document.querySelectorAll('.followup-level-tab').forEach(t => t.classList.remove('selected'));
    app._saveBreakdownModalState();
    await app.saveAiHistory('breakdown', app.currentBreakdownText, app.breakdownThreads);
    return true;
  } catch (error) {
    console.error('Failed to generate follow-up:', error);
    presentAiLabError(app, error, {
      resultEl,
      loadingEl,
      fallbackMessage: 'Failed to generate follow-up response',
    });
    if (followupContainer) followupContainer.style.display = 'block';
    return false;
  }
}

function _emitAiArtifact(app, payload) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  app.emitAiTaskOutput(payload);
}

function _generateBreakdownFollowupAnswer(app, followupQuestion) {
  if (app.selectedFollowupLevel) {
    console.log('🎯 Generating follow-up at level:', app.selectedFollowupLevel);
    const levelPrompt = `Based on the previous explanation, answer this follow-up question at a ${app.selectedFollowupLevel} comprehension level: ${followupQuestion}. Context: "${app.currentBreakdownText.substring(0, 100)}..."`;
    return pasteCraftSupabase.breakdownText(levelPrompt, app.selectedFollowupLevel);
  }
  const contextPrompt = `Based on the previous explanation about "${app.currentBreakdownText.substring(0, 100)}...", answer this follow-up: ${followupQuestion}`;
  return pasteCraftSupabase.generateSummary(app.currentBreakdownText, contextPrompt);
}

function _escapeHtmlAttr(val) {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Recent AI History strip on Summary tab empty state ("Open recent conversation"). */
export async function renderOpenRecentConversation(app) {
  const container = document.getElementById('openRecentConversationContainer');
  if (!container) return;

  const entries = typeof app.loadAiHistory === 'function'
    ? await app.loadAiHistory()
    : (await chrome.storage.local.get([AI_STORAGE_KEYS.HISTORY]))[AI_STORAGE_KEYS.HISTORY] || [];
  const recent = (entries || []).slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const tipBreakdown = OPEN_RECENT_CONVERSATION_TOOLTIPS.breakdown;
  const tipSummary = OPEN_RECENT_CONVERSATION_TOOLTIPS.summary;

  container.style.display = 'block';
  container.innerHTML = `
      <div class="open-recent-header">
        <span class="open-recent-icon" aria-hidden="true">\u2192</span>
        <span>Open recent conversation</span>
      </div>
      <div class="open-recent-list">
        ${recent.map((e) => {
    const iconName = e.type === 'breakdown' ? 'brain' : 'notebook-pen';
    const label = e.type === 'breakdown' ? 'Breakdown' : 'Summary';
    const tooltipRaw = e.type === 'breakdown' ? tipBreakdown : tipSummary;
    const title = (e.title || 'Untitled').substring(0, 40) + (e.title?.length > 40 ? '\u2026' : '');
    const timeStr = e.createdAt ? app.getTimeAgo(e.createdAt) : '';
    const tooltip = _escapeHtmlAttr(tooltipRaw);
    return `<button class="open-recent-item" data-history-id="${e.id}" type="button"
            aria-label="${_escapeHtmlAttr(`${label} conversation: ${(e.title || 'Untitled').substring(0, 80)}`)}">
            <span class="open-recent-item-icon" aria-hidden="true" title="${tooltip}"><i data-lucide="${iconName}"></i></span>
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
      if (entry) app.openAiHistoryModal(entry);
    });
  });

  if (typeof app.renderLucideIcons === 'function') {
    app.renderLucideIcons(container);
  } else   if (typeof window.renderLucideIcons === 'function') {
    window.renderLucideIcons(container);
  }
}

export async function handleSummaryFollowup(app, followupQuestion) {
  const summaryFollowupInput = document.getElementById('summaryFollowupInput');
  const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');
  if (summaryFollowupInput) summaryFollowupInput.disabled = true;
  if (summaryFollowupBtn) summaryFollowupBtn.disabled = true;

  let ok = false;
  try {
    ok = await app.generateSummary(app.currentSummaryText, followupQuestion);
  } finally {
    applyFollowupComposerAfterSend({
      inputEl: summaryFollowupInput,
      btnEl: summaryFollowupBtn,
      success: ok === true,
    });
  }
}
