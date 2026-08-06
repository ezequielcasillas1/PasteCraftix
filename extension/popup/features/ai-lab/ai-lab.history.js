// @forward-slice AI Lab history — public API
import { AI_STORAGE_KEYS, AI_HISTORY_PAGE_SIZE } from './ai-lab.constants.js';
import { AI_SELECTORS, byId, getHistoryModalElements } from './ai-lab.selectors.js';
import {
  emitHistoryFromLatestThread,
  emitHistoryThreadArtifact,
} from './ai-lab.history.emit.js';
import {
  assertCloudTicketApi,
  buildFormatHistoryEntry,
  buildRefactorHistoryEntry,
  buildRefactorTicketPayload,
  createHistoryEntry,
  findActiveHistoryEntry,
  getRefactorTicketValidationError,
  isUsableGeneratedTitle,
  backfillHistoryEntryImageFromSession,
  mergeCloudHistory,
  resolveHistoryImageToPersist,
  serializeThreads,
  setActiveHistoryId,
  stripOlderHistoryImages,
  syncAiHistoryToCloud,
} from './ai-lab.history.persist.js';
import {
  attachHistoryListHandlers,
  clampAiHistoryPageIndex,
  createHistoryThreadBox,
  filterHistoryEntries,
  getAiHistoryTotalPages,
  getHistoryCopyText,
  getHistoryTitleEditElements,
  historyTypeIcon,
  isValidHistoryThreadIndex,
  renderAiHistoryListPagination,
  renderCurrentHistoryThread,
  renderEmptyHistory,
  renderHistoryEntry,
  renderHistoryImageBlock,
  renderHistoryModalHeader,
  toggleRefactorModalUi,
} from './ai-lab.history.render.js';

export { renderOpenRecentConversation } from './ai-lab.summary.js';
export { continueHistoryConversation } from './ai-lab.history.continue.js';

export async function loadAiHistory(options = {}) {
  const mergeCloud = options?.mergeCloud !== false;
  try {
    const { [AI_STORAGE_KEYS.HISTORY]: localEntries = [] } = await chrome.storage.local.get([AI_STORAGE_KEYS.HISTORY]);
    const localHistory = mergeCloud
      ? await mergeCloudHistory(localEntries)
      : (Array.isArray(localEntries) ? localEntries : []);
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
    try {
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.HISTORY]: this.aiHistoryEntries });
    } catch (quotaErr) {
      this.aiHistoryEntries = stripOlderHistoryImages(this.aiHistoryEntries, 8);
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.HISTORY]: this.aiHistoryEntries });
      console.warn('AI history persist: stripped older images after quota error', quotaErr?.message || quotaErr);
    }
    syncAiHistoryToCloud(this.aiHistoryEntries);
  } catch (_) {}
}

function _ingestCompareHistoryEntry(app, entry, source) {
  const titleSource = entry._titleSource;
  delete entry._titleSource;
  app.aiHistoryEntries.unshift(entry);
  app._generateAiHistoryTitle(entry.id, titleSource);
  emitHistoryThreadArtifact(app, entry, entry.threads[0], {
    source,
    persisted: true,
  });
}

export async function saveRefactorHistory(records) {
  try {
    if (!Array.isArray(records) || records.length === 0) return;
    await this.loadAiHistory();

    for (const record of records) {
      const entry = buildRefactorHistoryEntry(record);
      if (!entry) continue;
      _ingestCompareHistoryEntry(this, entry, 'ai-lab.refactorization');
    }

    await this._persistAiHistory();
    if (this.currentTab === 'aiHistory') {
      this.renderAiHistoryList();
    }
  } catch (err) {
    console.error('saveRefactorHistory failed:', err);
  }
}

export async function saveFormatHistory(records) {
  try {
    if (!Array.isArray(records) || records.length === 0) return;
    await this.loadAiHistory();

    for (const record of records) {
      const entry = buildFormatHistoryEntry(record);
      if (!entry) continue;
      _ingestCompareHistoryEntry(this, entry, 'ai-lab.formatted');
    }

    await this._persistAiHistory();
    if (this.currentTab === 'aiHistory') {
      this.renderAiHistoryList();
    }
  } catch (err) {
    console.error('saveFormatHistory failed:', err);
  }
}

export async function submitRefactorTicket(message) {
  const entry = this.currentHistoryEntry;
  const validationError = getRefactorTicketValidationError(entry, message);
  if (validationError) {
    this.showToast(validationError, 'error');
    return false;
  }

  const trimmed = String(message || '').trim();
  try {
    assertCloudTicketApi();
    await pasteCraftSupabase.submitRefactorTicket(buildRefactorTicketPayload(entry, trimmed));
    this.showToast('Ticket sent — thank you!');
    return true;
  } catch (err) {
    console.error('submitRefactorTicket failed:', err);
    this.showToast(err.message || 'Failed to send ticket', 'error');
    return false;
  }
}

export async function saveAiHistory(type, originalText, threads, options = {}) {
  try {
    if (!threads || threads.length === 0) {
      console.warn('saveAiHistory: no threads to save');
      return;
    }

    const imageBase64 = typeof options?.imageBase64 === 'string' ? options.imageBase64 : '';
    // Local-only reload — cloud merge must not race-strip imageBase64 before we write.
    await this.loadAiHistory({ mergeCloud: false });
    const existing = findActiveHistoryEntry(this, type);
    if (existing) {
      const carriedImage = resolveHistoryImageToPersist(imageBase64, existing.entry);
      existing.entry.threads = serializeThreads(threads, originalText, carriedImage);
      if (carriedImage) existing.entry.imageBase64 = carriedImage;
      existing.entry.updatedAt = Date.now();
      await this._persistAiHistory();
      console.log('📜 AI History updated:', existing.entry.id, 'threads:', threads.length);
      emitHistoryFromLatestThread(this, existing.entry, { persisted: true, updated: true });
      return existing.entry;
    }

    const entry = createHistoryEntry(type, originalText, threads, imageBase64);
    this.aiHistoryEntries.unshift(entry);
    setActiveHistoryId(this, type, entry.id);
    await this._persistAiHistory();
    console.log('📜 AI History saved new entry:', entry.id, type, 'threads:', threads.length);
    this._generateAiHistoryTitle(entry.id, originalText);
    emitHistoryFromLatestThread(this, entry, { persisted: true });
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
    if (!isUsableGeneratedTitle(title)) return;

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

export function resetAiHistoryListPagination() {
  this._aiHistoryPageIndex = 0;
}

export function setAiHistoryListPage(pageIndex) {
  const entries = filterHistoryEntries(this);
  const totalPages = getAiHistoryTotalPages(entries.length);
  const next = Math.max(0, Math.min(pageIndex, totalPages - 1));
  if (this._aiHistoryPageIndex === next) return;
  this._aiHistoryPageIndex = next;
  this.renderAiHistoryList();
}

export function renderAiHistoryList() {
  const container = byId(AI_SELECTORS.historyList);
  const paginationEl = byId(AI_SELECTORS.historyListPagination);
  if (!container) return;

  const entries = filterHistoryEntries(this);
  if (!entries || entries.length === 0) {
    container.innerHTML = renderEmptyHistory(this);
    renderAiHistoryListPagination(this, paginationEl, 0, 0);
    return;
  }

  const total = entries.length;
  const totalPages = getAiHistoryTotalPages(total);
  clampAiHistoryPageIndex(this, totalPages);

  const pageIndex = this._aiHistoryPageIndex || 0;
  const start = pageIndex * AI_HISTORY_PAGE_SIZE;
  const pageEntries = entries.slice(start, start + AI_HISTORY_PAGE_SIZE);

  container.innerHTML = pageEntries.map(entry => renderHistoryEntry(this, entry)).join('');
  attachHistoryListHandlers(this, container);
  renderAiHistoryListPagination(this, paginationEl, total, totalPages);
  if (typeof this.renderLucideIcons === 'function') {
    this.renderLucideIcons(container);
  }
}

async function _persistBackfilledHistoryImage(app, entry) {
  const idx = app.aiHistoryEntries?.findIndex((e) => e.id === entry.id);
  if (idx == null || idx === -1) return;
  app.aiHistoryEntries[idx] = entry;
  await app._persistAiHistory();
}

export async function openAiHistoryModal(entry) {
  if (!entry) return;

  if (backfillHistoryEntryImageFromSession(this, entry)) {
    await _persistBackfilledHistoryImage(this, entry);
  }

  this.currentHistoryEntry = entry;
  this.currentHistoryThreadIndex = 0;

  const { modal, titleEl, subtitleEl, resultEl } = getHistoryModalElements();
  if (!modal) return;

  this._cancelEditHistoryTitle();
  toggleRefactorModalUi(entry);
  renderHistoryModalHeader(entry, titleEl, subtitleEl);
  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
  await renderCurrentHistoryThread(this, entry, resultEl);
  emitHistoryFromLatestThread(this, entry, { fromModalOpen: true, threadIndex: 0 });
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
    paginationEl.appendChild(createHistoryThreadBox(this, thread, index));
  });
}

export async function navigateHistoryThread(index) {
  const entry = this.currentHistoryEntry;
  if (!isValidHistoryThreadIndex(entry, index)) return;

  this.currentHistoryThreadIndex = index;
  const resultEl = document.getElementById('aiHistoryResultContent');
  if (resultEl) {
    const answerHtml = await this._renderAiResponse(entry.threads[index].answer);
    resultEl.innerHTML = renderHistoryImageBlock(entry) + answerHtml;
  }
  emitHistoryThreadArtifact(this, entry, entry.threads[index], { fromModalNavigation: true, threadIndex: index });
  this._renderHistoryPagination();
}

export function copyHistoryContent() {
  const entry = this.currentHistoryEntry;
  if (!entry || !entry.threads) return;
  const thread = entry.threads[this.currentHistoryThreadIndex];
  if (!thread) return;

  const text = getHistoryCopyText(entry, thread);
  if (!text) return;

  this.copyToClipboardFallback(text)
    .then(() => this.showToast('Copied to clipboard!'))
    .catch((error) => {
      console.error('History copy failed:', error);
      this.showToast('Failed to copy history content', 'error');
    });
}

export function _startEditHistoryTitle() {
  const entry = this.currentHistoryEntry;
  if (!entry) return;
  const els = getHistoryTitleEditElements();
  if (!els) return;

  els.titleEl.style.display = 'none';
  els.editContainer.style.display = 'flex';
  if (els.editBtn) els.editBtn.style.display = 'none';
  els.titleInput.value = entry.title || 'Untitled';
  els.titleInput.focus();
  els.titleInput.select();
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

  const titleEl = document.getElementById('aiHistoryModalTitle');
  if (titleEl) titleEl.textContent = `${historyTypeIcon(entry)} ${newTitle}`;
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
  resetAiHistoryListPagination.call(this);
  await this._persistAiHistory();
  this.renderAiHistoryList();
  this.showToast('AI history cleared');
}
