import { mergeActiveClipsSources } from '../../../shared/clips-local-merge.js';
import { mergeActiveCategoriesSources } from '../../../shared/categories-local-merge.js';

const loadDataPromises = new WeakMap();
const cloudResolutionTimers = new WeakMap();
const CLOUD_RESOLUTION_TIMEOUT_MS = 5000;

export const CORE_HYDRATION_STATES = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  FAILED: 'failed',
});

export const CORE_CLOUD_STATES = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
});

function isExtensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

export async function ensureStorageReady(app) {
  if (!isExtensionContextValid()) return;
  await app._ensureIndexedDbReadyAndMigrate();
}

export async function fetchRawData(app) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }
  const result = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
  let { clips = [], categories = [], searchOnlyClips = [] } = result;
  let cameFromIdb = false;

  if (app._idbReady && app.idb) {
    const [idbClips, idbCategories] = await Promise.all([
      app.idb.getAllPayloads('clips'),
      app.idb.getAllPayloads('categories')
    ]);
    if (Array.isArray(idbClips) && idbClips.length > 0) {
      clips = mergeActiveClipsSources(clips, idbClips);
      cameFromIdb = true;
    }
    if (Array.isArray(idbCategories) && idbCategories.length > 0) {
      categories = mergeActiveCategoriesSources(categories, idbCategories);
    }
  }
  return { clips, categories, searchOnlyClips, cameFromIdb };
}

export async function injectDemoSeedIfNeeded(app, rawData) {
  let { clips, categories, searchOnlyClips, cameFromIdb } = rawData;
  let seeded = false;

  if (clips.length === 0 && categories.length === 0) {
    const now = Date.now();
    categories = app.syncFeature.constants.getDemoCategories(now);
    clips = app.syncFeature.constants.getDemoClips(now);
    await chrome.storage.local.set({ clips, categories, searchOnlyClips });
    seeded = true;
    cameFromIdb = false;
    console.log('🌱 Seeded 8 preset categories + 8 example clips (PC 1.0)');
  }

  return { clips, categories, searchOnlyClips, seeded, cameFromIdb };
}

function hashText(t) {
  const s = String(t || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function getClipId(clip, ts, text) {
  if (clip?.id != null) return clip.id;
  if (clip?.clip_id != null) return clip.clip_id;
  if (clip?.clipId != null) return clip.clipId;
  return `${ts}_${hashText(text)}`;
}

function getClipTimestamp(clip) {
  if (typeof clip?.timestamp === 'number') return clip.timestamp;
  return Date.now();
}

function getClipText(clip) {
  return clip?.text || clip;
}

function applyOptionalFields(clip, normalized) {
  if (!clip || typeof clip !== 'object') return;
  
  const updated = clip.updatedAt ?? clip.updated_at;
  if (Number.isFinite(updated)) normalized.updatedAt = Number(updated);

  const deleted = clip.deletedAt ?? clip.deleted_at;
  if (Number.isFinite(deleted)) normalized.deletedAt = Number(deleted);

  const device = clip.deviceId || clip.device_id;
  if (device) normalized.deviceId = device;

  if (clip.meta) normalized.meta = clip.meta;
}

function normalizeSingleClip(app, clip, setChanged) {
  if (typeof clip === 'string') {
    setChanged();
    const ts = Date.now();
    return {
      id: `${ts}_${hashText(clip)}`,
      text: clip,
      category: 'Uncategorized',
      timestamp: ts
    };
  }

  const text = getClipText(clip);
  const ts = getClipTimestamp(clip);
  const id = getClipId(clip, ts, text);
  
  if (clip?.id == null || typeof clip?.timestamp !== 'number') {
    setChanged();
  }

  const normalized = {
    id,
    text,
    title: app._clipTitle(clip),
    category: clip?.category || 'Uncategorized',
    timestamp: ts
  };

  applyOptionalFields(clip, normalized);

  return normalized;
}

export function normalizeClipData(app, rawData) {
  let { clips, categories, searchOnlyClips, seeded, cameFromIdb } = rawData;
  let normalizedChanged = false;
  const setChanged = () => { normalizedChanged = true; };

  const normalizedClips = clips.map(clip => normalizeSingleClip(app, clip, setChanged));
  normalizedClips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const normalizedSearchOnlyClips = searchOnlyClips.map(clip => normalizeSingleClip(app, clip, setChanged));

  if (seeded) {
    normalizedChanged = false;
  }

  return {
    clips: normalizedClips,
    categories,
    searchOnlyClips: normalizedSearchOnlyClips,
    normalizedChanged,
    cameFromIdb,
    seeded,
  };
}

function scheduleIdbBackfill(app) {
  Promise.resolve()
    .then(() => app.idb.syncEntityFromLocalStorage('clips', app.clips))
    .then(() => app.idb.syncEntityFromLocalStorage('categories', app.categories))
    .catch((error) => {
      console.warn('IDB backfill skipped:', error);
    });
}

function shouldBackfillIndexedDb({ normalizedChanged, cameFromIdb, seeded }) {
  if (normalizedChanged) return true;
  if (seeded) return true;
  return !cameFromIdb;
}

function canScheduleIdbBackfill(app, flags) {
  if (!app._idbReady) return false;
  if (!app.idb) return false;
  return shouldBackfillIndexedDb(flags);
}

export async function syncNormalizedState(app, normalizedData) {
  const { clips, categories, searchOnlyClips, normalizedChanged, cameFromIdb, seeded } = normalizedData;

  app.clips = clips;
  app.categories = categories;
  app.searchOnlyClips = searchOnlyClips;

  if (normalizedChanged) {
    await chrome.storage.local.set({
      clips: app.clips,
      searchOnlyClips: app.searchOnlyClips
    });
  }

  // Skip full IDB wipe+rewrite when data already came from IDB and was not reshaped.
  // When a backfill is needed, schedule it off the init critical path so large
  // libraries (400+ clips) cannot trip the 10s offline-mode watchdog.
  if (canScheduleIdbBackfill(app, { normalizedChanged, cameFromIdb, seeded })) {
    scheduleIdbBackfill(app);
  }

  if (typeof app.enforceClipLimit === 'function') {
    await app.enforceClipLimit();
  }
}

export async function loadStorageData(app) {
  await ensureStorageReady(app);
  const rawData = await fetchRawData(app);
  const seededData = await injectDemoSeedIfNeeded(app, rawData);
  const normalizedData = normalizeClipData(app, seededData);
  await syncNormalizedState(app, normalizedData);
}

function beginCoreHydration(app) {
  app._coreHydrationState = CORE_HYDRATION_STATES.LOADING;
  if (app._isFreemiumGuest) {
    app._coreCloudHydrationState = CORE_CLOUD_STATES.READY;
    return;
  }
  if (app.currentUser && !app._coreCloudHydrationState) {
    app._coreCloudHydrationState = CORE_CLOUD_STATES.PENDING;
  }
}

function hasLocalClips(app) {
  return (app.clips?.length || 0) > 0;
}

function shouldAwaitCloudHydration(app) {
  if (!app.currentUser) return false;
  if (hasLocalClips(app)) return false;
  return app._coreCloudHydrationState === CORE_CLOUD_STATES.PENDING;
}

function scheduleCloudResolutionFallback(app) {
  if (cloudResolutionTimers.has(app)) return;
  const timerId = setTimeout(() => {
    cloudResolutionTimers.delete(app);
    finalizeCoreCloudHydration(app, CORE_CLOUD_STATES.FAILED);
  }, CLOUD_RESOLUTION_TIMEOUT_MS);
  cloudResolutionTimers.set(app, timerId);
}

function completeCoreHydration(app) {
  app._coreHydrationState = CORE_HYDRATION_STATES.READY;
  if (app._isFreemiumGuest) {
    app._coreCloudHydrationState = CORE_CLOUD_STATES.READY;
    return;
  }
  if (shouldAwaitCloudHydration(app)) scheduleCloudResolutionFallback(app);
}

function failCoreHydration(app) {
  app._coreHydrationState = CORE_HYDRATION_STATES.FAILED;
}

export function finalizeCoreCloudHydration(app, outcome = CORE_CLOUD_STATES.READY) {
  const timerId = cloudResolutionTimers.get(app);
  if (timerId) clearTimeout(timerId);
  cloudResolutionTimers.delete(app);
  app._coreCloudHydrationState = outcome === CORE_CLOUD_STATES.FAILED
    ? CORE_CLOUD_STATES.FAILED
    : CORE_CLOUD_STATES.READY;
  if (app.currentTab === 'clips') app.renderChips?.();
}

export function loadData(app) {
  if (!isExtensionContextValid()) {
    failCoreHydration(app);
    return Promise.resolve();
  }
  if (loadDataPromises.has(app)) return loadDataPromises.get(app);

  beginCoreHydration(app);
  const loadPromise = loadStorageData(app)
    .then((result) => {
      completeCoreHydration(app);
      return result;
    })
    .catch((error) => {
      failCoreHydration(app);
      throw error;
    })
    .finally(() => {
      if (loadDataPromises.get(app) === loadPromise) loadDataPromises.delete(app);
    });
  loadDataPromises.set(app, loadPromise);
  return loadPromise;
}
