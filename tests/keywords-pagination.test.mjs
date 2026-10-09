import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterByName,
  filterKeywords,
  paginateSlice,
  renderPaginationControls,
  renderSearchBar,
} from '../extension/popup/features/keywords/keywords.pagination.js';
import { createKeywordsPageState } from '../extension/popup/features/keywords/keywords.state.js';
import { createKeywordsPage } from '../extension/popup/features/keywords/keywords.page.js';

test('paginateSlice calculates safe pagination slices and clamps bounds', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  
  // Page 0 with pageSize 3
  const p0 = paginateSlice(items, 0, 3);
  assert.equal(p0.total, 7);
  assert.equal(p0.totalPages, 3);
  assert.equal(p0.currentPage, 0);
  assert.deepEqual(p0.items, ['a', 'b', 'c']);

  // Page 2 (last page) with pageSize 3
  const p2 = paginateSlice(items, 2, 3);
  assert.equal(p2.currentPage, 2);
  assert.deepEqual(p2.items, ['g']);

  // Negative page clamps to 0
  const neg = paginateSlice(items, -5, 3);
  assert.equal(neg.currentPage, 0);
  assert.deepEqual(neg.items, ['a', 'b', 'c']);

  // Oversized page clamps to last page
  const over = paginateSlice(items, 999, 3);
  assert.equal(over.currentPage, 2);
  assert.deepEqual(over.items, ['g']);

  // Empty items
  const empty = paginateSlice([], 0, 5);
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.currentPage, 0);
  assert.deepEqual(empty.items, []);

  // Zero or invalid pageSize defaults safely
  const safeSize = paginateSlice(items, 0, 0);
  assert.equal(safeSize.items.length, 7);
});

test('filterByName performs safe, case-insensitive, trimmed matching', () => {
  const files = [
    { name: 'Saved' },
    { name: 'Work Project' },
    { name: 'Personal Study' },
  ];

  assert.equal(filterByName(files, '').length, 3);
  assert.equal(filterByName(files, '   ').length, 3);
  assert.equal(filterByName(files, 'work').length, 1);
  assert.equal(filterByName(files, 'WORK')[0].name, 'Work Project');
  assert.equal(filterByName(files, 'study').length, 1);
  assert.equal(filterByName(files, 'nonexistent').length, 0);
});

test('filterKeywords searches text and key properties', () => {
  const words = [
    { key: 'algorithm', text: 'Algorithm' },
    { key: 'data structure', text: 'Data Structure' },
    { key: 'function', text: 'function' },
  ];

  assert.equal(filterKeywords(words, '').length, 3);
  assert.equal(filterKeywords(words, 'algo').length, 1);
  assert.equal(filterKeywords(words, 'structure').length, 1);
  assert.equal(filterKeywords(words, 'data')[0].key, 'data structure');
  assert.equal(filterKeywords(words, 'missing').length, 0);
});

test('renderPaginationControls produces accessible navigation markup', () => {
  const app = { escapeHtml: (s) => String(s ?? '') };

  // When totalPages is 1, markup is empty
  const singlePage = renderPaginationControls(app, {
    currentPage: 0,
    totalPages: 1,
    action: 'keyword-file-page',
  });
  assert.equal(singlePage, '');

  // When totalPages is 3, renders prev, next, page buttons, indicator
  const multiPage = renderPaginationControls(app, {
    currentPage: 1,
    totalPages: 3,
    action: 'keyword-file-page',
    ariaLabel: 'Files pagination',
  });

  assert.match(multiPage, /nav class="keywords-pagination"/);
  assert.match(multiPage, /aria-label="Files pagination"/);
  assert.match(multiPage, /‹ Prev/);
  assert.match(multiPage, /Next ›/);
  assert.match(multiPage, /aria-current="page"/);
  assert.match(multiPage, /2 \/ 3/);
});

test('renderSearchBar renders input and conditional clear button', () => {
  const app = { escapeHtml: (s) => String(s ?? '') };

  // Empty search
  const emptyBar = renderSearchBar(app, {
    field: 'keyword-file-search',
    value: '',
    placeholder: 'Search files...',
    clearAction: 'keyword-clear-file-search',
    ariaLabel: 'Search files',
  });
  assert.match(emptyBar, /placeholder="Search files\.\.\."/);
  assert.doesNotMatch(emptyBar, /keywords-search-clear/);

  // Active search
  const activeBar = renderSearchBar(app, {
    field: 'keyword-file-search',
    value: 'notes',
    placeholder: 'Search files...',
    clearAction: 'keyword-clear-file-search',
    ariaLabel: 'Search files',
  });
  assert.match(activeBar, /value="notes"/);
  assert.match(activeBar, /keywords-search-clear/);
  assert.match(activeBar, /data-action="keyword-clear-file-search"/);
});

test('Keywords page state and controller manage files, folders, and keyword search/pagination', () => {
  const store = {
    getLibrary: () => ({
      files: [{ id: 'kw-file-saved', name: 'Saved' }],
      folders: [
        { id: 'kw-folder-all', fileId: 'kw-file-saved', name: 'All words' },
        { id: 'folder-study', fileId: 'kw-file-saved', name: 'Study' },
      ],
      selection: { fileId: 'kw-file-saved', folderId: 'kw-folder-all' },
    }),
    getBank: () => [
      { key: 'compile', text: 'compile', folderId: 'kw-folder-all' },
      { key: 'runtime', text: 'runtime', folderId: 'folder-study' },
    ],
    apply: async () => ({ ok: true }),
  };

  const app = {
    escapeHtml: (s) => String(s ?? ''),
    showToast: () => {},
  };

  // Mock minimal elements for render
  const elements = new Map([
    ['keywordsFiles', { innerHTML: '' }],
    ['keywordsFolders', { innerHTML: '' }],
  ]);
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null,
  };

  const page = createKeywordsPage({ app, store });

  // Test Files search and pagination methods
  page.setFileSearch('save');
  assert.equal(page.state.fileSearch, 'save');
  assert.equal(page.state.filePage, 0);

  page.setFilePage(2);
  assert.equal(page.state.filePage, 2);

  page.clearFileSearch();
  assert.equal(page.state.fileSearch, '');
  assert.equal(page.state.filePage, 0);

  // Test Folders search and pagination methods
  page.setFolderSearch('stud');
  assert.equal(page.state.folderSearch, 'stud');
  assert.equal(page.state.folderPage, 0);

  page.setFolderPage(3);
  assert.equal(page.state.folderPage, 3);

  page.clearFolderSearch();
  assert.equal(page.state.folderSearch, '');
  assert.equal(page.state.folderPage, 0);

  // Test Words search and auto-expansion of folder containing match
  page.setWordSearch('run');
  assert.equal(page.state.wordSearch, 'run');
  assert.equal(page.state.expanded.has('folder-study'), true);

  page.setWordPage('folder-study', 1);
  assert.equal(page.state.wordPages.get('folder-study'), 1);

  page.clearWordSearch();
  assert.equal(page.state.wordSearch, '');
  assert.equal(page.state.wordPages.size, 0);
});
