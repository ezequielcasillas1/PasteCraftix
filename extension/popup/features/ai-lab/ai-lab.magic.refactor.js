// @forward-slice AI Lab magic — refactor registry + siblings
import { getClipIdKey } from '../clips/clips.state.js';
import { deleteClipsByIdKeys } from '../clips/clips.service.js';
import { AI_STORAGE_KEYS } from './ai-lab.constants.js';
import { isOutOfCreditsError } from './ai-lab.credit-error.js';

export function _resolveRefactorSourceClip(app, clip) {
  const linkedSourceId = clip?.meta?.craftRefactorSourceId;
  if (linkedSourceId == null || linkedSourceId === '') return clip;
  const sourceKey = getClipIdKey(linkedSourceId);
  if (sourceKey === getClipIdKey(clip?.id)) return clip;
  const original = app.clips.find((candidate) => getClipIdKey(candidate.id) === sourceKey);
  if (original) return original;
  const storedText = String(clip?.meta?.craftRefactorSourceText || '').trim();
  if (storedText) {
    return { id: linkedSourceId, text: storedText, meta: {}, category: clip.category };
  }
  return clip;
}

export function _normalizeRefactorEligibleTargets(app, targets) {
  const seen = new Set();
  const out = [];
  for (const clip of targets) {
    const sourceClip = _resolveRefactorSourceClip(app, clip);
    const key = getClipIdKey(sourceClip.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sourceClip);
  }
  return out;
}

export function _normalizeRefactorText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function _textPreview(text, max = 60) {
  const norm = _normalizeRefactorText(text);
  return norm.length <= max ? norm : `${norm.slice(0, max)}…`;
}

export function _formatRefactorSkipLog(skip) {
  const parts = [];
  if (skip.clipId) parts.push(`clip=${skip.clipId}`);
  parts.push(`outcome=${skip.outcome || 'unknown'}`);
  parts.push(`reason=${skip.reason || 'unknown'}`);
  if (skip.originalLen != null) parts.push(`origLen=${skip.originalLen}`);
  if (skip.refactoredLen != null) parts.push(`refLen=${skip.refactoredLen}`);
  if (skip.originalPreview) parts.push(`orig="${skip.originalPreview}"`);
  if (skip.refactoredPreview) parts.push(`ref="${skip.refactoredPreview}"`);
  if (skip.synthesis) parts.push(`synthesis="${String(skip.synthesis).slice(0, 100)}"`);
  if (Array.isArray(skip.reasons) && skip.reasons.length > 1) {
    parts.push(`allReasons=[${skip.reasons.join('; ')}]`);
  }
  return parts.join(' ');
}

export function _resolveRefactorSkipToast(skipped, refactorError) {
  if (refactorError) {
    if (isOutOfCreditsError({ message: refactorError }) || /need more ai credits/i.test(refactorError)) {
      return 'Need more AI credits — buy a pack or wait for your monthly reset';
    }
    if (/failed to fetch|network|timeout/i.test(refactorError)) {
      return 'Refactor failed — network error reaching Supabase. Check connection and retry.';
    }
    return `Refactor failed: ${refactorError}`;
  }

  if (!Array.isArray(skipped) || skipped.length === 0) {
    return 'No refactored copies saved — select text clips (not URLs/code)';
  }

  const first = skipped[0];
  const outcome = first?.outcome || 'unknown';

  switch (outcome) {
    case 'no_credits':
      return 'Need more AI credits — buy a pack or wait for your monthly reset';
    case 'unchanged':
      return 'AI returned the same text — try a different level or a longer clip';
    case 'minimal_change':
      return 'AI made only tiny edits — try a higher-contrast level (e.g. Child or PhD)';
    case 'preserved':
      return 'This clip looks like code or a link — refactor preserves it unchanged';
    case 'partial':
      return 'AI response was incomplete — try again';
    case 'empty_response':
      return 'Refactor returned no results — check connection and retry';
    default:
      if (first?.reason === 'identical_text') {
        return 'AI returned the same text — try a different level or a longer clip';
      }
      return 'No refactored copies saved — check credits or try again';
  }
}

export function _resolveRefactorSummaryLine(stats) {
  if (stats.aiRefactored > 0) {
    return `Original clip kept; ${stats.aiRefactored} new refactored clip(s) added to recents.`;
  }
  if (stats.refactorError || stats.refactorPipeline?.blockedBeforeCall) {
    return _resolveRefactorSkipToast(stats.refactorPipeline?.skipped || [], stats.refactorError);
  }
  const skipped = stats.refactorPipeline?.skipped || [];
  if (skipped.length > 0) {
    return _resolveRefactorSkipToast(skipped, null);
  }
  return 'No refactored copies saved (check network, credits, or clip type).';
}

let _refactorClipIdSeq = 0;
let _pendingRefactorLinkPersist = Promise.resolve();

export function _nextRefactorClipId() {
  _refactorClipIdSeq = (_refactorClipIdSeq + 1) % 1000;
  return Date.now() + _refactorClipIdSeq;
}

export function hydrateRefactorResolverIndex(app, links) {
  if (!app._refactorResolverIndex) app._refactorResolverIndex = new Map();
  for (const link of links || []) {
    const before = String(link.before || '').trim();
    const after = String(link.after || '').trim();
    if (!before || !after || before === after) continue;
    const record = {
      sourceClipId: getClipIdKey(link.sourceClipId),
      newClipId: getClipIdKey(link.newClipId),
      before,
      after,
    };
    if (record.sourceClipId) app._refactorResolverIndex.set(record.sourceClipId, record);
    if (record.newClipId) app._refactorResolverIndex.set(record.newClipId, record);
  }
}

export async function ensureRefactorRegistryReady(app) {
  await _pendingRefactorLinkPersist;
  try {
    const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: stored = [] } = await chrome.storage.local.get([
      AI_STORAGE_KEYS.REFACTOR_LINKS,
    ]);
    app._refactorLinks = Array.isArray(stored) ? stored : [];
    hydrateRefactorResolverIndex(app, app._refactorLinks);
  } catch (err) {
    console.warn('ensureRefactorRegistryReady failed:', err?.message || err);
  }
}

export function _registerRefactorLinkInMemory(app, record) {
  if (!record) return;
  if (!Array.isArray(app._refactorLinks)) app._refactorLinks = [];
  app._refactorLinks.unshift({
    sourceClipId: record.sourceClipId,
    newClipId: record.newClipId,
    before: record.before,
    after: record.after,
    updatedAt: Date.now(),
  });
  if (app._refactorLinks.length > 50) app._refactorLinks.length = 50;
  if (!app._refactorResolverIndex) app._refactorResolverIndex = new Map();
  app._refactorResolverIndex.set(record.sourceClipId, record);
  if (record.newClipId) app._refactorResolverIndex.set(record.newClipId, record);
}

export function _rememberRefactorPair(app, sourceClip, newClip) {
  const before = String(
    sourceClip?.text || newClip?.meta?.craftRefactorSourceText || '',
  ).trim();
  const after = String(newClip?.text || '').trim();
  if (!before || !after || before === after) return null;

  const record = {
    sourceClipId: getClipIdKey(sourceClip?.id ?? newClip?.meta?.craftRefactorSourceId),
    newClipId: getClipIdKey(newClip?.id),
    before,
    after,
  };
  _registerRefactorLinkInMemory(app, record);
  return record;
}

export function _buildRefactoredSiblingClip(sourceClip, refactoredText, settings) {
  const now = Date.now();
  const sourceMeta = sourceClip.meta && typeof sourceClip.meta === 'object'
    ? { ...sourceClip.meta }
    : {};
  return {
    id: _nextRefactorClipId(),
    text: refactoredText,
    category: sourceClip.category || 'Uncategorized',
    timestamp: now,
    updatedAt: now,
    meta: {
      ...sourceMeta,
      craftRefactor: true,
      craftRefactorSourceId: getClipIdKey(sourceClip.id),
      craftRefactorSourceText: String(sourceClip.text || '').trim(),
      craftRefactorLevel: settings.refactorLevel,
    },
  };
}

export async function _insertRefactoredSiblingClips(app, ctx, targetSet) {
  const created = ctx.refactorNewClips || [];
  if (created.length === 0) return;

  await _replaceExistingRefactoredSiblings(app, ctx);

  const linkRecords = [];
  for (let i = created.length - 1; i >= 0; i--) {
    const newClip = created[i];
    const sourceIdKey = getClipIdKey(newClip?.meta?.craftRefactorSourceId || '');
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey) || {
      id: sourceIdKey,
      text: newClip?.meta?.craftRefactorSourceText || '',
    };
    const linkRecord = _rememberRefactorPair(app, sourceClip, newClip);
    if (linkRecord) linkRecords.push(linkRecord);
    app.clips.unshift(newClip);
    targetSet.add(getClipIdKey(newClip.id));
  }

  console.warn('[PasteCraft:refactor]', {
    message: 'siblings_inserted',
    siblingsCreated: created.length,
    linksRegistered: linkRecords.length,
  });

  if (linkRecords.length > 0) {
    await _persistRefactorLinks(linkRecords);
    for (const record of linkRecords) {
      console.warn('[PasteCraft:refactor-link]', {
        sourceId: record.sourceClipId,
        refactoredId: record.newClipId,
      });
    }
  }

  if (typeof app.enforceClipLimit === 'function') {
    await app.enforceClipLimit();
  }
}

export async function _persistRefactorLinks(records) {
  if (!Array.isArray(records) || records.length === 0) return;
  _pendingRefactorLinkPersist = _pendingRefactorLinkPersist.then(async () => {
    try {
      const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: existing = [] } = await chrome.storage.local.get([
        AI_STORAGE_KEYS.REFACTOR_LINKS,
      ]);
      const links = Array.isArray(existing) ? [...existing] : [];
      for (const record of records) {
        const before = String(record.before || '').trim();
        const after = String(record.after || '').trim();
        if (!before || !after || before === after) continue;
        links.unshift({
          sourceClipId: getClipIdKey(record.sourceClipId),
          newClipId: getClipIdKey(record.newClipId),
          before,
          after,
          updatedAt: Date.now(),
        });
      }
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.REFACTOR_LINKS]: links.slice(0, 50) });
    } catch (err) {
      console.warn('_persistRefactorLinks failed:', err?.message || err);
    }
  });
  return _pendingRefactorLinkPersist;
}

export async function _replaceExistingRefactoredSiblings(app, ctx) {
  const sourceIds = new Set();
  for (const newClip of ctx.refactorNewClips || []) {
    const sourceKey = getClipIdKey(newClip?.meta?.craftRefactorSourceId || '');
    if (sourceKey) sourceIds.add(sourceKey);
  }
  if (sourceIds.size === 0) return;

  const toDelete = [];
  for (const clip of app.clips || []) {
    const linkedSourceId = clip?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') continue;
    const sourceKey = getClipIdKey(linkedSourceId);
    if (!sourceIds.has(sourceKey)) continue;
    const clipKey = getClipIdKey(clip.id);
    if (clipKey === sourceKey) continue;
    toDelete.push(clipKey);
  }
  if (toDelete.length === 0) return;

  await deleteClipsByIdKeys(app, toDelete, {
    reason: 'replace:refactor',
    rerender: false,
    clearSelection: false,
  });
  await _pruneRefactorLinksForDeletedClips(app, toDelete);
}

export async function _pruneRefactorLinksForDeletedClips(app, deletedIdKeys) {
  const deleted = new Set((deletedIdKeys || []).map(getClipIdKey).filter(Boolean));
  if (deleted.size === 0) return;

  if (Array.isArray(app._refactorLinks)) {
    app._refactorLinks = app._refactorLinks.filter(
      (link) => !deleted.has(getClipIdKey(link.newClipId)),
    );
  }
  if (app._refactorResolverIndex instanceof Map) {
    for (const id of deleted) {
      app._refactorResolverIndex.delete(id);
    }
  }

  _pendingRefactorLinkPersist = _pendingRefactorLinkPersist.then(async () => {
    try {
      const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: existing = [] } = await chrome.storage.local.get([
        AI_STORAGE_KEYS.REFACTOR_LINKS,
      ]);
      const links = (Array.isArray(existing) ? existing : []).filter(
        (link) => !deleted.has(getClipIdKey(link.newClipId)),
      );
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.REFACTOR_LINKS]: links.slice(0, 50) });
    } catch (err) {
      console.warn('_pruneRefactorLinksForDeletedClips failed:', err?.message || err);
    }
  });
  return _pendingRefactorLinkPersist;
}

export async function _saveCraftRefactorHistory(app, ctx) {
  if (typeof app.saveRefactorHistory !== 'function') return;
  const records = [];
  const savedSources = new Set();

  for (const newClip of ctx.refactorNewClips || []) {
    const sourceIdKey = getClipIdKey(newClip.meta?.craftRefactorSourceId || '');
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey);
    const before = String(sourceClip?.text || '').trim();
    const after = String(newClip.text || '').trim();
    if (!before || !after) continue;
    savedSources.add(sourceIdKey);
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: sourceIdKey,
      newClipId: getClipIdKey(newClip.id),
      synthesis: ctx.refactorDiagnostics?.get(String(sourceIdKey)) || {},
    });
  }

  for (const [sourceId, synthesis] of ctx.refactorDiagnostics || []) {
    const sourceIdKey = getClipIdKey(sourceId);
    if (savedSources.has(sourceIdKey)) continue;
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey);
    const before = String(sourceClip?.text || '').trim();
    if (!before) continue;
    const after = String(ctx.aiRefactorMap?.get(String(sourceId)) || before).trim();
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: sourceIdKey,
      newClipId: '',
      synthesis: synthesis || {},
    });
  }

  if (records.length > 0) {
    await _persistRefactorLinks(records);
    await app.saveRefactorHistory(records);
  }
}
