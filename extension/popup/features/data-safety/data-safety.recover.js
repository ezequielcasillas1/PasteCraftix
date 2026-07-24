/** @forward-slice Recover empty local state from IDB or restore points. */

import { RESTORE_STORAGE_KEYS } from '../settings/settings.constants.js';
import { DATA_SAFETY_LIMITS } from './data-safety.constants.js';
import {
  readSafetyMeta,
  readSyncSafetyHint,
  summarizeLocalCounts,
} from './data-safety.persistence.js';

function _resolveIdb() {
  try {
    return typeof window !== 'undefined' ? window.pasteCraftIndexedDB : null;
  } catch (_) {
    return null;
  }
}

function _asArray(value) {
  return Array.isArray(value) ? value : [];
}

function _candidateFromParts(source, parts, pointId = '') {
  const clips = _asArray(parts.clips);
  const searchOnlyClips = _asArray(parts.searchOnlyClips);
  const categories = _asArray(parts.categories);
  const notes = _asArray(parts.notes);
  const counts = summarizeLocalCounts({ clips, searchOnlyClips, categories, notes });
  if (counts.total <= 0) return null;
  return { source, clips, searchOnlyClips, categories, notes, counts, pointId };
}

async function _loadFromIdb() {
  const idb = _resolveIdb();
  if (!idb || typeof idb.getAllPayloads !== 'function') return null;
  try {
    const [clips, categories, notes] = await Promise.all([
      idb.getAllPayloads('clips'),
      idb.getAllPayloads('categories'),
      idb.getAllPayloads('notes'),
    ]);
    return _candidateFromParts('idb', { clips, categories, notes, searchOnlyClips: [] });
  } catch (_) {
    return null;
  }
}

function _sortedRestorePoints(points) {
  return _asArray(points)
    .filter((p) => p && typeof p === 'object')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function _loadFromRestorePoints(app) {
  const key = app?._restorePointsKey || RESTORE_STORAGE_KEYS.POINTS;
  try {
    const res = await chrome.storage.local.get([key]);
    for (const point of _sortedRestorePoints(res?.[key])) {
      const candidate = _candidateFromParts('restore-point', point, point.id || '');
      if (candidate) return candidate;
    }
  } catch (_) {}
  return null;
}

async function _persistRecovered(payload) {
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      clips: payload.clips,
      searchOnlyClips: payload.searchOnlyClips,
      categories: payload.categories,
      notes: payload.notes,
      pc_local_updatedAt: payload.pc_local_updatedAt,
    }),
    stateSetter: async () => {},
    stateKeys: ['clips', 'searchOnlyClips', 'categories', 'notes', 'pc_local_updatedAt'],
    mutateState: async () => {},
    storageKeys: ['clips', 'searchOnlyClips', 'categories', 'notes', 'pc_local_updatedAt'],
    buildStorageData: async (state) => ({
      clips: state.clips,
      searchOnlyClips: state.searchOnlyClips,
      categories: state.categories,
      notes: state.notes,
      pc_local_updatedAt: state.pc_local_updatedAt,
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async () => {
      const stored = await chrome.storage.local.get(['clips', 'searchOnlyClips', 'categories', 'notes']);
      return (
        _asArray(stored.clips).length === payload.clips.length
        && _asArray(stored.searchOnlyClips).length === payload.searchOnlyClips.length
        && _asArray(stored.categories).length === payload.categories.length
        && _asArray(stored.notes).length === payload.notes.length
      );
    },
    successMessage: () => '',
    errorMessage: (error) => `Recovery failed: ${error.message || 'Unknown error'}`,
    showToast: null,
  });
  if (!result.success) throw new Error(result.error || 'Recovery failed');
}

function _safeCall(app, methodName) {
  try { app?.[methodName]?.(); } catch (_) {}
}

function _applyToAppMemory(app, payload) {
  app.clips = payload.clips;
  app.searchOnlyClips = payload.searchOnlyClips;
  app.categories = payload.categories;
  app.notes = payload.notes;
  ['renderChips', 'renderCategories', 'updateCategoryFilter', 'updatePreview', 'updateLastCapture']
    .forEach((name) => _safeCall(app, name));
}

function _hasPriorEvidence(meta, hint) {
  return !!(meta?.total > 0 || hint?.hadData);
}

export async function assessDataLossRisk(app) {
  const current = summarizeLocalCounts({
    clips: app?.clips,
    searchOnlyClips: app?.searchOnlyClips,
    categories: app?.categories,
    notes: app?.notes,
  });
  const meta = await readSafetyMeta();
  const hint = await readSyncSafetyHint();
  const priorTotal = Math.max(
    typeof meta?.total === 'number' ? meta.total : 0,
    typeof hint?.total === 'number' ? hint.total : 0,
  );
  const priorHadData = _hasPriorEvidence(meta, hint);
  const emptyNow = current.total === 0;
  const suspiciousEmpty = emptyNow
    && priorHadData
    && priorTotal >= DATA_SAFETY_LIMITS.MIN_PRIOR_CLIPS_FOR_RECOVERY;

  return { current, priorTotal, priorHadData, emptyNow, suspiciousEmpty, meta, hint };
}

function _shouldAttemptRecovery(risk) {
  if (risk.suspiciousEmpty) return true;
  return !!(risk.emptyNow && _hasPriorEvidence(risk.meta, risk.hint));
}

async function _findRecoveryCandidate(app) {
  return (await _loadFromIdb()) || (await _loadFromRestorePoints(app));
}

/**
 * Attempt automatic local recovery. Returns result for banner/toast UX.
 */
export async function maybeRecoverLocalData(app) {
  const risk = await assessDataLossRisk(app);
  if (!_shouldAttemptRecovery(risk)) {
    return { recovered: false, attempted: false, risk };
  }

  const candidate = await _findRecoveryCandidate(app);
  if (!candidate) {
    return { recovered: false, attempted: true, risk, reason: 'no-secondary-source' };
  }

  try {
    const payload = {
      clips: candidate.clips,
      searchOnlyClips: candidate.searchOnlyClips,
      categories: candidate.categories,
      notes: candidate.notes,
      pc_local_updatedAt: Date.now(),
    };
    await _persistRecovered(payload);
    _applyToAppMemory(app, payload);
    return {
      recovered: true,
      attempted: true,
      risk,
      source: candidate.source,
      counts: candidate.counts,
    };
  } catch (e) {
    return {
      recovered: false,
      attempted: true,
      risk,
      reason: String(e?.message || e),
    };
  }
}
