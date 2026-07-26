// @forward-slice AI Lab history — artifact emission

function _canEmitHistoryArtifact(app, entry, thread) {
  return Boolean(entry && thread && typeof app?.emitAiTaskOutput === 'function');
}

function _isRefactorEntry(entry) {
  return entry?.type === 'refactorization';
}

function _refactorArtifactTexts(entry, thread) {
  return {
    sourceText: thread.before || entry.originalText || '',
    level: thread.refactorLevel || thread.level || '',
    outputText: thread.after || thread.answer || '',
  };
}

function _buildRefactorArtifactMetadata(entry, thread, metadata) {
  return {
    historyId: entry.id,
    threadTimestamp: thread.timestamp || Date.now(),
    sourceClipId: thread.sourceClipId || '',
    newClipId: thread.newClipId || '',
    ...metadata,
  };
}

function _buildRefactorArtifactPayload(entry, thread, metadata = {}) {
  const texts = _refactorArtifactTexts(entry, thread);
  return {
    source: metadata.source || 'ai-history.refactorization',
    taskType: 'refactorization',
    title: entry.title || 'AI Refactorization',
    sourceText: texts.sourceText,
    question: 'Refactorization output',
    level: texts.level,
    outputText: texts.outputText,
    metadata: _buildRefactorArtifactMetadata(entry, thread, metadata),
  };
}

function _resolveGeneralTaskType(entry) {
  return entry.type === 'breakdown' ? 'breakdown' : 'summary';
}

function _buildGeneralArtifactMetadata(entry, thread, metadata) {
  return {
    historyId: entry.id,
    threadTimestamp: thread.timestamp || Date.now(),
    ...metadata,
  };
}

function _buildGeneralArtifactPayload(entry, thread, metadata = {}) {
  return {
    source: metadata.source || `ai-history.${entry.type || 'general'}`,
    taskType: _resolveGeneralTaskType(entry),
    title: entry.title || 'AI History',
    sourceText: entry.originalText || '',
    question: thread.question || '',
    level: thread.level || '',
    outputText: thread.answer || '',
    metadata: _buildGeneralArtifactMetadata(entry, thread, metadata),
  };
}

export function emitHistoryThreadArtifact(app, entry, thread, metadata = {}) {
  if (!_canEmitHistoryArtifact(app, entry, thread)) return;

  const payload = _isRefactorEntry(entry)
    ? _buildRefactorArtifactPayload(entry, thread, metadata)
    : _buildGeneralArtifactPayload(entry, thread, metadata);

  app.emitAiTaskOutput(payload);
}

export function emitHistoryFromLatestThread(app, entry, metadata = {}) {
  if (!entry?.threads?.length) return;
  const latestThread = entry.threads[entry.threads.length - 1];
  emitHistoryThreadArtifact(app, entry, latestThread, {
    ...metadata,
    threadIndex: entry.threads.length - 1,
  });
}
