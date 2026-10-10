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
  KEYWORD_SELECTORS,
} from './keywords.constants.js';
import {
  filterByName,
  filterKeywords,
  paginateSlice,
  renderPaginationControls,
  renderSearchBar,
} from './keywords.pagination.js';
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

function renderFileTab(app, file, viewFile, wordCount) {
  const open = file.id === viewFile.id;
  return `
    <button type="button" class="keywords-file${open ? ' is-open' : ''}" role="tab" aria-selected="${open ? 'true' : 'false'}" data-action="${KEYWORD_ACTIONS.VIEW_FILE}" data-file="${escapeHtml(app, file.id)}">
      <i data-lucide="${open ? 'folder-open' : 'folder'}"></i>
      <span class="keywords-file-name">${escapeHtml(app, file.name)}</span>
      <span class="keywords-count">${wordCount}</span>
    </button>
  `;
}

function renderFileTools(app, viewFile, form) {
  const id = escapeHtml(app, viewFile.id);
  const name = escapeHtml(app, viewFile.name);
  const remove = viewFile.id === DEFAULT_KEYWORD_FILE_ID
    ? ''
    : `<button type="button" class="keywords-link is-danger" data-action="${KEYWORD_ACTIONS.DELETE_FILE}" data-file="${id}" data-name="${name}">${KEYWORD_COPY.DELETE_FILE}</button>`;
  return `
    <div class="keywords-file-tools">
      <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.RENAME_FILE}" data-file="${id}" data-name="${name}">${KEYWORD_COPY.RENAME_FILE}</button>
      ${remove}
    </div>
    ${renderForm(app, form, 'rename-file', viewFile.id)}
  `;
}

function renderGuide(open) {
  if (!open) return '';
  return `
    <div class="keywords-guide" id="keywordsGuide" role="region" aria-label="${KEYWORD_COPY.GUIDE_LABEL}">
      <p class="keywords-guide-lead">${KEYWORD_COPY.GUIDE_FILES}</p>
      <ul class="keywords-guide-list">
        <li>${KEYWORD_COPY.GUIDE_NEW_FILE}</li>
        <li>${KEYWORD_COPY.GUIDE_RENAME_FILE}</li>
        <li>${KEYWORD_COPY.GUIDE_SEARCH_FILES}</li>
      </ul>
      <p class="keywords-guide-lead">${KEYWORD_COPY.GUIDE_FOLDERS}</p>
      <ul class="keywords-guide-list">
        <li>${KEYWORD_COPY.GUIDE_OPEN_FOLDER}</li>
        <li>${KEYWORD_COPY.GUIDE_NEW_FOLDER}</li>
        <li>${KEYWORD_COPY.GUIDE_TARGET}</li>
        <li>${KEYWORD_COPY.GUIDE_MOVE}</li>
      </ul>
    </div>
  `;
}

function renderFileBar(app, { library, counts, viewFile, form, page }) {
  const allFiles = library.files;
  const filtered = filterByName(allFiles, page.fileSearch);
  const paged = paginateSlice(filtered, page.filePage, KEYWORD_PAGINATION.FILES_PER_PAGE);

  const tabs = paged.items.map((file) => {
    const words = library.folders
      .filter((folder) => folder.fileId === file.id)
      .reduce((sum, folder) => sum + (counts.get(folder.id) || 0), 0);
    return renderFileTab(app, file, viewFile, words);
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

  const searchBar = renderSearchBar(app, {
    field: 'keyword-file-search',
    value: page.fileSearch,
    placeholder: KEYWORD_COPY.SEARCH_FILES,
    clearAction: KEYWORD_ACTIONS.CLEAR_FILE_SEARCH,
    ariaLabel: 'Search files',
    compact: true,
  });

  const guideOpen = !!page.guideOpen;
  return `
    <div class="keywords-section-head">
      <div class="keywords-section-title">
        <p class="keywords-section-label">${KEYWORD_COPY.FILES_LABEL}</p>
        <button type="button" class="keywords-info-btn${guideOpen ? ' is-open' : ''}" data-action="${KEYWORD_ACTIONS.GUIDE}" aria-expanded="${guideOpen ? 'true' : 'false'}" aria-controls="keywordsGuide" title="${KEYWORD_COPY.GUIDE_LABEL}" aria-label="${KEYWORD_COPY.GUIDE_LABEL}"><i data-lucide="info"></i></button>
      </div>
      ${searchBar}
    </div>
    ${renderGuide(guideOpen)}
    <div class="keywords-file-tabs" role="tablist" aria-label="${KEYWORD_COPY.FILES_LABEL}">
      ${tabs}
      <button type="button" class="keywords-add" data-action="${KEYWORD_ACTIONS.NEW_FILE}"><i data-lucide="plus"></i> ${KEYWORD_COPY.NEW_FILE}</button>
    </div>
    ${emptyMatch}
    ${pagination}
    ${renderForm(app, form, 'new-file')}
    ${renderFileTools(app, viewFile, form)}
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

  const folderSearchBar = renderSearchBar(app, {
    field: 'keyword-folder-search',
    value: page.folderSearch,
    placeholder: KEYWORD_COPY.SEARCH_FOLDERS,
    clearAction: KEYWORD_ACTIONS.CLEAR_FOLDER_SEARCH,
    ariaLabel: 'Search folders',
    compact: true,
  });

  const wordSearchBar = renderSearchBar(app, {
    field: 'keyword-word-search',
    value: page.wordSearch,
    placeholder: KEYWORD_COPY.SEARCH_KEYWORDS,
    clearAction: KEYWORD_ACTIONS.CLEAR_WORD_SEARCH,
    ariaLabel: 'Search keywords',
  });

  return `
    <div class="keywords-global-search">
      ${wordSearchBar}
    </div>
    <div class="keywords-folders-head">
      <div class="keywords-folders-title-wrap">
        <p class="keywords-section-label">${KEYWORD_COPY.FOLDERS_IN} ${escapeHtml(app, viewFile.name)}</p>
        ${folderSearchBar}
      </div>
      <button type="button" class="keywords-add" data-action="${KEYWORD_ACTIONS.NEW_FOLDER}" data-file="${escapeHtml(app, viewFile.id)}"><i data-lucide="folder-plus"></i> ${KEYWORD_COPY.NEW_FOLDER}</button>
    </div>
    ${renderForm(app, page.form, 'new-folder', viewFile.id)}
    ${empty}
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

export function renderKeywordLibrary(app, { library, bank, page }) {
  const filesEl = document.getElementById(KEYWORD_SELECTORS.FILES);
  const foldersEl = document.getElementById(KEYWORD_SELECTORS.FOLDERS);
  if (!filesEl || !foldersEl || !library?.files?.length) return;
  const items = Array.isArray(bank) ? bank : [];
  const viewFile = library.files.find((file) => file.id === page.viewFileId) || library.files[0];
  const counts = countByFolder(items);
  paintNerdStats(app, KEYWORD_SELECTORS, {
    open: !!page.nerdStatsOpen,
    kind: 'page',
    savedCount: items.length,
  });

  const prevFocus = captureSearchFocus();

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
