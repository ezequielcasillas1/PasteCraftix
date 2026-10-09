/** Keywords facade. Review stays on Quick Save and clips. The page keeps saved words. */

import {
  CLIP_VIEWER_KEYWORD_SELECTORS,
  MAX_PHRASE_WORDS,
  PHRASE_LOOKUP_DELAY_MS,
  QUICK_SAVE_KEYWORD_SELECTORS,
} from './keywords.constants.js';
import { bankEntryFromLookup } from './keywords.bank.js';
import { lookupEmphasis } from './keywords.dictionary.js';
import { extractKeywords, selectedPhrase, toggleKeywordSelection, visibleKeywords } from './keywords.extract.js';
import { createKeywordsEvents } from './keywords.events.js';
import { describeKeywordPlace } from './keywords.library.js';
import { createKeywordsPage } from './keywords.page.js';
import { renderKeywordsPage } from './keywords.render.js';
import { createKeywordsState } from './keywords.state.js';
import { createKeywordStore } from './keywords.store.js';

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
  if (root) {
    root.hidden = false;
    globalThis.window?.renderLucideIcons?.(root);
  }
}

function sendKeywordsText(app, state, payload, selectors, options = {}) {
  const text = payload?.text || '';
  const words = extractKeywords(text);
  state.clipId = payload?.clipId ?? null;
  if (!words.length) {
    if (!options.quietEmpty) app.showToast?.('No words to save');
    if (options.reveal) {
      state.sourceLabel = String(payload?.sourceLabel || 'Saved text');
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

  state.sourceLabel = String(payload?.sourceLabel || 'Saved text');
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

function lookupPhrase(app, state, selectors) {
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

function toggleKeyword(app, state, key, options = {}, selectors) {
  const phraseMode = !!state.phraseMode;
  const next = toggleKeywordSelection(state.words, state.selectedKeys, key, {
    extend: phraseMode && !!options.extend,
    replace: !phraseMode,
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

function setPhraseMode(app, state, on, selectors) {
  state.phraseMode = !!on;
  if (!state.phraseMode && state.selectedKeys.length > 1) {
    state.selectedKeys = state.selectedKeys.slice(-1);
    state.anchorKey = state.selectedKeys[0] || '';
  }
  return lookupPhrase(app, state, selectors);
}

function clearKeywords(app, state, selectors) {
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
  state.clipId = null;
  state.entries = new Map();
  state.lookupSeq += 1;
}

function draftProblem(draft) {
  if (!draft) return 'Click a word to see what it means.';
  if (draft.pending) return 'Wait for the meaning, then save.';
  if (draft.blocked) return 'Could not look this up. Try again.';
  return '';
}

export function initKeywordsFeature(app) {
  const viewerState = createKeywordsState({ phraseMode: false });
  const quickSaveState = createKeywordsState({ phraseMode: true });
  const savedKeys = new Set();
  const savedPlaces = new Map();
  [viewerState, quickSaveState].forEach((state) => {
    state.savedKeys = savedKeys;
    state.savedPlaces = savedPlaces;
  });

  let page = null;
  const store = createKeywordStore({
    storage: globalThis.chrome?.storage?.local,
    onChange: () => paintAll(),
  });

  function paintAll() {
    const library = store.getLibrary();
    savedKeys.clear();
    savedPlaces.clear();
    store.getBank().forEach((item) => {
      savedKeys.add(item.key);
      savedPlaces.set(item.key, describeKeywordPlace(library, item.folderId));
    });
    const target = describeKeywordPlace(library, library.selection?.folderId);
    viewerState.saveTarget = target;
    quickSaveState.saveTarget = target;
    page?.render();
    renderKeywordsPage(app, viewerState, CLIP_VIEWER_KEYWORD_SELECTORS);
    renderKeywordsPage(app, quickSaveState, QUICK_SAVE_KEYWORD_SELECTORS);
  }

  page = createKeywordsPage({ app, store });
  store.ready.then((ok) => {
    if (!ok) app.showToast?.('Could not load saved words.');
  });

  async function saveFrom(state) {
    await store.ready;
    const draft = bankEntryFromLookup(state);
    const problem = draftProblem(draft);
    if (problem) {
      app.showToast?.(problem);
      return { ok: false };
    }
    const ok = await store.saveWord(draft);
    app.showToast?.(ok ? `Keyword saved to ${savedPlaces.get(draft.key) || state.saveTarget}` : 'Could not save this keyword.');
    return { ok };
  }

  const api = {
    page,
    state: page.state,
    reviewState: quickSaveState,
    getBank: () => store.getBank(),
    getLibrary: () => store.getLibrary(),
    reviewSavedText(payload) {
      return sendKeywordsText(app, quickSaveState, payload, QUICK_SAVE_KEYWORD_SELECTORS, {
        quietEmpty: true,
        reveal: true,
      });
    },
    saveKeyword(scope) {
      return saveFrom(scope === 'viewer' ? viewerState : quickSaveState);
    },
    removeKeyword: (key) => page.removeWord(key),
    openKeyword: (key) => page.openWord(key),
    render: () => page.render(),
    toggle(key, options) {
      return toggleKeyword(app, quickSaveState, key, options, QUICK_SAVE_KEYWORD_SELECTORS);
    },
    clear() {
      clearKeywords(app, quickSaveState, QUICK_SAVE_KEYWORD_SELECTORS);
    },
    quickHideCommon(checked) {
      quickSaveState.hideCommon = !!checked;
      return lookupPhrase(app, quickSaveState, QUICK_SAVE_KEYWORD_SELECTORS);
    },
    reviewClip(clip) {
      const text = String(clip?.text || '');
      const label = text.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Clip';
      return sendKeywordsText(app, viewerState, {
        text,
        sourceLabel: label,
        clipId: clip?.id ?? null,
      }, CLIP_VIEWER_KEYWORD_SELECTORS, { quietEmpty: true, reveal: true });
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
    reviewPhraseMode(on) {
      const next = typeof on === 'boolean' ? on : !viewerState.phraseMode;
      return setPhraseMode(app, viewerState, next, CLIP_VIEWER_KEYWORD_SELECTORS);
    },
  };
  api.events = createKeywordsEvents(api);
  paintAll();
  return api;
}
