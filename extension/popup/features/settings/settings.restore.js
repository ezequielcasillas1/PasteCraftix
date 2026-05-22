import {
  RESTORE_LIMITS,
  RESTORE_STORAGE_KEYS,
  RESTORE_WINDOW_MS,
} from './settings.constants.js';
import { repairLocalClipIds } from '../sync/sync.repair.js';

function restoreWindowToMs(windowKey) {
  return RESTORE_WINDOW_MS[windowKey] || RESTORE_WINDOW_MS['1week'];
}

function localDateKey(ts) {
  const d = new Date(typeof ts === 'number' ? ts : Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadRestorePoints(app) {
  try {
    const res = await chrome.storage.local.get([app._restorePointsKey]);
    const raw = res ? res[app._restorePointsKey] : null;
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

async function saveRestorePoints(app, points) {
  try {
    await chrome.storage.local.set({ [app._restorePointsKey]: points });
  } catch (_) {
    // ignore
  }
}

function pruneRestorePoints(app, points) {
  const arr = Array.isArray(points) ? points : [];
  const valid = arr
    .filter(p => p && typeof p === 'object')
    .map(p => ({
      ...p,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
      kind: typeof p.kind === 'string' ? p.kind : 'daily',
      dateKey: typeof p.dateKey === 'string' ? p.dateKey : ''
    }))
    .filter(p => p.createdAt > 0);

  valid.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const dailyByDate = new Map();
  const manual = [];
  for (const p of valid) {
    if (p.kind === 'manual') {
      manual.push(p);
      continue;
    }
    const k = p.dateKey || localDateKey(p.createdAt);
    if (!dailyByDate.has(k)) dailyByDate.set(k, { ...p, dateKey: k, kind: 'daily' });
  }

  const daily = Array.from(dailyByDate.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const keptDaily = daily.slice(0, RESTORE_LIMITS.MAX_DAILY_POINTS);
  const keptManual = manual.slice(0, RESTORE_LIMITS.MAX_MANUAL_POINTS);

  return [...keptManual, ...keptDaily].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function buildRestoreSnapshotFromLocal(app, local) {
  const source = local && typeof local === 'object' ? local : {};
  const repaired = repairLocalClipIds(source.clips, source.searchOnlyClips);
  const clips = Array.isArray(repaired.clips) ? repaired.clips.slice(0, RESTORE_LIMITS.MAX_ACTIVE_CLIPS) : [];
  const searchOnlyClips = Array.isArray(repaired.searchOnlyClips)
    ? repaired.searchOnlyClips.slice(0, RESTORE_LIMITS.MAX_ARCHIVED_CLIPS)
    : [];
  const categories = Array.isArray(source.categories) ? source.categories.slice(0, RESTORE_LIMITS.MAX_CATEGORIES) : [];
  const notes = Array.isArray(source.notes) ? source.notes.slice(0, RESTORE_LIMITS.MAX_NOTES) : [];
  return { clips, searchOnlyClips, categories, notes };
}

export async function maybeCreateDailyRestorePoint(app, reason = 'daily', localOverride = null) {
  const now = Date.now();
  const todayKey = localDateKey(now);

  const points = await loadRestorePoints(app);
  const hasToday = points.some(p =>
    p && p.kind !== 'manual' && (p.dateKey === todayKey || localDateKey(p.createdAt) === todayKey)
  );
  if (hasToday) return false;

  let local = localOverride;
  if (!local) {
    local = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips', 'notes']);
  }

  const snap = buildRestoreSnapshotFromLocal(app, local);
  const point = {
    id: `rp_${now}_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'daily',
    reason: String(reason || 'daily').slice(0, 60),
    createdAt: now,
    dateKey: todayKey,
    ...snap
  };

  const next = pruneRestorePoints(app, [point, ...points]);
  await saveRestorePoints(app, next);
  return true;
}

export async function createManualRestorePoint(app, reason = 'manual') {
  const now = Date.now();
  const points = await loadRestorePoints(app);
  const local = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips', 'notes']);
  const snap = buildRestoreSnapshotFromLocal(app, local);

  const point = {
    id: `rp_${now}_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'manual',
    reason: String(reason || 'manual').slice(0, 60),
    createdAt: now,
    dateKey: localDateKey(now),
    ...snap
  };

  const next = pruneRestorePoints(app, [point, ...points]);
  await saveRestorePoints(app, next);
  return point;
}

function selectRestorePointForWindow(app, points, windowKey) {
  const arr = Array.isArray(points) ? points.slice() : [];
  if (arr.length === 0) return { point: null, cutoffMs: 0 };

  arr.sort((a, b) => (b?.createdAt || 0) - (a.createdAt || 0));
  const cutoffMs = Date.now() - restoreWindowToMs(windowKey);

  const match = arr.find(p => p && typeof p.createdAt === 'number' && p.createdAt <= cutoffMs) || null;
  if (match) return { point: match, cutoffMs };

  const oldest = arr[arr.length - 1] || null;
  return { point: oldest, cutoffMs };
}

function formatRestorePreview(point, windowKey, cutoffMs) {
  if (!point) return 'No restore points found yet.';
  const when = new Date(point.createdAt).toLocaleString();
  const active = Array.isArray(point.clips) ? point.clips.length : 0;
  const archived = Array.isArray(point.searchOnlyClips) ? point.searchOnlyClips.length : 0;
  const categories = Array.isArray(point.categories) ? point.categories.length : 0;
  const notes = Array.isArray(point.notes) ? point.notes.length : 0;
  const target = new Date(cutoffMs).toLocaleString();
  const reason = point.reason ? ` — ${String(point.reason)}` : '';
  return `Restore point: ${when}${reason}. Target window: ${windowKey} (= ${target}). Clips: ${active} active, ${archived} archived. Categories: ${categories}. Notes: ${notes}.`;
}

export async function previewRestore(app, windowKey) {
  const points = await loadRestorePoints(app);
  const { point, cutoffMs } = selectRestorePointForWindow(app, points, windowKey);
  app._lastPreviewRestore = { point, cutoffMs, windowKey };

  const el = document.getElementById('restorePreviewText');
  if (el) el.textContent = formatRestorePreview(point, windowKey, cutoffMs);

  return { point, cutoffMs };
}

export async function applyRestoreFromPreview(app) {
  const preview = app._lastPreviewRestore;
  const point = preview?.point ? preview.point : null;
  if (!point) {
    app.showToast('No restore point available yet', 'error');
    return false;
  }

  try { await createManualRestorePoint(app, 'pre-restore'); } catch (_) {}

  const ok = confirm(
    'Restore will replace local Clips and Archive with a previous snapshot.\n\nCloud data will NOT be changed unless you click "Sync restored data to cloud".\n\nProceed?'
  );
  if (!ok) return false;

  const clips = Array.isArray(point.clips) ? point.clips.slice(0, RESTORE_LIMITS.MAX_ACTIVE_CLIPS) : [];
  const searchOnlyClips = Array.isArray(point.searchOnlyClips)
    ? point.searchOnlyClips.slice(0, RESTORE_LIMITS.MAX_ARCHIVED_CLIPS)
    : [];
  const categories = Array.isArray(point.categories) ? point.categories.slice(0, RESTORE_LIMITS.MAX_CATEGORIES) : [];
  const notes = Array.isArray(point.notes) ? point.notes.slice(0, RESTORE_LIMITS.MAX_NOTES) : [];

  const appliedAt = Date.now();
  await chrome.storage.local.set({
    clips,
    searchOnlyClips,
    categories,
    notes,
    pc_local_updatedAt: appliedAt,
    [RESTORE_STORAGE_KEYS.LAST_AT]: appliedAt,
    [RESTORE_STORAGE_KEYS.LAST_POINT_ID]: point.id || ''
  });

  await app.loadData();
  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
  app.updatePreview();
  app.updateLastCapture();
  try { app.updateStorageStats(); } catch (_) {}

  app._lastAppliedRestore = { point, appliedAt };
  const btn = document.getElementById('syncRestoredToCloudBtn');
  if (btn) btn.disabled = false;

  app.showToast('Restore complete (local only)');
  return true;
}

export async function syncRestoredDataToCloud(app) {
  const applied = app._lastAppliedRestore;
  if (!applied?.point) {
    app.showToast('Restore first, then sync to cloud', 'error');
    return false;
  }

  const ok = confirm(
    'This will sync your CURRENT local state to the cloud.\n\nThis may overwrite cloud clips to match the restored snapshot.\n\nProceed?'
  );
  if (!ok) return false;

  await app.performBackgroundSync({ force: true, reason: 'restore:cloud-sync' });
  app.showToast('Synced restored data to cloud');
  return true;
}
