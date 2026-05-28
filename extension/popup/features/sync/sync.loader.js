function isExtensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

// All chrome.storage.local keys that hold per-user data. Used to isolate
// accounts: when the signed-in user changes, the outgoing account's data is
// archived under its own key and the incoming account's data is restored, so
// no account ever inherits (or loses) another account's locally cached data.
export const USER_DATA_LOCAL_KEYS = [
  'clips',
  'categories',
  'searchOnlyClips',
  'notes',
  'settings',
  'userProfile',
  'pc_aiHistory_v1',
  'pc_deleted_clips',
  'pc_deleted_archived_clips',
  'pc_deleted_categories',
  'pc_deleted_notes',
  'pc_deleted_category_files',
  'pc_deleted_file_categories',
  'pc_local_updatedAt',
];

const LOCAL_DATA_OWNER_KEY = 'pc_local_data_owner';
const ACCOUNT_CACHE_PREFIX = 'pc_account_cache__';

async function clearIdbUserStores() {
  try {
    const idb = (typeof window !== 'undefined') ? window.pasteCraftIndexedDB : null;
    if (idb && typeof idb.syncEntityFromLocalStorage === 'function') {
      await idb.syncEntityFromLocalStorage('clips', []);
      await idb.syncEntityFromLocalStorage('categories', []);
      await idb.syncEntityFromLocalStorage('notes', []);
    }
  } catch (_) {}
}

async function rebuildIdbFromData(data) {
  try {
    const idb = (typeof window !== 'undefined') ? window.pasteCraftIndexedDB : null;
    if (idb && typeof idb.syncEntityFromLocalStorage === 'function') {
      await idb.syncEntityFromLocalStorage('clips', Array.isArray(data?.clips) ? data.clips : []);
      await idb.syncEntityFromLocalStorage('categories', Array.isArray(data?.categories) ? data.categories : []);
      await idb.syncEntityFromLocalStorage('notes', Array.isArray(data?.notes) ? data.notes : []);
    }
  } catch (_) {}
}

export async function clearLocalUserData(app) {
  try { await chrome.storage.local.remove(USER_DATA_LOCAL_KEYS); } catch (_) {}
  await clearIdbUserStores();
  if (app) {
    app.clips = [];
    app.categories = [];
    app.searchOnlyClips = [];
  }
}

async function readLocalDataOwner() {
  try {
    const res = await chrome.storage.local.get([LOCAL_DATA_OWNER_KEY]);
    return res && res[LOCAL_DATA_OWNER_KEY] ? String(res[LOCAL_DATA_OWNER_KEY]) : null;
  } catch (_) {
    return null;
  }
}

async function writeLocalDataOwner(userId) {
  try { await chrome.storage.local.set({ [LOCAL_DATA_OWNER_KEY]: String(userId) }); } catch (_) {}
}

async function snapshotActiveUserData() {
  try {
    const res = await chrome.storage.local.get(USER_DATA_LOCAL_KEYS);
    const snapshot = {};
    for (const key of USER_DATA_LOCAL_KEYS) {
      if (res[key] !== undefined) snapshot[key] = res[key];
    }
    return snapshot;
  } catch (_) {
    return {};
  }
}

async function archiveUserDataFor(ownerId) {
  if (!ownerId) return;
  const snapshot = await snapshotActiveUserData();
  if (!snapshot || Object.keys(snapshot).length === 0) return;
  try {
    await chrome.storage.local.set({
      [ACCOUNT_CACHE_PREFIX + ownerId]: { savedAt: Date.now(), data: snapshot },
    });
  } catch (_) {}
}

async function restoreUserDataFor(userId) {
  if (!userId) return false;
  try {
    const key = ACCOUNT_CACHE_PREFIX + userId;
    const res = await chrome.storage.local.get([key]);
    const backup = res?.[key]?.data;
    if (backup && typeof backup === 'object') {
      await chrome.storage.local.set(backup);
      await rebuildIdbFromData(backup);
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Non-destructively switch the active local cache from one account to another:
 * archive the outgoing account's data under its own key, clear the active
 * caches, then restore the incoming account's previously archived data (if any).
 * No data is ever deleted — only moved into a per-user namespace.
 */
async function switchActiveAccount(app, previousOwner, newUserId) {
  await archiveUserDataFor(previousOwner);
  await clearLocalUserData(app);
  const restored = await restoreUserDataFor(newUserId);
  await writeLocalDataOwner(newUserId);
  // #region agent log
  try {
    const _p={sessionId:'1e733c',hypothesisId:'A,B',location:'sync.loader.js:switchActiveAccount',message:'account switch isolated local cache',data:{previousOwner,newUserId:String(newUserId),restoredFromBackup:restored},timestamp:Date.now()};
    console.warn('[PC-DEBUG-1e733c]',JSON.stringify(_p));
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e733c'},body:JSON.stringify(_p)}).catch(()=>{});
  } catch (_) {}
  // #endregion
  return { switched: true, restored };
}

/**
 * Called at every successful authentication (account boundary). When the
 * signed-in user differs from the cached owner, the previous account's local
 * data is archived and the new account's data is restored. Same-account
 * re-login is a no-op (no data movement, no loss).
 */
export async function stampLocalDataOwner(app, userId) {
  if (!userId) return { switched: false };
  const owner = await readLocalDataOwner();
  if (owner && owner !== String(userId)) {
    return switchActiveAccount(app, owner, String(userId));
  }
  await writeLocalDataOwner(userId);
  return { switched: false };
}

/**
 * Boot catch-all (e.g. OAuth/session restore that did not pass through the
 * sign-in handler). Only acts when a DIFFERENT owner is already recorded.
 * Never archives/stamps when the owner is absent (avoids mislabeling data).
 */
export async function enforceLocalDataOwnerOnBoot(app, userId) {
  if (!userId) return { switched: false };
  const owner = await readLocalDataOwner();
  if (owner && owner !== String(userId)) {
    return switchActiveAccount(app, owner, String(userId));
  }
  return { switched: false };
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

  // #region agent log
  const _chromeClipCount = Array.isArray(clips) ? clips.length : 0;
  let _idbClipCount = 0;
  let _idbShadowed = false;
  // #endregion

  if (app._idbReady && app.idb) {
    const [idbClips, idbCategories] = await Promise.all([
      app.idb.getAllPayloads('clips'),
      app.idb.getAllPayloads('categories')
    ]);
    if (Array.isArray(idbClips) && idbClips.length > 0) clips = idbClips;
    if (Array.isArray(idbCategories) && idbCategories.length > 0) categories = idbCategories;
    // #region agent log
    _idbClipCount = Array.isArray(idbClips) ? idbClips.length : 0;
    _idbShadowed = _idbClipCount > 0;
    // #endregion
  }

  // #region agent log
  try {
    const _firstClip = Array.isArray(clips) && clips[0] ? { id: clips[0].id ?? clips[0].clip_id ?? null, ts: clips[0].timestamp ?? null, title: clips[0].title ?? null } : null;
    const _p={sessionId:'1e733c',hypothesisId:'A,B',location:'sync.loader.js:18',message:'fetchRawData clip sources',data:{chromeClipCount:_chromeClipCount,idbClipCount:_idbClipCount,idbShadowedChrome:_idbShadowed,finalClipCount:Array.isArray(clips)?clips.length:0,currentUser:app?.currentUser?.id||null,firstClip:_firstClip},timestamp:Date.now()};
    console.warn('[PC-DEBUG-1e733c]',JSON.stringify(_p));
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e733c'},body:JSON.stringify(_p)}).catch(()=>{});
  } catch (_) {}
  // #endregion

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

  const expiresAt = clip.expiresAt ?? clip.expires_at;
  if (Number.isFinite(expiresAt)) normalized.expiresAt = Number(expiresAt);

  const expirePreset = clip.expirePreset ?? clip.expire_preset;
  if (expirePreset) normalized.expirePreset = expirePreset;
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
