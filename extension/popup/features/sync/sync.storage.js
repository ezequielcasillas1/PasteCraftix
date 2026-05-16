export async function ensureIndexedDbReadyAndMigrate(app) {
  if (!app.idb || app._idbReady) return;
  try {
    // Add a 5 second timeout so IDB issues don't block the entire popup
    const openWithTimeout = Promise.race([
      app.idb.open(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB open timeout')), 5000))
    ]);
    await openWithTimeout;
    
    const seedData = await chrome.storage.local.get(['clips', 'categories', 'notes']);
    await app.idb.importIfNeededFromStorage({
      clips: Array.isArray(seedData?.clips) ? seedData.clips : [],
      categories: Array.isArray(seedData?.categories) ? seedData.categories : [],
      notes: Array.isArray(seedData?.notes) ? seedData.notes : []
    });
    app._idbReady = true;
  } catch (error) {
    app._idbReady = false;
    console.warn('[PasteCraft] IndexedDB unavailable, falling back to chrome.storage.local:', error?.message || error);
  }
}

export async function mirrorChangedLocalStateToIndexedDb(app, changes) {
  if (!app._idbReady || !app.idb || !changes) return;
  try {
    if (changes.clips) {
      await app.idb.syncEntityFromLocalStorage('clips', Array.isArray(changes.clips.newValue) ? changes.clips.newValue : []);
    }
    if (changes.categories) {
      await app.idb.syncEntityFromLocalStorage('categories', Array.isArray(changes.categories.newValue) ? changes.categories.newValue : []);
    }
    if (changes.notes) {
      await app.idb.syncEntityFromLocalStorage('notes', Array.isArray(changes.notes.newValue) ? changes.notes.newValue : []);
    }
  } catch (error) {
      console.warn('[PasteCraft] Failed mirroring local entities to IndexedDB:', error?.message || error);
  }
}

export async function initializeTieredStorage(app) {
  // Only initialize if StorageMeter and TieredStorage are available
  if (typeof StorageMeter === 'undefined' || typeof tieredStorageManager === 'undefined') {
    return;
  }

  try {
    // Initialize clips tiered storage
    app.tieredClipsStore = tieredStorageManager.getStore('clips', {
      pageSize: app.clipsPerPage,
      localStorageKey: 'clips',
      supabaseTable: 'clips',
      timestampField: 'timestamp'
    });
    await app.tieredClipsStore.initialize();
    app.tieredClipsStore.localCount = app.clips.length;

    // Initialize archived clips tiered storage
    app.tieredArchivedStore = tieredStorageManager.getStore('archived', {
      pageSize: 20,
      localStorageKey: 'searchOnlyClips',
      supabaseTable: 'archived_clips',
      timestampField: 'timestamp'
    });
    await app.tieredArchivedStore.initialize();
    app.tieredArchivedStore.localCount = app.searchOnlyClips.length;

    // Get remote counts if authenticated (for accurate pagination)
    if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
      const [clipsCount, archivedCount] = await Promise.all([
        pasteCraftSupabase.getClipsCount().catch(() => 0),
        pasteCraftSupabase.getArchivedClipsCount().catch(() => 0)
      ]);
      
      app.totalClipsCount = Math.max(clipsCount, app.clips.length);
      app.totalArchivedCount = Math.max(archivedCount, app.searchOnlyClips.length);
      
      app.tieredClipsStore.totalCount = app.totalClipsCount;
      app.tieredArchivedStore.totalCount = app.totalArchivedCount;
      
      console.log(`[PasteCraft] Tiered storage initialized: ${app.clips.length} local clips, ${app.totalClipsCount} total`);
    } else {
      // No Supabase - use local counts
      app.totalClipsCount = app.clips.length;
      app.totalArchivedCount = app.searchOnlyClips.length;
    }
  } catch (e) {
    console.warn('Failed to initialize tiered storage:', e);
    app.totalClipsCount = app.clips.length;
    app.totalArchivedCount = app.searchOnlyClips.length;
  }
}

export async function maybeMigrateTieredStorage(app) {
  // Check if StorageMeter is available
  if (typeof StorageMeter === 'undefined') {
    return;
  }

  // Check if already migrated
  const { pc_tiered_storage_migrated_v1 } = await chrome.storage.local.get(['pc_tiered_storage_migrated_v1']);
  if (pc_tiered_storage_migrated_v1) {
    return;
  }

  // Check if user is authenticated (needed to push to cloud)
  if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase.isAuthenticated?.()) {
    return;
  }

  try {
    // Get storage report
    const report = await StorageMeter.getStorageReport();
    
    // Only migrate if storage is at 70%+ capacity
    if (report.total.percentage < 0.7) {
      // Mark as migrated (no migration needed)
      await chrome.storage.local.set({ pc_tiered_storage_migrated_v1: Date.now() });
      return;
    }

    console.log('[PasteCraft] Starting tiered storage migration...');
    console.log(`[PasteCraft] Current storage: ${StorageMeter.formatBytes(report.total.used)} / ${StorageMeter.formatBytes(report.total.quota)} (${Math.round(report.total.percentage * 100)}%)`);

    // Calculate budgets
    const budgets = report.budgets;
    let migrated = { clips: 0, notes: 0, archived: 0 };

    // Migrate clips if over budget
    if (app.clips.length > budgets.clips) {
      const excessClips = app.clips.slice(budgets.clips);
      console.log(`[PasteCraft] Migrating ${excessClips.length} excess clips to cloud...`);
      
      // Push excess to Supabase
      try {
        await pasteCraftSupabase.syncClipsToSupabase(excessClips);
        migrated.clips = excessClips.length;
        
        // Keep only budget amount locally
        app.clips = app.clips.slice(0, budgets.clips);
        await chrome.storage.local.set({ clips: app.clips });
        if (app._idbReady && app.idb) {
          await app.idb.syncEntityFromLocalStorage('clips', app.clips);
        }
      } catch (e) {
        console.warn('Failed to migrate clips:', e);
      }
    }

    // Migrate notes if over budget
    if (app.notes.length > budgets.notes) {
      const excessNotes = app.notes.slice(budgets.notes);
      console.log(`[PasteCraft] Migrating ${excessNotes.length} excess notes to cloud...`);
      
      try {
        await pasteCraftSupabase.syncNotesToSupabase(excessNotes);
        migrated.notes = excessNotes.length;
        
        // Keep only budget amount locally
        app.notes = app.notes.slice(0, budgets.notes);
        await app.saveNotes();
      } catch (e) {
        console.warn('Failed to migrate notes:', e);
      }
    }

    // Migrate archived clips if over budget
    if (app.searchOnlyClips.length > budgets.archived) {
      const excessArchived = app.searchOnlyClips.slice(budgets.archived);
      console.log(`[PasteCraft] Migrating ${excessArchived.length} excess archived clips to cloud...`);
      
      try {
        await pasteCraftSupabase.syncArchivedClipsToSupabase(excessArchived);
        migrated.archived = excessArchived.length;
        
        // Keep only budget amount locally
        app.searchOnlyClips = app.searchOnlyClips.slice(0, budgets.archived);
        await chrome.storage.local.set({ searchOnlyClips: app.searchOnlyClips });
      } catch (e) {
        console.warn('Failed to migrate archived clips:', e);
      }
    }

    // Mark migration as complete
    await chrome.storage.local.set({ pc_tiered_storage_migrated_v1: Date.now() });

    // Log results
    const totalMigrated = migrated.clips + migrated.notes + migrated.archived;
    if (totalMigrated > 0) {
      console.log(`? Tiered storage migration complete: ${migrated.clips} clips, ${migrated.notes} notes, ${migrated.archived} archived`);
      
      // Update total counts
      app.totalClipsCount = app.clips.length + migrated.clips;
      app.totalNotesCount = app.notes.length + migrated.notes;
      app.totalArchivedCount = app.searchOnlyClips.length + migrated.archived;
      
      // Re-render to show updated pagination
      app.renderChips();
    } else {
      console.log('? Tiered storage migration complete (no migration needed)');
    }

  } catch (e) {
    console.error('Tiered storage migration failed:', e);
  }
}
