function isExtensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

export function maxIdbRecordUpdatedAtMs(records) {
  if (!Array.isArray(records) || records.length === 0) return 0;
  let max = 0;
  for (const record of records) {
    const parsed = Date.parse(record?.updated_at || '');
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return max;
}

export function pickPayloadsFromIdbRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => record?.payload).filter(Boolean);
}

/**
 * Prefer chrome.storage when it was written at/after the newest IndexedDB row
 * (restore, backup import, CRUD). When chrome is older, only fall back to IDB
 * if it clearly has more rows (recovery), never when chrome is fresher.
 */
export function shouldPreferChromeStorageOverIdb(chromeUpdatedAtMs, idbRecords, chromeItemCount = 0) {
  const chromeTs = Number.isFinite(chromeUpdatedAtMs) ? chromeUpdatedAtMs : 0;
  const idbCount = Array.isArray(idbRecords) ? idbRecords.length : 0;
  if (idbCount === 0) return true;

  const idbMax = maxIdbRecordUpdatedAtMs(idbRecords);
  if (chromeTs >= idbMax) return true;

  const chromeCount = Number.isFinite(chromeItemCount) ? chromeItemCount : 0;
  return chromeCount >= idbCount;
}

export async function ensureStorageReady(app) {
  if (!isExtensionContextValid()) return;
  await app._ensureIndexedDbReadyAndMigrate();
}

export async function fetchRawData(app) {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }
  const result = await chrome.storage.local.get([
    'clips',
    'categories',
    'searchOnlyClips',
    'pc_local_updatedAt',
  ]);
  let { clips = [], categories = [], searchOnlyClips = [] } = result;
  const chromeUpdatedAt = Number.isFinite(result.pc_local_updatedAt) ? result.pc_local_updatedAt : 0;

  if (app._idbReady && app.idb) {
    const [idbClipRecords, idbCategoryRecords] = await Promise.all([
      app.idb.getAllRecords('clips'),
      app.idb.getAllRecords('categories'),
    ]);

    if (!shouldPreferChromeStorageOverIdb(chromeUpdatedAt, idbClipRecords, clips.length)) {
      clips = pickPayloadsFromIdbRecords(idbClipRecords);
    }
    if (!shouldPreferChromeStorageOverIdb(chromeUpdatedAt, idbCategoryRecords, categories.length)) {
      categories = pickPayloadsFromIdbRecords(idbCategoryRecords);
    }
  }
  return { clips, categories, searchOnlyClips };
}

export async function injectDemoSeedIfNeeded(app, rawData) {
  let { clips, categories, searchOnlyClips } = rawData;
  let seeded = false;

  if (clips.length === 0 && categories.length === 0) {
    const now = Date.now();
    categories = app.syncFeature.constants.getDemoCategories(now);
    clips = app.syncFeature.constants.getDemoClips(now);
    await chrome.storage.local.set({ clips, categories, searchOnlyClips });
    seeded = true;
    console.log('🌱 Seeded 8 preset categories + 8 example clips (PC 1.0)');
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
}

export async function loadData(app) {
  if (!isExtensionContextValid()) return;
  await loadStorageData(app);
  
  if (typeof app.loadSettings === 'function') {
    await app.loadSettings();
  }
  if (typeof app.loadUserProfile === 'function') {
    await app.loadUserProfile();
  }
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
