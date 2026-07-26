// @forward-slice AI Lab history — list / modal render helpers
import { AI_HISTORY_PAGE_SIZE } from './ai-lab.constants.js';

export function getAiHistoryTotalPages(totalEntries) {
  return Math.max(1, Math.ceil(totalEntries / AI_HISTORY_PAGE_SIZE));
}

export function clampAiHistoryPageIndex(app, totalPages) {
  const idx = app._aiHistoryPageIndex || 0;
  if (idx >= totalPages) {
    app._aiHistoryPageIndex = Math.max(0, totalPages - 1);
  } else if (idx < 0) {
    app._aiHistoryPageIndex = 0;
  }
}

function _getAiHistoryPaginationItems(currentPage, totalPages) {
  const items = [];
  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);

  if (currentPage > 2) items.push({ type: 'page', page: 0 });
  if (currentPage > 3) items.push({ type: 'ellipsis' });

  for (let page = startPage; page <= endPage; page++) {
    items.push({ type: 'page', page });
  }

  if (currentPage < totalPages - 4) items.push({ type: 'ellipsis' });
  if (currentPage < totalPages - 3) items.push({ type: 'page', page: totalPages - 1 });

  return items;
}

function _renderAiHistoryPaginationItem(item, currentPage) {
  if (item.type === 'ellipsis') return '<span class="pagination-ellipsis">...</span>';
  const isActive = item.page === currentPage ? 'active' : '';
  const label = item.page + 1;
  return `<button type="button" class="pagination-number ${isActive}" data-action="ai-history-page" data-page="${item.page}" aria-label="Page ${label}">${label}</button>`;
}

export function renderAiHistoryListPagination(app, paginationEl, totalEntries, totalPages) {
  if (!paginationEl) return;

  if (totalEntries <= AI_HISTORY_PAGE_SIZE) {
    paginationEl.style.display = 'none';
    paginationEl.innerHTML = '';
    return;
  }

  const currentPage = app._aiHistoryPageIndex || 0;
  const pageLabel = currentPage + 1;

  let html = '<div class="pagination-wrapper ai-history-pagination-wrapper">';
  html += `<span class="ai-history-page-label" style="font-size:12px;font-weight:600;color:#64748b;margin-right:4px;">Page ${pageLabel} of ${totalPages}</span>`;
  html += `<button type="button" class="pagination-btn pagination-prev" data-action="ai-history-page" data-page="${currentPage - 1}" ${currentPage === 0 ? 'disabled' : ''} aria-label="Previous page">‹ Prev</button>`;
  html += '<div class="pagination-numbers">';
  html += _getAiHistoryPaginationItems(currentPage, totalPages)
    .map(item => _renderAiHistoryPaginationItem(item, currentPage))
    .join('');
  html += '</div>';
  html += `<button type="button" class="pagination-btn pagination-next" data-action="ai-history-page" data-page="${currentPage + 1}" ${currentPage >= totalPages - 1 ? 'disabled' : ''} aria-label="Next page">Next ›</button>`;
  html += '</div>';

  paginationEl.style.display = 'flex';
  paginationEl.innerHTML = html;
}

function _historyEntryMatchesQuery(entry, query) {
  const title = (entry.title || '').toLowerCase();
  const text = (entry.originalText || '').toLowerCase();
  const threads = entry.threads || [];
  const answers = threads.map(t => (t.answer || '').toLowerCase()).join(' ');
  const beforeAfter = threads.map(t => `${t.before || ''} ${t.after || ''}`).join(' ').toLowerCase();
  return title.includes(query) || text.includes(query) || answers.includes(query) || beforeAfter.includes(query);
}

export function filterHistoryEntries(app) {
  let entries = app.aiHistoryEntries || [];
  const filterType = app._aiHistoryFilterType || 'all';
  if (filterType !== 'all') {
    entries = entries.filter(e => e.type === filterType);
  }

  const query = (app._aiHistorySearchQuery || '').toLowerCase();
  if (query) {
    entries = entries.filter(entry => _historyEntryMatchesQuery(entry, query));
  }
  return entries;
}

function _emptyHistoryCopy(query, filter) {
  if (query) {
    return { heading: 'No matches', msg: 'No results match your search' };
  }
  if (filter === 'refactorization') {
    return {
      heading: 'No refactorizations yet',
      msg: 'Refactorizations appear here after you run AI Lab Refactorization or Craft Clips (AI Refactoring)',
    };
  }
  if (filter === 'formatted') {
    return {
      heading: 'No AI Formatted history yet',
      msg: 'Formatted before/after appears here after you run Craft Clips in AI Formatted mode',
    };
  }
  return {
    heading: 'No history yet',
    msg: 'Your AI Summary, Breakdown, and Refactorization history will appear here',
  };
}

export function renderEmptyHistory(app) {
  const { heading, msg } = _emptyHistoryCopy(
    app._aiHistorySearchQuery || '',
    app._aiHistoryFilterType || 'all',
  );
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="scroll-text"></i></div>
      <h3>${heading}</h3>
      <p>${msg}</p>
    </div>`;
}

export function historyTypeMeta(entry) {
  if (entry.type === 'breakdown') {
    return { icon: '🧠', badgeClass: 'breakdown', badgeLabel: 'Breakdown' };
  }
  if (entry.type === 'refactorization') {
    return { icon: '✨', badgeClass: 'refactorization', badgeLabel: 'Refactor' };
  }
  if (entry.type === 'formatted') {
    return { icon: '✏️', badgeClass: 'formatted', badgeLabel: 'Formatted' };
  }
  return { icon: '📝', badgeClass: 'summary', badgeLabel: 'Summary' };
}

function _isCompareHistoryType(type) {
  return type === 'refactorization' || type === 'formatted';
}

function _historyEntryMetaLabel(entry, timeStr, threadCount) {
  if (_isCompareHistoryType(entry.type)) return `${timeStr} · before/after`;
  return `${timeStr} · ${threadCount} response${threadCount !== 1 ? 's' : ''}`;
}

export function renderHistoryEntry(app, entry) {
  const meta = historyTypeMeta(entry);
  const threadCount = (entry.threads || []).length;
  const timeStr = app.getTimeAgo ? app.getTimeAgo(entry.createdAt) : new Date(entry.createdAt).toLocaleDateString();
  const title = app.escapeHtml ? app.escapeHtml(entry.title || 'Untitled') : (entry.title || 'Untitled');
  const metaLabel = _historyEntryMetaLabel(entry, timeStr, threadCount);

  return `
    <div class="ai-history-entry" data-history-id="${entry.id}">
      <span class="ai-history-entry-icon">${meta.icon}</span>
      <div class="ai-history-entry-info">
        <div class="ai-history-entry-title">${title}</div>
        <div class="ai-history-entry-meta">${metaLabel}</div>
      </div>
      <span class="ai-history-entry-badge ${meta.badgeClass}">${meta.badgeLabel}</span>
      <button class="ai-history-entry-delete" data-delete-id="${entry.id}" title="Delete"><i data-lucide="trash-2"></i></button>
    </div>`;
}

export function attachHistoryListHandlers(app, container) {
  container.querySelectorAll('.ai-history-entry').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.ai-history-entry-delete')) return;
      const id = parseInt(el.dataset.historyId);
      const entry = app.aiHistoryEntries.find(item => item.id === id);
      if (entry) app.openAiHistoryModal(entry);
    });
  });

  container.querySelectorAll('.ai-history-entry-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.deleteId);
      app.aiHistoryEntries = app.aiHistoryEntries.filter(entry => entry.id !== id);
      await app._persistAiHistory();
      app.renderAiHistoryList();
      app.showToast('History entry deleted');
    });
  });
}

export function renderHistoryModalHeader(entry, titleEl, subtitleEl) {
  const meta = historyTypeMeta(entry);
  const threadCount = (entry.threads || []).length;
  if (titleEl) titleEl.textContent = `${meta.icon} ${entry.title || 'Untitled'}`;
  if (subtitleEl) {
    if (entry.type === 'refactorization') {
      subtitleEl.textContent = `AI Refactorization · ${(entry.threads?.[0]?.refactorLevel || 'college')} level`;
    } else if (entry.type === 'formatted') {
      subtitleEl.textContent = 'AI Formatted · before/after';
    } else {
      subtitleEl.textContent = `${meta.badgeLabel} — ${threadCount} response(s)`;
    }
  }
}

function _setElDisplay(el, display) {
  if (el) el.style.display = display;
}

function _clearInputValue(el) {
  if (el) el.value = '';
}

export function toggleRefactorModalUi(entry) {
  const isCompare = entry?.type === 'refactorization' || entry?.type === 'formatted';
  const isRefactor = entry?.type === 'refactorization';
  _setElDisplay(document.getElementById('continueConversationBtn'), isCompare ? 'none' : '');
  _setElDisplay(document.getElementById('aiRefactorReportBtn'), isRefactor ? '' : 'none');
  _setElDisplay(document.getElementById('aiRefactorReportWrap'), 'none');
  _setElDisplay(document.getElementById('aiRefactorReportForm'), 'none');
  _clearInputValue(document.getElementById('aiRefactorReportInput'));
}

function _escapeHtmlFn(app) {
  return app.escapeHtml ? app.escapeHtml.bind(app) : (s) => String(s || '');
}

function _stringOrFallback(value, fallback) {
  return value ? String(value) : fallback;
}

function _refactorPaneTexts(thread) {
  return {
    before: thread.before || thread.question || '',
    after: thread.after || thread.answer || '',
  };
}

function _refactorCompareFields(thread) {
  const synthesis = thread.synthesis || {};
  const panes = _refactorPaneTexts(thread);
  return {
    before: panes.before,
    after: panes.after,
    level: thread.refactorLevel || synthesis.level || 'college',
    outcome: _stringOrFallback(synthesis.outcome, 'changed'),
    summary: _stringOrFallback(synthesis.synthesis, ''),
    reasons: Array.isArray(synthesis.reasons) ? synthesis.reasons : [],
  };
}

function _renderRefactorSynthesisHtml(esc, summary, reasons) {
  if (!summary && reasons.length === 0) return '';
  const summaryHtml = summary ? `<p>${esc(summary)}</p>` : '';
  const reasonsHtml = reasons.length
    ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
    : '';
  return `
        <div class="refactor-history-synthesis">
          <h4>AI diagnostic</h4>
          ${summaryHtml}
          ${reasonsHtml}
        </div>`;
}

export function renderRefactorCompareHtml(app, thread, options = {}) {
  const esc = _escapeHtmlFn(app);
  const fields = _refactorCompareFields(thread);
  const isFormat = options.mode === 'formatted';
  const metaHtml = isFormat
    ? `<div class="refactor-history-meta">
        <span class="refactor-history-level">AI Formatted</span>
        <span class="refactor-history-outcome outcome-applied">applied</span>
      </div>`
    : `<div class="refactor-history-meta">
        <span class="refactor-history-level">${esc(fields.level)} level</span>
        <span class="refactor-history-outcome outcome-${esc(fields.outcome)}">${esc(fields.outcome.replace(/_/g, ' '))}</span>
      </div>`;
  return `
    <div class="refactor-history-compare">
      ${metaHtml}
      <div class="refactor-history-stack">
        <section class="refactor-history-pane">
          <h4>Before</h4>
          <div class="refactor-history-text">${esc(fields.before)}</div>
        </section>
        <section class="refactor-history-pane after">
          <h4>After</h4>
          <div class="refactor-history-text">${esc(fields.after)}</div>
        </section>
      </div>
      ${isFormat ? '' : _renderRefactorSynthesisHtml(esc, fields.summary, fields.reasons)}
    </div>`;
}

function _setResultHtml(resultEl, html) {
  if (resultEl) resultEl.innerHTML = html;
}

export async function renderCurrentHistoryThread(app, entry, resultEl) {
  if (!entry.threads || entry.threads.length === 0) {
    _setResultHtml(resultEl, '<p style="color:#94a3b8;">No content</p>');
    return;
  }

  if (entry.type === 'refactorization' || entry.type === 'formatted') {
    _setResultHtml(
      resultEl,
      renderRefactorCompareHtml(app, entry.threads[0], { mode: entry.type }),
    );
    return;
  }

  _setResultHtml(resultEl, await app._renderAiResponse(entry.threads[0].answer));
}

function _historyThreadBoxStyle(app, index) {
  const active = index === app.currentHistoryThreadIndex;
  return `
    width: 32px; height: 32px; border-radius: 6px;
    background: ${active ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
    border: 2px solid ${active ? '#2563eb' : '#cbd5e1'};
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    color: ${active ? 'white' : '#64748b'};
    transition: all 0.25s ease;
  `;
}

export function createHistoryThreadBox(app, thread, index) {
  const box = document.createElement('div');
  box.className = `thread-box ${index === app.currentHistoryThreadIndex ? 'active' : ''}`;
  box.textContent = index + 1;
  box.style.cssText = _historyThreadBoxStyle(app, index);

  const question = thread.question || 'Response';
  const tipText = question.length > 30 ? question.substring(0, 30) + '...' : question;
  box.title = `${index + 1}. ${tipText}`;
  box.addEventListener('click', () => app.navigateHistoryThread(index));
  return box;
}

export function isValidHistoryThreadIndex(entry, index) {
  return Boolean(entry?.threads) && index >= 0 && index < entry.threads.length;
}

export function getHistoryCopyText(entry, thread) {
  if (entry.type === 'refactorization' || entry.type === 'formatted') {
    return `Before:\n${thread.before || entry.originalText || ''}\n\nAfter:\n${thread.after || thread.answer || ''}`;
  }
  return thread.answer || '';
}

function _hasTitleEditCore(titleEl, editContainer, titleInput) {
  return Boolean(titleEl && editContainer && titleInput);
}

export function getHistoryTitleEditElements() {
  const titleEl = document.getElementById('aiHistoryModalTitle');
  const editContainer = document.getElementById('aiHistoryTitleEditContainer');
  const titleInput = document.getElementById('aiHistoryTitleInput');
  const editBtn = document.getElementById('editAiHistoryTitleBtn');
  if (!_hasTitleEditCore(titleEl, editContainer, titleInput)) return null;
  return { titleEl, editContainer, titleInput, editBtn };
}

export function historyTypeIcon(entry) {
  if (entry.type === 'breakdown') return '🧠';
  if (entry.type === 'refactorization') return '✨';
  if (entry.type === 'formatted') return '✏️';
  return '📝';
}
