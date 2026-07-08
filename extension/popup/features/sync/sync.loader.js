import { mergeActiveClipsSources } from '../../../shared/clips-local-merge.js';
import { mergeActiveCategoriesSources } from '../../../shared/categories-local-merge.js';

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

  if (app._idbReady && app.idb) {
    const [idbClips, idbCategories] = await Promise.all([
      app.idb.getAllPayloads('clips'),
      app.idb.getAllPayloads('categories')
    ]);
    if (Array.isArray(idbClips) && idbClips.length > 0) {
      clips = mergeActiveClipsSources(clips, idbClips);
    }
    if (Array.isArray(idbCategories) && idbCategories.length > 0) {
      categories = mergeActiveCategoriesSources(categories, idbCategories);
    }
  }
  return { clips, categories, searchOnlyClips };
}

export async function injectDemoSeedIfNeeded(app, rawData) {
  let { clips, categories, searchOnlyClips } = rawData;
  let seeded = false;
  const constants = app.syncFeature.constants;
  const version = constants.DEMO_SEED_VERSION;
  const stored = await chrome.storage.local.get(['pc_demo_seed_version']);
  const currentVersion = stored.pc_demo_seed_version;
  const needsSeed = currentVersion !== version;

  if (needsSeed) {
    const now = Date.now();
    const demoClips = constants.getDemoClips(now);
    const demoCategories = constants.getDemoCategories(now);
    const empty = clips.length === 0 && categories.length === 0;

    if (empty) {
      clips = demoClips;
      categories = demoCategories;
    } else {
      // Put marketing demos on page 0; keep real (non-demo_*) user clips after.
      clips = constants.mergeDemoClips(clips, demoClips);
      categories = constants.mergeDemoCategories(categories, demoCategories);
    }

    await chrome.storage.local.set({
      clips,
      categories,
      searchOnlyClips,
      pc_demo_seed_version: version,
      pc_local_updatedAt: Date.now()
    });
    seeded = true;
    if (typeof app !== 'undefined' && app) app.currentPage = 0;
    console.log(`🌱 Marketing demo seed v${version}: ${demoClips.length} clips on page 0 (${clips.length} total)`);
  }

  return { clips, categories, searchOnlyClips, seeded };
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
  let { clips, categories, searchOnlyClips, seeded } = rawData;
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
    normalizedChanged
  };
}

export async function syncNormalizedState(app, normalizedData) {
  const { clips, categories, searchOnlyClips, normalizedChanged } = normalizedData;

  app.clips = clips;
  app.categories = categories;
  app.searchOnlyClips = searchOnlyClips;

  if (normalizedChanged) {
    await chrome.storage.local.set({
      clips: app.clips,
      searchOnlyClips: app.searchOnlyClips
    });
  }

  if (app._idbReady && app.idb) {
    await app.idb.syncEntityFromLocalStorage('clips', app.clips);
    await app.idb.syncEntityFromLocalStorage('categories', app.categories);
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
  if (seededData.seeded) {
    app.currentPage = 0;
  }
}

export async function loadData(app) {
  if (!isExtensionContextValid()) return;
  await loadStorageData(app);

  // Settings/profile are orchestrated by popup.init.js startup batches.
  // Avoid duplicate calls here so loadData remains focused on clip/category state.
  if (typeof app._initializeTieredStorage === 'function') {
    app._initializeTieredStorage().catch(e => {
      console.warn('Tiered storage initialization failed (will use local only):', e);
    });
  }
  if (typeof app._maybeMigrateTieredStorage === 'function') {
    app._maybeMigrateTieredStorage().catch(e => {
      console.warn('Tiered storage migration skipped:', e);
    });
  }
}
