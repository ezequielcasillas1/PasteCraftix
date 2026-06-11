/** Breakdown modal, thread pagination, and inline breakdown entry. */
import { isOutOfCreditsError, showCreditExhaustedInline } from './ai-lab.credit-error.js';

const LEVEL_DESCRIPTIONS = {
  eli5: '<strong>Child Level:</strong> Super simple explanation using basic words and fun examples',
  elementary: '<strong>Elementary School Level:</strong> Clear explanation for kids ages 8-11 with relatable examples',
  highschool: '<strong>High School Level:</strong> More sophisticated explanation with relevant concepts for teenagers',
  college: '<strong>College Level:</strong> Academic explanation with detailed analysis and nuanced understanding',
  phd: '<strong>PhD/Expert Level:</strong> Technical analysis with advanced concepts and scholarly depth',
  wiseman: '<strong>Wise Man:</strong> Philosophical wisdom with metaphors, life lessons, and profound insights',
};

export function showBreakdownModal(app, text) {
  const breakdownModal = document.getElementById('breakdownModal');
  const breakdownOriginalText = document.getElementById('breakdownOriginalText');
  const breakdownTextLength = document.getElementById('breakdownTextLength');

  if (!breakdownModal || !breakdownOriginalText) return;

  app.currentBreakdownText = text;
  app.currentBreakdownLevel = null;
  app.breakdownCache = {};
  app.breakdownThreads = [];
  app.currentBreakdownThreadIndex = 0;
  app._activeBreakdownHistoryId = null;
  app.selectedFollowupLevel = null;

  breakdownOriginalText.textContent = text;

  if (breakdownTextLength) {
    const wordCount = text.trim().split(/\s+/).length;
    breakdownTextLength.textContent = `${wordCount} words`;
  }

  breakdownOriginalText.style.display = 'none';
  breakdownOriginalText.offsetHeight;
  breakdownOriginalText.style.display = 'block';
  breakdownOriginalText.scrollTop = 0;

  breakdownModal.style.display = 'flex';

  const breakdownResult = document.getElementById('breakdownResult');
  if (breakdownResult) breakdownResult.innerHTML = '';

  const loadingEl = document.getElementById('breakdownLoading');
  const followupContainer = document.getElementById('breakdownFollowupContainer');
  const paginationContainer = document.getElementById('breakdownThreadPagination');
  if (loadingEl) loadingEl.style.display = 'none';
  if (followupContainer) followupContainer.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'none';

  document.querySelectorAll('.breakdown-tab').forEach((tab) => tab.classList.remove('active'));

  const levelInfoText = document.getElementById('levelInfoText');
  if (levelInfoText) {
    levelInfoText.innerHTML = `
      <strong>Choose a level:</strong> Select a comprehension level above to get an AI-powered explanation tailored to that audience
    `;
  }

  const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
  if (clipCount > 1) {
    app.showToast(`${clipCount} clips ready for breakdown (scroll to see all)`);
  }

  app.saveToAnalysisHistory(text, 'breakdown-initiated');
  app._saveBreakdownPageState();
  app._currentAiLabSubTab = 'breakdown';
  app._saveActiveTabState();
}

export function showBreakdownModalWithLevel(app, text, level) {
  showBreakdownModal(app, text);
  app.currentBreakdownLevel = level;

  document.querySelectorAll('.breakdown-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.level === level);
  });
  updateLevelInfo(level);
  generateBreakdown.call(app, level);
}

export function hideBreakdownModal(app) {
  document.getElementById('breakdownModal').style.display = 'none';
  app.currentBreakdownText = null;
  app.currentBreakdownLevel = null;
  app.breakdownCache = {};

  app.breakdownThreads = [];
  app.currentBreakdownThreadIndex = 0;

  const followupContainer = document.getElementById('breakdownFollowupContainer');
  const paginationContainer = document.getElementById('breakdownThreadPagination');
  if (followupContainer) followupContainer.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'none';

  const breakdownResult = document.getElementById('breakdownResult');
  const italicsBtn = document.getElementById('breakdownItalicsBtn');
  if (breakdownResult && italicsBtn) {
    breakdownResult.classList.remove('italics');
    italicsBtn.classList.remove('active');
  }
}

export function toggleBreakdownItalics() {
  const breakdownResult = document.getElementById('breakdownResult');
  const italicsBtn = document.getElementById('breakdownItalicsBtn');

  if (breakdownResult && italicsBtn) {
    const isActive = breakdownResult.classList.toggle('italics');
    italicsBtn.classList.toggle('active');
    console.log(`?? Breakdown Result Italics ${isActive ? 'ENABLED' : 'DISABLED'}`);
  } else {
    console.error('? Elements not found:', { breakdownResult, italicsBtn });
  }
}

export function updateLevelInfo(level) {
  document.getElementById('levelInfoText').innerHTML = LEVEL_DESCRIPTIONS[level] || '';
}

export async function generateBreakdown(level) {
  let premiumOk = true;
  if (this.currentUser) {
    premiumOk = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown');
  }
  if (!premiumOk) return;

  if (this.breakdownCache[level]) {
    const resultEl = document.getElementById('breakdownResult');
    const cachedOutput = this.breakdownCache[level];
    resultEl.innerHTML = await this._renderAiResponse(cachedOutput);
    _emitBreakdownArtifact(this, level, cachedOutput, { cached: true });
    return;
  }

  const loadingEl = document.getElementById('breakdownLoading');
  const resultEl = document.getElementById('breakdownResult');

  try {
    loadingEl.style.display = 'flex';
    resultEl.innerHTML = '';

    const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);
    const formatted = this._formatAiOutput(explanation);
    this.breakdownCache[level] = formatted;

    resultEl.innerHTML = await this._renderAiResponse(formatted);
    loadingEl.style.display = 'none';
    _emitBreakdownArtifact(this, level, formatted);

    this.breakdownThreads.push({
      question: `Breakdown at ${level} level`,
      answer: formatted,
      level,
      timestamp: Date.now(),
    });
    this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;

    const followupContainer = document.getElementById('breakdownFollowupContainer');
    if (followupContainer) followupContainer.style.display = 'block';

    if (this.breakdownThreads.length >= 2) {
      renderThreadPagination.call(this, 'breakdown');
    }

    this._saveBreakdownModalState();
    await this.saveAiHistory('breakdown', this.currentBreakdownText, this.breakdownThreads);
  } catch (error) {
    console.error('Failed to generate breakdown:', error);
    if (isOutOfCreditsError(error)) {
      showCreditExhaustedInline(this, resultEl, loadingEl);
    } else {
      const message = String(error?.message || '').trim();
      resultEl.textContent = message || 'Failed to generate explanation.';
      loadingEl.style.display = 'none';
      this.showToast(message || 'Failed to generate explanation');
    }
  }
}

function _emitBreakdownArtifact(app, level, outputText, metadata = {}) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  app.emitAiTaskOutput({
    source: 'ai-lab.breakdown',
    taskType: 'breakdown',
    title: 'AI Breakdown',
    sourceText: app.currentBreakdownText || '',
    question: `Breakdown at ${level} level`,
    level,
    outputText,
    metadata,
  });
}

export function copyBreakdownText(app) {
  const text = document.getElementById('breakdownResult').textContent;
  if (text) {
    app.copyToClipboardFallback(text)
      .then(() => app.showToast('Explanation copied to clipboard!'))
      .catch((error) => {
        console.error('Breakdown copy failed:', error);
        app.showToast('Failed to copy explanation', 'error');
      });
  }
}

export function startInlineBreakdown(app, text, level) {
  app.currentBreakdownText = text;
  app.currentBreakdownLevel = level;
  app.inlineBreakdownCache = {};
  app.inlineBreakdownThreads = [];
  app.currentInlineBreakdownThreadIndex = 0;

  const resultsSection = document.getElementById('bdInlineResults');
  if (resultsSection) {
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('.bd-inline-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.inlineLevel === level);
  });

  const levelNames = { eli5: 'Child', elementary: 'Elementary', highschool: 'High School', college: 'College', phd: 'PhD', wiseman: 'Wise Man' };
  const badge = document.getElementById('bdInlineLevelBadge');
  if (badge) badge.textContent = levelNames[level] || level;

  app.generateBreakdownInline(level);
}

export function toggleFollowupLevelTabs(enable) {
  const tabs = document.querySelectorAll('.followup-level-tab');
  tabs.forEach((tab) => {
    if (enable) {
      tab.classList.remove('disabled');
      tab.disabled = false;
    } else {
      tab.classList.add('disabled');
      tab.disabled = true;
    }
  });
}

export function renderThreadPagination(type) {
  const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
  const currentIndex = type === 'summary' ? this.currentSummaryThreadIndex : this.currentBreakdownThreadIndex;
  const paginationContainer = document.getElementById(`${type}ThreadPagination`);

  if (!paginationContainer || threads.length < 2) return;

  paginationContainer.style.display = 'flex';
  paginationContainer.style.gap = '8px';
  paginationContainer.innerHTML = '';

  threads.forEach((thread, index) => {
    const box = document.createElement('div');
    box.className = `thread-box ${index === currentIndex ? 'active' : ''}`;
    box.textContent = index + 1;

    box.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: ${index === currentIndex ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
        border: 2px solid ${index === currentIndex ? '#2563eb' : '#cbd5e1'};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: ${index === currentIndex ? 'white' : '#64748b'};
        transition: all 0.25s ease;
        position: relative;
      `;

    const tooltipText = generateThreadTooltip(thread, index + 1);
    box.setAttribute('data-tooltip', tooltipText);
    box.setAttribute('title', tooltipText);

    box.addEventListener('click', () => {
      navigateToThread.call(this, type, index);
    });

    paginationContainer.appendChild(box);
  });
}

export function generateThreadTooltip(thread, number) {
  const question = thread.question || 'Response';
  const summaryTitle = question.length > 30 ? `${question.substring(0, 30)}...` : question;
  return `${number}. "${summaryTitle}"`;
}

export async function navigateToThread(type, index) {
  const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
  if (index < 0 || index >= threads.length) return;

  const thread = threads[index];
  const contentEl = document.getElementById(type === 'summary' ? 'summaryResultContent' : 'breakdownResult');

  if (contentEl) {
    contentEl.innerHTML = await this._renderAiResponse(thread.answer);
  }

  if (typeof this.emitAiTaskOutput === 'function') {
    this.emitAiTaskOutput({
      source: `ai-lab.${type}-thread`,
      taskType: type === 'breakdown' ? 'breakdown' : 'summary',
      title: type === 'breakdown' ? 'AI Breakdown Thread' : 'AI Summary Thread',
      sourceText: type === 'breakdown' ? this.currentBreakdownText || '' : this.currentSummaryText || '',
      question: thread.question || '',
      level: thread.level || '',
      outputText: thread.answer || '',
      metadata: { threadIndex: index, threadNavigation: true },
    });
  }

  if (type === 'summary') {
    this.currentSummaryThreadIndex = index;
  } else {
    this.currentBreakdownThreadIndex = index;
  }

  renderThreadPagination.call(this, type);
}
