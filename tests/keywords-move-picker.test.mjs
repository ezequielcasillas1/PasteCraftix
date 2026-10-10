import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMovePickerModel,
  renderMovePicker,
} from '../extension/popup/features/keywords/keywords.move-picker.js';
import { createKeywordsPage } from '../extension/popup/features/keywords/keywords.page.js';

function makeLibrary(fileCount, foldersPerFile) {
  const files = [];
  const folders = [];
  for (let f = 0; f < fileCount; f += 1) {
    files.push({ id: `file-${f}`, name: `File ${f}` });
    for (let d = 0; d < foldersPerFile; d += 1) {
      folders.push({ id: `folder-${f}-${d}`, fileId: `file-${f}`, name: `Folder ${f}-${d}` });
    }
  }
  return { files, folders };
}

const item = { key: 'ontology', text: 'Ontology', folderId: 'folder-0-0' };

test('pages 6 folders at a time with the right page count', () => {
  const cases = [[0, 1], [6, 1], [7, 2], [288, 48]];
  for (const [count, pages] of cases) {
    const library = makeLibrary(count ? 1 : 0, count);
    const model = buildMovePickerModel(library, item, { page: 0 });
    assert.equal(model.paged.totalPages, pages, `${count} folders`);
    assert.equal(model.paged.items.length, Math.min(count, 6));
  }
  const max = buildMovePickerModel(makeLibrary(12, 24), item, { page: 47 });
  assert.equal(max.total, 288);
  assert.equal(max.paged.currentPage, 47);
  assert.equal(max.paged.items.length, 6);
});

test('search narrows folders and the page clamps', () => {
  const library = makeLibrary(3, 10);
  const model = buildMovePickerModel(library, item, { search: '2-1', page: 5 });
  assert.deepEqual(model.filtered.map((f) => f.id), ['folder-2-1']);
  assert.equal(model.paged.currentPage, 0);
});

test('renders nothing with fewer than 2 folders', () => {
  assert.equal(renderMovePicker(null, item, makeLibrary(1, 1), { open: true }), '');
});

test('closed picker shows the current folder; open picker shows rows and pager', () => {
  const library = makeLibrary(2, 5);
  const closed = renderMovePicker(null, item, library, { open: false });
  assert.match(closed, /aria-expanded="false"/);
  assert.match(closed, /<strong>Folder 0-0<\/strong>/);
  assert.doesNotMatch(closed, /keywords-move-panel/);

  const open = renderMovePicker(null, item, library, { open: true, page: 0 });
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /data-field="keyword-move-search"/);
  assert.equal((open.match(/keywords-move-row/g) || []).length, 6);
  assert.match(open, /1 \/ 2/);
  assert.match(open, /data-action="keyword-move-page"/);
});

test('file headings appear where the file changes on a page', () => {
  const library = makeLibrary(2, 5);
  const html = renderMovePicker(null, item, library, { open: true, page: 0 });
  const headings = html.match(/class="keywords-move-file"[^>]*>([^<]+)</g) || [];
  assert.equal(headings.length, 2);
  assert.match(headings[0], /File 0/);
  assert.match(headings[1], /File 1/);
});

test('current folder is marked and disabled', () => {
  const html = renderMovePicker(null, item, makeLibrary(1, 3), { open: true });
  assert.match(html, /is-current" role="option" aria-selected="true"[^>]*data-folder="folder-0-0" disabled/);
  assert.match(html, />Current</);
});

test('page methods open, page, search, and reset the picker', async () => {
  const library = {
    files: [{ id: 'kw-file-saved', name: 'Saved' }],
    folders: Array.from({ length: 8 }, (_, i) => ({ id: i ? `f${i}` : 'kw-folder-all', fileId: 'kw-file-saved', name: `Folder ${i}` })),
    selection: { fileId: 'kw-file-saved', folderId: 'kw-folder-all' },
  };
  const store = {
    getLibrary: () => library,
    getBank: () => [{ key: 'compile', text: 'compile', folderId: 'kw-folder-all' }],
    apply: async () => ({ ok: true }),
  };
  const elements = new Map([['keywordsFiles', { innerHTML: '' }], ['keywordsFolders', { innerHTML: '' }]]);
  globalThis.document = { getElementById: (id) => elements.get(id) || null, querySelector: () => null };
  const page = createKeywordsPage({ app: { showToast: () => {} }, store });

  page.openWord('compile');
  page.toggleMovePicker();
  assert.equal(page.state.movePicker.open, true);
  assert.match(elements.get('keywordsFolders').innerHTML, /1 \/ 2/);

  page.setMovePickerPage(1);
  assert.equal(page.state.movePicker.page, 1);
  page.setMovePickerSearch('7');
  assert.equal(page.state.movePicker.page, 0);
  assert.equal(page.state.movePicker.search, '7');
  page.clearMovePickerSearch();
  assert.equal(page.state.movePicker.search, '');

  page.closeMovePicker();
  assert.equal(page.state.movePicker.open, false);

  page.toggleMovePicker();
  await page.moveWord('compile', 'f3');
  assert.deepEqual(page.state.movePicker, { open: false, search: '', page: 0 });
});

test('escapes folder and file names', () => {
  const library = {
    files: [{ id: 'f', name: '<b>File</b>' }],
    folders: [
      { id: 'a', fileId: 'f', name: '<img src=x onerror=1>' },
      { id: 'b', fileId: 'f', name: 'Safe' },
    ],
  };
  const html = renderMovePicker(null, { key: 'w', text: 'w', folderId: 'b' }, library, { open: true });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<b>File/);
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
});
