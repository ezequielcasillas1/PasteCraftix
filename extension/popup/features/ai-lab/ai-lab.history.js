import { AI_STORAGE_KEYS } from './ai-lab.constants.js';
import { getHistoryModalElements } from './ai-lab.selectors.js';

export async function loadAiHistory() {
  try {
    const { [AI_STORAGE_KEYS.HISTORY]: localEntries = [] } = await chrome.storage.local.get([AI_STORAGE_KEYS.HISTORY]);
    const localHistory = await _mergeCloudHistory(localEntries);
    this.aiHistoryEntries = localHistory;
    return localHistory;
  } catch (_) {
    this.aiHistoryEntries = [];
    return [];
  }
}

export async function _persistAiHistory() {
  try {
    if (this.aiHistoryEntries.length > 50) {
      this.aiHistoryEntries.splice(50);
    }
    await chrome.storage.local.set({ [AI_STORAGE_KEYS.HISTORY]: this.aiHistoryEntries });
    _syncAiHistoryToCloud(this.aiHistoryEntries);
  } catch (_) {}
}

export async function saveAiHistory(type, originalText, threads) {
  try {
    if (!threads || threads.length === 0) {
      console.warn('saveAiHistory: no threads to save');
      return;
    }

    await this.loadAiHistory();
    const existing = _findActiveHistoryEntry(this, type);
    if (existing) {
      existing.entry.threads = _serializeThreads(threads);
      existing.entry.updatedAt = Date.now();
      await this._persistAiHistory();
      console.log('📜 AI History updated:', existing.entry.id, 'threads:', threads.length);
      return existing.entry;
    }

    const entry = _createHistoryEntry(type, originalText, threads);
    this.aiHistoryEntries.unshift(entry);
    _setActiveHistoryId(this, type, entry.id);
    await this._persistAiHistory();
    console.log('📜 AI History saved new entry:', entry.id, type, 'threads:', threads.length);
    this._generateAiHistoryTitle(entry.id, originalText);
    return entry;
  } catch (err) {
    console.error('saveAiHistory failed:', err);
  }
}

export async function _generateAiHistoryTitle(entryId, originalText) {
  try {
    const snippet = (originalText || '').substring(0, 300);
    const title = await pasteCraftSupabase.generateSummary(
      snippet,
      'Generate a concise 3-5 word title for this text. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.'
    );
    if (!title || typeof title !== 'string' || !title.trim()) return;

    const cleanTitle = title.trim().replace(/^["']|["']$/g, '').substring(0, 60);
    const idx = this.aiHistoryEntries.findIndex(e => e.id === entryId);
    if (idx === -1) return;

    this.aiHistoryEntries[idx].title = cleanTitle;
    await this._persistAiHistory();
    if (this.currentTab === 'aiHistory') {
      this.renderAiHistoryList();
    }
  } catch (err) {
    console.warn('AI history title generation failed:', err);
  }
}

export function renderAiHistoryList() {
  const container = document.getElementById('aiHistoryList');
  if (!container) return;

  const entries = _filterHistoryEntries(this);
  if (!entries || entries.length === 0) {
    container.innerHTML = _renderEmptyHistory(this);
    return;
  }

  container.innerHTML = entries.map(entry => _renderHistoryEntry(this, entry)).join('');
  _attachHistoryListHandlers(this, container);
}

export async function openAiHistoryModal(entry) {
  if (!entry) return;
  this.currentHistoryEntry = entry;
  this.currentHistoryThreadIndex = 0;

  const { modal, titleEl, subtitleEl, resultEl } = getHistoryModalElements();
  if (!modal) return;

  this._cancelEditHistoryTitle();
  _renderHistoryModalHeader(entry, titleEl, subtitleEl);
  modal.style.display = 'flex';
  await _renderCurrentHistoryThread(this, entry, resultEl);
  this._renderHistoryPagination();
}

export function _renderHistoryPagination() {
  const { paginationEl } = getHistoryModalElements();
  const entry = this.currentHistoryEntry;
  if (!paginationEl || !entry) return;

  const threads = entry.threads || [];
  if (threads.length < 2) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';
  paginationEl.style.gap = '8px';
  paginationEl.innerHTML = '';
  threads.forEach((thread, index) => {
    paginationEl.appendChild(_createHistoryThreadBox(this, thread, index));
  });
}

export async function navigateHistoryThread(index) {
  const entry = this.currentHistoryEntry;
  if (!entry || !entry.threads || index < 0 || index >= entry.threads.length) return;

  this.currentHistoryThreadIndex = index;
  const resultEl = document.getElementById('aiHistoryResultContent');
  if (resultEl) {
    resultEl.innerHTML = await this._renderAiResponse(entry.threads[index].answer);
  }
  this._renderHistoryPagination();
}

export function copyHistoryContent() {
  const entry = this.currentHistoryEntry;
  if (!entry || !entry.threads) return;
  const thread = entry.threads[this.currentHistoryThreadIndex];
  if (thread && thread.answer) {
    this.copyToClipboardFallback(thread.answer)
      .then(() => this.showToast('Copied to clipboard!'))
      .catch((error) => {
        console.error('History copy failed:', error);
        this.showToast('Failed to copy history content', 'error');
      });
  }
}

export function _startEditHistoryTitle() {
  const entry = this.currentHistoryEntry;
  if (!entry) return;
  const titleEl = document.getElementById('aiHistoryModalTitle');
  const editContainer = document.getElementById('aiHistoryTitleEditContainer');
  const titleInput = document.getElementById('aiHistoryTitleInput');
  const editBtn = document.getElementById('editAiHistoryTitleBtn');
  if (!titleEl || !editContainer || !titleInput) return;

  titleEl.style.display = 'none';
  editContainer.style.display = 'flex';
  if (editBtn) editBtn.style.display = 'none';
  titleInput.value = entry.title || 'Untitled';
  titleInput.focus();
  titleInput.select();
}

export async function _saveEditHistoryTitle() {
  const entry = this.currentHistoryEntry;
  const titleInput = document.getElementById('aiHistoryTitleInput');
  if (!entry || !titleInput) return;

  const newTitle = titleInput.value.trim().substring(0, 60);
  if (!newTitle) {
    this.showToast('Title cannot be empty');
    return;
  }

  entry.title = newTitle;
  const idx = this.aiHistoryEntries.findIndex(e => e.id === entry.id);
  if (idx !== -1) this.aiHistoryEntries[idx].title = newTitle;
  await this._persistAiHistory();

  const typeIcon = entry.type === 'breakdown' ? '🧠' : '📝';
  const titleEl = document.getElementById('aiHistoryModalTitle');
  if (titleEl) titleEl.textContent = `${typeIcon} ${newTitle}`;
  this._cancelEditHistoryTitle();
  this.renderAiHistoryList();
  this.showToast('Title updated');
}

export function _cancelEditHistoryTitle() {
  const titleEl = document.getElementById('aiHistoryModalTitle');
  const editContainer = document.getElementById('aiHistoryTitleEditContainer');
  const editBtn = document.getElementById('editAiHistoryTitleBtn');
  if (titleEl) titleEl.style.display = '';
  if (editContainer) editContainer.style.display = 'none';
  if (editBtn) editBtn.style.display = '';
}

export async function clearAllAiHistory() {
  this.aiHistoryEntries = [];
  this._activeBreakdownHistoryId = null;
  this._activeSummaryHistoryId = null;
  await this._persistAiHistory();
  this.renderAiHistoryList();
  this.showToast('AI history cleared');
}

async function _mergeCloudHistory(localEntries) {
  let localHistory = localEntries;
  if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase.client) {
    return localHistory;
  }

  try {
    const remoteHistory = await pasteCraftSupabase.fetchAiHistoryFromSupabase();
    if (remoteHistory && remoteHistory.length > 0) {
      localHistory = pasteCraftSupabase.mergeAiHistory(localHistory, remoteHistory);
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.HISTORY]: localHistory });
    }
  } catch (_) {}

  return localHistory;
}

function _syncAiHistoryToCloud(entries) {
  if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.client) {
    pasteCraftSupabase.syncAiHistoryToSupabase(entries).catch(() => {});
  }
}

function _findActiveHistoryEntry(app, type) {
  const activeId = type === 'breakdown' ? app._activeBreakdownHistoryId : app._activeSummaryHistoryId;
  if (!activeId) return null;
  const idx = app.aiHistoryEntries.findIndex(e => e.id === activeId);
  return idx === -1 ? null : { idx, entry: app.aiHistoryEntries[idx] };
}

function _serializeThreads(threads) {
  return threads.map(t => ({
    question: t.question || '',
    answer: t.answer || '',
    level: t.level || null,
    timestamp: t.timestamp || Date.now(),
  }));
}

function _createHistoryEntry(type, originalText, threads) {
  const placeholderTitle = (originalText || '').substring(0, 40).replace(/\n/g, ' ').trim() || 'Untitled';
  return {
    id: Date.now(),
    type,
    title: placeholderTitle + '...',
    originalText: (originalText || '').substring(0, 2000),
    threads: _serializeThreads(threads),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function _setActiveHistoryId(app, type, id) {
  if (type === 'breakdown') {
    app._activeBreakdownHistoryId = id;
  } else {
    app._activeSummaryHistoryId = id;
  }
}

function _filterHistoryEntries(app) {
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

function _historyEntryMatchesQuery(entry, query) {
  const title = (entry.title || '').toLowerCase();
  const text = (entry.originalText || '').toLowerCase();
  const answers = (entry.threads || []).map(t => (t.answer || '').toLowerCase()).join(' ');
  return title.includes(query) || text.includes(query) || answers.includes(query);
}

function _renderEmptyHistory(app) {
  const query = app._aiHistorySearchQuery || '';
  const msg = query ? 'No results match your search' : 'Your AI Summary and Breakdown conversations will appear here';
  const heading = query ? 'No matches' : 'No history yet';
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="scroll-text"></i></div>
      <h3>${heading}</h3>
      <p>${msg}</p>
    </div>`;
}

function _renderHistoryEntry(app, entry) {
  const icon = entry.type === 'breakdown' ? '🧠' : '📝';
  const badgeClass = entry.type === 'breakdown' ? 'breakdown' : 'summary';
  const badgeLabel = entry.type === 'breakdown' ? 'Breakdown' : 'Summary';
  const threadCount = (entry.threads || []).length;
  const timeStr = app.getTimeAgo ? app.getTimeAgo(entry.createdAt) : new Date(entry.createdAt).toLocaleDateString();
  const title = app.escapeHtml ? app.escapeHtml(entry.title || 'Untitled') : (entry.title || 'Untitled');

  return `
    <div class="ai-history-entry" data-history-id="${entry.id}">
      <span class="ai-history-entry-icon">${icon}</span>
      <div class="ai-history-entry-info">
        <div class="ai-history-entry-title">${title}</div>
        <div class="ai-history-entry-meta">${timeStr} &middot; ${threadCount} response${threadCount !== 1 ? 's' : ''}</div>
      </div>
      <span class="ai-history-entry-badge ${badgeClass}">${badgeLabel}</span>
      <button class="ai-history-entry-delete" data-delete-id="${entry.id}" title="Delete"><i data-lucide="trash-2"></i></button>
    </div>`;
}

function _attachHistoryListHandlers(app, container) {
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

function _renderHistoryModalHeader(entry, titleEl, subtitleEl) {
  const typeIcon = entry.type === 'breakdown' ? '🧠' : '📝';
  const typeLabel = entry.type === 'breakdown' ? 'Breakdown' : 'Summary';
  if (titleEl) titleEl.textContent = `${typeIcon} ${entry.title || 'Untitled'}`;
  if (subtitleEl) subtitleEl.textContent = `${typeLabel} — ${(entry.threads || []).length} response(s)`;
}

async function _renderCurrentHistoryThread(app, entry, resultEl) {
  if (entry.threads && entry.threads.length > 0) {
    if (resultEl) resultEl.innerHTML = await app._renderAiResponse(entry.threads[0].answer);
  } else if (resultEl) {
    resultEl.innerHTML = '<p style="color:#94a3b8;">No content</p>';
  }
}

function _createHistoryThreadBox(app, thread, index) {
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
