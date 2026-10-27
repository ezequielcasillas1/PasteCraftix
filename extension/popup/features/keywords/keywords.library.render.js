/** Keywords page: file tabs on top, folder cards below, words inside each folder.
 * Includes search bars and pagination for files, folders, and keywords.
 */

import {
  DEFAULT_KEYWORD_FILE_ID,
  DEFAULT_KEYWORD_FOLDER_ID,
  KEYWORD_ACTIONS,
  KEYWORD_COPY,
  KEYWORD_FORM_TITLES,
  KEYWORD_PAGINATION,
  KEYWORD_SECTIONS,
  KEYWORD_SELECTORS,
} from './keywords.constants.js';
import { renderGamesSection } from './keywords.games.render.js';
import {
  filterByName,
  filterKeywords,
  paginateSlice,
  renderPaginationControls,
  renderSearchBar,
} from './keywords.pagination.js';
import { renderLearnCatalog } from './keywords.learn.render.js';
import { escapeHtml, paintNerdStats, renderStoredCard } from './keywords.render.js';

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function renderForm(app, form, kind, id = '') {
  if (!form || form.kind !== kind || (id && form.id !== id)) return '';
  const error = form.error
    ? `<p class="keywords-form-error" role="alert">${escapeHtml(app, form.error)}</p>`
    : '';
  return `
    <form class="keywords-form" data-form="${kind}">
      <label class="keywords-form-label">
        <span>${KEYWORD_FORM_TITLES[kind]}</span>
        <input class="keywords-form-input" type="text" maxlength="40" autocomplete="off" data-field="keyword-name" value="${escapeHtml(app, form.value)}">
      </label>
      <div class="keywords-form-actions">
        <button type="submit" class="keywords-primary">${KEYWORD_COPY.FORM_SAVE}</button>
        <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.FORM_CANCEL}">${KEYWORD_COPY.FORM_CANCEL}</button>
      </div>
      ${error}
    </form>
  `;
}

function countByFolder(bank) {
  const counts = new Map();
  bank.forEach((item) => counts.set(item.folderId, (counts.get(item.folderId) || 0) + 1));
  return counts;
}

function renderFileOption(app, file, viewFile, wordCount) {
  const open = file.id === viewFile.id;
  return `
    <button type="button" class="keywords-file${open ? ' is-open' : ''}" role="option" aria-selected="${open ? 'true' : 'false'}" data-action="${KEYWORD_ACTIONS.VIEW_FILE}" data-file="${escapeHtml(app, file.id)}">
      <i data-lucide="${open ? 'folder-open' : 'folder'}"></i>
      <span class="keywords-file-name">${escapeHtml(app, file.name)}</span>
      <span class="keywords-count">${wordCount}</span>
    </button>
  `;
}

/** "File: Saved ▾" dropdown and "+ Folder". File rename/delete live in the ⋯ menu. */
function renderFileBar(app, { library, counts, viewFile, form, page }) {
  const filtered = filterByName(library.files, page.fileSearch);
  const paged = paginateSlice(filtered, page.filePage, KEYWORD_PAGINATION.FILES_PER_PAGE);
  const options = paged.items.map((file) => {
    const words = library.folders
      .filter((folder) => folder.fileId === file.id)
      .reduce((sum, folder) => sum + (counts.get(folder.id) || 0), 0);
    return renderFileOption(app, file, viewFile, words);
  }).join('');
  const emptyMatch = !filtered.length && page.fileSearch
    ? `<p class="keywords-empty">${KEYWORD_COPY.NO_FILES_MATCH}</p>`
    : '';
  const pagination = renderPaginationControls(app, {
    currentPage: paged.currentPage,
    totalPages: paged.totalPages,
    action: KEYWORD_ACTIONS.FILE_PAGE,
    ariaLabel: 'Files pagination',
  });
  const fileSearch = library.files.length > KEYWORD_PAGINATION.FILES_PER_PAGE || page.fileSearch
    ? renderSearchBar(app, {
      field: 'keyword-file-search',
      value: page.fileSearch,
      placeholder: KEYWORD_COPY.SEARCH_FILES,
      clearAction: KEYWORD_ACTIONS.CLEAR_FILE_SEARCH,
      ariaLabel: 'Search files',
      compact: true,
    })
    : '';
  const menuOpen = !!page.fileMenuOpen;
  return `
    <div class="keywords-filebar">
      <div class="keywords-file-picker">
        <span class="keywords-file-label">${KEYWORD_COPY.FILE_LABEL}:</span>
        <button type="button" class="keywords-file-select" data-action="${KEYWORD_ACTIONS.FILE_MENU}" aria-haspopup="listbox" aria-expanded="${menuOpen ? 'true' : 'false'}" aria-controls="keywordsFileMenu">
          <span class="keywords-file-name">${escapeHtml(app, viewFile.name)}</span> <span aria-hidden="true">▾</span>
        </button>
      </div>
      <button type="button" class="keywords-add" data-action="${KEYWORD_ACTIONS.NEW_FOLDER}" data-file="${escapeHtml(app, viewFile.id)}">${KEYWORD_COPY.ADD_FOLDER}</button>
    </div>
    <div class="keywords-file-menu" id="keywordsFileMenu"${menuOpen ? '' : ' hidden'}>
      ${fileSearch}
      <div class="keywords-file-tabs" role="listbox" aria-label="${KEYWORD_COPY.FILES_LABEL}">${options}</div>
      ${emptyMatch}
      ${pagination}
      <button type="button" class="keywords-add" data-action="${KEYWORD_ACTIONS.NEW_FILE}"><i data-lucide="plus"></i> ${KEYWORD_COPY.NEW_FILE}</button>
    </div>
    ${renderForm(app, form, 'new-file')}
    ${renderForm(app, form, 'rename-file', viewFile.id)}
  `;
}

function renderTargetControl(app, folder, isTarget) {
  if (isTarget) return `<span class="keywords-target-badge"><i data-lucide="check"></i> ${KEYWORD_COPY.TARGET_BADGE}</span>`;
  return `<button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.SET_TARGET}" data-folder="${escapeHtml(app, folder.id)}">${KEYWORD_COPY.SET_TARGET}</button>`;
}

function renderFolderBody(app, { folder, rawWords, page, library }) {
  const filteredWords = filterKeywords(rawWords, page.wordSearch);
  if (!rawWords.length) return `<p class="keywords-empty">${KEYWORD_COPY.FOLDER_EMPTY}</p>`;
  if (!filteredWords.length) return `<p class="keywords-empty">${KEYWORD_COPY.NO_WORDS_MATCH}</p>`;

  const wordPage = page.wordPages?.get?.(folder.id) || 0;
  const pagedWords = paginateSlice(filteredWords, wordPage, KEYWORD_PAGINATION.WORDS_PER_PAGE);

  const chips = pagedWords.items.map((item) => {
    const pressed = item.key === page.openKey;
    return `<button type="button" class="keywords-word is-saved${pressed ? ' is-selected' : ''}" data-action="${KEYWORD_ACTIONS.OPEN}" data-word="${escapeHtml(app, item.key)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, item.text)}</button>`;
  }).join('');

  const wordPagination = renderPaginationControls(app, {
    currentPage: pagedWords.currentPage,
    totalPages: pagedWords.totalPages,
    action: KEYWORD_ACTIONS.WORD_PAGE,
    extraDataset: { folder: folder.id },
    ariaLabel: `${folder.name} words pagination`,
  });

  const open = filteredWords.find((item) => item.key === page.openKey)
    || rawWords.find((item) => item.key === page.openKey);
  const card = open
    ? `<div class="keywords-card">${renderStoredCard(app, open, library, page.movePicker)}</div>`
    : `<p class="keywords-hint">${KEYWORD_COPY.OPEN_HINT}</p>`;

  return `
    <div class="keywords-word-list" data-folder-words="${escapeHtml(app, folder.id)}">${chips}</div>
    ${wordPagination}
    ${card}
  `;
}

function renderFolderCard(app, { folder, rawWords, page, library, canDelete }) {
  const id = escapeHtml(app, folder.id);
  const name = escapeHtml(app, folder.name);
  const filteredWords = filterKeywords(rawWords, page.wordSearch);
  const expanded = page.expanded.has(folder.id);
  const isTarget = library.selection?.folderId === folder.id;
  const remove = canDelete
    ? `<button type="button" class="keywords-icon-btn is-danger" data-action="${KEYWORD_ACTIONS.DELETE_FOLDER}" data-folder="${id}" data-name="${name}" title="${KEYWORD_COPY.DELETE_FOLDER}" aria-label="${KEYWORD_COPY.DELETE_FOLDER} ${name}"><i data-lucide="trash-2"></i></button>`
    : '';
  const body = expanded ? `<div class="keywords-folder-body">${renderFolderBody(app, { folder, rawWords, page, library })}</div>` : '';

  const countDisplay = page.wordSearch && filteredWords.length !== rawWords.length
    ? `${filteredWords.length} of ${rawWords.length} words`
    : plural(rawWords.length, 'word');

  return `
    <section class="keywords-folder${expanded ? ' is-expanded' : ''}${isTarget ? ' is-target' : ''}">
      <div class="keywords-folder-head">
        <button type="button" class="keywords-folder-toggle" data-action="${KEYWORD_ACTIONS.TOGGLE_FOLDER}" data-folder="${id}" aria-expanded="${expanded ? 'true' : 'false'}">
          <span class="keywords-caret" aria-hidden="true">▶</span>
          <i data-lucide="folder"></i>
          <span class="keywords-folder-name">${name}</span>
          <span class="keywords-count">${countDisplay}</span>
        </button>
        <div class="keywords-folder-actions">
          ${renderTargetControl(app, folder, isTarget)}
          <button type="button" class="keywords-icon-btn" data-action="${KEYWORD_ACTIONS.RENAME_FOLDER}" data-folder="${id}" data-name="${name}" title="${KEYWORD_COPY.RENAME_FOLDER}" aria-label="${KEYWORD_COPY.RENAME_FOLDER} ${name}"><i data-lucide="pencil"></i></button>
          ${remove}
        </div>
      </div>
      ${renderForm(app, page.form, 'rename-folder', folder.id)}
      ${body}
    </section>
  `;
}

function renderFolderList(app, { library, bank, viewFile, page }) {
  const allFolders = library.folders.filter((folder) => folder.fileId === viewFile.id);
  const filtered = filterByName(allFolders, page.folderSearch);
  const paged = paginateSlice(filtered, page.folderPage, KEYWORD_PAGINATION.FOLDERS_PER_PAGE);

  const empty = bank.length ? '' : `<p class="keywords-empty">${KEYWORD_COPY.PAGE_EMPTY}</p>`;
  const emptyMatch = !filtered.length && page.folderSearch
    ? `<p class="keywords-empty">${KEYWORD_COPY.NO_FOLDERS_MATCH}</p>`
    : '';

  const cards = paged.items.map((folder) => renderFolderCard(app, {
    folder,
    rawWords: bank.filter((item) => item.folderId === folder.id),
    page,
    library,
    canDelete: folder.id !== DEFAULT_KEYWORD_FOLDER_ID && allFolders.length > 1,
  })).join('');

  const pagination = renderPaginationControls(app, {
    currentPage: paged.currentPage,
    totalPages: paged.totalPages,
    action: KEYWORD_ACTIONS.FOLDER_PAGE,
    ariaLabel: 'Folders pagination',
  });

  const searching = !!String(page.wordSearch || '').trim();
  const noWordMatch = searching && bank.length && !filterKeywords(bank, page.wordSearch).length
    ? `<p class="keywords-empty">${KEYWORD_COPY.NO_MY_WORDS_MATCH}</p>`
    : '';
  const learnLink = bank.length
    ? ''
    : `<button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.INTRO_LEARN}">${KEYWORD_COPY.WORDS_EMPTY_LEARN}</button>`;

  return `
    ${renderForm(app, page.form, 'new-folder', viewFile.id)}
    ${empty}
    ${learnLink}
    ${noWordMatch}
    ${emptyMatch}
    ${cards}
    ${pagination}
  `;
}

function focusForm(root) {
  const input = root?.querySelector?.('[data-field="keyword-name"]');
  if (!input || globalThis.document?.activeElement === input) return;
  input.focus?.();
  input.select?.();
}

function captureSearchFocus() {
  const active = globalThis.document?.activeElement;
  const field = active?.dataset?.field;
  if (!field || !field.startsWith('keyword-')) return null;
  return {
    field,
    start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
  };
}

const SECTION_TABS = Object.freeze([
  { id: KEYWORD_SECTIONS.WORDS, label: KEYWORD_COPY.SECTION_WORDS },
  { id: KEYWORD_SECTIONS.LEARN, label: KEYWORD_COPY.SECTION_LEARN },
  { id: KEYWORD_SECTIONS.GAMES, label: KEYWORD_COPY.SECTION_GAMES },
]);

const SEARCH_COPY = Object.freeze({
  [KEYWORD_SECTIONS.WORDS]: KEYWORD_COPY.SEARCH_MY_WORDS,
  [KEYWORD_SECTIONS.LEARN]: KEYWORD_COPY.SEARCH_LEARN,
  [KEYWORD_SECTIONS.GAMES]: KEYWORD_COPY.SEARCH_GAMES,
});

function scopedQuery(page) {
  if (page.section === KEYWORD_SECTIONS.LEARN) return page.learnQuery;
  if (page.section === KEYWORD_SECTIONS.GAMES) return page.gamesQuery;
  return page.wordSearch;
}

export function renderKeywordsNav(app, page, savedCount) {
  const tabs = SECTION_TABS.map((tab) => {
    const on = tab.id === page.section;
    const count = tab.id === KEYWORD_SECTIONS.WORDS ? ` <span class="keywords-seg-count">· ${savedCount}</span>` : '';
    return `<button type="button" class="keywords-seg${on ? ' is-on' : ''}" role="tab" aria-selected="${on ? 'true' : 'false'}" data-action="${KEYWORD_ACTIONS.SECTION}" data-section="${tab.id}">${tab.label}${count}</button>`;
  }).join('');
  const placeholder = SEARCH_COPY[page.section] || KEYWORD_COPY.SEARCH_MY_WORDS;
  return `
    <div class="keywords-segments" role="tablist" aria-label="${KEYWORD_COPY.SECTIONS_LABEL}">${tabs}</div>
    ${renderSearchBar(app, {
      field: 'keyword-scoped-search',
      value: scopedQuery(page),
      placeholder,
      clearAction: KEYWORD_ACTIONS.CLEAR_SCOPED_SEARCH,
      ariaLabel: placeholder,
    })}
  `;
}

export function renderKeywordsIntro() {
  return `
    <div class="keywords-intro-card" role="dialog" aria-labelledby="keywordsIntroTitle">
      <button type="button" class="keywords-intro-close" data-action="${KEYWORD_ACTIONS.INTRO_CLOSE}" aria-label="${KEYWORD_COPY.INTRO_CLOSE}">✕</button>
      <p class="keywords-intro-title" id="keywordsIntroTitle">${KEYWORD_COPY.INTRO_TITLE}</p>
      <p class="keywords-intro-body">${KEYWORD_COPY.INTRO_BODY}</p>
      <ol class="keywords-intro-steps">
        <li><span>1</span>${KEYWORD_COPY.INTRO_STEP_SAVE}</li>
        <li><span>2</span>${KEYWORD_COPY.INTRO_STEP_TAP}</li>
        <li><span>3</span>${KEYWORD_COPY.INTRO_STEP_KEEP}</li>
      </ol>
      <div class="keywords-intro-actions">
        <button type="button" class="keywords-primary" data-action="${KEYWORD_ACTIONS.INTRO_CLOSE}">${KEYWORD_COPY.INTRO_GOT_IT}</button>
        <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.INTRO_LEARN}">${KEYWORD_COPY.INTRO_BROWSE}</button>
      </div>
    </div>
  `;
}

export function renderKeywordsToast(app, toast) {
  if (!toast?.message) return '';
  const view = toast.key
    ? `<button type="button" class="keywords-toast-view" data-action="${KEYWORD_ACTIONS.TOAST_VIEW}" data-word="${escapeHtml(app, toast.key)}">${KEYWORD_COPY.TOAST_VIEW}</button>`
    : '';
  return `
    <div class="keywords-toast-body" role="status" aria-live="polite">
      <span>${escapeHtml(app, toast.message)}</span>
      ${view}
      <button type="button" class="keywords-toast-close" data-action="${KEYWORD_ACTIONS.TOAST_CLOSE}" aria-label="Dismiss">✕</button>
    </div>
  `;
}

function paintChrome(app, page, viewFile, savedCount) {
  const doc = globalThis.document;
  const nav = doc.getElementById(KEYWORD_SELECTORS.NAV);
  if (nav) {
    nav.innerHTML = renderKeywordsNav(app, page, savedCount);
    globalThis.window?.renderLucideIconsSync?.(nav);
  }
  const intro = doc.getElementById(KEYWORD_SELECTORS.INTRO);
  if (intro) {
    intro.hidden = !page.introOpen;
    intro.innerHTML = page.introOpen ? renderKeywordsIntro() : '';
  }
  const introToggle = doc.getElementById(KEYWORD_SELECTORS.INTRO_TOGGLE);
  introToggle?.setAttribute?.('aria-expanded', page.introOpen ? 'true' : 'false');
  const menu = doc.getElementById(KEYWORD_SELECTORS.MENU);
  if (menu) menu.hidden = !page.menuOpen;
  doc.getElementById(KEYWORD_SELECTORS.MENU_TOGGLE)?.setAttribute?.('aria-expanded', page.menuOpen ? 'true' : 'false');
  const rename = doc.getElementById(KEYWORD_SELECTORS.MENU_RENAME);
  const remove = doc.getElementById(KEYWORD_SELECTORS.MENU_DELETE);
  [rename, remove].forEach((button) => {
    if (!button?.dataset) return;
    button.dataset.file = viewFile.id;
    button.dataset.name = viewFile.name;
  });
  if (remove) remove.hidden = viewFile.id === DEFAULT_KEYWORD_FILE_ID;
  const toast = doc.getElementById(KEYWORD_SELECTORS.TOAST);
  if (toast) {
    toast.hidden = !page.toast;
    toast.innerHTML = renderKeywordsToast(app, page.toast);
  }
}

function restoreSearchFocus(focus) {
  if (!focus?.field) return;
  const target = globalThis.document?.querySelector?.(`[data-field="${focus.field}"]`);
  if (!target) return;
  target.focus?.();
  if (typeof focus.start === 'number' && typeof focus.end === 'number') {
    try {
      target.setSelectionRange(focus.start, focus.end);
    } catch {}
  }
}

/** Enter on a game card focuses the detail title; Back returns focus to that card (or a fallback). */
export function applyGamesFocus(gamesEl, page) {
  const request = page.gamesFocus;
  page.gamesFocus = null;
  if (!request || !gamesEl) return;
  const find = (sel) => gamesEl.querySelector?.(sel) || null;
  const target = request.kind === 'title'
    ? find('.keywords-game-title') || find('[data-action="keyword-game-back"]')
    : (request.id && find(`.keywords-game-card[data-game="${String(request.id).replace(/["\\]/g, '')}"]`))
      || find('.keywords-game-card')
      || find('[data-action="keyword-game-back"]')
      || globalThis.document?.querySelector?.('[data-field="keyword-scoped-search"]');
  target?.focus?.({ preventScroll: false });
}

export function renderKeywordLibrary(app, { library, bank, page }) {
  const filesEl = document.getElementById(KEYWORD_SELECTORS.FILES);
  const foldersEl = document.getElementById(KEYWORD_SELECTORS.FOLDERS);
  if (!filesEl || !foldersEl || !library?.files?.length) return;
  const items = Array.isArray(bank) ? bank : [];
  const viewFile = library.files.find((file) => file.id === page.viewFileId) || library.files[0];
  const counts = countByFolder(items);
  // Capture before paintChrome: it rewrites the search box, which drops focus.
  const prevFocus = captureSearchFocus();
  paintNerdStats(app, KEYWORD_SELECTORS, {
    open: !!page.nerdStatsOpen,
    kind: 'page',
    savedCount: items.length,
  });
  paintChrome(app, page, viewFile, items.length);

  const learnEl = document.getElementById(KEYWORD_SELECTORS.LEARN);
  const gamesEl = document.getElementById(KEYWORD_SELECTORS.GAMES);
  const section = learnEl && page.section === KEYWORD_SECTIONS.LEARN
    ? KEYWORD_SECTIONS.LEARN
    : (gamesEl && page.section === KEYWORD_SECTIONS.GAMES ? KEYWORD_SECTIONS.GAMES : KEYWORD_SECTIONS.WORDS);
  const showWords = section === KEYWORD_SECTIONS.WORDS;
  filesEl.hidden = !showWords;
  foldersEl.hidden = !showWords;
  if (learnEl) {
    learnEl.hidden = section !== KEYWORD_SECTIONS.LEARN;
    learnEl.innerHTML = section === KEYWORD_SECTIONS.LEARN ? renderLearnCatalog(app, page, { bank: items }) : '';
    globalThis.window?.renderLucideIconsSync?.(learnEl);
  }
  if (gamesEl) {
    gamesEl.hidden = section !== KEYWORD_SECTIONS.GAMES;
    gamesEl.innerHTML = section === KEYWORD_SECTIONS.GAMES ? renderGamesSection(app, page) : '';
    globalThis.window?.renderLucideIconsSync?.(gamesEl);
  }
  if (!showWords) {
    restoreSearchFocus(prevFocus);
    if (section === KEYWORD_SECTIONS.GAMES) applyGamesFocus(gamesEl, page);
    return;
  }

  filesEl.innerHTML = renderFileBar(app, { library, counts, viewFile, form: page.form, page });
  foldersEl.innerHTML = renderFolderList(app, { library, bank: items, viewFile, page });
  globalThis.window?.renderLucideIconsSync?.(filesEl);
  globalThis.window?.renderLucideIconsSync?.(foldersEl);

  if (page.form) {
    focusForm(page.form.kind.endsWith('file') ? filesEl : foldersEl);
  } else if (prevFocus) {
    restoreSearchFocus(prevFocus);
  }
}
