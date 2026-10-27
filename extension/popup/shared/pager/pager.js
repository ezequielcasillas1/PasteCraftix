/**
 * @forward-slice Reusable pager: slice math + accessible Prev / numbers / Next markup.
 * Used by Categories (20 per page, top + bottom) and the Keywords Learn / Mini Games grids.
 */

export const DEFAULT_PAGE_SIZE = 20;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Clamp page into range and return the visible slice plus totals. */
export function paginateSlice(items, page = 0, pageSize = 10) {
  const list = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const startIndex = currentPage * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, total);
  return { items: list.slice(startIndex, endIndex), totalPages, currentPage, total, startIndex, endIndex };
}

/**
 * Pager markup. Returns '' for a single page. `classPrefix` keeps per-feature styling
 * (e.g. 'keywords-pagination' or 'pc-pager'); every button carries data-action + data-page.
 */
export function renderPager({
  currentPage,
  totalPages,
  action,
  extraDataset = {},
  ariaLabel = 'Pagination',
  classPrefix = 'pc-pager',
  position = '',
  maxVisiblePages = 5,
}) {
  if (!(totalPages > 1)) return '';
  const c = esc(classPrefix);
  const prevDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= totalPages - 1;
  const datasetAttrs = Object.entries(extraDataset).map(([k, v]) => `data-${esc(k)}="${esc(v)}"`).join(' ');
  let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages);
  if (endPage - startPage < maxVisiblePages) startPage = Math.max(0, endPage - maxVisiblePages);
  const buttons = [];
  for (let p = startPage; p < endPage; p += 1) {
    const isActive = p === currentPage;
    buttons.push(`<button type="button" class="${c}-btn ${c}-number${isActive ? ' is-active' : ''}" data-action="${esc(action)}" data-page="${p}" ${datasetAttrs} ${isActive ? 'aria-current="page"' : ''} aria-label="Page ${p + 1}">${p + 1}</button>`);
  }
  const pos = position ? ` ${c}--${esc(position)}` : '';
  return `
    <nav class="${c}${pos}" aria-label="${esc(ariaLabel)}">
      <button type="button" class="${c}-btn ${c}-prev" data-action="${esc(action)}" data-page="${currentPage - 1}" ${datasetAttrs} ${prevDisabled ? 'disabled' : ''} aria-label="Previous page">‹ Prev</button>
      <div class="${c}-numbers">${buttons.join('')}</div>
      <button type="button" class="${c}-btn ${c}-next" data-action="${esc(action)}" data-page="${currentPage + 1}" ${datasetAttrs} ${nextDisabled ? 'disabled' : ''} aria-label="Next page">Next ›</button>
      <span class="${c}-indicator" aria-hidden="true">${currentPage + 1} / ${totalPages}</span>
    </nav>
  `;
}

/**
 * Wire a container's pager clicks once (event delegation). onPage(page:number) is called
 * for enabled buttons matching `action`.
 */
export function bindPager(container, action, onPage) {
  if (!container || container.dataset.pagerBound === action) return;
  container.dataset.pagerBound = action;
  container.addEventListener('click', (event) => {
    const btn = event.target?.closest?.(`[data-action="${action}"]`);
    if (!btn || btn.disabled || !container.contains(btn)) return;
    const page = Number(btn.dataset.page);
    if (Number.isFinite(page)) onPage(page);
  });
}
