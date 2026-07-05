import {
  getDarkModeToggleEl,
  getRestoreWindowSelect,
} from './settings.selectors.js';
import { loadSettings } from './settings.storage.js';

// ── updateStorageStats ────────────────────────────────────────────────────────

export function updateStorageStats(app) {
  const allClips = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  const total = allClips.length;
  const categorized = allClips.filter((c) => c.category !== 'Uncategorized').length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('totalClipsCount', `${total} (${app.clips?.length ?? 0} active, ${app.searchOnlyClips?.length ?? 0} archived)`);
  setEl('categorizedClipsCount', categorized);
  setEl('uncategorizedClipsCount', total - categorized);
}

// ── Restore UI helper ─────────────────────────────────────────────────────────

function _applyRestoreUI(app) {
  try {
    const restoreWindowSelect = getRestoreWindowSelect();
    if (restoreWindowSelect && !restoreWindowSelect.value) restoreWindowSelect.value = '1week';

    const previewEl = document.getElementById('restorePreviewText');
    if (previewEl) previewEl.textContent = 'Select a window to preview what will be restored.';

    const syncBtn = document.getElementById('syncRestoredToCloudBtn');
    if (syncBtn) syncBtn.disabled = !(app._lastAppliedRestore?.point);

    const key = restoreWindowSelect ? restoreWindowSelect.value : '1week';
    Promise.resolve().then(() => app.previewRestore(key)).catch(() => {});
  } catch (_) {}
}

// ── showSettingsModal ─────────────────────────────────────────────────────────

export async function showSettingsModal(app) {
  updateStorageStats(app);

  _applyBasicSettingsToUI(app);
  Promise.resolve().then(() => app.applyAuthPrefsToUi()).catch(() => {});
  Promise.resolve().then(() => app.settingsFeature?.coupon?.refreshCouponSettingsUI?.()).catch(() => {});
  _applyRestoreUI(app);

  document.getElementById('settingsModal').style.display = 'flex';

  // Background refresh: update UI with fresh values without blocking modal open
  Promise.all([
    loadSettings(app).catch(() => {}),
  ]).then(() => {
    _applyBasicSettingsToUI(app);
  }).catch(() => {});
}

function _applyAutoDeleteUI(app) {
  const el = document.getElementById('autoDeletePeriod');
  if (el) el.value = app.autoDeletePeriod || 'never';
}

function _applyQuickPasteUI(app) {
  const qp = app.quickPasteSettings;
  const autoHideEl = document.getElementById('quickPasteAutoHidePopup');
  if (autoHideEl) autoHideEl.checked = qp?.autoHide !== false;
  const showTsEl = document.getElementById('quickPasteShowTimestampsPopup');
  if (showTsEl) showTsEl.checked = qp?.showTimestamps !== false;
  const maxClipsEl = document.getElementById('quickPasteMaxClipsPopup');
  if (maxClipsEl) maxClipsEl.value = qp?.maxClipsDisplay || 20;
  const albumModeEl = document.getElementById('albumAttachmentOpenMode');
  if (albumModeEl) albumModeEl.value = app.albumAttachmentOpenMode || 'edgePopup';
}

function _applyBasicSettingsToUI(app) {
  _applyAutoDeleteUI(app);
  _applyThemeToggle(app, getDarkModeToggleEl(), app.darkModeComingSoon);
  _applyThemeToggle(app, document.getElementById('profileDarkModeToggle'), app.darkModeComingSoon);
  _applyQuickPasteUI(app);
}

function _applyThemeToggle(app, el, comingSoon) {
  if (!el) return;
  if (comingSoon) {
    el.checked = false;
    el.disabled = true;
  } else {
    el.disabled = false;
    el.checked = app.theme === 'dark';
  }
}

// ── hideSettingsModal ─────────────────────────────────────────────────────────

export function hideSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.style.display = 'none';
}

// ── Help modal ────────────────────────────────────────────────────────────────

export function showHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.style.display = 'flex';
}

export function hideHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.style.display = 'none';
}

// ── Restore Preview modal ─────────────────────────────────────────────────────

function _truncate(text, max = 80) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max).trim()}…` : s;
}

function _categoryLabel(cat) {
  if (cat && typeof cat === 'object') return String(cat.name || cat.title || cat.id || 'Untitled');
  return String(cat ?? '');
}

function _noteLabel(note) {
  if (!note || typeof note !== 'object') return String(note ?? '');
  return String(note.title || note.body || note.description || 'Untitled note');
}

function _renderClipRows(container, clips) {
  if (!container) return;
  container.innerHTML = '';
  const arr = Array.isArray(clips) ? clips : [];
  if (arr.length === 0) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;padding:4px 0;">None</div>';
    return;
  }
  const max = 50;
  arr.slice(0, max).forEach((clip) => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#374151;';
    const cat = clip?.category ? `<span style="color:#6366f1;font-weight:500;">[${_truncate(clip.category, 24)}]</span> ` : '';
    row.innerHTML = `${cat}${_truncate(clip?.text, 100).replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}`;
    container.appendChild(row);
  });
  if (arr.length > max) {
    const more = document.createElement('div');
    more.style.cssText = 'padding:6px 4px;color:#9ca3af;font-size:11px;font-style:italic;';
    more.textContent = `…and ${arr.length - max} more`;
    container.appendChild(more);
  }
}

function _renderLabelRows(container, items, labelFn) {
  if (!container) return;
  container.innerHTML = '';
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;padding:4px 0;">None</div>';
    return;
  }
  arr.forEach((item) => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:4px 4px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#374151;';
    row.textContent = _truncate(labelFn(item), 100);
    container.appendChild(row);
  });
}

function _setMetaText(point, windowKey, cutoffMs) {
  const meta = document.getElementById('restorePreviewMetaText');
  if (!meta) return;
  if (!point) {
    meta.textContent = `Target window: ${windowKey} (≤ ${new Date(cutoffMs || Date.now()).toLocaleString()}). No restore point available yet.`;
    return;
  }
  const when = new Date(point.createdAt).toLocaleString();
  const target = new Date(cutoffMs).toLocaleString();
  const reason = point.reason ? ` • ${String(point.reason)}` : '';
  meta.textContent = `Restore point: ${when}${reason}. Target window: ${windowKey} (≤ ${target}).`;
}

function _toggleEmptyState(hasPoint) {
  const empty = document.getElementById('restorePreviewEmpty');
  const content = document.getElementById('restorePreviewContent');
  if (empty) empty.style.display = hasPoint ? 'none' : 'flex';
  if (content) content.style.display = hasPoint ? '' : 'none';
}

export async function openRestorePreviewModal(app, windowKey) {
  const modal = document.getElementById('restorePreviewModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const { point, cutoffMs } = await app.previewRestore(windowKey);
  _setMetaText(point, windowKey, cutoffMs);
  _toggleEmptyState(!!point);

  const active = Array.isArray(point?.clips) ? point.clips : [];
  const archived = Array.isArray(point?.searchOnlyClips) ? point.searchOnlyClips : [];
  const cats = Array.isArray(point?.categories) ? point.categories : [];
  const notes = Array.isArray(point?.notes) ? point.notes : [];

  const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  setCount('rpActiveCount', active.length);
  setCount('rpArchivedCount', archived.length);
  setCount('rpCategoriesCount', cats.length);
  setCount('rpNotesCount', notes.length);

  _renderClipRows(document.getElementById('rpActiveList'), active);
  _renderClipRows(document.getElementById('rpArchivedList'), archived);
  _renderLabelRows(document.getElementById('rpCategoriesList'), cats, _categoryLabel);
  _renderLabelRows(document.getElementById('rpNotesList'), notes, _noteLabel);
}

export function hideRestorePreviewModal() {
  const modal = document.getElementById('restorePreviewModal');
  if (modal) modal.style.display = 'none';
}
