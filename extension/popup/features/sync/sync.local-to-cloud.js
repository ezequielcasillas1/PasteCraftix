/** @forward-slice One-shot local → cloud library upload when hasCloudSyncAccess becomes true. */

import {
  LOCAL_TO_CLOUD_STORAGE_KEYS,
  LOCAL_TO_CLOUD_TOAST,
  LOCAL_TO_CLOUD_VERSION,
} from './sync.local-to-cloud.constants.js';

const inFlightByUserId = new Map();

function _toast(app, message, type) {
  if (!message || typeof app?.showToast !== 'function') return;
  app.showToast(message, type);
}

function _asArray(value) {
  return Array.isArray(value) ? value : [];
}

function _buildSettingsPayload(app) {
  const qp = app?.quickPasteSettings;
  return {
    autoDeletePeriod: app?.autoDeletePeriod ?? 'never',
    theme: app?.theme ?? 'light',
    quickPasteSettings: qp && typeof qp === 'object' ? qp : {},
    albumAttachmentOpenMode: app?.albumAttachmentOpenMode ?? 'edgePopup',
  };
}

function _countStats(app, uploaded) {
  return {
    clips: _asArray(app?.clips).length,
    archived: _asArray(app?.searchOnlyClips).length,
    categories: _asArray(app?.categories).length,
    notes: _asArray(app?.notes).length,
    uploaded,
  };
}

async function _readMigratedMap() {
  try {
    const res = await chrome.storage.local.get([LOCAL_TO_CLOUD_STORAGE_KEYS.MIGRATED_MAP]);
    const map = res?.[LOCAL_TO_CLOUD_STORAGE_KEYS.MIGRATED_MAP];
    return map && typeof map === 'object' ? map : {};
  } catch (_) {
    return {};
  }
}

async function _isAlreadyMigrated(userId) {
  if (!userId) return false;
  const map = await _readMigratedMap();
  return map[userId]?.ok === true;
}

async function _markMigrated(userId, stats) {
  if (!userId) return;
  const map = await _readMigratedMap();
  map[userId] = {
    ok: true,
    at: Date.now(),
    version: LOCAL_TO_CLOUD_VERSION,
    stats: stats || null,
  };
  await chrome.storage.local.set({ [LOCAL_TO_CLOUD_STORAGE_KEYS.MIGRATED_MAP]: map });
}

async function _clearMigrated(userId) {
  if (!userId) return;
  const map = await _readMigratedMap();
  if (!map[userId]) return;
  delete map[userId];
  await chrome.storage.local.set({ [LOCAL_TO_CLOUD_STORAGE_KEYS.MIGRATED_MAP]: map });
}

async function _fetchAuthUserId() {
  try {
    const user = await pasteCraftSupabase?.getCurrentUser?.();
    return user?.id ? String(user.id) : null;
  } catch (_) {
    return null;
  }
}

async function _resolveUserId(app) {
  const fromApp = app?.currentUser?.id;
  return fromApp ? String(fromApp) : _fetchAuthUserId();
}

async function _hasCloudAccess(userId) {
  if (!userId || !pasteCraftSupabase?.hasCloudSyncAccess) return false;
  try {
    return !!(await pasteCraftSupabase.hasCloudSyncAccess(userId));
  } catch (_) {
    return false;
  }
}

async function _pushEntity(label, data, syncFn) {
  if (typeof syncFn !== 'function') {
    return { label, ok: true, skipped: true, reason: 'no-sync-fn' };
  }
  if (!_asArray(data).length) {
    return { label, ok: true, skipped: true, count: 0 };
  }
  try {
    // Direct upsert — avoid syncWithQueue false-fails while full sync is busy.
    const ok = await syncFn.call(pasteCraftSupabase, data);
    return { label, ok: ok !== false, skipped: false, count: data.length };
  } catch (error) {
    console.warn(`[local-to-cloud] ${label} failed:`, error?.message || error);
    return { label, ok: false, skipped: false, count: data.length };
  }
}

async function _pushSettings(app) {
  const syncFn = pasteCraftSupabase?.syncSettingsToSupabase;
  if (typeof syncFn !== 'function') {
    return { label: 'settings', ok: true, skipped: true, reason: 'no-sync-fn' };
  }
  try {
    const ok = await syncFn.call(pasteCraftSupabase, _buildSettingsPayload(app));
    return { label: 'settings', ok: ok !== false, skipped: false, count: 1 };
  } catch (error) {
    console.warn('[local-to-cloud] settings failed:', error?.message || error);
    return { label: 'settings', ok: false, skipped: false, count: 1 };
  }
}

function _summarizeResults(results) {
  const failed = results.filter((r) => r?.ok === false);
  const uploaded = results
    .filter((r) => r && !r.skipped && r.ok)
    .reduce((sum, r) => sum + (Number(r.count) || 0), 0);
  return { ok: failed.length === 0, failedLabels: failed.map((r) => r.label), uploaded };
}

async function _runUpload(app) {
  const sb = pasteCraftSupabase;
  const results = [
    await _pushEntity('clips', _asArray(app?.clips), sb.syncClipsToSupabase),
    await _pushEntity('archived', _asArray(app?.searchOnlyClips), sb.syncArchivedClipsToSupabase),
    await _pushEntity('categories', _asArray(app?.categories), sb.syncCategoriesToSupabase),
    await _pushEntity('notes', _asArray(app?.notes), sb.syncNotesToSupabase),
    await _pushSettings(app),
  ];
  return { results, summary: _summarizeResults(results) };
}

async function _gateMigrate(userId, force) {
  if (!(await _hasCloudAccess(userId))) {
    return { allow: false, reason: 'no-cloud-access' };
  }
  if (!force && (await _isAlreadyMigrated(userId))) {
    return { allow: false, reason: 'already-migrated' };
  }
  return { allow: true };
}

function _failResult(ctx) {
  console.warn('☁️ Local→cloud migration partial/failed', {
    reason: ctx.reason,
    failed: ctx.summary.failedLabels,
    results: ctx.results,
  });
  return { ran: true, success: false, reason: ctx.reason, results: ctx.results, summary: ctx.summary };
}

async function _succeedResult(ctx) {
  const stats = _countStats(ctx.app, ctx.summary.uploaded);
  await _markMigrated(ctx.userId, stats);
  console.log('☁️ Local→cloud migration complete', { userId: ctx.userId, reason: ctx.reason, stats });
  return {
    ran: true,
    success: true,
    reason: ctx.reason,
    results: ctx.results,
    summary: ctx.summary,
    stats,
  };
}

async function _executeMigrate(app, userId, reason, silent) {
  if (!silent) _toast(app, LOCAL_TO_CLOUD_TOAST.START, 'info');
  console.log('☁️ Local→cloud migration starting', { userId, reason });

  const { results, summary } = await _runUpload(app);
  const ctx = { app, userId, reason, results, summary };
  if (!summary.ok) {
    if (!silent) _toast(app, LOCAL_TO_CLOUD_TOAST.FAILURE, 'error');
    return _failResult(ctx);
  }

  const done = await _succeedResult(ctx);
  if (!silent) _toast(app, LOCAL_TO_CLOUD_TOAST.SUCCESS, 'success');
  return done;
}

async function _migrateForUser(app, userId, { force, reason, silent }) {
  const gate = await _gateMigrate(userId, force);
  if (!gate.allow) return { ran: false, reason: gate.reason };
  return _executeMigrate(app, userId, reason, silent);
}

/**
 * Idempotent local → cloud migration.
 * Runs only when hasCloudSyncAccess is true and per-user flag is unset (unless force).
 */
export async function maybeMigrateLocalToCloud(app, {
  force = false,
  reason = 'entitlement',
  silent = false,
} = {}) {
  if (app?._isFreemiumGuest || !app?.currentUser?.id) {
    return { ran: false, reason: 'guest-or-unsigned' };
  }

  const userId = await _resolveUserId(app);
  if (!userId) return { ran: false, reason: 'no-user' };

  if (inFlightByUserId.has(userId)) {
    return inFlightByUserId.get(userId);
  }

  const work = _migrateForUser(app, userId, { force, reason, silent });
  inFlightByUserId.set(userId, work);
  try {
    return await work;
  } finally {
    inFlightByUserId.delete(userId);
  }
}

/** Force retry after a failed migrate (clears success flag first). */
export async function retryMigrateLocalToCloud(app, options = {}) {
  const userId = await _resolveUserId(app);
  if (userId) await _clearMigrated(userId);
  return maybeMigrateLocalToCloud(app, { ...options, force: true, reason: options.reason || 'retry' });
}

export async function wasLocalToCloudMigrated(userId) {
  return _isAlreadyMigrated(userId);
}
