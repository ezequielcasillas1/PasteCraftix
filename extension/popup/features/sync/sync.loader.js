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
    if (Array.isArray(idbClips) && idbClips.length > 0) { clips = idbClips; cameFromIdb = true; }
    if (Array.isArray(idbCategories) && idbCategories.length > 0) categories = idbCategories;
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
    seeded
  };
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

  // Avoid the expensive full IDB wipe+rewrite when the data already came from
  // IDB and wasn't reshaped. Only sync to IDB when something materially changed:
  //   - normalization rewrote shapes, OR
  //   - we just seeded demo data, OR
  //   - the load came from chrome.storage.local (IDB had nothing) and we need to backfill.
  const needsIdbSync = !!(normalizedChanged || seeded || !cameFromIdb);
  if (app._idbReady && app.idb && needsIdbSync) {
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

  // NOTE: loadSettings + loadUserProfile are intentionally NOT awaited here.
  // The popup init pipeline already runs them in parallel inside its Promise.all,
  // so calling them again here doubled the work and contended with chrome.storage.
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
