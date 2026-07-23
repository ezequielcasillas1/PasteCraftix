// @forward-slice AI Lab magic — preview modal render
import {
  CRAFT_CLIPS_AI_MODES,
} from './ai-lab.craft-clips.constants.js';

export function _animateMagicWand() {
  const wand = document.getElementById('magicWand');
  if (!wand) return;
  wand.style.transform = 'scale(1.2) rotate(360deg)';
  setTimeout(() => { wand.style.transform = ''; }, 500);
}

export function _toggleMagicAiCreditNotice(app) {
  const notice = document.getElementById('magicAiCreditNotice');
  if (!notice) return;
  if (!app._hasAiAccess()) {
    notice.style.display = 'none';
    return;
  }
  const settings = app._craftClipsSettings || {};
  const modeLabel = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
    ? 'AI Refactoring'
    : 'AI Formatted';
  notice.textContent = `💎 Premium · ~25 credits per batch · ${modeLabel} (one AI mode per craft)`;
  notice.style.display = 'block';
}

export function _renderMagicPage(page) {
  const app = this;
  app._magicPage = page;
  const perPage = 10;
  const start = page * perPage;
  const end = Math.min(start + perPage, app._magicAnalysis.length);
  const pageItems = app._magicAnalysis.slice(start, end);
  const labels = app._magicTypeLabels();
  const container = document.getElementById('magicClipList');
  if (!container) return;

  if (app._magicAnalysis.length === 0) {
    container.innerHTML = '<div class="magic-clip-empty">No clips to analyze</div>';
    return;
  }

  container.innerHTML = pageItems
    .map((item, idx) => _buildMagicRowHtml(app, item, start + idx, labels))
    .join('');
  _attachMagicRowHandlers(app, container);
}

function _buildMagicRowHtml(app, item, globalIdx, labels) {
  const clipId = String(item.clip.id);
  const isSelected = app._magicSelected.has(clipId);
  const preview = _buildMagicPreviewText(item.clip.text);
  const typeBadge = app._escHtml(labels[item.contentType] || item.contentType);
  const actionCards = (item.actions || []).map(a => _buildCraftActionCardHtml(app, a)).join('');
  return `
    <div class="magic-clip-row craft-clip-card ${isSelected ? 'magic-clip-selected' : ''}" data-magic-idx="${globalIdx}" data-clip-id="${clipId}">
      <input type="checkbox" class="magic-clip-check" ${isSelected ? 'checked' : ''}>
      <div class="magic-clip-info">
        <div class="magic-clip-text">${app._escHtml(preview)}</div>
        <div class="magic-clip-meta">
          <span class="magic-type-badge">${typeBadge}</span>
        </div>
        <div class="craft-action-cards">${actionCards}</div>
      </div>
    </div>`;
}

function _buildCraftActionCardHtml(app, action) {
  const kind = String(action.kind || 'neutral').replace(/[^a-z0-9_-]/gi, '') || 'neutral';
  const inactive = action.active === false ? ' craft-action-inactive' : '';
  return `<span class="craft-action-card craft-action-${kind}${inactive}">${app._escHtml(action.label || '')}</span>`;
}

function _buildMagicPreviewText(text) {
  const flat = (text || '').replace(/\n/g, ' ');
  const truncated = flat.slice(0, 80);
  return truncated + ((text || '').length > 80 ? '…' : '');
}

function _buildMagicIssueTagHtml(app, issue) {
  const safeColor = String(issue.color || 'neutral').replace(/[^a-z0-9_-]/gi, '') || 'neutral';
  const detailHtml = issue.detail ? ' ' + app._escHtml(issue.detail) : '';
  return `<span class="magic-issue-tag magic-issue-${safeColor}">${app._escHtml(issue.tag)}${detailHtml}</span>`;
}

function _attachMagicRowHandlers(app, container) {
  container.querySelectorAll('.magic-clip-row').forEach(row => {
    row.addEventListener('click', () => _toggleMagicRowSelection(app, row));
  });
}

function _toggleMagicRowSelection(app, row) {
  const clipId = row.dataset.clipId;
  if (app._magicSelected.has(clipId)) {
    _deselectMagicRow(app, row, clipId);
  } else {
    _selectMagicRow(app, row, clipId);
  }
  app._updateMagicSelectedCount();
}

function _selectMagicRow(app, row, clipId) {
  app._magicSelected.add(clipId);
  row.classList.add('magic-clip-selected');
  _setMagicRowChecked(row, true);
}

function _deselectMagicRow(app, row, clipId) {
  app._magicSelected.delete(clipId);
  row.classList.remove('magic-clip-selected');
  _setMagicRowChecked(row, false);
}

function _setMagicRowChecked(row, checked) {
  const checkbox = row.querySelector('.magic-clip-check');
  if (checkbox) checkbox.checked = checked;
}

// ────────────────────────────────────────────────────────────
// Pagination (decomposed from cc=13)
// ────────────────────────────────────────────────────────────

export function _renderMagicPagination() {
  const app = this;
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(app._magicAnalysis.length / perPage));
  const container = document.getElementById('magicPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = _buildMagicPaginationHtml(totalPages, app._magicPage);
  _attachMagicPaginationHandlers(app, container, totalPages);
}

function _buildMagicPaginationHtml(totalPages, currentPage) {
  let html = _buildMagicPrevButton(currentPage);
  for (let i = 0; i < totalPages; i++) {
    html += _buildMagicPageButtonOrDots(i, currentPage, totalPages);
  }
  html += _buildMagicNextButton(currentPage, totalPages);
  return html;
}

function _buildMagicPrevButton(currentPage) {
  const disabled = currentPage === 0 ? 'disabled' : '';
  return `<button class="magic-page-btn" data-magic-page="${currentPage - 1}" ${disabled}>‹</button>`;
}

function _buildMagicNextButton(currentPage, totalPages) {
  const disabled = currentPage >= totalPages - 1 ? 'disabled' : '';
  return `<button class="magic-page-btn" data-magic-page="${currentPage + 1}" ${disabled}>›</button>`;
}

function _buildMagicPageButtonOrDots(i, currentPage, totalPages) {
  if (_isVisibleMagicPage(i, currentPage, totalPages)) {
    return _buildMagicVisiblePageButton(i, currentPage);
  }
  return _buildMagicEllipsisIfNeeded(i, currentPage, totalPages);
}

function _isVisibleMagicPage(i, currentPage, totalPages) {
  return i === 0 || i === totalPages - 1 || Math.abs(i - currentPage) <= 2;
}

function _buildMagicVisiblePageButton(i, currentPage) {
  const active = i === currentPage ? 'active' : '';
  return `<button class="magic-page-btn ${active}" data-magic-page="${i}">${i + 1}</button>`;
}

function _buildMagicEllipsisIfNeeded(i, currentPage, totalPages) {
  if (i === 1 && currentPage > 3) return '<span class="magic-page-dots">…</span>';
  if (i === totalPages - 2 && currentPage < totalPages - 4) return '<span class="magic-page-dots">…</span>';
  return '';
}

function _attachMagicPaginationHandlers(app, container, totalPages) {
  container.querySelectorAll('.magic-page-btn').forEach(btn => {
    btn.addEventListener('click', () => _handleMagicPageClick(app, btn, totalPages));
  });
}

function _handleMagicPageClick(app, btn, totalPages) {
  const p = parseInt(btn.dataset.magicPage);
  if (!_isValidMagicPageIndex(p, totalPages)) return;
  app._renderMagicPage(p);
  app._renderMagicPagination();
}

function _isValidMagicPageIndex(p, totalPages) {
  return !isNaN(p) && p >= 0 && p < totalPages;
}

// ────────────────────────────────────────────────────────────
// Selected count + tiny helpers
// ────────────────────────────────────────────────────────────

export function _updateMagicSelectedCount() {
  const app = this;
  const countEl = document.getElementById('magicSelectedCount');
  if (countEl) countEl.textContent = `${app._magicSelected.size} selected`;
  const craftBtn = document.getElementById('magicCraftSelectedBtn');
  if (craftBtn) craftBtn.disabled = app._magicSelected.size === 0;
}

export function _escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
