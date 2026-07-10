import {
  ACTIVITY_OPERATION_ICONS,
  ACTIVITY_TABLE_BADGES,
  ACTIVITY_SELECTORS,
  ACTIVITY_STATUS,
  ACTIVITY_STATUS_COPY,
} from './activity.constants.js';

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

function resolveAction(operation) {
  if (operation === 'INSERT') return 'Created';
  if (operation === 'UPDATE') return 'Updated';
  if (operation === 'DELETE') return 'Deleted';
  return 'Modified';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toClassToken(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

export function getActivitySummary(entry) {
  const action = resolveAction(entry.operation);
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

function buildEntryHTML(entry) {
  const icon = getActivityIcon(entry.operation);
  const iconClass = toClassToken(entry.operation);
  const tableBadge = getTableBadge(entry.table_name);
  const summary = getActivitySummary(entry);
  const timeAgo = formatTimeAgo(new Date(entry.occurred_at));
  const tableClass = toClassToken(entry.table_name);

  return `
    <div class="activity-entry" data-id="${escapeHtml(entry.id)}">
      <div class="activity-entry-icon ${iconClass}">${escapeHtml(icon)}</div>
      <div class="activity-entry-info">
        <div class="activity-entry-title">${escapeHtml(summary)}</div>
        <div class="activity-entry-meta">${escapeHtml(timeAgo)}</div>
      </div>
      <span class="activity-entry-badge ${tableClass}">${escapeHtml(tableBadge)}</span>
    </div>
  `;
}

function renderStatusState(container, status) {
  const type = status?.type || ACTIVITY_STATUS.EMPTY;
  const copy = ACTIVITY_STATUS_COPY[type] || ACTIVITY_STATUS_COPY[ACTIVITY_STATUS.EMPTY];
  const role = type === ACTIVITY_STATUS.EMPTY ? 'status' : 'alert';

  container.innerHTML = `
    <div class="empty-state" role="${role}">
      <div class="empty-state-icon"><i data-lucide="${escapeHtml(copy.icon)}"></i></div>
      <h3>${escapeHtml(copy.title)}</h3>
      <p>${escapeHtml(copy.message)}</p>
    </div>
  `;
}

export function renderActivityList(app) {
  const container = document.getElementById(ACTIVITY_SELECTORS.LIST);
  const loadMoreBtn = document.getElementById(ACTIVITY_SELECTORS.LOAD_MORE_BTN);
  if (!container) return;

  if (!app.activityEntries?.length) {
    renderStatusState(container, app.activityStatus);
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  container.innerHTML = app.activityEntries.map(buildEntryHTML).join('');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = app.activityHasMore ? 'block' : 'none';
  }
}
