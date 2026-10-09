/** Reusable pagination, filtering, and search helpers for keywords, folders, and files.
 * Follows 5 best practices: Reusability, Reliability, Secureness, Accountability, Accessibility.
 */

import { escapeHtml } from './keywords.render.js';

/** Best practice 1: Reusability & Best practice 2: Reliability (Safe slice computation with boundary clamping). */
export function paginateSlice(items, page = 0, pageSize = 10) {
  const list = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const startIndex = currentPage * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, total);
  const pageItems = list.slice(startIndex, endIndex);

  return {
    items: pageItems,
    totalPages,
    currentPage,
    total,
    startIndex,
    endIndex,
  };
}

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
  if (totalPages <= 1) return '';

  const prevDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= totalPages - 1;

  const datasetAttrs = Object.entries(extraDataset)
    .map(([k, v]) => `data-${escapeHtml(app, k)}="${escapeHtml(app, v)}"`)
    .join(' ');

  // Display page buttons with a sliding window if many pages exist
  const buttons = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages);
  if (endPage - startPage < maxVisiblePages) {
    startPage = Math.max(0, endPage - maxVisiblePages);
  }

  for (let p = startPage; p < endPage; p += 1) {
    const isActive = p === currentPage;
    buttons.push(`
      <button type="button" class="keywords-pagination-btn keywords-pagination-number${isActive ? ' is-active' : ''}" data-action="${action}" data-page="${p}" ${datasetAttrs} ${isActive ? 'aria-current="page"' : ''} aria-label="Page ${p + 1}">${p + 1}</button>
    `);
  }

  return `
    <nav class="keywords-pagination" aria-label="${escapeHtml(app, ariaLabel)}">
      <button type="button" class="keywords-pagination-btn keywords-pagination-prev" data-action="${action}" data-page="${currentPage - 1}" ${datasetAttrs} ${prevDisabled ? 'disabled' : ''} aria-label="Previous page">‹ Prev</button>
      <div class="keywords-pagination-numbers">
        ${buttons.join('')}
      </div>
      <button type="button" class="keywords-pagination-btn keywords-pagination-next" data-action="${action}" data-page="${currentPage + 1}" ${datasetAttrs} ${nextDisabled ? 'disabled' : ''} aria-label="Next page">Next ›</button>
      <span class="keywords-pagination-indicator" aria-hidden="true">${currentPage + 1} / ${totalPages}</span>
    </nav>
  `;
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
