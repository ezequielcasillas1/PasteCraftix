const indexedDbInitializationPromises = new WeakMap();
const tieredStorageInitializationPromises = new WeakMap();
const tieredStorageMigrationPromises = new WeakMap();

function getOrCreatePromise(cache, app, task) {
  if (!cache.has(app)) cache.set(app, task());
  return cache.get(app);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function initializeIndexedDb(app) {
  try {
    await app.idb.open();
    const seedData = await chrome.storage.local.get(['clips', 'categories', 'notes']);
    await app.idb.importIfNeededFromStorage({
      clips: asArray(seedData?.clips),
      categories: asArray(seedData?.categories),
      notes: asArray(seedData?.notes),
    });
    app._idbReady = true;
  } catch (error) {
    app._idbReady = false;
    console.warn('?? IndexedDB unavailable, falling back to chrome.storage.local:', error?.message || error);
  }
}

export function ensureIndexedDbReadyAndMigrate(app) {
  if (!app.idb || app._idbReady) return Promise.resolve();
  return getOrCreatePromise(
    indexedDbInitializationPromises,
    app,
    () => initializeIndexedDb(app),
  );
}

function canMirrorLocalState(app, changes) {
  return !!app._idbReady && !!app.idb && !!changes;
}

async function syncChangedEntity(app, changes, changeKey, storeName) {
  const change = changes[changeKey];
  if (!change) return;
  await app.idb.syncEntityFromLocalStorage(storeName, asArray(change.newValue));
}

export async function mirrorChangedLocalStateToIndexedDb(app, changes) {
  if (!canMirrorLocalState(app, changes)) return;
  try {
    await syncChangedEntity(app, changes, 'clips', 'clips');
    await syncChangedEntity(app, changes, 'categories', 'categories');
    await syncChangedEntity(app, changes, 'notes', 'notes');
  } catch (error) {
    console.warn('?? Failed mirroring local entities to IndexedDB:', error?.message || error);
  }
}

function isTieredStorageAvailable() {
  return typeof StorageMeter !== 'undefined' && typeof tieredStorageManager !== 'undefined';
}

function setLocalTieredCounts(app) {
  app.totalClipsCount = app.clips.length;
  app.totalArchivedCount = app.searchOnlyClips.length;
}

async function initializeTieredStores(app) {
  app.tieredClipsStore = tieredStorageManager.getStore('clips', {
    pageSize: app.clipsPerPage,
    localStorageKey: 'clips',
    supabaseTable: 'clips',
    timestampField: 'timestamp'
  });
  await app.tieredClipsStore.initialize();
  app.tieredClipsStore.localCount = app.clips.length;

  app.tieredArchivedStore = tieredStorageManager.getStore('archived', {
    pageSize: 20,
    localStorageKey: 'searchOnlyClips',
    supabaseTable: 'archived_clips',
    timestampField: 'timestamp'
  });
  await app.tieredArchivedStore.initialize();
  app.tieredArchivedStore.localCount = app.searchOnlyClips.length;
}

function canLoadRemoteCounts() {
  return typeof pasteCraftSupabase !== 'undefined'
    && !!pasteCraftSupabase.isAuthenticated?.();
}

async function loadRemoteTieredCounts(app) {
  const [clipsResult, archivedResult] = await Promise.allSettled([
    pasteCraftSupabase.getClipsCount(),
    pasteCraftSupabase.getArchivedClipsCount()
  ]);
  const clipsCount = clipsResult.status === 'fulfilled' ? clipsResult.value : 0;
  const archivedCount = archivedResult.status === 'fulfilled' ? archivedResult.value : 0;
  app.totalClipsCount = Math.max(clipsCount, app.clips.length);
  app.totalArchivedCount = Math.max(archivedCount, app.searchOnlyClips.length);
  app.tieredClipsStore.totalCount = app.totalClipsCount;
  app.tieredArchivedStore.totalCount = app.totalArchivedCount;
  return clipsResult.status === 'fulfilled' && archivedResult.status === 'fulfilled';
}

function finalizeCoreCloudHydration(app, outcome) {
  app.syncFeature?.loader?.finalizeCoreCloudHydration?.(app, outcome);
}

async function runTieredStorageInitialization(app) {
  if (!isTieredStorageAvailable()) return;
  try {
    await initializeTieredStores(app);
    if (canLoadRemoteCounts()) {
      const resolved = await loadRemoteTieredCounts(app);
      finalizeCoreCloudHydration(app, resolved ? 'ready' : 'failed');
    } else {
      setLocalTieredCounts(app);
      if (app._isFreemiumGuest) finalizeCoreCloudHydration(app, 'ready');
    }
    app.updateHeaderClipCount?.();
  } catch (error) {
    console.warn('Failed to initialize tiered storage:', error);
    setLocalTieredCounts(app);
    finalizeCoreCloudHydration(app, 'failed');
    app.updateHeaderClipCount?.();
  }
}

export function initializeTieredStorage(app) {
  return getOrCreatePromise(
    tieredStorageInitializationPromises,
    app,
    () => runTieredStorageInitialization(app),
  );
}

async function hasCompletedTieredMigration() {
  const { pc_tiered_storage_migrated_v1 } = await chrome.storage.local.get(['pc_tiered_storage_migrated_v1']);
  return !!pc_tiered_storage_migrated_v1;
}

function canMigrateTieredStorage() {
  return typeof pasteCraftSupabase !== 'undefined'
    && !!pasteCraftSupabase.isAuthenticated?.();
}

function markTieredMigrationComplete() {
  return chrome.storage.local.set({ pc_tiered_storage_migrated_v1: Date.now() });
}

async function syncMigratedClipsToIndexedDb(app) {
  if (app._idbReady && app.idb) {
    await app.idb.syncEntityFromLocalStorage('clips', app.clips);
  }
}

async function migrateExcessClips(app, budget) {
  if (app.clips.length <= budget) return 0;
  try {
    const excess = app.clips.slice(budget);
    await pasteCraftSupabase.syncClipsToSupabase(excess);
    app.clips = app.clips.slice(0, budget);
    await chrome.storage.local.set({ clips: app.clips });
    await syncMigratedClipsToIndexedDb(app);
    return excess.length;
  } catch (error) {
    console.warn('Failed to migrate clips:', error);
    return 0;
  }
}

async function migrateExcessNotes(app, budget) {
  if (app.notes.length <= budget) return 0;
  try {
    const excess = app.notes.slice(budget);
    await pasteCraftSupabase.syncNotesToSupabase(excess);
    app.notes = app.notes.slice(0, budget);
    await app.saveNotes();
    return excess.length;
  } catch (error) {
    console.warn('Failed to migrate notes:', error);
    return 0;
  }
}

async function migrateExcessArchivedClips(app, budget) {
  if (app.searchOnlyClips.length <= budget) return 0;
  try {
    const excess = app.searchOnlyClips.slice(budget);
    await pasteCraftSupabase.syncArchivedClipsToSupabase(excess);
    app.searchOnlyClips = app.searchOnlyClips.slice(0, budget);
    await chrome.storage.local.set({ searchOnlyClips: app.searchOnlyClips });
    return excess.length;
  } catch (error) {
    console.warn('Failed to migrate archived clips:', error);
    return 0;
  }
}

async function migrateOverBudgetData(app, budgets) {
  const clips = await migrateExcessClips(app, budgets.clips);
  const notes = await migrateExcessNotes(app, budgets.notes);
  const archived = await migrateExcessArchivedClips(app, budgets.archived);
  return { clips, notes, archived };
}

function applyMigratedCounts(app, migrated) {
  const totalMigrated = migrated.clips + migrated.notes + migrated.archived;
  if (totalMigrated === 0) return;
  app.totalClipsCount = app.clips.length + migrated.clips;
  app.totalNotesCount = app.notes.length + migrated.notes;
  app.totalArchivedCount = app.searchOnlyClips.length + migrated.archived;
  app.renderChips();
}

async function runTieredStorageMigration(app) {
  if (typeof StorageMeter === 'undefined') return;
  if (await hasCompletedTieredMigration()) return;
  if (!canMigrateTieredStorage()) return;

  try {
    const report = await StorageMeter.getStorageReport();
    if (report.total.percentage < 0.7) {
      await markTieredMigrationComplete();
      return;
    }
    const migrated = await migrateOverBudgetData(app, report.budgets);
    await markTieredMigrationComplete();
    applyMigratedCounts(app, migrated);
  } catch (error) {
    console.error('Tiered storage migration failed:', error);
  }
}

export function maybeMigrateTieredStorage(app) {
  return getOrCreatePromise(
    tieredStorageMigrationPromises,
    app,
    () => runTieredStorageMigration(app),
  );
}
