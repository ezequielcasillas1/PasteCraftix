/** Keywords clicks: organize saved words on the page, or save one from Quick Save and clips. */

import {
  CLIP_VIEWER_KEYWORD_SELECTORS,
  KEYWORD_ACTIONS,
  KEYWORD_SELECTORS,
  QUICK_SAVE_KEYWORD_SELECTORS,
} from './keywords.constants.js';

function elementOf(target) {
  return target instanceof Element ? target : target?.parentElement;
}

function confirmAction(message) {
  if (typeof globalThis.confirm !== 'function') return true;
  return !!globalThis.confirm(message);
}

function bindClicks(root, onAction) {
  if (!root || root.dataset.keywordsBound === 'true') return false;
  root.dataset.keywordsBound = 'true';
  root.addEventListener('click', (event) => {
    const button = elementOf(event.target)?.closest?.('[data-action]');
    if (!button || !root.contains(button) || button.dataset.action === KEYWORD_ACTIONS.MOVE) return;
    onAction(button.dataset.action, button, event);
  });
  return true;
}

function pageActions(page) {
  return {
    [KEYWORD_ACTIONS.OPEN]: (el) => page.openWord(el.dataset.word),
    [KEYWORD_ACTIONS.VIEW_FILE]: (el) => page.viewFile(el.dataset.file),
    [KEYWORD_ACTIONS.TOGGLE_FOLDER]: (el) => page.toggleFolder(el.dataset.folder),
    [KEYWORD_ACTIONS.SET_TARGET]: (el) => page.setTarget(el.dataset.folder),
    [KEYWORD_ACTIONS.NEW_FILE]: () => page.startForm('new-file'),
    [KEYWORD_ACTIONS.NEW_FOLDER]: (el) => page.startForm('new-folder', el.dataset.file),
    [KEYWORD_ACTIONS.RENAME_FILE]: (el) => page.startForm('rename-file', el.dataset.file, el.dataset.name),
    [KEYWORD_ACTIONS.RENAME_FOLDER]: (el) => page.startForm('rename-folder', el.dataset.folder, el.dataset.name),
    [KEYWORD_ACTIONS.FORM_CANCEL]: () => page.cancelForm(),
    [KEYWORD_ACTIONS.DELETE_FILE]: (el) => {
      if (confirmAction(`Delete the file "${el.dataset.name}"? Its words move to Saved / All words.`)) page.deleteFile(el.dataset.file);
    },
    [KEYWORD_ACTIONS.DELETE_FOLDER]: (el) => {
      if (confirmAction(`Delete the folder "${el.dataset.name}"? Its words move to another folder in this file.`)) page.deleteFolder(el.dataset.folder);
    },
    [KEYWORD_ACTIONS.REMOVE]: (el) => {
      if (confirmAction(`Delete "${el.dataset.name || el.dataset.word}" from Keywords?`)) page.removeWord(el.dataset.word);
    },
    [KEYWORD_ACTIONS.FILE_PAGE]: (el) => page.setFilePage(el.dataset.page),
    [KEYWORD_ACTIONS.FOLDER_PAGE]: (el) => page.setFolderPage(el.dataset.page),
    [KEYWORD_ACTIONS.WORD_PAGE]: (el) => page.setWordPage(el.dataset.folder, el.dataset.page),
    [KEYWORD_ACTIONS.CLEAR_FILE_SEARCH]: () => page.clearFileSearch(),
    [KEYWORD_ACTIONS.CLEAR_FOLDER_SEARCH]: () => page.clearFolderSearch(),
    [KEYWORD_ACTIONS.CLEAR_WORD_SEARCH]: () => page.clearWordSearch(),
  };
}

function bindPage(root, page) {
  const actions = pageActions(page);
  if (!bindClicks(root, (action, el) => actions[action]?.(el))) return;
  root.addEventListener('change', (event) => {
    const select = elementOf(event.target);
    if (select?.dataset?.action !== KEYWORD_ACTIONS.MOVE) return;
    page.moveWord(select.dataset.word, select.value);
  });
  root.addEventListener('input', (event) => {
    const input = elementOf(event.target);
    const field = input?.dataset?.field;
    if (field === 'keyword-name') page.updateForm(input.value);
    else if (field === 'keyword-file-search') page.setFileSearch(input.value);
    else if (field === 'keyword-folder-search') page.setFolderSearch(input.value);
    else if (field === 'keyword-word-search') page.setWordSearch(input.value);
  });
  root.addEventListener('submit', (event) => {
    const form = elementOf(event.target)?.closest?.('form[data-form]');
    if (!form) return;
    event.preventDefault();
    page.submitForm(form.querySelector('[data-field="keyword-name"]')?.value);
  });
  root.addEventListener('keydown', (event) => {
    const input = elementOf(event.target);
    const field = input?.dataset?.field;
    if (field === 'keyword-name') {
      if (event.key === 'Escape') {
        event.preventDefault();
        page.cancelForm();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        page.submitForm(input.value);
      }
    } else if (event.key === 'Escape') {
      if (field === 'keyword-file-search') {
        event.preventDefault();
        page.clearFileSearch();
      } else if (field === 'keyword-folder-search') {
        event.preventDefault();
        page.clearFolderSearch();
      } else if (field === 'keyword-word-search') {
        event.preventDefault();
        page.clearWordSearch();
      }
    }
  });
}

function bindReview(root, review) {
  bindClicks(root, (action, el, event) => {
    if (action === KEYWORD_ACTIONS.CLEAR) review.clear();
    else if (action === KEYWORD_ACTIONS.SAVE) review.save();
    else if (action === KEYWORD_ACTIONS.LOOKUP && el.dataset.word) review.toggle(el.dataset.word, { extend: event.shiftKey });
  });
}

function bindHideCommon(id, onChange) {
  document.getElementById(id)?.addEventListener('change', (event) => onChange(!!event.target?.checked));
}

export function createKeywordsEvents(api) {
  return {
    initKeywordsEventListeners(app) {
      if (app._keywordsEventsBound) return;
      app._keywordsEventsBound = true;

      bindPage(document.getElementById(KEYWORD_SELECTORS.TAB), api.page);

      bindReview(document.getElementById(QUICK_SAVE_KEYWORD_SELECTORS.ROOT), {
        clear: () => api.clear(),
        save: () => api.saveKeyword('quick'),
        toggle: (word, options) => api.toggle(word, options),
      });
      bindHideCommon(QUICK_SAVE_KEYWORD_SELECTORS.HIDE_COMMON, (checked) => api.quickHideCommon(checked));

      bindReview(document.getElementById(CLIP_VIEWER_KEYWORD_SELECTORS.ROOT), {
        clear: () => api.reviewClear(),
        save: () => api.saveKeyword('viewer'),
        toggle: (word, options) => api.reviewToggle(word, options),
      });
      bindHideCommon(CLIP_VIEWER_KEYWORD_SELECTORS.HIDE_COMMON, (checked) => api.reviewHideCommon(checked));
    },
  };
}
