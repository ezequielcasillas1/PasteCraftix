import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paginateSlice, renderPager, DEFAULT_PAGE_SIZE } from '../extension/popup/shared/pager/pager.js';
import { paginateSlice as kwSlice, renderPaginationControls } from '../extension/popup/features/keywords/keywords.pagination.js';
import { getCategoriesPageView } from '../extension/popup/features/categories/categories.render.js';
import { CATEGORIES_DEFAULTS } from '../extension/popup/features/categories/categories.constants.js';

test('shared pager is the one keywords uses', () => {
  assert.equal(kwSlice, paginateSlice);
  const html = renderPaginationControls({ escapeHtml: (s) => s }, { currentPage: 0, totalPages: 3, action: 'x' });
  assert.match(html, /class="keywords-pagination"/);
  assert.match(html, /keywords-pagination-btn keywords-pagination-number is-active/);
});

test('renderPager: empty for one page, escapes, marks position', () => {
  assert.equal(renderPager({ currentPage: 0, totalPages: 1, action: 'a' }), '');
  const html = renderPager({ currentPage: 1, totalPages: 4, action: 'a"b', position: 'top', ariaLabel: '<x>' });
  assert.match(html, /pc-pager pc-pager--top/);
  assert.match(html, /aria-label="&lt;x&gt;"/);
  assert.ok(!html.includes('a"b'));
  assert.match(html, /aria-current="page"[^>]*>2</);
});

test('categories page 20 at a time, newest first, clamped', () => {
  assert.equal(DEFAULT_PAGE_SIZE, 20);
  assert.equal(CATEGORIES_DEFAULTS.PAGE_SIZE, 20);
  const cats = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `C${i + 1}` }));
  const p0 = getCategoriesPageView(cats, 0);
  assert.equal(p0.items.length, 20);
  assert.equal(p0.totalPages, 3);
  assert.equal(p0.items[0].name, 'C45');
  const last = getCategoriesPageView(cats, 99);
  assert.equal(last.currentPage, 2);
  assert.equal(last.items.length, 5);
});
