/** @forward-slice Storage canary + cross-session meta (local + sync hint). */

import {
  DATA_SAFETY_LIMITS,
  DATA_SAFETY_STORAGE_KEYS,
} from './data-safety.constants.js';

function _countEntities(local) {
  const clips = Array.isArray(local?.clips) ? local.clips.length : 0;
  const archived = Array.isArray(local?.searchOnlyClips) ? local.searchOnlyClips.length : 0;
  const categories = Array.isArray(local?.categories) ? local.categories.length : 0;
  const notes = Array.isArray(local?.notes) ? local.notes.length : 0;
  return { clips, archived, categories, notes, total: clips + archived + notes };
}

/**
 * Write-then-read canary. Detects Aaron-class "saves don't survive" storage failure.
 */
export async function probeStoragePersistence() {
  const token = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await chrome.storage.local.set({ [DATA_SAFETY_STORAGE_KEYS.CANARY]: token });
    const got = await chrome.storage.local.get([DATA_SAFETY_STORAGE_KEYS.CANARY]);
    const ok = got?.[DATA_SAFETY_STORAGE_KEYS.CANARY] === token;
    if (!ok) {
      await chrome.storage.local.set({
        [DATA_SAFETY_STORAGE_KEYS.UNHEALTHY]: { at: Date.now(), reason: 'canary-mismatch' },
      });
    }
    return { ok, reason: ok ? 'ok' : 'canary-mismatch' };
  } catch (e) {
    try {
      await chrome.storage.local.set({
        [DATA_SAFETY_STORAGE_KEYS.UNHEALTHY]: {
          at: Date.now(),
          reason: 'canary-throw',
          message: String(e?.message || e),
        },
      });
    } catch (_) {}
    return { ok: false, reason: 'canary-throw' };
  }
}

export async function readSafetyMeta() {
  try {
    const local = await chrome.storage.local.get([DATA_SAFETY_STORAGE_KEYS.META_LOCAL]);
    const meta = local?.[DATA_SAFETY_STORAGE_KEYS.META_LOCAL];
    return meta && typeof meta === 'object' ? meta : null;
  } catch (_) {
    return null;
  }
}

export async function readSyncSafetyHint() {
  try {
    if (!chrome.storage?.sync) return null;
    const res = await chrome.storage.sync.get([DATA_SAFETY_STORAGE_KEYS.META_SYNC]);
    const hint = res?.[DATA_SAFETY_STORAGE_KEYS.META_SYNC];
    return hint && typeof hint === 'object' ? hint : null;
  } catch (_) {
    return null;
  }
}

/**
 * Persist lightweight durability meta locally + sync hint (survives some local wipes).
 */
export async function writeSafetyMeta(app, overrides = {}) {
  const clips = Array.isArray(app?.clips) ? app.clips.length : 0;
  const archived = Array.isArray(app?.searchOnlyClips) ? app.searchOnlyClips.length : 0;
  const categories = Array.isArray(app?.categories) ? app.categories.length : 0;
  const notes = Array.isArray(app?.notes) ? app.notes.length : 0;
  const now = Date.now();
  const meta = {
    updatedAt: now,
    lastHealthyAt: overrides.lastHealthyAt ?? now,
    clips,
    archived,
    categories,
    notes,
    total: clips + archived + notes,
    guest: !!app?._isFreemiumGuest,
    ...overrides,
  };

  try {
    await chrome.storage.local.set({ [DATA_SAFETY_STORAGE_KEYS.META_LOCAL]: meta });
  } catch (_) {}

  try {
    if (!chrome.storage?.sync) return meta;
    const hint = {
      updatedAt: now,
      hadData: meta.total > 0,
      total: meta.total,
      clips: meta.clips,
      guest: meta.guest,
    };
    const encoded = JSON.stringify(hint);
    if (encoded.length <= DATA_SAFETY_LIMITS.SYNC_HINT_MAX_BYTES) {
      await chrome.storage.sync.set({ [DATA_SAFETY_STORAGE_KEYS.META_SYNC]: hint });
    }
  } catch (_) {}

  return meta;
}

export async function clearUnhealthyFlag() {
  try {
    await chrome.storage.local.remove([DATA_SAFETY_STORAGE_KEYS.UNHEALTHY]);
  } catch (_) {}
}

export async function isMarkedUnhealthy() {
  try {
    const res = await chrome.storage.local.get([DATA_SAFETY_STORAGE_KEYS.UNHEALTHY]);
    return !!(res && res[DATA_SAFETY_STORAGE_KEYS.UNHEALTHY]);
  } catch (_) {
    return false;
  }
}

export function summarizeLocalCounts(local) {
  return _countEntities(local);
}
