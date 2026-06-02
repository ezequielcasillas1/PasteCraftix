import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  clearSummaryAiContext,
  resetSummaryToEmpty,
} from '../extension/popup/features/ai-lab/ai-lab.session-state.js';
import { showSummaryModal } from '../extension/popup/features/ai-lab/ai-lab.summary-modal.js';

let originalDocument;
let originalEvent;

function createClassList() {
  const values = new Set();
  return {
    add(...classes) {
      classes.forEach((className) => values.add(className));
    },
    remove(...classes) {
      classes.forEach((className) => values.delete(className));
    },
    contains(className) {
      return values.has(className);
    },
  };
}

function createElement(id, extra = {}) {
  const listeners = [];
  return {
    id,
    value: extra.value || '',
    textContent: extra.textContent || '',
    innerHTML: extra.innerHTML || '',
    disabled: !!extra.disabled,
    scrollTop: 99,
    style: { display: extra.display || '' },
    dataset: extra.dataset || {},
    classList: createClassList(),
    focused: false,
    dispatchedEvents: [],
    addEventListener(type, handler) {
      listeners.push({ type, handler });
    },
    dispatchEvent(event) {
      this.dispatchedEvents.push(event.type);
      listeners
        .filter((listener) => listener.type === event.type)
        .forEach((listener) => listener.handler(event));
      return true;
    },
    focus() {
      this.focused = true;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function buildDocumentHarness() {
  const elements = new Map();
  const add = (id, extra) => {
    const element = createElement(id, extra);
    elements.set(id, element);
    return element;
  };

  const aiTabButton = add('tab-ai', { dataset: { tab: 'ai' } });
  const clipsTabButton = add('tab-clips', { dataset: { tab: 'clips' } });
  const aiTabContent = add('aiTab');
  const clipsTabContent = add('clipsTab');
  const summarySubTab = add('summary-subtab', { dataset: { aiTab: 'summary' } });
  const otherSubTab = add('other-ai-subtab');
  const summarySection = add('aiSummarySection');
  const otherSection = add('aiOtherSection');

  [
    'summaryInput',
    'summaryCharCounter',
    'generateQuestionsBtn',
    'questionsList',
    'summaryResultContent',
    'questionsLoading',
    'summaryLoading',
    'summaryFollowupContainer',
    'summaryThreadPagination',
    'customQuestionInput',
    'customQuestionBtn',
    'openRecentConversationContainer',
  ].forEach((id) => add(id));

  elements.get('questionsList').innerHTML = '<li>old question</li>';
  elements.get('summaryResultContent').innerHTML = '<p>old answer</p>';
  elements.get('questionsLoading').style.display = 'block';
  elements.get('summaryLoading').style.display = 'block';
  elements.get('summaryFollowupContainer').style.display = 'block';
  elements.get('summaryThreadPagination').style.display = 'block';
  elements.get('customQuestionInput').value = 'old follow-up';
  elements.get('customQuestionBtn').disabled = false;

  return {
    elements,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      if (selector === '[data-tab="ai"]') return aiTabButton;
      if (selector === '[data-ai-tab="summary"]') return summarySubTab;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return [aiTabButton, clipsTabButton];
      if (selector === '.tab-content') return [aiTabContent, clipsTabContent];
      if (selector === '.ai-lab-tab') return [summarySubTab, otherSubTab];
      if (selector === '.ai-lab-section') return [summarySection, otherSection];
      return [];
    },
  };
}

function createSummaryApp() {
  return {
    currentSummaryText: 'old summary text',
    generatedQuestions: ['old question'],
    currentSummaryQuestion: 'old selected question',
    _activeSummaryHistoryId: 123,
    summaryThreads: [{ answer: 'old answer' }],
    currentSummaryThreadIndex: 2,
    _currentRawSummary: 'old raw answer',
    _currentSummarySection: 'result',
    shownSections: [],
    historyCalls: [],
    savedSummaryState: 0,
    savedActiveTabState: 0,
    clearedSelections: 0,
    toasts: [],
    showSummarySection(section) {
      this.shownSections.push(section);
    },
    saveToAnalysisHistory(text, type) {
      this.historyCalls.push({ text, type });
    },
    _saveSummaryState() {
      this.savedSummaryState += 1;
    },
    _saveActiveTabState() {
      this.savedActiveTabState += 1;
    },
    clearAllSelections() {
      this.clearedSelections += 1;
    },
    showToast(message) {
      this.toasts.push(message);
    },
  };
}

beforeEach(() => {
  originalDocument = globalThis.document;
  originalEvent = globalThis.Event;
  globalThis.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
});

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.Event = originalEvent;
});

test('clearSummaryAiContext resets stale summary state and DOM output', () => {
  const harness = buildDocumentHarness();
  globalThis.document = harness;
  const app = createSummaryApp();

  clearSummaryAiContext(app);

  assert.equal(app.currentSummaryText, null);
  assert.deepEqual(app.generatedQuestions, []);
  assert.equal(app.currentSummaryQuestion, null);
  assert.equal(app._activeSummaryHistoryId, null);
  assert.deepEqual(app.summaryThreads, []);
  assert.equal(app.currentSummaryThreadIndex, 0);
  assert.equal(app._currentRawSummary, null);
  assert.equal(app._currentSummarySection, 'input');
  assert.deepEqual(app.shownSections, ['input']);
  assert.equal(harness.elements.get('questionsList').innerHTML, '');
  assert.equal(harness.elements.get('summaryResultContent').innerHTML, '');
  assert.equal(harness.elements.get('questionsLoading').style.display, 'none');
  assert.equal(harness.elements.get('summaryLoading').style.display, 'none');
  assert.equal(harness.elements.get('summaryFollowupContainer').style.display, 'none');
  assert.equal(harness.elements.get('summaryThreadPagination').style.display, 'none');
  assert.equal(harness.elements.get('customQuestionInput').value, '');
  assert.equal(harness.elements.get('customQuestionBtn').disabled, true);
});

test('resetSummaryToEmpty clears stale context and disables empty input actions', () => {
  const harness = buildDocumentHarness();
  globalThis.document = harness;
  const app = createSummaryApp();
  harness.elements.get('summaryInput').value = 'old clip';
  harness.elements.get('summaryCharCounter').textContent = '8 characters';
  harness.elements.get('generateQuestionsBtn').disabled = false;

  resetSummaryToEmpty(app);

  assert.equal(harness.elements.get('summaryInput').value, '');
  assert.equal(harness.elements.get('summaryCharCounter').textContent, '0 characters');
  assert.equal(harness.elements.get('generateQuestionsBtn').disabled, true);
  assert.deepEqual(app.summaryThreads, []);
  assert.equal(app._currentSummarySection, 'input');
});

test('showSummaryModal clears prior AI context before saving the new clip text', () => {
  const harness = buildDocumentHarness();
  globalThis.document = harness;
  const app = createSummaryApp();
  const summaryInput = harness.elements.get('summaryInput');

  showSummaryModal(app, 'fresh clip\n\n---\n\nsecond clip');

  assert.deepEqual(app.summaryThreads, []);
  assert.equal(app._currentRawSummary, null);
  assert.equal(harness.elements.get('summaryResultContent').innerHTML, '');
  assert.equal(harness.elements.get('questionsList').innerHTML, '');
  assert.equal(summaryInput.value, 'fresh clip\n\n---\n\nsecond clip');
  assert.deepEqual(summaryInput.dispatchedEvents, ['input']);
  assert.equal(summaryInput.scrollTop, 0);
  assert.equal(summaryInput.focused, true);
  assert.deepEqual(app.historyCalls, [
    { text: 'fresh clip\n\n---\n\nsecond clip', type: 'summary-initiated' },
  ]);
  assert.equal(app.savedSummaryState, 1);
  assert.equal(app.savedActiveTabState, 1);
  assert.equal(app._currentAiLabSubTab, 'summary');
  assert.equal(app.clearedSelections, 1);
  assert.deepEqual(app.toasts, ['2 clips added to summary (scroll to see all)']);
});
