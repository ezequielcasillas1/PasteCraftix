/** Reusable pagination, filtering, and search helpers for keywords, folders, and files.
 * Follows 5 best practices: Reusability, Reliability, Secureness, Accountability, Accessibility.
 */

import { escapeHtml } from './keywords.render.js';
import { paginateSlice, renderPager } from '../../shared/pager/pager.js';

/** Slice math lives in the shared pager so Categories, Learn and Mini Games page the same way. */
export { paginateSlice };

/** Best practice 3: Secureness (Safe case-insensitive text matching without regex injection). */
export function filterByName(items, query, key = 'name') {
  const list = Array.isArray(items) ? items : [];
  const clean = String(query || '').trim().toLowerCase();
  if (!clean) return list;
  return list.filter((item) => String(item?.[key] || '').toLowerCase().includes(clean));
}

/** Best practice 3: Secureness (Safe keyword search across text and key). */
export function filterKeywords(words, query) {
  const list = Array.isArray(words) ? words : [];
  const clean = String(query || '').trim().toLowerCase();
  if (!clean) return list;
  return list.filter((word) => {
    const text = String(word?.text || '').toLowerCase();
    const key = String(word?.key || '').toLowerCase();
    return text.includes(clean) || key.includes(clean);
  });
}

/** Best practice 5: Accessibility & Best practice 1: Reusability (Accessible pagination controls). */
export function renderPaginationControls(app, {
  currentPage,
  totalPages,
  action,
  extraDataset = {},
  ariaLabel = 'Pagination',
}) {
  return renderPager({ currentPage, totalPages, action, extraDataset, ariaLabel, classPrefix: 'keywords-pagination' });
}

/** Best practice 1: Reusability & Best practice 5: Accessibility (Accessible search bar renderer). */
export function renderSearchBar(app, {
  field,
  value = '',
  placeholder = 'Search...',
  clearAction,
  ariaLabel = 'Search',
  compact = false,
}) {
  const cleanVal = String(value || '');
  const clearBtn = cleanVal
    ? `<button type="button" class="keywords-search-clear" data-action="${clearAction}" title="Clear search" aria-label="Clear search">✕</button>`
    : '';

  return `
    <div class="keywords-search-bar${compact ? ' is-compact' : ''}" role="search">
      <i data-lucide="search" aria-hidden="true"></i>
      <input type="text" class="keywords-search-input" data-field="${escapeHtml(app, field)}" placeholder="${escapeHtml(app, placeholder)}" value="${escapeHtml(app, cleanVal)}" aria-label="${escapeHtml(app, ariaLabel)}" autocomplete="off" spellcheck="false">
      ${clearBtn}
    </div>
  `;
}
