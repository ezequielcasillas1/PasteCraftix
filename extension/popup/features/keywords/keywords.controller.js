/** Keywords facade. Clips calls sendText; definitions stay behind the dictionary port. */

import { activatePopupTab } from '../app/popup.tab-lifecycle.js';
import {
  CLIP_VIEWER_KEYWORD_SELECTORS,
  KEYWORD_SELECTORS,
  MAX_PHRASE_WORDS,
  PHRASE_LOOKUP_DELAY_MS,
} from './keywords.constants.js';
import { lookupEmphasis } from './keywords.dictionary.js';
import { extractKeywords, selectedPhrase, toggleKeywordSelection, visibleKeywords } from './keywords.extract.js';
import { createKeywordsEvents } from './keywords.events.js';
import { renderKeywordsPage } from './keywords.render.js';
import { createKeywordsState } from './keywords.state.js';

function rememberEntry(result) {
  if (result?.error) return { status: 'error', result };
  if (result?.found) return { status: 'ready', result };
  return { status: 'missing', result };
}

function phraseOf(state) {
  return selectedPhrase(visibleKeywords(state.words, state.hideCommon), state.selectedKeys);
}

function cancelScheduledLookup(state) {
  clearTimeout(state.phraseTimer);
  state.phraseTimer = 0;
  state.settleLookup?.();
  state.settleLookup = null;
}

function revealHost(selectors) {
  const root = selectors.ROOT ? document.getElementById(selectors.ROOT) : null;
  if (root) root.hidden = false;
}

function sendKeywordsText(app, state, payload, selectors = KEYWORD_SELECTORS, options = {}) {
  const text = payload?.text || '';
  const words = extractKeywords(text);
  if (!words.length) {
    if (!options.quietEmpty) app.showToast?.('No words to review');
    if (options.reveal) {
      state.sourceLabel = String(payload?.sourceLabel || 'Clip text');
      state.words = [];
      state.selectedKeys = [];
      state.anchorKey = '';
      state.phraseKey = '';
      state.phraseLabel = '';
      state.entries = new Map();
      state.lookupSeq += 1;
      cancelScheduledLookup(state);
      revealHost(selectors);
      renderKeywordsPage(app, state, selectors);
    }
    return { ok: false, count: 0 };
  }

  state.sourceLabel = String(payload?.sourceLabel || 'Clip text');
  state.words = words;
  state.selectedKeys = [];
  state.anchorKey = '';
  state.phraseKey = '';
  state.phraseLabel = '';
  state.entries = new Map();
  state.lookupSeq += 1;
  cancelScheduledLookup(state);
  revealHost(selectors);
  renderKeywordsPage(app, state, selectors);
  if (options.activateTab !== false) {
    activatePopupTab(app, 'keywords', { source: 'keywords-send' });
    app.showToast?.(`${words.length} word${words.length === 1 ? '' : 's'} ready`);
  }
  return { ok: true, count: words.length };
}

async function runLookup(app, state, phraseKey, seq, selectors) {
  let result;
  try {
    result = await lookupEmphasis(phraseKey);
  } catch {
    result = { found: false, error: true };
  }
  if (seq !== state.lookupSeq) return;
  state.entries.set(phraseKey, rememberEntry(result));
  if (phraseOf(state).key !== phraseKey) return;
  renderKeywordsPage(app, state, selectors);
}

function lookupPhrase(app, state, selectors = KEYWORD_SELECTORS) {
  const phrase = phraseOf(state);
  state.phraseKey = phrase.key;
  state.phraseLabel = phrase.label;
  cancelScheduledLookup(state);
  state.lookupSeq += 1;
  const seq = state.lookupSeq;
  if (!phrase.key) {
    renderKeywordsPage(app, state, selectors);
    return Promise.resolve();
  }

  const cached = state.entries.get(phrase.key);
  if (cached && cached.status !== 'error') {
    renderKeywordsPage(app, state, selectors);
    return Promise.resolve();
  }

  renderKeywordsPage(app, state, selectors);
  const delay = phrase.key.includes(' ') ? PHRASE_LOOKUP_DELAY_MS : 0;
  return new Promise((resolve) => {
    state.settleLookup = resolve;
    state.phraseTimer = setTimeout(() => {
      state.settleLookup = null;
      resolve(runLookup(app, state, phrase.key, seq, selectors));
    }, delay);
  });
}

function toggleKeyword(app, state, key, options = {}, selectors = KEYWORD_SELECTORS) {
  const next = toggleKeywordSelection(state.words, state.selectedKeys, key, {
    extend: !!options.extend,
    anchor: state.anchorKey,
    max: MAX_PHRASE_WORDS,
  });
  if (!options.extend) state.anchorKey = String(key || '').trim().toLowerCase();
  if (next.limited) {
    app.showToast?.('Choose up to 8 words for one phrase');
    return;
  }
  state.selectedKeys = next.keys;
  return lookupPhrase(app, state, selectors);
}

function clearKeywords(app, state, selectors = KEYWORD_SELECTORS) {
  cancelScheduledLookup(state);
  state.selectedKeys = [];
  state.anchorKey = '';
  state.phraseKey = '';
  state.phraseLabel = '';
  state.lookupSeq += 1;
  renderKeywordsPage(app, state, selectors);
}

function hideHost(selectors) {
  const root = selectors.ROOT ? document.getElementById(selectors.ROOT) : null;
  if (root) root.hidden = true;
}

function resetReview(state) {
  cancelScheduledLookup(state);
  state.sourceLabel = '';
  state.words = [];
  state.selectedKeys = [];
  state.anchorKey = '';
  state.phraseKey = '';
  state.phraseLabel = '';
  state.entries = new Map();
  state.lookupSeq += 1;
}

export function initKeywordsFeature(app) {
  const state = createKeywordsState();
  const viewerState = createKeywordsState();
  const api = {
    state,
    sendText(payload) {
      return sendKeywordsText(app, state, payload);
    },
    toggle(key, options) {
      return toggleKeyword(app, state, key, options);
    },
    clear() {
      clearKeywords(app, state);
    },
    refresh() {
      return lookupPhrase(app, state);
    },
    render() {
      const phrase = phraseOf(state);
      state.phraseKey = phrase.key;
      state.phraseLabel = phrase.label;
      renderKeywordsPage(app, state);
    },
    reviewClip(clip) {
      const text = String(clip?.text || '');
      const label = text.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Clip';
      return sendKeywordsText(app, viewerState, {
        text,
        sourceLabel: label,
        clips: [{ id: clip?.id, text, label }],
      }, CLIP_VIEWER_KEYWORD_SELECTORS, { activateTab: false, quietEmpty: true, reveal: true });
    },
    clearClipReview() {
      resetReview(viewerState);
      renderKeywordsPage(app, viewerState, CLIP_VIEWER_KEYWORD_SELECTORS);
      hideHost(CLIP_VIEWER_KEYWORD_SELECTORS);
    },
    reviewToggle(key, options) {
      return toggleKeyword(app, viewerState, key, options, CLIP_VIEWER_KEYWORD_SELECTORS);
    },
    reviewClear() {
      clearKeywords(app, viewerState, CLIP_VIEWER_KEYWORD_SELECTORS);
    },
    reviewHideCommon(checked) {
      viewerState.hideCommon = !!checked;
      return lookupPhrase(app, viewerState, CLIP_VIEWER_KEYWORD_SELECTORS);
    },
  };
  api.events = createKeywordsEvents(api);
  return api;
}
