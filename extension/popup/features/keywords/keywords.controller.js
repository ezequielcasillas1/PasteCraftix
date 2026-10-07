/** Keywords facade. Clips calls sendText; definitions stay behind the dictionary port. */

import { activatePopupTab } from '../app/popup.tab-lifecycle.js';
import { MAX_PHRASE_WORDS, PHRASE_LOOKUP_DELAY_MS } from './keywords.constants.js';
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

function sendKeywordsText(app, state, payload) {
  const text = payload?.text || '';
  const words = extractKeywords(text);
  if (!words.length) {
    app.showToast?.('No words to review');
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
  renderKeywordsPage(app, state);
  activatePopupTab(app, 'keywords', { source: 'keywords-send' });
  app.showToast?.(`${words.length} word${words.length === 1 ? '' : 's'} ready`);
  return { ok: true, count: words.length };
}

async function runLookup(app, state, phraseKey, seq) {
  let result;
  try {
    result = await lookupEmphasis(phraseKey);
  } catch {
    result = { found: false, error: true };
  }
  if (seq !== state.lookupSeq) return;
  state.entries.set(phraseKey, rememberEntry(result));
  if (phraseOf(state).key !== phraseKey) return;
  renderKeywordsPage(app, state);
}

function lookupPhrase(app, state) {
  const phrase = phraseOf(state);
  state.phraseKey = phrase.key;
  state.phraseLabel = phrase.label;
  cancelScheduledLookup(state);
  state.lookupSeq += 1;
  const seq = state.lookupSeq;
  if (!phrase.key) {
    renderKeywordsPage(app, state);
    return Promise.resolve();
  }

  const cached = state.entries.get(phrase.key);
  if (cached && cached.status !== 'error') {
    renderKeywordsPage(app, state);
    return Promise.resolve();
  }

  renderKeywordsPage(app, state);
  const delay = phrase.key.includes(' ') ? PHRASE_LOOKUP_DELAY_MS : 0;
  return new Promise((resolve) => {
    state.settleLookup = resolve;
    state.phraseTimer = setTimeout(() => {
      state.settleLookup = null;
      resolve(runLookup(app, state, phrase.key, seq));
    }, delay);
  });
}

function toggleKeyword(app, state, key, options = {}) {
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
  return lookupPhrase(app, state);
}

function clearKeywords(app, state) {
  cancelScheduledLookup(state);
  state.selectedKeys = [];
  state.anchorKey = '';
  state.phraseKey = '';
  state.phraseLabel = '';
  state.lookupSeq += 1;
  renderKeywordsPage(app, state);
}

export function initKeywordsFeature(app) {
  const state = createKeywordsState();
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
  };
  api.events = createKeywordsEvents(api);
  return api;
}
