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
    if (!button || !root.contains(button)) return;
    onAction(button.dataset.action, button, event);
  });
  return true;
}

function closeMenus(page) {
  page.state.menuOpen = false;
  page.state.fileMenuOpen = false;
}

function pageActions(page) {
  return {
    [KEYWORD_ACTIONS.OPEN]: (el) => page.openWord(el.dataset.word),
    [KEYWORD_ACTIONS.VIEW_FILE]: (el) => {
      page.state.fileMenuOpen = false;
      page.viewFile(el.dataset.file);
    },
    [KEYWORD_ACTIONS.TOGGLE_FOLDER]: (el) => page.toggleFolder(el.dataset.folder),
    [KEYWORD_ACTIONS.SET_TARGET]: (el) => page.setTarget(el.dataset.folder),
    [KEYWORD_ACTIONS.NEW_FILE]: () => {
      closeMenus(page);
      page.setSection('words');
      page.startForm('new-file');
    },
    [KEYWORD_ACTIONS.NEW_FOLDER]: (el) => page.startForm('new-folder', el.dataset.file),
    [KEYWORD_ACTIONS.RENAME_FILE]: (el) => {
      closeMenus(page);
      page.setSection('words');
      page.startForm('rename-file', el.dataset.file, el.dataset.name);
    },
    [KEYWORD_ACTIONS.RENAME_FOLDER]: (el) => page.startForm('rename-folder', el.dataset.folder, el.dataset.name),
    [KEYWORD_ACTIONS.FORM_CANCEL]: () => page.cancelForm(),
    [KEYWORD_ACTIONS.DELETE_FILE]: (el) => {
      closeMenus(page);
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
    [KEYWORD_ACTIONS.NERD_STATS]: () => {
      closeMenus(page);
      page.toggleNerdStats();
    },
    [KEYWORD_ACTIONS.GUIDE]: () => page.toggleGuide(),
    [KEYWORD_ACTIONS.MOVE_TOGGLE]: () => page.toggleMovePicker(),
    [KEYWORD_ACTIONS.MOVE_PAGE]: (el) => page.setMovePickerPage(el.dataset.page),
    [KEYWORD_ACTIONS.CLEAR_MOVE_SEARCH]: () => page.clearMovePickerSearch(),
    [KEYWORD_ACTIONS.MOVE]: (el) => page.moveWord(el.dataset.word, el.dataset.folder),
    [KEYWORD_ACTIONS.LEARN]: () => page.toggleLearn(),
    [KEYWORD_ACTIONS.LEARN_GROUP]: (el) => page.setLearnGroup(el.dataset.group),
    [KEYWORD_ACTIONS.LEARN_SUBJECT]: (el) => page.setLearnSubject(el.dataset.title),
    [KEYWORD_ACTIONS.LEARN_BACK]: () => page.clearLearnSubject(),
    [KEYWORD_ACTIONS.LEARN_PAGE]: (el) => page.setLearnPage(el.dataset.page),
    [KEYWORD_ACTIONS.LEARN_OPEN]: (el) => page.openLearnTitle(el.dataset.title),
    [KEYWORD_ACTIONS.LEARN_SAVE]: () => page.saveLearn(),
    [KEYWORD_ACTIONS.CLEAR_LEARN_SEARCH]: () => page.clearLearnSearch(),
    [KEYWORD_ACTIONS.SECTION]: (el) => page.setSection(el.dataset.section),
    [KEYWORD_ACTIONS.CLEAR_SCOPED_SEARCH]: () => page.clearScopedSearch(),
    [KEYWORD_ACTIONS.INTRO]: () => page.toggleIntro(),
    [KEYWORD_ACTIONS.INTRO_CLOSE]: () => page.dismissIntro(),
    [KEYWORD_ACTIONS.INTRO_LEARN]: () => page.introBrowseLearn(),
    [KEYWORD_ACTIONS.MENU]: () => page.toggleMenu(),
    [KEYWORD_ACTIONS.FILE_MENU]: () => page.toggleFileMenu(),
    [KEYWORD_ACTIONS.BRIDGE_VIEW]: (el) => page.viewSavedWord(el.dataset.word),
    [KEYWORD_ACTIONS.TOAST_VIEW]: (el) => page.viewSavedWord(el.dataset.word),
    [KEYWORD_ACTIONS.TOAST_CLOSE]: () => page.closeToast(),
    [KEYWORD_ACTIONS.GAME_GROUP]: (el) => page.setGamesGroup(el.dataset.group),
    [KEYWORD_ACTIONS.GAME_PAGE]: (el) => page.setGamesPage(el.dataset.page),
    [KEYWORD_ACTIONS.GAME_OPEN]: (el) => page.openGame(el.dataset.game),
    [KEYWORD_ACTIONS.GAME_BACK]: () => page.closeGame(),
    [KEYWORD_ACTIONS.GAME_KEYWORD]: (el) => page.openGameKeyword(el.dataset.title),
    [KEYWORD_ACTIONS.GAME_SAVE]: () => page.saveGameKeyword(),
    [KEYWORD_ACTIONS.GAMES_SEARCH_ALL]: () => page.searchAllGameGroups(),
  };
}

function bindPage(root, page) {
  const actions = pageActions(page);
  if (!bindClicks(root, (action, el) => actions[action]?.(el))) return;
  // Clicking anywhere outside an open ⋯ / file menu closes it.
  root.addEventListener('click', (event) => {
    const el = elementOf(event.target);
    if (page.state.menuOpen && !el?.closest?.('.keywords-menu-wrap')) page.closeMenu();
    if (page.state.fileMenuOpen && !el?.closest?.('.keywords-file-menu, .keywords-file-select')) {
      page.state.fileMenuOpen = false;
      page.render();
    }
  });
  root.addEventListener('input', (event) => {
    const input = elementOf(event.target);
    const field = input?.dataset?.field;
    if (field === 'keyword-name') page.updateForm(input.value);
    else if (field === 'keyword-file-search') page.setFileSearch(input.value);
    else if (field === 'keyword-folder-search') page.setFolderSearch(input.value);
    else if (field === 'keyword-word-search') page.setWordSearch(input.value);
    else if (field === 'keyword-move-search') page.setMovePickerSearch(input.value);
    else if (field === 'keyword-learn-search') page.setLearnSearch(input.value);
    else if (field === 'keyword-scoped-search') page.setScopedSearch(input.value);
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
    if (event.key === 'Escape' && input?.closest?.('.keywords-move')) {
      event.preventDefault();
      page.closeMovePicker();
    } else if (field === 'keyword-name') {
      if (event.key === 'Escape') {
        event.preventDefault();
        page.cancelForm();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        page.submitForm(input.value);
      }
    } else if (event.key === 'Escape' && (page.state.menuOpen || page.state.fileMenuOpen)) {
      event.preventDefault();
      closeMenus(page);
      page.render();
    } else if (event.key === 'Escape' && field === 'keyword-scoped-search') {
      event.preventDefault();
      page.clearScopedSearch();
    } else if (event.key === 'Escape' && page.state.introOpen) {
      event.preventDefault();
      page.dismissIntro();
    } else if (event.key === 'Escape' && page.state.guideOpen) {
      event.preventDefault();
      page.closeGuide();
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
      } else if (field === 'keyword-learn-search') {
        event.preventDefault();
        page.clearLearnSearch();
      }
    }
  });
}

function bindReview(root, review) {
  bindClicks(root, (action, el, event) => {
    if (action === KEYWORD_ACTIONS.CLEAR) review.clear();
    else if (action === KEYWORD_ACTIONS.SAVE) review.save();
    else if (action === KEYWORD_ACTIONS.PHRASE_MODE) review.setPhraseMode?.();
    else if (action === KEYWORD_ACTIONS.LOOKUP && el.dataset.word) review.toggle(el.dataset.word, { extend: event.shiftKey });
    else if (action === KEYWORD_ACTIONS.NERD_STATS) review.toggleNerdStats?.();
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
        toggleNerdStats: () => api.toggleNerdStats(),
      });
      bindHideCommon(QUICK_SAVE_KEYWORD_SELECTORS.HIDE_COMMON, (checked) => api.quickHideCommon(checked));

      bindReview(document.getElementById(CLIP_VIEWER_KEYWORD_SELECTORS.ROOT), {
        clear: () => api.reviewClear(),
        save: () => api.saveKeyword('viewer'),
        toggle: (word, options) => api.reviewToggle(word, options),
        setPhraseMode: () => api.reviewPhraseMode(),
        toggleNerdStats: () => api.reviewNerdStats(),
      });
      bindHideCommon(CLIP_VIEWER_KEYWORD_SELECTORS.HIDE_COMMON, (checked) => api.reviewHideCommon(checked));
    },
  };
}
