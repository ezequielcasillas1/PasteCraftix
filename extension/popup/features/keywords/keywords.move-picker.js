/** Saved-word card: searchable, paged "Move to folder" picker grouped by file. */

import { KEYWORD_ACTIONS, KEYWORD_COPY, KEYWORD_PAGINATION } from './keywords.constants.js';
import {
  filterByName,
  paginateSlice,
  renderPaginationControls,
  renderSearchBar,
} from './keywords.pagination.js';
import { escapeHtml } from './keywords.render.js';

function flattenFolders(library) {
  const files = library?.files || [];
  const folders = library?.folders || [];
  return files.flatMap((file) => folders
    .filter((folder) => folder.fileId === file.id)
    .map((folder) => ({ id: folder.id, name: folder.name, fileId: file.id, fileName: file.name })));
}

export function buildMovePickerModel(library, item, picker = {}) {
  const all = flattenFolders(library);
  const filtered = filterByName(all, picker.search);
  const paged = paginateSlice(filtered, picker.page, KEYWORD_PAGINATION.MOVE_FOLDERS_PER_PAGE);
  const current = all.find((folder) => folder.id === item?.folderId) || null;
  return { total: all.length, filtered, paged, current };
}

function renderRows(app, item, rows) {
  let lastFileId = '';
  return rows.map((folder) => {
    const heading = folder.fileId === lastFileId
      ? ''
      : `<p class="keywords-move-file" role="presentation">${escapeHtml(app, folder.fileName)}</p>`;
    lastFileId = folder.fileId;
    const isCurrent = folder.id === item.folderId;
    const badge = isCurrent ? `<span class="keywords-move-current">${KEYWORD_COPY.MOVE_CURRENT}</span>` : '';
    return `${heading}<button type="button" class="keywords-move-row${isCurrent ? ' is-current' : ''}" role="option" aria-selected="${isCurrent ? 'true' : 'false'}" data-action="${KEYWORD_ACTIONS.MOVE}" data-word="${escapeHtml(app, item.key)}" data-folder="${escapeHtml(app, folder.id)}"${isCurrent ? ' disabled' : ''}><i data-lucide="folder"></i><span class="keywords-move-name">${escapeHtml(app, folder.name)}</span>${badge}</button>`;
  }).join('');
}

function renderPanel(app, item, model, picker) {
  const search = renderSearchBar(app, {
    field: 'keyword-move-search',
    value: picker.search,
    placeholder: KEYWORD_COPY.MOVE_SEARCH,
    clearAction: KEYWORD_ACTIONS.CLEAR_MOVE_SEARCH,
    ariaLabel: 'Search folders to move into',
    compact: true,
  });
  const list = model.filtered.length
    ? `<div class="keywords-move-list" role="listbox" aria-label="${KEYWORD_COPY.MOVE}">${renderRows(app, item, model.paged.items)}</div>`
    : `<p class="keywords-empty">${KEYWORD_COPY.MOVE_NO_MATCH}</p>`;
  const pager = renderPaginationControls(app, {
    currentPage: model.paged.currentPage,
    totalPages: model.paged.totalPages,
    action: KEYWORD_ACTIONS.MOVE_PAGE,
    ariaLabel: `Folders to move ${item.text || item.key} into`,
  });
  return `<div class="keywords-move-panel">${search}${list}${pager}</div>`;
}

export function renderMovePicker(app, item, library, picker = {}) {
  const model = buildMovePickerModel(library, item, picker);
  if (model.total < 2) return '';
  const open = !!picker.open;
  const currentName = model.current ? escapeHtml(app, model.current.name) : '';
  const toggle = `<button type="button" class="keywords-move-toggle${open ? ' is-open' : ''}" data-action="${KEYWORD_ACTIONS.MOVE_TOGGLE}" aria-expanded="${open ? 'true' : 'false'}"><span>${KEYWORD_COPY.MOVE}:</span> <strong>${currentName}</strong><span class="keywords-caret" aria-hidden="true">▾</span></button>`;
  return `<div class="keywords-move${open ? ' is-open' : ''}">${toggle}${open ? renderPanel(app, item, model, picker) : ''}</div>`;
}
