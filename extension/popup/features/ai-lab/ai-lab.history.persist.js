// @forward-slice AI Lab history — persist / serialize helpers
import { AI_STORAGE_KEYS } from './ai-lab.constants.js';

function _hasSupabaseClient() {
  return typeof pasteCraftSupabase !== 'undefined' && Boolean(pasteCraftSupabase.client);
}

function _hasRemoteHistory(remoteHistory) {
  return Boolean(remoteHistory && remoteHistory.length > 0);
}

export async function mergeCloudHistory(localEntries) {
  if (!_hasSupabaseClient()) return localEntries;

  try {
    const remoteHistory = await pasteCraftSupabase.fetchAiHistoryFromSupabase();
    if (!_hasRemoteHistory(remoteHistory)) return localEntries;

    const merged = pasteCraftSupabase.mergeAiHistory(localEntries, remoteHistory);
    await chrome.storage.local.set({ [AI_STORAGE_KEYS.HISTORY]: merged });
    return merged;
  } catch (_) {
    return localEntries;
  }
}

export function syncAiHistoryToCloud(entries) {
  if (!_hasSupabaseClient()) return;
  pasteCraftSupabase.syncAiHistoryToSupabase(entries).catch(() => {});
}

function _activeHistoryIdForType(app, type) {
  return type === 'breakdown' ? app._activeBreakdownHistoryId : app._activeSummaryHistoryId;
}

export function findActiveHistoryEntry(app, type) {
  const activeId = _activeHistoryIdForType(app, type);
  if (!activeId) return null;
  const idx = app.aiHistoryEntries.findIndex(e => e.id === activeId);
  if (idx === -1) return null;
  return { idx, entry: app.aiHistoryEntries[idx] };
}

export function setActiveHistoryId(app, type, id) {
  if (type === 'breakdown') {
    app._activeBreakdownHistoryId = id;
    return;
  }
  app._activeSummaryHistoryId = id;
}

function _orEmpty(value) {
  return value || '';
}

function _normalizeThreadSource(sourceText) {
  return String(_orEmpty(sourceText)).trim().substring(0, 2000);
}

function _threadHasOwnSource(thread) {
  return Boolean(String(thread?.sourceText || thread?.source_text || '').trim());
}

function _shouldAttachSourceText(index, normalizedSource, thread) {
  return index === 0 && Boolean(normalizedSource) && !_threadHasOwnSource(thread);
}

function _baseSerializedThread(thread) {
  return {
    question: _orEmpty(thread.question),
    answer: _orEmpty(thread.answer),
    level: thread.level || null,
    timestamp: thread.timestamp || Date.now(),
  };
}

function _serializeOneThread(thread, index, normalizedSource) {
  const next = _baseSerializedThread(thread);
  if (_shouldAttachSourceText(index, normalizedSource, thread)) {
    next.sourceText = normalizedSource;
  }
  return next;
}

export function serializeThreads(threads, sourceText = '') {
  const normalizedSource = _normalizeThreadSource(sourceText);
  return threads.map((thread, index) => _serializeOneThread(thread, index, normalizedSource));
}

function _placeholderTitle(text, fallback) {
  return String(_orEmpty(text)).substring(0, 40).replace(/\n/g, ' ').trim() || fallback;
}

export function createHistoryEntry(type, originalText, threads) {
  return {
    id: Date.now(),
    type,
    title: `${_placeholderTitle(originalText, 'Untitled')}...`,
    originalText: String(_orEmpty(originalText)).substring(0, 2000),
    threads: serializeThreads(threads, originalText),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function _buildRefactorThread(record, before, after) {
  return {
    question: 'Before',
    answer: after.substring(0, 4000),
    before,
    after,
    refactorLevel: record.refactorLevel || 'college',
    sourceClipId: _orEmpty(record.sourceClipId),
    newClipId: _orEmpty(record.newClipId),
    synthesis: record.synthesis || {},
    timestamp: Date.now(),
  };
}

export function buildRefactorHistoryEntry(record) {
  const before = String(_orEmpty(record.before)).trim();
  const after = String(_orEmpty(record.after)).trim();
  if (!before) return null;

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: 'refactorization',
    title: `${_placeholderTitle(before, 'Refactor')}...`,
    originalText: before.substring(0, 2000),
    threads: [_buildRefactorThread(record, before, after)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _titleSource: before,
  };
}

function _buildFormatThread(record, before, after) {
  return {
    question: 'Before',
    answer: after.substring(0, 4000),
    before,
    after,
    sourceClipId: _orEmpty(record.sourceClipId),
    newClipId: _orEmpty(record.newClipId || record.sourceClipId),
    timestamp: Date.now(),
  };
}

/** AI Formatted history — same before/after compare shape as refactorization. */
export function buildFormatHistoryEntry(record) {
  const before = String(_orEmpty(record.before)).trim();
  const after = String(_orEmpty(record.after)).trim();
  if (!before || !after || before === after) return null;

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: 'formatted',
    title: `${_placeholderTitle(before, 'Formatted')}...`,
    originalText: before.substring(0, 2000),
    threads: [_buildFormatThread(record, before, after)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _titleSource: before,
  };
}

function _isRefactorEntry(entry) {
  return Boolean(entry && entry.type === 'refactorization');
}

export function getRefactorTicketValidationError(entry, message) {
  if (!_isRefactorEntry(entry)) return 'No refactor entry selected';
  if (!String(_orEmpty(message)).trim()) return 'Describe what went wrong';
  return null;
}

function _firstThread(entry) {
  return (entry.threads || [])[0] || {};
}

function _ticketBeforeText(entry, thread) {
  return thread.before || entry.originalText || thread.question || '';
}

function _ticketAfterText(thread) {
  return thread.after || thread.answer || '';
}

export function buildRefactorTicketPayload(entry, trimmedMessage) {
  const thread = _firstThread(entry);
  return {
    historyId: entry.id,
    message: trimmedMessage,
    beforeText: _ticketBeforeText(entry, thread),
    afterText: _ticketAfterText(thread),
    refactorLevel: _orEmpty(thread.refactorLevel),
    synthesis: thread.synthesis || {},
  };
}

export function assertCloudTicketApi() {
  if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase.submitRefactorTicket) {
    throw new Error('Cloud sync unavailable');
  }
}

export function isUsableGeneratedTitle(title) {
  return Boolean(title && typeof title === 'string' && title.trim());
}

function _firstNonEmptyString(...candidates) {
  for (const candidate of candidates) {
    if (candidate) return String(candidate);
  }
  return '';
}

export function deriveEntryOriginalText(entry) {
  const firstThread = entry?.threads?.[0] || {};
  return _firstNonEmptyString(
    entry?.originalText,
    entry?.original_text,
    firstThread?.sourceText,
    firstThread?.source_text,
  );
}

export function serializeSummaryThreads(threads) {
  return threads.map(t => ({
    question: _orEmpty(t.question),
    answer: _orEmpty(t.answer),
    timestamp: t.timestamp || Date.now(),
  }));
}

export function serializeBreakdownThreads(threads) {
  return threads.map(t => ({
    question: _orEmpty(t.question),
    answer: _orEmpty(t.answer),
    level: t.level || null,
    timestamp: t.timestamp || Date.now(),
  }));
}
