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

function _stripEntryImage(entry) {
  if (!entry?.imageBase64 && !entry?.threads?.[0]?.imageBase64) return entry;
  const next = { ...entry, imageBase64: '' };
  if (!Array.isArray(next.threads) || !next.threads[0]?.imageBase64) return next;
  next.threads = next.threads.map((thread, index) => {
    if (index !== 0 || !thread?.imageBase64) return thread;
    const copy = { ...thread };
    delete copy.imageBase64;
    return copy;
  });
  return next;
}

/** Keep newest 8 images; strip the rest when chrome.storage quota fails. */
export function stripOlderHistoryImages(entries, keepNewest = 8) {
  return (Array.isArray(entries) ? entries : []).map((entry, index) => (
    index < keepNewest ? entry : _stripEntryImage(entry)
  ));
}

function _sessionSummaryImage(app) {
  const value = typeof app?.currentSummaryImageBase64 === 'string'
    ? app.currentSummaryImageBase64.trim()
    : '';
  return value.startsWith('data:image/') ? value : '';
}

function _entryMissingImage(entry) {
  const value = typeof entry?.imageBase64 === 'string' ? entry.imageBase64.trim() : '';
  return !value.startsWith('data:image/');
}

/**
 * If the live summary session still holds the picked image, attach it to a
 * history entry that lost it (pre-fix rows / cloud merge wipe).
 * @returns {boolean} true when the entry was mutated
 */
export function backfillHistoryEntryImageFromSession(app, entry) {
  if (!entry || entry.type !== 'summary' || !_entryMissingImage(entry)) return false;
  const sessionImage = _sessionSummaryImage(app);
  if (!sessionImage) return false;
  const activeId = app?._activeSummaryHistoryId;
  if (activeId != null && activeId !== entry.id) return false;

  entry.imageBase64 = sessionImage;
  if (Array.isArray(entry.threads) && entry.threads[0]) {
    entry.threads[0] = { ...entry.threads[0], imageBase64: sessionImage };
  }
  return true;
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

/** Prefer newly saved image, else entry/thread carry. */
export function resolveHistoryImageToPersist(optionsImage, entry) {
  const fromOpts = typeof optionsImage === 'string' ? optionsImage.trim() : '';
  if (fromOpts.startsWith('data:image/')) return fromOpts;
  const fromEntry = typeof entry?.imageBase64 === 'string' ? entry.imageBase64.trim() : '';
  if (fromEntry.startsWith('data:image/')) return fromEntry;
  const fromThread = typeof entry?.threads?.[0]?.imageBase64 === 'string'
    ? entry.threads[0].imageBase64.trim()
    : '';
  return fromThread.startsWith('data:image/') ? fromThread : fromOpts;
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

function _normalizeThreadImage(imageBase64) {
  const value = String(imageBase64 || '').trim();
  return value.startsWith('data:image/') ? value : '';
}

function _baseSerializedThread(thread) {
  const next = {
    question: _orEmpty(thread.question),
    answer: _orEmpty(thread.answer),
    level: thread.level || null,
    timestamp: thread.timestamp || Date.now(),
  };
  const carried = _normalizeThreadImage(thread.imageBase64);
  if (carried) next.imageBase64 = carried;
  return next;
}

function _shouldAttachThreadImage(index, normalizedImage, thread) {
  return index === 0 && Boolean(normalizedImage) && !_normalizeThreadImage(thread?.imageBase64);
}

function _serializeOneThread(thread, index, normalizedSource, normalizedImage) {
  const next = _baseSerializedThread(thread);
  if (_shouldAttachSourceText(index, normalizedSource, thread)) {
    next.sourceText = normalizedSource;
  }
  if (_shouldAttachThreadImage(index, normalizedImage, thread)) {
    next.imageBase64 = normalizedImage;
  }
  return next;
}

export function serializeThreads(threads, sourceText = '', imageBase64 = '') {
  const normalizedSource = _normalizeThreadSource(sourceText);
  const normalizedImage = _normalizeThreadImage(imageBase64);
  return threads.map((thread, index) => _serializeOneThread(thread, index, normalizedSource, normalizedImage));
}

function _placeholderTitle(text, fallback) {
  return String(_orEmpty(text)).substring(0, 40).replace(/\n/g, ' ').trim() || fallback;
}

export function createHistoryEntry(type, originalText, threads, imageBase64 = '') {
  const normalizedImage = _normalizeThreadImage(imageBase64);
  return {
    id: Date.now(),
    type,
    title: `${_placeholderTitle(originalText, 'Untitled')}...`,
    originalText: String(_orEmpty(originalText)).substring(0, 2000),
    threads: serializeThreads(threads, originalText, normalizedImage),
    imageBase64: normalizedImage,
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
