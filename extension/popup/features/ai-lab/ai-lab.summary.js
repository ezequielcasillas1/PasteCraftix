import { AI_STORAGE_KEYS, OPEN_RECENT_CONVERSATION_TOOLTIPS } from './ai-lab.constants.js';
import { isOutOfCreditsError, showCreditExhaustedInline } from './ai-lab.credit-error.js';

export async function generateBreakdownInline(level) {
  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
    return;
  }

  const loadingEl = document.getElementById('bdInlineLoading');
  const resultEl = document.getElementById('bdInlineResult');
  const cached = this.inlineBreakdownCache && this.inlineBreakdownCache[level];
  if (cached) {
    if (resultEl) resultEl.innerHTML = await this._renderAiResponse(cached);
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
    _showInlineFollowup();
    if (this.inlineBreakdownThreads.length >= 2) this.renderInlineBreakdownPagination();
    _mirrorInlineBreakdownState(this);
    await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);
  } catch (error) {
    console.error('Failed to generate inline breakdown:', error);
    if (isOutOfCreditsError(error)) {
      showCreditExhaustedInline(this, resultEl, loadingEl);
    } else {
      if (resultEl) resultEl.innerHTML = '❌ Failed to generate explanation. Please try again.';
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate explanation');
    }
  }
}

export async function sendInlineBreakdownFollowup(question) {
  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
    return;
  }

  const loadingEl = document.getElementById('bdInlineLoading');
  const resultEl = document.getElementById('bdInlineResult');

  try {
    _setInlineBreakdownLoading(loadingEl, resultEl, true);
    const contextPrompt = _buildInlineFollowupPrompt(this, question);
    const level = this.currentBreakdownLevel || 'college';
    const explanation = await pasteCraftSupabase.breakdownText(contextPrompt, level);
    const formatted = this._formatAiOutput(explanation);

    if (resultEl) resultEl.innerHTML = await this._renderAiResponse(formatted);
    if (loadingEl) loadingEl.style.display = 'none';

    this.inlineBreakdownThreads.push({ question, answer: formatted, level, timestamp: Date.now() });
    this.currentInlineBreakdownThreadIndex = this.inlineBreakdownThreads.length - 1;
    this.renderInlineBreakdownPagination();
    _mirrorInlineBreakdownState(this);
    await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);
  } catch (error) {
    console.error('Failed to send inline follow-up:', error);
    if (isOutOfCreditsError(error)) {
      showCreditExhaustedInline(this, resultEl, loadingEl);
    } else {
      if (resultEl) resultEl.innerHTML = '❌ Failed to generate response.';
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate follow-up');
    }
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
  if (section === 'result' && resultSection) resultSection.style.display = 'block';
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

    const questions = await pasteCraftSupabase.generateSummaryQuestions(text);
    this.generatedQuestions = questions;
    if (questionsLoading) questionsLoading.style.display = 'none';
    _renderQuestionChips(this, questionsList, text, questions);
    _resetCustomQuestionInput();

    this._currentSummarySection = 'questions';
    this._saveSummaryState();
  } catch (error) {
    console.error('Failed to generate questions:', error);
    if (isOutOfCreditsError(error)) {
      this.showSummarySection('input');
      const inputSection = document.getElementById('summaryInputSection');
      showCreditExhaustedInline(this, inputSection, document.getElementById('questionsLoading'));
    } else {
      const message = String(error?.message || '').trim();
      this.showToast(message || 'Failed to generate questions. Please try again.');
      this.showSummarySection('input');
    }
  }
}

export async function generateSummary(text, question) {
  if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
    return;
  }

  const summaryLoading = document.getElementById('summaryLoading');
  const summaryContent = document.getElementById('summaryResultContent');

  try {
    this.showSummarySection('result');
    if (summaryLoading) summaryLoading.style.display = 'flex';
    if (summaryContent) summaryContent.innerHTML = '';

    const summary = await pasteCraftSupabase.generateSummary(text, question);
    const formatted = this._formatAiOutput(summary);
    if (summaryLoading) summaryLoading.style.display = 'none';
    if (summaryContent) summaryContent.innerHTML = await this._renderAiResponse(formatted);

    _appendSummaryThread(this, question, formatted);
    _showSummaryFollowup();
    if (this.summaryThreads.length >= 2) this.renderThreadPagination('summary');
    this._currentSummarySection = 'result';
    this._saveSummaryState();
    await this.saveAiHistory('summary', this.currentSummaryText, this.summaryThreads);
  } catch (error) {
    console.error('Failed to generate summary:', error);
    if (isOutOfCreditsError(error)) {
      showCreditExhaustedInline(this, summaryContent, summaryLoading);
    } else {
      const message = String(error?.message || '').trim();
      if (summaryContent) {
        summaryContent.textContent = `❌ ${message || 'Failed to generate summary.'}`;
      }
      if (summaryLoading) summaryLoading.style.display = 'none';
      this.showToast(message || 'Failed to generate summary');
    }
  }
}

export function _formatAiOutput(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return '';
  const cleaned = s.split(/\r?\n/).map(_cleanAiOutputLine);
  return _collapseBlankLines(cleaned).join('\n').trim();
}

export async function _renderAiResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const text = rawText.trim();
  if (!text) return '';
  if (typeof PCMarkup === 'undefined') return text;

  const mermaidBlocks = [];
  const latexBlocks = [];
  let processed = _extractMermaidBlocks(text, mermaidBlocks);
  processed = _extractLatexBlocks(processed, latexBlocks);
  let html = PCMarkup.renderMarkup(processed, null, { type: 'markdown' });
  html = _renderLatexBlocks(html, latexBlocks);
  return _renderMermaidBlocks(html, mermaidBlocks);
}

export async function handleBreakdownFollowup(followupQuestion) {
  const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
  const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');
  if (breakdownFollowupInput) {
    breakdownFollowupInput.value = '';
    breakdownFollowupInput.disabled = true;
  }
  if (breakdownFollowupBtn) breakdownFollowupBtn.disabled = true;
  this.toggleFollowupLevelTabs(false);

  try {
    await _runBreakdownFollowup(this, followupQuestion);
  } finally {
    if (breakdownFollowupInput) breakdownFollowupInput.disabled = false;
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

function _showSummaryFollowup() {
  const followupContainer = document.getElementById('summaryFollowupContainer');
  if (followupContainer) followupContainer.style.display = 'block';
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

function _extractMermaidBlocks(text, mermaidBlocks) {
  return text.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, code) => {
    const placeholder = `%%MERMAID_BLOCK_${mermaidBlocks.length}%%`;
    mermaidBlocks.push(code.trim());
    return placeholder;
  });
}

function _extractLatexBlocks(text, latexBlocks) {
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => _pushLatex(latexBlocks, expr, true));
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => _pushLatex(latexBlocks, expr, true));
  processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => _pushLatex(latexBlocks, expr, false));
  return processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => _pushLatex(latexBlocks, expr, false));
}

function _pushLatex(latexBlocks, expr, display) {
  const type = display ? 'DISPLAY' : 'INLINE';
  const placeholder = `%%LATEX_${type}_${latexBlocks.length}%%`;
  latexBlocks.push({ expr: expr.trim(), display });
  return placeholder;
}

function _renderLatexBlocks(html, latexBlocks) {
  if (typeof katex === 'undefined') return html;
  let output = html;
  for (let i = 0; i < latexBlocks.length; i++) {
    output = _replaceLatexBlock(output, latexBlocks[i], i);
  }
  return output;
}

function _replaceLatexBlock(html, block, index) {
  const displayPlaceholder = `%%LATEX_DISPLAY_${index}%%`;
  const inlinePlaceholder = `%%LATEX_INLINE_${index}%%`;
  try {
    const rendered = katex.renderToString(block.expr, {
      displayMode: block.display,
      throwOnError: false,
    });
    return html.replace(displayPlaceholder, rendered).replace(inlinePlaceholder, rendered);
  } catch (_) {
    const fallback = `<code>${PCMarkup.escapeHtml(block.expr)}</code>`;
    return html.replace(displayPlaceholder, fallback).replace(inlinePlaceholder, fallback);
  }
}

async function _renderMermaidBlocks(html, mermaidBlocks) {
  let output = html;
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const placeholder = `%%MERMAID_BLOCK_${i}%%`;
    if (output.includes(placeholder)) {
      output = await _replaceMermaidBlock(output, placeholder, mermaidBlocks[i]);
    }
  }
  return output;
}

async function _replaceMermaidBlock(html, placeholder, block) {
  try {
    const mermaidHtml = await PCMarkup.renderMarkup(block, null, { type: 'mermaid' });
    return html.replace(placeholder, mermaidHtml);
  } catch (_) {
    return html.replace(placeholder, `<pre class="pc-code-block"><code>${PCMarkup.escapeHtml(block)}</code></pre>`);
  }
}

async function _runBreakdownFollowup(app, followupQuestion) {
  const loadingEl = document.getElementById('breakdownLoading');
  const resultEl = document.getElementById('breakdownResult');

  try {
    if (loadingEl) loadingEl.style.display = 'flex';
    if (resultEl) resultEl.innerHTML = '';
    const answer = await _generateBreakdownFollowupAnswer(app, followupQuestion);
    const formatted = app._formatAiOutput(answer);
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultEl) resultEl.innerHTML = await app._renderAiResponse(formatted);

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
  } catch (error) {
    console.error('Failed to generate follow-up:', error);
    if (resultEl) resultEl.innerHTML = '❌ Failed to generate follow-up response.';
    if (loadingEl) loadingEl.style.display = 'none';
    app.showToast('Failed to generate follow-up');
  }
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
    app.renderLucideIcons();
  } else   if (typeof window.renderLucideIcons === 'function') {
    window.renderLucideIcons();
  }
}

export async function handleSummaryFollowup(app, followupQuestion) {
  const summaryFollowupInput = document.getElementById('summaryFollowupInput');
  if (summaryFollowupInput) {
    summaryFollowupInput.value = '';
    summaryFollowupInput.disabled = true;
  }

  const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');
  if (summaryFollowupBtn) {
    summaryFollowupBtn.disabled = true;
  }

  await app.generateSummary(app.currentSummaryText, followupQuestion);

  if (summaryFollowupInput) {
    summaryFollowupInput.disabled = false;
  }
}
