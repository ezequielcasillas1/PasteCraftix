const AI_ARTIFACT_VERSION = 1;
const MAX_TEXT_LENGTH = 16000;
const MAX_SHORT_FIELD_LENGTH = 200;
const MAX_SOURCE_TEXT_LENGTH = 4000;

const AI_TASK_TYPES = new Set([
  'summary',
  'breakdown',
  'refactorization',
  'note-title',
  'note-description',
  'profile-name',
  'craft',
  'history',
  'general',
]);

const AI_TASK_LABELS = Object.freeze({
  summary: 'Summary',
  breakdown: 'Breakdown',
  refactorization: 'Refactorization',
  'note-title': 'Note Title',
  'note-description': 'Note Description',
  'profile-name': 'Profile Name',
  craft: 'Craft Clips',
  history: 'History',
  general: 'AI Output',
});

function _safeText(value, maxLength = MAX_TEXT_LENGTH) {
  if (value == null) return '';
  return String(value).replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function _safeShort(value) {
  return _safeText(value, MAX_SHORT_FIELD_LENGTH);
}

function _safeTaskType(value) {
  const taskType = _safeShort(value).toLowerCase();
  return AI_TASK_TYPES.has(taskType) ? taskType : 'general';
}

function _safeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!key) return;
    if (entry == null) {
      normalized[key] = null;
      return;
    }
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      normalized[key] = entry;
      return;
    }
    if (Array.isArray(entry)) {
      normalized[key] = entry
        .filter((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))
        .slice(0, 20);
    }
  });
  return normalized;
}

function _deriveDefaultTitle(taskType) {
  return `AI ${AI_TASK_LABELS[taskType] || AI_TASK_LABELS.general}`;
}

function _buildArtifactId(source, taskType, createdAt) {
  const safeSource = source.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 16) || 'source';
  const safeType = taskType.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 16) || 'task';
  return `ai-${safeSource}-${safeType}-${createdAt}`;
}

function _hashArtifact(artifact) {
  const source = _safeShort(artifact.source);
  const taskType = _safeShort(artifact.taskType);
  const outputText = _safeText(artifact.outputText, 2000);
  const question = _safeShort(artifact.question);
  const level = _safeShort(artifact.level);
  let hash = 2166136261;
  const payload = `${source}|${taskType}|${question}|${level}|${outputText}`;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function normalizeAiTaskOutputArtifact(rawArtifact) {
  const raw = rawArtifact && typeof rawArtifact === 'object' ? rawArtifact : {};
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const source = _safeShort(raw.source || 'unknown');
  const taskType = _safeTaskType(raw.taskType);
  const outputText = _safeText(raw.outputText);
  if (!outputText) return null;

  const normalized = {
    version: AI_ARTIFACT_VERSION,
    artifactId: _safeShort(raw.artifactId) || _buildArtifactId(source, taskType, createdAt),
    source,
    taskType,
    title: _safeShort(raw.title) || _deriveDefaultTitle(taskType),
    outputText,
    sourceText: _safeText(raw.sourceText, MAX_SOURCE_TEXT_LENGTH),
    question: _safeShort(raw.question),
    level: _safeShort(raw.level),
    metadata: _safeMetadata(raw.metadata),
    createdAt,
  };

  normalized.artifactHash = _hashArtifact(normalized);
  return normalized;
}

export function setAiTaskOutputArtifact(app, rawArtifact) {
  const artifact = normalizeAiTaskOutputArtifact(rawArtifact);
  if (!artifact || !app) return null;
  app.pendingAiTaskOutputArtifact = artifact;
  return artifact;
}

export function getAiTaskOutputArtifact(app) {
  return app?.pendingAiTaskOutputArtifact || null;
}

export function consumeAiTaskOutputArtifact(app) {
  const artifact = getAiTaskOutputArtifact(app);
  if (!app) return artifact;
  app.pendingAiTaskOutputArtifact = null;
  return artifact;
}

export function clearAiTaskOutputArtifact(app) {
  if (app) app.pendingAiTaskOutputArtifact = null;
}

function _buildArtifactHeaderLines(artifact) {
  const taskLabel = AI_TASK_LABELS[artifact.taskType] || AI_TASK_LABELS.general;
  const lines = [
    `[AI ${taskLabel}]`,
    artifact.title ? `Title: ${artifact.title}` : '',
    artifact.question ? `Question: ${artifact.question}` : '',
    artifact.level ? `Level: ${artifact.level}` : '',
    artifact.source ? `Source: ${artifact.source}` : '',
    `Artifact: ${artifact.artifactId}`,
    `Created: ${new Date(artifact.createdAt).toISOString()}`,
  ].filter(Boolean);
  return lines;
}

export function artifactToNotesClip(artifact) {
  if (!artifact || !artifact.outputText) return null;
  const lines = _buildArtifactHeaderLines(artifact);
  const text = `${lines.join('\n')}\n\n${artifact.outputText}`.slice(0, MAX_TEXT_LENGTH);
  const id = `ai-artifact-${artifact.artifactHash}`;
  return {
    id,
    title: artifact.title || _deriveDefaultTitle(artifact.taskType),
    text,
    category: 'Uncategorized',
    timestamp: Date.now(),
    updatedAt: Date.now(),
    __aiArtifactHash: artifact.artifactHash,
    __aiArtifactId: artifact.artifactId,
    meta: {
      aiTaskOutput: true,
      aiTaskType: artifact.taskType,
      aiSource: artifact.source,
      aiArtifactId: artifact.artifactId,
      aiArtifactHash: artifact.artifactHash,
      aiCreatedAt: artifact.createdAt,
    },
  };
}
