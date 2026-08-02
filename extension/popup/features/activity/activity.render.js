import {
  ACTIVITY_OPERATION_ICONS,
  ACTIVITY_TABLE_BADGES,
  ACTIVITY_SELECTORS,
  ACTIVITY_FILTERS,
  ACTIVITY_EMPTY_COPY,
} from './activity.constants.js';

function escapeHtml(app, text) {
  if (typeof app.escapeHtml === 'function') return app.escapeHtml(text);
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

/** Soft-delete = UPDATE that newly sets deleted_at. */
export function isSoftDeleteEntry(entry) {
  if (!entry || entry.operation !== 'UPDATE') return false;
  const next = entry.row_new?.deleted_at;
  const prev = entry.row_old?.deleted_at;
  return Boolean(next) && !prev;
}

/** Effective op for icon/label (soft-deletes display as DELETE). */
export function resolveDisplayOperation(entry) {
  if (entry?.operation === 'DELETE' || isSoftDeleteEntry(entry)) return 'DELETE';
  return entry?.operation || 'DEFAULT';
}

export function getActivityIcon(operation) {
  return ACTIVITY_OPERATION_ICONS[operation] ?? ACTIVITY_OPERATION_ICONS.DEFAULT;
}

export function getTableBadge(tableName) {
  return ACTIVITY_TABLE_BADGES[tableName] || tableName;
}

function extractIdentifier(data) {
  if (!data) return '';
  if (data.text) return `: "${data.text.substring(0, 30)}${data.text.length > 30 ? '...' : ''}"`;
  if (data.name) return `: "${data.name}"`;
  if (data.title) return `: "${data.title}"`;
  return '';
}

function resolveAction(displayOperation) {
  if (displayOperation === 'INSERT') return 'Created';
  if (displayOperation === 'UPDATE') return 'Updated';
  if (displayOperation === 'DELETE') return 'Deleted';
  return 'Modified';
}

export function getActivitySummary(entry) {
  const displayOp = resolveDisplayOperation(entry);
  const action = resolveAction(displayOp);
  const table = getTableBadge(entry.table_name).toLowerCase();
  const identifier = extractIdentifier(entry.row_new || entry.row_old);
  return `${action} ${table}${identifier}`;
}

export function formatTimeAgo(date) {
  const diff = Date.now() - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function buildEntryHTML(app, entry) {
  const displayOp = resolveDisplayOperation(entry);
  const icon = getActivityIcon(displayOp);
  const iconClass = displayOp.toLowerCase();
  const tableBadge = getTableBadge(entry.table_name);
  const summary = getActivitySummary(entry);
  const timeAgo = formatTimeAgo(new Date(entry.occurred_at));

  return `
    <div class="activity-entry" data-id="${escapeHtml(app, entry.id)}">
      <div class="activity-entry-icon ${iconClass}">${icon}</div>
      <div class="activity-entry-info">
        <div class="activity-entry-title">${escapeHtml(app, summary)}</div>
        <div class="activity-entry-meta">${escapeHtml(app, timeAgo)}</div>
      </div>
      <span class="activity-entry-badge ${entry.table_name}">${escapeHtml(app, tableBadge)}</span>
    </div>
  `;
}

function renderEmptyState(container, filter) {
  const copy = ACTIVITY_EMPTY_COPY[filter] || ACTIVITY_EMPTY_COPY[ACTIVITY_FILTERS.ALL];
  container.removeAttribute('aria-busy');
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
      <h3>${copy.title}</h3>
      <p>${copy.body}</p>
    </div>
  `;
}

export function renderActivityList(app) {
  const container = document.getElementById(ACTIVITY_SELECTORS.LIST);
  const loadMoreBtn = document.getElementById(ACTIVITY_SELECTORS.LOAD_MORE_BTN);
  if (!container) return;

  if (!app.activityEntries?.length) {
    renderEmptyState(container, app.activityFilter || ACTIVITY_FILTERS.ALL);
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  container.removeAttribute('aria-busy');
  container.innerHTML = app.activityEntries.map((entry) => buildEntryHTML(app, entry)).join('');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = app.activityHasMore ? 'block' : 'none';
  }
}
