/** Keywords clicks: send clip text, hide common words, build a phrase. */

import { CLIP_VIEWER_KEYWORD_SELECTORS, KEYWORD_ACTIONS, KEYWORD_SELECTORS } from './keywords.constants.js';

function clipPreview(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 48);
}

function sendComposerText(app, sendText) {
  const text = document.getElementById('manualInputTextarea')?.value || '';
  if (!String(text).trim()) {
    app.showToast?.('Type some text to review keywords');
    return;
  }
  sendText({ text, sourceLabel: 'Draft', clips: [] });
}

function sendSelectedClips(app, sendText) {
  const clips = typeof app._getSelectedClipObjects === 'function'
    ? app._getSelectedClipObjects()
    : [];
  if (!clips.length) {
    app.showToast?.('Select clips to send to Keywords');
    return;
  }
  const text = clips.map((clip) => clip?.text || '').join('\n');
  const preview = clipPreview(clips[0]?.text);
  const sourceLabel = clips.length > 1
    ? `${clips.length} clips — ${preview}`
    : (preview || 'Selected clip');
  sendText({
    text,
    sourceLabel,
    clips: clips.map((clip) => ({
      id: clip?.id,
      text: clip?.text || '',
      label: clipPreview(clip?.text),
    })),
  });
}

function bindReviewHost(root, handlers) {
  if (!root || root.dataset.keywordsBound === 'true') return;
  root.dataset.keywordsBound = 'true';
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest?.('[data-action]');
    if (!button || !root.contains(button)) return;
    if (button.dataset.action === KEYWORD_ACTIONS.CLEAR) {
      handlers.clear();
      return;
    }
    if (button.dataset.action !== KEYWORD_ACTIONS.LOOKUP) return;
    const key = button.dataset.word;
    if (!key) return;
    handlers.toggle(key, { extend: event.shiftKey });
  });
}

export function createKeywordsEvents(api) {
  return {
    initKeywordsEventListeners(app) {
      if (app._keywordsEventsBound) return;
      app._keywordsEventsBound = true;

      bindReviewHost(document.getElementById(CLIP_VIEWER_KEYWORD_SELECTORS.ROOT), {
        toggle: (key, options) => api.reviewToggle(key, options),
        clear: () => api.reviewClear(),
      });
      document.getElementById(CLIP_VIEWER_KEYWORD_SELECTORS.HIDE_COMMON)?.addEventListener('change', (event) => {
        api.reviewHideCommon(!!event.target?.checked);
      });

      document.getElementById(KEYWORD_SELECTORS.REVIEW_BTN)?.addEventListener('click', () => {
        sendComposerText(app, api.sendText);
      });
      document.getElementById(KEYWORD_SELECTORS.BULK_SEND_BTN)?.addEventListener('click', () => {
        sendSelectedClips(app, api.sendText);
      });

      const tab = document.getElementById(KEYWORD_SELECTORS.TAB);
      tab?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const button = target?.closest?.('[data-action]');
        if (!button || !tab.contains(button)) return;
        if (button.dataset.action === KEYWORD_ACTIONS.CLEAR) {
          api.clear();
          return;
        }
        if (button.dataset.action !== KEYWORD_ACTIONS.LOOKUP) return;
        const key = button.dataset.word;
        if (!key) return;
        api.toggle(key, { extend: event.shiftKey });
      });

      document.getElementById(KEYWORD_SELECTORS.HIDE_COMMON)?.addEventListener('change', (event) => {
        api.state.hideCommon = !!event.target?.checked;
        api.refresh();
      });
    },
  };
}
