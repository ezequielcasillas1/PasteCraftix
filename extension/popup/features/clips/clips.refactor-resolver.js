// @forward-slice clips — refactor dual-view context resolution
import { getClipIdKey } from './clips.state.js';
import { AI_STORAGE_KEYS } from '../ai-lab/ai-lab.constants.js';
import { ensureRefactorRegistryReady } from '../ai-lab/ai-lab.magic.js';

const HEURISTIC_REFACTOR_WINDOW_MS = 5 * 60 * 1000;

export function findClipAcrossCollections(app, id) {
  if (id == null) return null;
  const key = getClipIdKey(id);
  return (
    app.clips?.find((clip) => getClipIdKey(clip.id) === key) ||
    app.searchOnlyClips?.find((clip) => getClipIdKey(clip.id) === key) ||
    null
  );
}

function normalizeTextForMatch(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function textsMatch(a, b) {
  const left = normalizeTextForMatch(a);
  const right = normalizeTextForMatch(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 120 && right.length >= 120) {
    return left.slice(0, 240) === right.slice(0, 240);
  }
  return false;
}

export async function ensureRefactorResolverData(app) {
  await ensureRefactorRegistryReady(app);
  const stored = await chrome.storage.local.get([AI_STORAGE_KEYS.HISTORY]);
  app.aiHistoryEntries = Array.isArray(stored[AI_STORAGE_KEYS.HISTORY])
    ? stored[AI_STORAGE_KEYS.HISTORY]
    : [];

  if (app.aiHistoryEntries.length === 0 && typeof app.loadAiHistory === 'function') {
    try {
      await app.loadAiHistory();
    } catch (_) {
      /* keep storage read */
    }
  }
}

function findClipByTextMatch(app, text, excludeId = null) {
  const target = normalizeTextForMatch(text);
  if (!target) return null;
  const excludeKey = excludeId != null ? getClipIdKey(excludeId) : '';
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  for (const candidate of all) {
    if (excludeKey && getClipIdKey(candidate?.id) === excludeKey) continue;
    if (textsMatch(candidate?.text, target)) return candidate;
  }
  return null;
}
function findRefactoredSiblingsForSource(app, sourceId) {
  const key = getClipIdKey(sourceId);
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  return all.filter((clip) => {
    const linkedSourceId = clip?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') return false;
    return getClipIdKey(linkedSourceId) === key && getClipIdKey(clip.id) !== key;
  });
}

function isRefactoredSiblingClip(clip) {
  const linkedSourceId = clip?.meta?.craftRefactorSourceId;
  if (linkedSourceId == null || linkedSourceId === '') return false;
  return getClipIdKey(linkedSourceId) !== getClipIdKey(clip?.id);
}

function resolveRefactorContextFromSessionIndex(app, clip) {
  const clipKey = getClipIdKey(clip?.id);
  if (!clipKey || !app._refactorResolverIndex?.get) return null;

  const record = app._refactorResolverIndex.get(clipKey);
  if (!record) return null;

  const sourceId = getClipIdKey(record.sourceClipId);
  const newClipId = getClipIdKey(record.newClipId);
  const before = normalizeTextForMatch(record.before);
  const after = normalizeTextForMatch(record.after);
  if (!before || !after || before === after) return null;

  let sourceClip = findClipAcrossCollections(app, sourceId);
  let refactoredClip = findClipAcrossCollections(app, newClipId);
  if (!sourceClip && clipKey === sourceId) sourceClip = clip;
  if (!refactoredClip && clipKey === newClipId) refactoredClip = clip;

  return buildRefactorPairResult(
    sourceClip || { id: sourceId || clipKey, text: record.before },
    refactoredClip || { id: newClipId || `refactored_session_${sourceId}`, text: record.after },
    { fromSessionIndex: true, resolverPath: 'session-index' },
  );
}

function buildRefactorPairResult(sourceClip, refactoredClip, extra = {}) {
  const originalText = String(sourceClip?.text ?? '');
  const refactoredText = String(refactoredClip?.text ?? '');
  const normOriginal = normalizeTextForMatch(originalText);
  const normRefactored = normalizeTextForMatch(refactoredText);
  if (!normOriginal || !normRefactored) return null;
  if (normOriginal === normRefactored) return null;

  return {
    sourceClip,
    refactoredClip,
    originalText,
    refactoredText,
    refactoredClipId: refactoredClip?.id,
    sourceClipId: sourceClip?.id,
    ...extra,
  };
}

function backfillRefactorMetaLink(refactoredClip, sourceClipId) {
  if (!refactoredClip || sourceClipId == null) return;
  if (!refactoredClip.meta || typeof refactoredClip.meta !== 'object') {
    refactoredClip.meta = {};
  }
  if (!refactoredClip.meta.craftRefactorSourceId) {
    refactoredClip.meta.craftRefactorSourceId = getClipIdKey(sourceClipId);
  }
  if (refactoredClip.meta.craftRefactor !== true) {
    refactoredClip.meta.craftRefactor = true;
  }
}

function logRefactorPairResolved(clip, pair) {
  console.warn('[PasteCraft:refactor-link]', {
    clipId: getClipIdKey(clip?.id),
    sourceClipId: getClipIdKey(pair.sourceClipId),
    refactoredClipId: getClipIdKey(pair.refactoredClipId),
    resolverPath: pair.resolverPath || 'unknown',
  });
}

function resolveRefactorContextFromHistory(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  if (!clipId && !clipText) return null;

  const entries = app.aiHistoryEntries || [];
  for (const entry of entries) {
    if (entry?.type !== 'refactorization') continue;
    const thread = entry.threads?.[0];
    if (!thread) continue;

    const sourceId = getClipIdKey(thread.sourceClipId);
    const newClipId = getClipIdKey(thread.newClipId);
    const beforeRaw = thread.before || entry.originalText || thread.question || '';
    const afterRaw = thread.after || thread.answer || '';
    const before = normalizeTextForMatch(beforeRaw);
    const after = normalizeTextForMatch(afterRaw);
    if (!before || !after || before === after) continue;

    const idMatch = clipId && (clipId === sourceId || clipId === newClipId);
    const textMatchBefore = clipText && textsMatch(clipText, before);
    const textMatchAfter = clipText && textsMatch(clipText, after);
    if (!idMatch && !textMatchBefore && !textMatchAfter) continue;

    const viewingAfter = textMatchAfter || (clipId && clipId === newClipId);
    const viewingBefore = textMatchBefore || (clipId && clipId === sourceId);

    let sourceClip = findClipAcrossCollections(app, sourceId);
    let refactoredClip = findClipAcrossCollections(app, newClipId);

    if (!sourceClip) {
      sourceClip = viewingBefore
        ? clip
        : findClipByTextMatch(app, beforeRaw, refactoredClip?.id ?? clipId);
    }
    if (!refactoredClip) {
      refactoredClip = viewingAfter
        ? clip
        : findClipByTextMatch(app, afterRaw, sourceClip?.id ?? clipId);
    }

    const resolverPath = idMatch ? 'history-id' : 'history-text';
    const pair = buildRefactorPairResult(
      sourceClip || { id: sourceId || clipId, text: beforeRaw },
      refactoredClip || { id: newClipId || `refactored_${entry.id}`, text: afterRaw },
      { fromHistory: true, historyEntryId: entry.id, resolverPath, synthetic: !refactoredClip?.id || !sourceClip?.id },
    );
    if (pair) return pair;
  }

  return null;
}

function resolveRefactorContextFromLinks(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  const links = app._refactorLinks || [];

  for (const link of links) {
    const sourceId = getClipIdKey(link.sourceClipId);
    const newClipId = getClipIdKey(link.newClipId);
    const before = normalizeTextForMatch(link.before);
    const after = normalizeTextForMatch(link.after);
    if (!before || !after || before === after) continue;

    const matchesSource = (clipId && clipId === sourceId) || textsMatch(clipText, before);
    const matchesRefactored = (clipId && clipId === newClipId) || textsMatch(clipText, after);
    if (!matchesSource && !matchesRefactored) continue;

    let sourceClip = findClipAcrossCollections(app, sourceId);
    let refactoredClip = findClipAcrossCollections(app, newClipId);

    if (!sourceClip && matchesSource) sourceClip = clip;
    if (!refactoredClip && matchesRefactored) refactoredClip = clip;
    if (!sourceClip) sourceClip = findClipByTextMatch(app, before, refactoredClip?.id ?? clipId);
    if (!refactoredClip) refactoredClip = findClipByTextMatch(app, after, sourceClip?.id ?? clipId);

    const pair = buildRefactorPairResult(
      sourceClip || { id: sourceId || clipId, text: before },
      refactoredClip || { id: newClipId || `refactored_link_${sourceId}`, text: after },
      { fromLinks: true, resolverPath: 'content-link' },
    );
    if (pair) return pair;
  }

  return null;
}

function resolveRefactorContextFromContentMatch(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  if (!clipId) return null;

  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  for (const other of all) {
    if (getClipIdKey(other.id) === clipId) continue;
    const linkedSourceId = other?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') continue;
    if (getClipIdKey(linkedSourceId) === clipId) {
      return buildRefactorPairResult(clip, other, { resolverPath: 'content-meta' });
    }
  }

  return null;
}

function resolveRefactorContextHeuristicRecent(app, clip) {
  const clipKey = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  if (!clipKey || !clipText) return null;

  const clipTs = clip?.timestamp || 0;
  const clipCategory = clip?.category || 'Uncategorized';
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];

  const siblingCandidates = all.filter((other) => {
    if (getClipIdKey(other?.id) === clipKey) return false;
    if (!other?.meta?.craftRefactor) return false;
    const sameCategory = (other.category || 'Uncategorized') === clipCategory;
    const timeClose = Math.abs((other.timestamp || 0) - clipTs) <= HEURISTIC_REFACTOR_WINDOW_MS;
    const textDiffers = normalizeTextForMatch(other.text) !== clipText;
    if (!sameCategory || !timeClose || !textDiffers) return false;

    const linkedSourceKey = getClipIdKey(other.meta?.craftRefactorSourceId);
    const sourceTextMatch = textsMatch(other.meta?.craftRefactorSourceText, clip?.text);
    return linkedSourceKey === clipKey || sourceTextMatch;
  });

  if (siblingCandidates.length === 0) return null;

  const refactoredClip = siblingCandidates.sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  )[0];
  const viewingRefactored = isRefactoredSiblingClip(clip);
  const sourceClip = viewingRefactored
    ? findClipAcrossCollections(app, getClipIdKey(clip.meta.craftRefactorSourceId)) || {
        id: getClipIdKey(clip.meta.craftRefactorSourceId),
        text: clip.meta?.craftRefactorSourceText || '',
      }
    : clip;
  const refClip = viewingRefactored ? clip : refactoredClip;

  return buildRefactorPairResult(sourceClip, refClip, { resolverPath: 'heuristic-recent' });
}

export function resolveRefactorContext(app, clip) {
  if (!clip) {
    return null;
  }

  const sessionPair = resolveRefactorContextFromSessionIndex(app, clip);
  if (sessionPair) {
    logRefactorPairResolved(clip, sessionPair);
    return sessionPair;
  }

  const viewingRefactoredCopy = isRefactoredSiblingClip(clip);
  const sourceId = viewingRefactoredCopy
    ? getClipIdKey(clip.meta.craftRefactorSourceId)
    : getClipIdKey(clip.id);

  let sourceClip = viewingRefactoredCopy ? findClipAcrossCollections(app, sourceId) : clip;
  let refactoredClip = viewingRefactoredCopy ? clip : null;

  if (viewingRefactoredCopy && !sourceClip) {
    const historyPair = resolveRefactorContextFromHistory(app, clip);
    if (historyPair) {
      logRefactorPairResolved(clip, historyPair);
      return historyPair;
    }
    const linkPair = resolveRefactorContextFromLinks(app, clip);
    if (linkPair) {
      logRefactorPairResolved(clip, linkPair);
      return linkPair;
    }
  }

  if (!refactoredClip) {
    const siblings = findRefactoredSiblingsForSource(app, sourceId);
    if (siblings.length > 0) {
      refactoredClip = siblings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    }
  }

  if (sourceClip && refactoredClip) {
    const metaPair = buildRefactorPairResult(sourceClip, refactoredClip, { resolverPath: 'meta' });
    if (metaPair) {
      logRefactorPairResolved(clip, metaPair);
      return metaPair;
    }
  }

  const historyPair = resolveRefactorContextFromHistory(app, clip);
  if (historyPair) {
    if (historyPair.refactoredClip?.id && historyPair.sourceClipId) {
      backfillRefactorMetaLink(historyPair.refactoredClip, historyPair.sourceClipId);
    }
    logRefactorPairResolved(clip, historyPair);
    return historyPair;
  }

  const linkPair = resolveRefactorContextFromLinks(app, clip);
  if (linkPair) {
    if (linkPair.refactoredClip?.id && linkPair.sourceClipId) {
      backfillRefactorMetaLink(linkPair.refactoredClip, linkPair.sourceClipId);
    }
    logRefactorPairResolved(clip, linkPair);
    return linkPair;
  }

  const contentPair = resolveRefactorContextFromContentMatch(app, clip);
  if (contentPair) {
    logRefactorPairResolved(clip, contentPair);
    return contentPair;
  }

  const heuristicPair = resolveRefactorContextHeuristicRecent(app, clip);
  if (heuristicPair) {
    if (heuristicPair.refactoredClip?.id && heuristicPair.sourceClipId) {
      backfillRefactorMetaLink(heuristicPair.refactoredClip, heuristicPair.sourceClipId);
    }
    logRefactorPairResolved(clip, heuristicPair);
    return heuristicPair;
  }

  console.warn('[PasteCraft:refactor-link]', {
    clipId: getClipIdKey(clip.id),
    resolverPath: null,
    message: 'No refactor link for this clip — run AI Refactorization first',
  });
  return null;
}
