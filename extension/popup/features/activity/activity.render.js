import { ACTIVITY_OPERATION_ICONS, ACTIVITY_TABLE_BADGES, ACTIVITY_SELECTORS } from './activity.constants.js';

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

function buildEntryHTML(entry, app) {
  const icon = getActivityIcon(entry.operation);
  const iconClass = entry.operation.toLowerCase();
  const tableBadge = getTableBadge(entry.table_name);
  const summary = getActivitySummary(entry);
  const timeAgo = formatTimeAgo(new Date(entry.occurred_at));
  
  let recoverBtn = '';
  if (entry.operation === 'DELETE') {
    const isRecoverable = (Date.now() - new Date(entry.occurred_at).getTime()) <= (7 * 24 * 60 * 60 * 1000);
    
    // Check if already recovered (exists in current state)
    let alreadyRecovered = false;
    if (entry.row_old && entry.row_old.id) {
      if (entry.table_name === 'clips') {
        alreadyRecovered = (app.clips && app.clips.some(c => c.id == entry.row_old.id)) || 
                          (app.searchOnlyClips && app.searchOnlyClips.some(c => c.id == entry.row_old.id));
      } else if (entry.table_name === 'categories' && app.categories) {
        alreadyRecovered = app.categories.some(c => c.id == entry.row_old.id);
      } else if (entry.table_name === 'notes' && app.notes) {
        alreadyRecovered = app.notes.some(n => n.id == entry.row_old.id);
      }
    }
    
    const disabledAttr = (!isRecoverable || alreadyRecovered) ? 'disabled' : '';
    let titleAttr = 'Recover this item';
    if (!isRecoverable) titleAttr = 'Cannot recover items older than 7 days';
    if (alreadyRecovered) titleAttr = 'Item already recovered';
    
    const btnText = alreadyRecovered ? 'Recovered' : 'Recover';
    
    recoverBtn = `<button class="activity-recover-btn" data-id="${entry.id}" ${disabledAttr} title="${titleAttr}">${btnText}</button>`;
  }

  return `
    <div class="activity-entry" data-id="${entry.id}">
      <div class="activity-entry-icon ${iconClass}">${icon}</div>
      <div class="activity-entry-info">
        <div class="activity-entry-title">${summary}</div>
        <div class="activity-entry-meta">${timeAgo}</div>
      </div>
      <div class="activity-entry-actions">
        <span class="activity-entry-badge ${entry.table_name}">${tableBadge}</span>
        ${recoverBtn}
      </div>
    </div>
  `;
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
      <h3>No cloud activity yet</h3>
      <p>Activity appears here after clips sync to the cloud.<br>Try clicking Refresh after making changes.</p>
    </div>
  `;
}

export function renderActivityList(app) {
  const container = document.getElementById(ACTIVITY_SELECTORS.LIST);
  const loadMoreBtn = document.getElementById(ACTIVITY_SELECTORS.LOAD_MORE_BTN);
  if (!container) return;

  if (!app.activityEntries?.length) {
    renderEmptyState(container);
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  container.innerHTML = app.activityEntries.map(entry => buildEntryHTML(entry, app)).join('');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = app.activityHasMore ? 'block' : 'none';
  }
}
