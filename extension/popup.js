// PasteCraft Advanced Popup Script
// (startup logging removed)

const PASTECRAFT_LOGS_ENABLED = (() => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.PASTECRAFT_DEBUG === true) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {
    // Ignore storage access errors.
  }
  return false;
})();

if (!PASTECRAFT_LOGS_ENABLED && typeof console !== 'undefined') {
  const pastecraftNoop = () => {};
  console.log = pastecraftNoop;
  console.debug = pastecraftNoop;
  console.info = pastecraftNoop;
}

/**
 * =====================================================
 * CRUD UTILITY CLASS - 5 Best Practices Implementation
 * =====================================================
 * 
 * Provides reliable CRUD operations with:
 * 1. Validation - Verify inputs and state before operations
 * 2. Transaction-like State Snapshot - Save state for rollback
 * 3. Retry Logic - Retry failed operations with exponential backoff
 * 4. Idempotency - Safe to retry operations
 * 5. Verification - Verify operations succeeded before proceeding
 */
class PasteCraftCRUD {
  /**
   * Retry operation with exponential backoff
   */
  static async retryOperation(operation, maxRetries = 3, baseDelay = 100) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create state snapshot for rollback
   */
  static createSnapshot(data) {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Restore state from snapshot
   */
  static restoreSnapshot(target, snapshot) {
    Object.keys(snapshot).forEach(key => {
      target[key] = snapshot[key];
    });
  }

  /**
   * Generic CRUD DELETE operation with all 5 best practices
   */
  static async deleteOperation({
    // Entity identification
    entityId,
    entityName,
    entityType, // 'clip', 'category', 'note', 'setting', etc.
    
    // State management
    stateGetter, // () => ({ items: [], ... })
    stateSetter, // (newState) => Promise<void>
    stateKeys, // ['clips', 'categories'] - keys to snapshot
    
    // Validation
    validator, // (entity, state) => { valid: boolean, error?: string }
    idempotencyCheck, // (entityId, newState) => boolean - returns true if already deleted
    
    // Storage operations
    storageKeys, // ['clips', 'searchOnlyClips'] - keys to write to storage
    storageWriter, // (data) => Promise<void> - custom storage writer
    
    // Deletion logic
    deleteFromArray, // (items, entityId) => items - filter function
    updateRelatedEntities, // (state, entity) => state - update related data
    
    // Atomic secondary-store hard-delete (optional).
    // When provided, runs in the SAME step as storageWriter so IndexedDB
    // can never shadow chrome.storage on the next loadData().
    idbStoreName, // e.g. 'categories' | 'clips' | 'notes'
    idbExtraIds, // optional extra ids to hard-delete from IDB
    
    // Local tombstone bookkeeping (optional).
    // When provided, the tombstone is written BEFORE the background sync
    // so the mergeX helpers honor it even if a realtime echo races.
    tombstoneStorageKey, // e.g. 'pc_deleted_categories'
    
    // Verification
    verifier, // (entityId, storedData) => boolean - verify deletion persisted
    
    // UI updates
    uiUpdater, // () => void - update UI after successful deletion
    
    // Background sync (optional, non-blocking)
    backgroundSync, // (entity, deletedAt) => Promise<void>
    
    // User feedback
    successMessage, // string or (entity) => string
    errorMessage, // string or (error) => string
    showToast // (message, type) => void
  }) {
    // PRACTICE #1: VALIDATION
    if (!entityId) {
      const msg = errorMessage?.('Invalid entity ID') || 'Invalid entity - cannot delete';
      showToast?.(msg, 'error');
      return { success: false, error: 'Invalid entity ID' };
    }

    const currentState = stateGetter();
    if (!currentState || typeof currentState !== 'object') {
      const msg = errorMessage?.('Invalid state') || 'Invalid state - cannot delete';
      showToast?.(msg, 'error');
      return { success: false, error: 'Invalid state' };
    }

    // Custom validation
    if (validator) {
      const validation = validator({ id: entityId, name: entityName }, currentState);
      if (!validation.valid) {
        showToast?.(validation.error || 'Validation failed', 'error');
        return { success: false, error: validation.error || 'Validation failed' };
      }
    }

    // Idempotency check - already deleted?
    if (idempotencyCheck) {
      const alreadyDeleted = idempotencyCheck(entityId, currentState);
      if (alreadyDeleted) {
        const msg = successMessage?.({ id: entityId, name: entityName }) || 'Already deleted';
        showToast?.(msg, 'success');
        return { success: true, skipped: true };
      }
    }

    // PRACTICE #2: TRANSACTION-LIKE STATE SNAPSHOT
    const snapshot = {};
    stateKeys.forEach(key => {
      if (currentState[key] !== undefined) {
        snapshot[key] = PasteCraftCRUD.createSnapshot(currentState[key]);
      }
    });

    const rollback = async () => {
      try {
        PasteCraftCRUD.restoreSnapshot(currentState, snapshot);
        await stateSetter(currentState);
        if (storageWriter) {
          await PasteCraftCRUD.retryOperation(async () => {
            const storageData = {};
            storageKeys.forEach(key => {
              if (currentState[key] !== undefined) {
                storageData[key] = currentState[key];
              }
            });
            await storageWriter(storageData);
          });
        }
        uiUpdater?.();
      } catch (rollbackError) {
        console.error(`❌ Rollback failed for ${entityType}:`, rollbackError);
      }
    };

    try {
      const deletedAt = Date.now();
      const entity = { id: entityId, name: entityName, deletedAt };

      // Step 1: Update related entities (e.g., move clips to Uncategorized)
      if (updateRelatedEntities) {
        updateRelatedEntities(currentState, entity);
      }

      // Step 2: Remove from array
      if (deleteFromArray) {
        stateKeys.forEach(key => {
          if (Array.isArray(currentState[key])) {
            currentState[key] = deleteFromArray(currentState[key], entityId);
          }
        });
      }

      // PRACTICE #4: IDEMPOTENCY CHECK - Verify entity was removed
      const stillExists = stateKeys.some(key => {
        if (Array.isArray(currentState[key])) {
          return currentState[key].some(item => item.id === entityId);
        }
        return false;
      });
      if (stillExists) {
        throw new Error(`${entityType} still exists after deletion operation`);
      }

      // Step 3: Update in-memory state
      await stateSetter(currentState);

      // Step 3b: OPTIMISTIC UI - render the removal immediately so the
      // user sees the item disappear without waiting on storage/IDB/verifier.
      // If any downstream write fails, `rollback()` restores state and re-renders.
      try { uiUpdater?.(); } catch (uiErr) { console.error(`⚠️ uiUpdater threw (${entityType} delete, optimistic):`, uiErr); }

      // Step 4: Persist to storage with retry
      if (storageWriter) {
        await PasteCraftCRUD.retryOperation(async () => {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          storageData.pc_local_updatedAt = Date.now();
          await storageWriter(storageData);
        });
      }

      // Step 4b: ATOMIC SECONDARY-STORE HARD DELETE
      // Without this, IndexedDB can still contain the row and overwrite
      // chrome.storage on the next loadData() (see popup.js loadData IDB merge).
      if (idbStoreName && typeof window !== 'undefined' && window.pasteCraftIndexedDB) {
        try {
          const ids = [String(entityId), ...(Array.isArray(idbExtraIds) ? idbExtraIds.map(String) : [])];
          await window.pasteCraftIndexedDB.deleteByIds(idbStoreName, ids);
        } catch (idbErr) {
          console.warn(`⚠️ IDB hard-delete failed for ${entityType} (chrome.storage delete succeeded):`, idbErr?.message || idbErr);
        }
      }

      // Step 4c: RECORD LOCAL TOMBSTONE BEFORE BACKGROUND SYNC
      // Ensures mergeX helpers honor the delete even if a realtime echo races.
      if (tombstoneStorageKey) {
        try {
          const existing = await new Promise((resolve) => {
            chrome.storage.local.get([tombstoneStorageKey], (res) => resolve(res || {}));
          });
          const prev = Array.isArray(existing[tombstoneStorageKey]) ? existing[tombstoneStorageKey] : [];
          const already = prev.some((t) => t && String(t.id) === String(entityId));
          if (!already) {
            const tombstone = { id: entityId, name: entityName, deletedAt, updatedAt: deletedAt };
            await new Promise((resolve) => {
              chrome.storage.local.set({ [tombstoneStorageKey]: [...prev, tombstone] }, resolve);
            });
          }
        } catch (tombErr) {
          console.warn(`⚠️ Tombstone write failed for ${entityType}:`, tombErr?.message || tombErr);
        }
      }

      const msg = successMessage?.({ id: entityId, name: entityName }) || `${entityType} deleted`;
      showToast?.(msg, 'success');

      // PRACTICE #5: VERIFICATION - diagnostic only, off the critical path.
      // chrome.storage + IDB writes above already acknowledged; re-reading
      // storage just to block the UI was the main lag source, so we now
      // only log mismatches instead of throwing.
      if (verifier) {
        Promise.resolve()
          .then(() => verifier(entityId))
          .then((ok) => {
            if (!ok) console.warn(`⚠️ Post-write verification still sees ${entityType}:`, entityId);
          })
          .catch((verErr) => console.warn(`⚠️ Verifier threw (${entityType} delete):`, verErr));
      }

      // Background sync (non-blocking)
      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(entity, deletedAt))
          .catch((error) => {
            console.error(`⚠️ Background sync failed for ${entityType} (local deletion succeeded):`, error);
          });
      }

      return { success: true, entity };
    } catch (error) {
      // Rollback on any failure
      console.error(`❌ ${entityType} deletion failed, rolling back:`, error);
      await rollback();
      const msg = errorMessage?.(error) || `Failed to delete ${entityType}: ${error.message || 'Unknown error'}`;
      showToast?.(msg, 'error');
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generic CRUD CREATE operation with all 5 best practices
   */
  static async createOperation({
    entity,
    stateGetter,
    stateSetter,
    stateKeys,
    validator,
    duplicateCheck, // (entity, state) => boolean - returns true if duplicate exists
    storageKeys,
    storageWriter,
    addToArray, // (items, entity) => items - add function
    verifier, // (entity, storedData) => boolean
    uiUpdater,
    backgroundSync,
    successMessage,
    errorMessage,
    showToast
  }) {
    // PRACTICE #1: VALIDATION
    if (!entity || !entity.id) {
      const msg = errorMessage?.('Invalid entity') || 'Invalid entity - cannot create';
      showToast?.(msg, 'error');
      return { success: false, error: 'Invalid entity' };
    }

    const currentState = stateGetter();
    if (!currentState || typeof currentState !== 'object') {
      const msg = errorMessage?.('Invalid state') || 'Invalid state - cannot create';
      showToast?.(msg, 'error');
      return { success: false, error: 'Invalid state' };
    }

    if (validator) {
      const validation = validator(entity, currentState);
      if (!validation.valid) {
        showToast?.(validation.error || 'Validation failed', 'error');
        return { success: false, error: validation.error || 'Validation failed' };
      }
    }

    // Duplicate check
    if (duplicateCheck && duplicateCheck(entity, currentState)) {
      const msg = errorMessage?.('Duplicate entity') || 'Entity already exists';
      showToast?.(msg, 'error');
      return { success: false, error: 'Duplicate entity' };
    }

    // PRACTICE #2: STATE SNAPSHOT
    const snapshot = {};
    stateKeys.forEach(key => {
      if (currentState[key] !== undefined) {
        snapshot[key] = PasteCraftCRUD.createSnapshot(currentState[key]);
      }
    });

    const rollback = async () => {
      try {
        PasteCraftCRUD.restoreSnapshot(currentState, snapshot);
        await stateSetter(currentState);
        if (storageWriter) {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          await storageWriter(storageData);
        }
        uiUpdater?.();
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    };

    try {
      // Step 1: Add to array
      if (addToArray) {
        stateKeys.forEach(key => {
          if (Array.isArray(currentState[key])) {
            currentState[key] = addToArray(currentState[key], entity);
          }
        });
      }

      // Step 2: Update in-memory state
      await stateSetter(currentState);

      // Step 3: OPTIMISTIC UI - paint the change immediately so the user
      // sees the new entity without waiting on chrome.storage or verifier I/O.
      try { uiUpdater?.(); } catch (uiErr) { console.error('⚠️ uiUpdater threw (create, optimistic):', uiErr); }

      // Step 4: Persist with retry (still awaited so rollback fires on real failure)
      if (storageWriter) {
        await PasteCraftCRUD.retryOperation(async () => {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          storageData.pc_local_updatedAt = Date.now();
          await storageWriter(storageData);
        });
      }

      const msg = successMessage?.(entity) || 'Entity created';
      showToast?.(msg, 'success');

      // Step 5: Verifier is diagnostic-only now (off the critical path).
      //   If it fails we just warn — we do NOT rollback a write that Chrome
      //   acknowledged. This removes the biggest source of perceived lag.
      if (verifier) {
        Promise.resolve()
          .then(() => verifier(entity))
          .then((ok) => {
            if (!ok) console.warn('⚠️ Post-write verification missed entity (create):', entity?.id);
          })
          .catch((verErr) => console.warn('⚠️ Verifier threw (create):', verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(entity))
          .catch((error) => {
            console.error('⚠️ Background sync failed (local creation succeeded):', error);
          });
      }

      return { success: true, entity };
    } catch (error) {
      await rollback();
      const msg = errorMessage?.(error) || `Failed to create: ${error.message || 'Unknown error'}`;
      showToast?.(msg, 'error');
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generic CRUD UPDATE operation with all 5 best practices
   */
  static async updateOperation({
    entityId,
    updates,
    stateGetter,
    stateSetter,
    stateKeys,
    validator,
    storageKeys,
    storageWriter,
    updateInArray, // (items, entityId, updates) => items
    verifier,
    uiUpdater,
    backgroundSync,
    successMessage,
    errorMessage,
    showToast
  }) {
    // PRACTICE #1: VALIDATION
    if (!entityId) {
      const msg = errorMessage?.('Invalid entity ID') || 'Invalid entity - cannot update';
      showToast?.(msg, 'error');
      return { success: false, error: 'Invalid entity ID' };
    }

    const currentState = stateGetter();
    const entity = stateKeys
      .map(key => Array.isArray(currentState[key]) ? currentState[key].find(item => item.id === entityId) : null)
      .find(item => item !== null);

    if (!entity) {
      const msg = errorMessage?.('Entity not found') || 'Entity not found';
      showToast?.(msg, 'error');
      return { success: false, error: 'Entity not found' };
    }

    if (validator) {
      const validation = validator({ ...entity, ...updates }, currentState);
      if (!validation.valid) {
        showToast?.(validation.error || 'Validation failed', 'error');
        return { success: false, error: validation.error || 'Validation failed' };
      }
    }

    // PRACTICE #2: STATE SNAPSHOT
    const snapshot = {};
    stateKeys.forEach(key => {
      if (currentState[key] !== undefined) {
        snapshot[key] = PasteCraftCRUD.createSnapshot(currentState[key]);
      }
    });

    const rollback = async () => {
      try {
        PasteCraftCRUD.restoreSnapshot(currentState, snapshot);
        await stateSetter(currentState);
        if (storageWriter) {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          await storageWriter(storageData);
        }
        uiUpdater?.();
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    };

    try {
      // Step 1: Update in array
      if (updateInArray) {
        stateKeys.forEach(key => {
          if (Array.isArray(currentState[key])) {
            currentState[key] = updateInArray(currentState[key], entityId, updates);
          }
        });
      }

      // Step 2: Update in-memory state
      await stateSetter(currentState);

      // Step 3: OPTIMISTIC UI - render the updated entity immediately.
      try { uiUpdater?.(); } catch (uiErr) { console.error('⚠️ uiUpdater threw (update, optimistic):', uiErr); }

      // Step 4: Persist with retry
      if (storageWriter) {
        await PasteCraftCRUD.retryOperation(async () => {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          storageData.pc_local_updatedAt = Date.now();
          await storageWriter(storageData);
        });
      }

      const msg = successMessage?.({ ...entity, ...updates }) || 'Entity updated';
      showToast?.(msg, 'success');

      // Step 5: Verifier is diagnostic-only now (off the critical path).
      if (verifier) {
        Promise.resolve()
          .then(() => verifier(entityId, updates))
          .then((ok) => {
            if (!ok) console.warn('⚠️ Post-write verification failed (update):', entityId);
          })
          .catch((verErr) => console.warn('⚠️ Verifier threw (update):', verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync({ ...entity, ...updates }))
          .catch((error) => {
            console.error('⚠️ Background sync failed (local update succeeded):', error);
          });
      }

      return { success: true, entity: { ...entity, ...updates } };
    } catch (error) {
      await rollback();
      const msg = errorMessage?.(error) || `Failed to update: ${error.message || 'Unknown error'}`;
      showToast?.(msg, 'error');
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
}

if (typeof window !== 'undefined') {
  window.PasteCraftCRUD = PasteCraftCRUD;
}

class PasteCraftPopup {
  constructor() {
    console.log('🟢 PasteCraftPopup constructor called');
    this.clips = [];
    this.categories = [];
    // NOTE: selectedChips stores stable clip id keys (String(clip.id)), not indices.
    this.selectedChips = new Set();
    this.selectedPickerClips = new Set();
    this.delimiter = 'comma';
    this.currentTab = 'clips';
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedDateFilter = '';
    this.pendingText = null;
    this.selectedCategoryForSave = 'Uncategorized';
    this.autoDeletePeriod = 'never';
    // Global theme (single source of truth). Quick Paste follows this.
    this.theme = 'light'; // 'light' | 'dark'
    // Dark mode is enabled (single source of truth: `theme`).
    this.darkModeComingSoon = true;
    this._themeSyncing = false;
    this.searchOnlyClips = [];
    // These store stable clip id keys (String(clip.id)), not numbers.
    this.selectedCategoryClips = new Set();
    this.selectedSearchClips = new Set();
    this.expandedCategoryIds = new Set();
    this.categoryUiOrderSelectedIds = [];
    // Pending clip reference for category modal actions (stable clip id key)
    this.pendingClipId = null;

    // Crafted Output (preview) editability
    this.previewIsManual = false;
    this.previewLastAutoValue = '';
    this.options = {
      deduplicate: false,
      sort: false,
      uppercase: false
    };
    this.userProfile = null;
    
    // Pagination system
    this.currentPage = 0;
    this.clipsPerPage = 10;
    this.maxPages = 50;
    this.maxClips = this.clipsPerPage * this.maxPages; // 500 clips total
    
    // Tiered storage for lazy loading
    this.tieredClipsStore = null;
    this.tieredNotesStore = null;
    this.tieredArchivedStore = null;
    this.totalClipsCount = 0; // Total clips including remote
    this.totalNotesCount = 0; // Total notes including remote
    this.totalArchivedCount = 0; // Total archived including remote
    this._isLazyLoading = false; // Flag for loading indicator
    
    // Magic preview state
    this._magicAnalysis = [];
    this._magicSelected = new Set();
    this._magicPage = 0;
    this._magicUndoSnapshot = null;

    // Breakdown text cache
    this.currentBreakdownText = null;
    this.currentBreakdownLevel = null;
    this.breakdownCache = {};
    
    // Summary state
    this.currentSummaryText = null;
    this.generatedQuestions = [];
    this.currentSummaryQuestion = null;
    
    // Thread conversation state
    this.summaryThreads = [];
    this.breakdownThreads = [];
    this.currentSummaryThreadIndex = 0;
    this.currentBreakdownThreadIndex = 0;
    this.selectedFollowupLevel = null;
    
    // Session persistence state
    this._currentAiLabSubTab = 'generator';
    this._currentSummarySection = 'input';
    
    // Countdown timers
    this.aiGenerationTimerInterval = null;
    this.profileCollapseInterval = null;
    this.nameCollapseInterval = null;

    // Auto-refresh while sync progress is visible
    this._syncAutoRefreshTimeout = null;
    this._syncAutoRefreshInFlight = false;
    this._syncAutoRefreshIntervalMs = 5000;
    
    // Analysis history
    this.analysisHistory = [];

    // AI History (persistent conversation logs)
    this.aiHistoryEntries = [];
    this.currentHistoryEntry = null;
    this.currentHistoryThreadIndex = 0;
    this._activeBreakdownHistoryId = null; // tracks active breakdown conversation
    this._activeSummaryHistoryId = null;   // tracks active summary conversation
    this._aiHistorySearchQuery = '';
    this._aiHistoryFilterType = 'all';
    
    // Notes system
    this.notes = [];
    this.currentNoteId = null;
    this.currentNoteType = 'note';
    this.currentNoteAttachments = [];
    this.pendingClipForNotes = null;
    this.pendingBulkClipsForNotes = null; // array of clip objects for bulk send-to-notes
    this.pendingBulkClipIds = null; // array of clip id keys for bulk send-to-categories
    this.pendingNoteForAlbum = null;
    this.currentViewerNoteId = null;
    this.currentAlbumAttachmentContext = null;
    this.noteViewerParentAlbumId = null;
    this.notesViewMode = 'notes'; // 'notes' | 'albums'
    this.notesPageIndex = 0; // starts at 0
    this.notesAiEnabled = false;
    this.albumAttachmentOpenMode = 'overlay'; // 'edgePopup' | 'overlay'
    this.idb = (typeof window !== 'undefined' && window.pasteCraftIndexedDB) ? window.pasteCraftIndexedDB : null;
    this._idbReady = false;

    // Serialize clip mutations to prevent races / double-click issues.
    this._clipOpQueue = Promise.resolve();

    // Auth preferences (local-only; never store passwords)
    this._authPrefsKey = 'pc_auth_prefs_v1';

    // Freemium guest mode (skipped login)
    this._isFreemiumGuest = false;

    // Restore points (local snapshots)
    this._restorePointsKey = 'pc_restore_points_v1';
    this._lastRestoreAtKey = 'pc_last_restore_at';
    this._lastRestorePointIdKey = 'pc_last_restore_point_id';
    this._restoreSkipCloudSyncWindowMs = 5 * 60 * 1000; // 5 minutes
    this._lastPreviewRestore = null; // { point, cutoffMs, windowKey }
    this._lastAppliedRestore = null; // { point, appliedAt }

    // AI workflow override (provider + preset)
    this._aiWorkflowKey = 'pc_ai_workflow_v1';
    this.aiWorkflow = {
      enabled: false,
      provider: 'openai',
      preset: 'default',
      updatedAt: 0
    };
    
    // BroadcastChannel is initialized by settingsFeature in _initializeSettingsFeature()
    this._broadcastChannel = null;
    
    this.init();
  }

  // =====================================================
  // AI WORKFLOW (provider + preset) - versioned storage
  // =====================================================

  // Weighted credit cost per AI text call (mirrors server CREDIT_COST map)
  static AI_CREDIT_COSTS = {
    openai: { default: 40, cheapest: 25, gpt5_mini: 200, latest: 500 },
    google: { default: 40, cheapest: 25, gemini_pro: 350, latest: 100 },
  };

  // Provider → preset options mapping (single source of truth)
  static AI_PROVIDER_PRESETS = {
    openai: [
      { value: 'default',   label: 'Default (4o-mini) · 40 cr' },
      { value: 'cheapest',  label: 'Cheap (GPT-5 Nano) · 25 cr' },
      { value: 'gpt5_mini', label: 'Balanced (GPT-5 Mini) · 200 cr' },
      { value: 'latest',    label: 'Latest (GPT-5.2) · 500 cr' },
    ],
    google: [
      { value: 'default',        label: 'Default (Gemini 2.0 Flash) · 40 cr' },
      { value: 'cheapest',       label: 'Cheap (Gemini 2.0 Flash‑Lite) · 25 cr' },
      { value: 'gemini_pro',     label: 'Balanced (Gemini 2.5 Pro) · 350 cr' },
      { value: 'latest',         label: 'Latest (Gemini 2.5 Flash) · 100 cr' },
    ],
    anthropic: [
      { value: 'default', label: 'Default (Coming Soon)' },
    ],
    groq: [
      { value: 'default', label: 'Default (Coming Soon)' },
    ],
  };

  static AI_ALLOWED_PROVIDERS = new Set(['openai', 'google', 'anthropic', 'groq']);

  _normalizeAiWorkflow(raw) {
    return this.aiLabFeature.credits._normalizeAiWorkflow.call(this, raw);
  }

  async loadAiWorkflow() {
    return this.aiLabFeature.credits.loadAiWorkflow.call(this);
  }

  applyAiWorkflowToUi() {
    return this.aiLabFeature.credits.applyAiWorkflowToUi.call(this);
  }

  async saveAiWorkflowFromUi(silent = true) {
    return this.aiLabFeature.credits.saveAiWorkflowFromUi.call(this, silent);
  }

  // =====================================================
  // LEGACY AUTH PREFS CLEANUP
  // =====================================================

  async clearLegacyAuthPrefs() {
    try {
      await chrome.storage.local.remove([this._authPrefsKey]);
    } catch (_) {}
  }

  _clipIdKey(id) {
    return this.clipsFeature.state.getClipIdKey(id);
  }

  _clipTitle(clip) {
    return this.clipsFeature.state.getClipTitle(clip);
  }

  _clipFallbackTitle(clip, maxLength = 42) {
    return this.clipsFeature.state.getClipFallbackTitle(clip, maxLength);
  }

  _clipAttachment(clip, addedDate = Date.now()) {
    return this.clipsFeature.state.getClipAttachment(clip, addedDate);
  }

  _categoryIdKey(category) {
    return this.categoriesFeature.state.getCategoryIdKey(category);
  }

  _queueClipOp(fn) {
    return this.clipsFeature.state.queueClipOp(this, fn);
  }

  getSelectedClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedClipIdsInUiOrder(this);
  }

  async deleteClipsByIdKeys(idKeys, {
    includeArchived = true,
    reason = 'delete:unknown',
    closeCategoryModal = false,
    clearSelection = true,
    rerender = true
  } = {}) {
    return this.clipsFeature.service.deleteClipsByIdKeys(this, idKeys, {
      includeArchived,
      reason,
      closeCategoryModal,
      clearSelection,
      rerender
    });
  }
  
  async init() {
    // Guarantees that the purple loading overlay never gets stuck. Wraps the
    // real init body in try/catch/finally with an absolute 10s watchdog so a
    // throw, hang, or network stall can't freeze the popup in a loading state.
    const watchdog = setTimeout(() => {
      try {
        console.warn('⏰ init() watchdog fired at 10s — force-hiding overlay');
        this.hideLoadingOverlay();
        this._showOfflineModeBanner();
      } catch (_) {}
    }, 10000);

    try {
      await this._initImpl();
    } catch (e) {
      console.error('❌ init() failed:', e);
      try { this._showOfflineModeBanner(); } catch (_) {}
    } finally {
      clearTimeout(watchdog);
      try { this.hideLoadingOverlay(); } catch (_) {}
    }
  }

  _showOfflineModeBanner() {
    if (document.getElementById('pcOfflineModeBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'pcOfflineModeBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10001;background:#b45309;color:#fff;font-size:12px;padding:6px 10px;text-align:center;cursor:pointer;';
    banner.textContent = 'Loaded in offline mode — click to retry';
    banner.addEventListener('click', () => { try { window.location.reload(); } catch (_) {} });
    (document.body || document.documentElement).appendChild(banner);
  }

  async _initializeClipsFeature() {
    if (this.clipsFeature) return this.clipsFeature;
    const { initClipsFeature } = await import('./popup/features/clips/clips.controller.js');
    this.clipsFeature = initClipsFeature(this);
    return this.clipsFeature;
  }

  async _initializeCategoriesFeature() {
    if (this.categoriesFeature) return this.categoriesFeature;
    const { initCategoriesFeature } = await import('./popup/features/categories/categories.controller.js');
    this.categoriesFeature = initCategoriesFeature(this);
    return this.categoriesFeature;
  }

  async _initializeNotesFeature() {
    if (this.notesFeature) return this.notesFeature;
    const { initNotesFeature } = await import('./popup/features/notes/notes.controller.js');
    this.notesFeature = initNotesFeature(this);
    return this.notesFeature;
  }

  async _initializeAiLabFeature() {
    if (this.aiLabFeature) return this.aiLabFeature;
    const { initAiLabFeature } = await import('./popup/features/ai-lab/ai-lab.controller.js');
    this.aiLabFeature = initAiLabFeature(this);
    return this.aiLabFeature;
  }

  async _initializeSettingsFeature() {
    if (this.settingsFeature) return this.settingsFeature;
    const { initSettingsFeature } = await import('./popup/features/settings/settings.controller.js');
    this.settingsFeature = initSettingsFeature(this);
    return this.settingsFeature;
  }

  async _initImpl() {
    console.log('🚀 Initializing PasteCraft popup...');
    await this._initializeClipsFeature();
    await this._initializeCategoriesFeature();
    await this._initializeNotesFeature();
    await this._initializeAiLabFeature();
    await this._initializeSettingsFeature();

    // Setup auth modal events FIRST (before checking auth)
    this.setupAuthModalEvents();

    // ─── V2 MODE GATE: read local-mode flag FIRST, before any Supabase call ───
    let isLocalGuest = false;
    try {
      const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
      isLocalGuest = !!pc_freemium_guest;
    } catch (_) {}

    if (isLocalGuest) {
      // Actively clear any stale cloud auth state so it can't interfere later
      try { await chrome.storage.local.remove(['pc_supabase_session_v1', 'oauth_callback', 'password_reset_callback']); } catch (_) {}
      try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}
      // Go straight to local mode — no cloud auth calls at all
      this._isFreemiumGuest = true;
      this.currentUser = null;
      this.userSubscription = null;
      document.getElementById('topBar').style.display = 'flex';
      await Promise.all([this.loadData(), this.loadSettings()]);
      this.updateTopBarIdentity();
      this.setupEventListeners();
      this.renderChips();
      this.updateLastCapture();
      this.updatePreview();
      this.renderCategories();
      this.updateCategoryFilter();
      this.hideLoadingOverlay();
      this.setupVisibilityListener();
      Promise.resolve().then(() => this.cleanupOldClips()).catch(() => {});
      return;
    }

    // ─── CLOUD AUTH PATH (only reached when NOT in local mode) ───

    // Check if this is a password reset callback from storage
    const resetCallback = await this.checkPasswordResetCallback();
    if (resetCallback) {
      console.log('🔑 Password reset callback detected from storage');
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check if this is a password reset callback from URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    console.log('🔍 URL check:', {
      search: window.location.search,
      hash: window.location.hash,
      type: hashParams.get('type'),
      accessToken: hashParams.get('access_token') ? 'present' : 'missing'
    });
    
    if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery' || hashParams.get('reset')) {
      console.log('🔑 Password reset callback detected from URL');
      const accessToken = hashParams.get('access_token') || hashParams.get('reset');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken) {
        await this.setPasswordResetSession(accessToken, refreshToken);
      }
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check for OAuth callback tokens
    await this.checkOAuthCallback();

    // Restore database auth before the signed-in check. After an OS/browser
    // restart, supabase-js may start empty while chrome.storage still has the
    // refresh token bridge needed to rehydrate the session.
    try {
      await this.clearLegacyAuthPrefs();
      await this.restoreSupabaseSessionFromBridge('startup');
    } catch (_) {}

    // Check if user is authenticated
    const currentUser = await pasteCraftSupabase.getCurrentUser();

    if (!currentUser) {
      // Show auth modal (no freemium fallback here — that's handled by the mode gate above)
      this.showAuthModal();
      return;
    }
    
    // User is authenticated, proceed with normal init
    console.log('✅ User authenticated:', currentUser.email);
    this.currentUser = currentUser;


    // Load subscription info
    // Do NOT block popup UI on slow network subscription fetch.
    // Use cached subscription if available, then refresh in background.
    try {
      this.userSubscription = await pasteCraftSupabase.getCachedSubscription(currentUser.id);
    } catch (_) {
      this.userSubscription = null;
    }
    console.log('💎 Subscription tier (cached):', this.userSubscription?.subscription_tier);
    // Best-effort credits render from cached subscription snapshot.
    this.updateAiCreditsPills('cached');
    this.updateUpgradeUI();

    pasteCraftSupabase.getUserSubscription(currentUser.id).then((sub) => {
      this.userSubscription = sub;
      console.log('💎 Subscription tier (fresh):', this.userSubscription?.subscription_tier);
      this.updateAiCreditsPills('fresh');
      this.updateUpgradeUI();
    }).catch(() => {});
    
    // Show top bar (with sign out button)
    document.getElementById('topBar').style.display = 'flex';
    
    this.setupLocalStorageListener();
    await this._ensureIndexedDbReadyAndMigrate();

    // Parallelize independent storage reads for faster startup
    await Promise.all([
      this.loadData(),
      this.loadSettings(),
      this.loadAiWorkflow(),
      this.loadUserProfile(),
      this.loadAnalysisHistory(),
    ]);

    // If local profile is empty/incomplete (new device), fetch from Supabase immediately.
    // Profile is identity data — not gated by cloud sync tier. Timeout to prevent hanging.
    if (!this.userProfile?.userName && !this.userProfile?.aiGeneratedName && !this.userProfile?.profileImageUrl) {
      try {
        const remoteProfile = await Promise.race([
          pasteCraftSupabase.syncUserProfileFromSupabase(),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000))
        ]);
        if (remoteProfile) {
          this.userProfile = { ...(this.userProfile || {}), ...remoteProfile };
          await chrome.storage.local.set({ userProfile: this.userProfile });
          console.log('✅ Profile hydrated from Supabase on fresh device');
        }
      } catch (_) {}
    }

    // Always update top bar name/image (even if no image saved yet)
    this.updateTopBarIdentity();
    
    if (this.userProfile?.profileImageUrl) {
      this.displayImageTopLeft(this.userProfile.profileImageUrl);
    }
    
    this.setupEventListeners();
    this.renderChips();
    this.updateLastCapture();
    this.updatePreview();
    this.renderCategories();
    this.updateCategoryFilter();

    // 🎯 HIDE LOADING OVERLAY (local data loaded, ready to show).
    // Done BEFORE _restoreSessionState() so a slow Supabase call inside
    // the session-restore path (loadNotes/loadActivityLog/loadAiHistory)
    // cannot stall the visible UI behind the purple overlay.
    this.hideLoadingOverlay();

    // 🔄 RESTORE SESSION STATE (active tab, AI content, etc.) — fire and
    // forget. The restored tab shows its own lightweight inline loading
    // state while its data arrives.
    this._restoreSessionState().catch((e) => {
      console.warn('Session restore failed:', e);
    });

    // Run potentially heavy maintenance tasks in background (do not block popup render)
    Promise.resolve()
      .then(() => this.maybeCreateDailyRestorePoint('startup'))
      .catch(() => {});

    // Auto-delete cleanup can be slow with large clip sets; run in background.
    Promise.resolve()
      .then(() => this.cleanupOldClips())
      .catch(() => {});
    
    // 🔄 SYNC WITH SUPABASE IN BACKGROUND (don't await - let it happen naturally)
    this.performBackgroundSync();
    
    // 📦 TIERED STORAGE MIGRATION (move excess data to cloud if needed)
    Promise.resolve()
      .then(() => this._maybeMigrateTieredStorage())
      .catch(e => console.warn('Tiered storage migration skipped:', e));
    
    // Reload data whenever popup becomes visible
    this.setupVisibilityListener();
    
    // Setup realtime data sync listeners
    this.setupRealtimeListeners();
    
    // Setup sync status listeners
    this.setupSyncStatusListeners();
    
    console.log('✅ PasteCraft popup initialized successfully');
  }

  _formatShortDate(isoOrDate) {
    try {
      const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return null;
    }
  }

  _computeAiImageCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiImageCreditsView.call(this, subscription);
  }

  _computeAiTextCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiTextCreditsView.call(this, subscription);
  }

  /** Update the label text of a credit pill without destroying child elements (tooltips). */
  _setPillLabel(el, text) {
    return this.aiLabFeature.credits._setPillLabel.call(this, el, text);
  }

  /** Build provider-aware cost breakdown HTML for the text-credits tooltip. */
  _buildCreditCostHtml() {
    return this.aiLabFeature.credits._buildCreditCostHtml.call(this);
  }

  updateAiCreditsPills(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPills.call(this, source);
  }

  // Back-compat: older callsites.
  updateAiCreditsPill(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPill.call(this, source);
  }

  setupLocalStorageListener() {
    try {
      // Debounce repeated local change events and avoid re-entrancy loops.
      this._handlingLocalChange = false;
      this._lastLocalChangeAt = 0;
      this._localChangeTimerId = null;
      this._isUpdating = {
        clips: false,
        categories: false,
        notes: false,
        ai: false,
        search: false
      };

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (!changes) return;

        // Detect what changed
        const clipsChanged = !!(changes.clips || changes.searchOnlyClips);
        const categoriesChanged = !!changes.categories;
        const notesChanged = !!changes.notes;
        const settingsChanged = !!(changes.autoDeletePeriod || changes.quickPasteSettings || changes.albumAttachmentOpenMode || changes.theme);
        const aiDataChanged = !!(changes.analysisHistory || changes.userProfile);

        // Only react to data we render
        const relevant = clipsChanged || categoriesChanged || notesChanged || settingsChanged || aiDataChanged;
        if (!relevant) return;
        if (this._handlingLocalChange) return;

        // If popup isn't visible, don't do expensive UI work
        if (document.visibilityState !== 'visible') return;

        const now = Date.now();
        if (now - this._lastLocalChangeAt < 150) return;
        this._lastLocalChangeAt = now;

        if (this._localChangeTimerId) clearTimeout(this._localChangeTimerId);
        this._localChangeTimerId = setTimeout(async () => {
          if (this._handlingLocalChange) return;
          this._handlingLocalChange = true;
          try {
            await this._mirrorChangedLocalStateToIndexedDb(changes);
            // Refresh clips/categories if changed
            if (clipsChanged || categoriesChanged) {
              await this.loadData();
            }

            // Refresh notes if changed
            if (notesChanged) {
              await this.loadNotes();
            }

            // Refresh AI data if changed
            if (aiDataChanged) {
              await this.loadAnalysisHistory();
              await this.loadUserProfile();
            }

            // Update only what's needed for the current view (only if not already updating)
            if (this.currentTab === 'clips' && clipsChanged && !this._isUpdating.clips) {
              this._isUpdating.clips = true;
              try {
                this.renderChips();
                this.updateLastCapture();
                this.updatePreview();
              } finally {
                this._isUpdating.clips = false;
              }
            } else if (this.currentTab === 'search' && clipsChanged && !this._isUpdating.search) {
              this._isUpdating.search = true;
              try {
                this.renderSearchResults();
                this.updateSearchBulkActions();
              } finally {
                this._isUpdating.search = false;
              }
            } else if (this.currentTab === 'categories' && (clipsChanged || categoriesChanged) && !this._isUpdating.categories) {
              this._isUpdating.categories = true;
              try {
                this.renderCategories();
                this.updateCategoryFilter();
                this.updateManualInputCategories();
                this.updateCategoryBulkActions();
              } finally {
                this._isUpdating.categories = false;
              }
            } else if (this.currentTab === 'notes' && notesChanged && !this._isUpdating.notes) {
              this._isUpdating.notes = true;
              try {
                this.renderNotes();
              } finally {
                this._isUpdating.notes = false;
              }
            } else if (this.currentTab === 'ai' && aiDataChanged && !this._isUpdating.ai) {
              this._isUpdating.ai = true;
              try {
                this.loadAIGallery();
              } finally {
                this._isUpdating.ai = false;
              }
            }

            // Settings changes: refresh settings UI if modal is open
            if (settingsChanged) {
              const settingsModal = document.getElementById('settingsModal');
              if (settingsModal && settingsModal.style.display !== 'none') {
                // Settings modal is open - refresh settings display
                this.showSettingsModal();
              }
            }
          } finally {
            this._handlingLocalChange = false;
          }
        }, 60);
      });
    } catch (_) {
      // ignore
    }
  }

  async _ensureIndexedDbReadyAndMigrate() {
    if (!this.idb || this._idbReady) return;
    try {
      await this.idb.open();
      const seedData = await chrome.storage.local.get(['clips', 'categories', 'notes']);
      await this.idb.importIfNeededFromStorage({
        clips: Array.isArray(seedData?.clips) ? seedData.clips : [],
        categories: Array.isArray(seedData?.categories) ? seedData.categories : [],
        notes: Array.isArray(seedData?.notes) ? seedData.notes : []
      });
      this._idbReady = true;
    } catch (error) {
      this._idbReady = false;
      console.warn('⚠️ IndexedDB unavailable, falling back to chrome.storage.local:', error?.message || error);
    }
  }

  async _mirrorChangedLocalStateToIndexedDb(changes) {
    if (!this._idbReady || !this.idb || !changes) return;
    try {
      if (changes.clips) {
        await this.idb.syncEntityFromLocalStorage('clips', Array.isArray(changes.clips.newValue) ? changes.clips.newValue : []);
      }
      if (changes.categories) {
        await this.idb.syncEntityFromLocalStorage('categories', Array.isArray(changes.categories.newValue) ? changes.categories.newValue : []);
      }
      if (changes.notes) {
        await this.idb.syncEntityFromLocalStorage('notes', Array.isArray(changes.notes.newValue) ? changes.notes.newValue : []);
      }
    } catch (error) {
      console.warn('⚠️ Failed mirroring local entities to IndexedDB:', error?.message || error);
    }
  }

  // =====================================================
  // RESTORE POINTS (Local daily snapshots)
  // =====================================================

  _restoreWindowToMs(windowKey) {
    const m = {
      '1day': 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '2weeks': 14 * 24 * 60 * 60 * 1000,
      '4weeks': 28 * 24 * 60 * 60 * 1000
    };
    return m[windowKey] || m['1week'];
  }

  _localDateKey(ts) {
    const d = new Date(typeof ts === 'number' ? ts : Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async _loadRestorePoints() {
    try {
      const res = await chrome.storage.local.get([this._restorePointsKey]);
      const raw = res ? res[this._restorePointsKey] : null;
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  async _saveRestorePoints(points) {
    try {
      await chrome.storage.local.set({ [this._restorePointsKey]: points });
    } catch (_) {
      // ignore
    }
  }

  _pruneRestorePoints(points) {
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

    // Sort newest first
    valid.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Keep unique daily points by dateKey, newest wins
    const dailyByDate = new Map();
    const manual = [];
    for (const p of valid) {
      if (p.kind === 'manual') {
        manual.push(p);
        continue;
      }
      const k = p.dateKey || this._localDateKey(p.createdAt);
      if (!dailyByDate.has(k)) dailyByDate.set(k, { ...p, dateKey: k, kind: 'daily' });
    }

    const daily = Array.from(dailyByDate.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const keptDaily = daily.slice(0, 28);
    const keptManual = manual.slice(0, 5);

    const out = [...keptManual, ...keptDaily].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }

  _buildRestoreSnapshotFromLocal(local) {
    const source = local && typeof local === 'object' ? local : {};
    const repaired = this.repairLocalClipIds(source.clips, source.searchOnlyClips);
    const clips = Array.isArray(repaired.clips) ? repaired.clips.slice(0, 500) : [];
    const searchOnlyClips = Array.isArray(repaired.searchOnlyClips) ? repaired.searchOnlyClips.slice(0, 1000) : [];
    const categories = Array.isArray(source.categories) ? source.categories.slice(0, 300) : [];
    const notes = Array.isArray(source.notes) ? source.notes.slice(0, 300) : [];
    return { clips, searchOnlyClips, categories, notes };
  }

  async maybeCreateDailyRestorePoint(reason = 'daily', localOverride = null) {
    // Create at most one daily restore point per local day.
    const now = Date.now();
    const todayKey = this._localDateKey(now);

    const points = await this._loadRestorePoints();
    const hasToday = points.some(p => p && p.kind !== 'manual' && (p.dateKey === todayKey || this._localDateKey(p.createdAt) === todayKey));
    if (hasToday) return false;

    let local = localOverride;
    if (!local) {
      local = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips', 'notes']);
    }

    const snap = this._buildRestoreSnapshotFromLocal(local);
    const point = {
      id: `rp_${now}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'daily',
      reason: String(reason || 'daily').slice(0, 60),
      createdAt: now,
      dateKey: todayKey,
      ...snap
    };

    const next = this._pruneRestorePoints([point, ...(Array.isArray(points) ? points : [])]);
    await this._saveRestorePoints(next);
    return true;
  }

  async createManualRestorePoint(reason = 'manual') {
    const now = Date.now();
    const points = await this._loadRestorePoints();
    const local = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips', 'notes']);
    const snap = this._buildRestoreSnapshotFromLocal(local);

    const point = {
      id: `rp_${now}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'manual',
      reason: String(reason || 'manual').slice(0, 60),
      createdAt: now,
      dateKey: this._localDateKey(now),
      ...snap
    };

    const next = this._pruneRestorePoints([point, ...(Array.isArray(points) ? points : [])]);
    await this._saveRestorePoints(next);
    return point;
  }

  _selectRestorePointForWindow(points, windowKey) {
    const arr = Array.isArray(points) ? points.slice() : [];
    if (arr.length === 0) return { point: null, cutoffMs: 0 };

    arr.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    const cutoffMs = Date.now() - this._restoreWindowToMs(windowKey);

    const match = arr.find(p => p && typeof p.createdAt === 'number' && p.createdAt <= cutoffMs) || null;
    if (match) return { point: match, cutoffMs };

    // No point old enough: fall back to the oldest available.
    const oldest = arr[arr.length - 1] || null;
    return { point: oldest, cutoffMs };
  }

  _formatRestorePreview(point, windowKey, cutoffMs) {
    if (!point) return 'No restore points found yet.';
    const when = new Date(point.createdAt).toLocaleString();
    const active = Array.isArray(point.clips) ? point.clips.length : 0;
    const archived = Array.isArray(point.searchOnlyClips) ? point.searchOnlyClips.length : 0;
    const categories = Array.isArray(point.categories) ? point.categories.length : 0;
    const notes = Array.isArray(point.notes) ? point.notes.length : 0;
    const target = new Date(cutoffMs).toLocaleString();
    const reason = point.reason ? ` • ${String(point.reason)}` : '';
    return `Restore point: ${when}${reason}. Target window: ${windowKey} (≤ ${target}). Clips: ${active} active, ${archived} archived. Categories: ${categories}. Notes: ${notes}.`;
  }

  async previewRestore(windowKey) {
    const points = await this._loadRestorePoints();
    const { point, cutoffMs } = this._selectRestorePointForWindow(points, windowKey);
    this._lastPreviewRestore = { point, cutoffMs, windowKey };

    const el = document.getElementById('restorePreviewText');
    if (el) el.textContent = this._formatRestorePreview(point, windowKey, cutoffMs);

    return { point, cutoffMs };
  }

  async applyRestoreFromPreview() {
    const preview = this._lastPreviewRestore;
    const point = preview && preview.point ? preview.point : null;
    if (!point) {
      this.showToast('⚠️ No restore point available yet', 'error');
      return false;
    }

    // Safety net: create a manual restore point before overwriting local storage.
    try { await this.createManualRestorePoint('pre-restore'); } catch (_) {}

    const ok = confirm(
      'Restore will replace local Clips and Archive with a previous snapshot.\n\nCloud data will NOT be changed unless you click “Sync restored data to cloud”.\n\nProceed?'
    );
    if (!ok) return false;

    const clips = Array.isArray(point.clips) ? point.clips.slice(0, 500) : [];
    const searchOnlyClips = Array.isArray(point.searchOnlyClips) ? point.searchOnlyClips.slice(0, 1000) : [];
    const categories = Array.isArray(point.categories) ? point.categories.slice(0, 300) : [];
    const notes = Array.isArray(point.notes) ? point.notes.slice(0, 300) : [];

    const appliedAt = Date.now();
    await chrome.storage.local.set({
      clips,
      searchOnlyClips,
      categories,
      notes,
      pc_local_updatedAt: appliedAt,
      [this._lastRestoreAtKey]: appliedAt,
      [this._lastRestorePointIdKey]: point.id || ''
    });

    // Update in-memory state + UI
    await this.loadData();
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
    this.updatePreview();
    this.updateLastCapture();
    try { this.updateStorageStats(); } catch (_) {}

    this._lastAppliedRestore = { point, appliedAt };
    const btn = document.getElementById('syncRestoredToCloudBtn');
    if (btn) btn.disabled = false;

    this.showToast('✅ Restore complete (local only)');
    return true;
  }

  async syncRestoredDataToCloud() {
    const applied = this._lastAppliedRestore;
    if (!applied || !applied.point) {
      this.showToast('⚠️ Restore first, then sync to cloud', 'error');
      return false;
    }

    const ok = confirm(
      'This will sync your CURRENT local state to the cloud.\n\nThis may overwrite cloud clips to match the restored snapshot.\n\nProceed?'
    );
    if (!ok) return false;

    await this.performBackgroundSync({ force: true, reason: 'restore:cloud-sync' });
    this.showToast('✅ Synced restored data to cloud');
    return true;
  }

  repairLocalClipIds(clipsRaw, searchOnlyRaw) {
    const normalize = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      let changed = false;

      const hashText = (t) => {
        const s = String(t || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
      };

      const toObj = (clip, i) => {
        if (typeof clip === 'string') {
          changed = true;
          const ts = Date.now();
          return {
            id: `${ts}_${hashText(clip)}_${i}`,
            text: clip,
            category: 'Uncategorized',
            timestamp: ts
          };
        }
        if (clip && typeof clip === 'object') return { ...clip };
        changed = true;
        return null;
      };

      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const c = toObj(arr[i], i);
        if (!c) continue;
        if (!c.text) { changed = true; continue; }

        const ts = typeof c.timestamp === 'number' ? c.timestamp : Date.now();
        if (typeof c.timestamp !== 'number') { c.timestamp = ts; changed = true; }

        let id = c.id ?? c.clip_id ?? c.clipId ?? null;
        if (id == null) {
          id = `${ts}_${hashText(c.text)}_${i}`;
          c.id = id;
          changed = true;
        } else {
          if (c.id == null) { c.id = id; changed = true; }
        }

        const key = String(c.id);
        if (seen.has(key)) {
          // If duplicate id is actually the same clip content, drop it to prevent user-visible dupes.
          // Otherwise, mint a stable-ish new id.
          const contentKey = `${hashText(c.text)}:${Math.floor(ts / 3000)}:${String(c.category || 'Uncategorized')}`;
          const hasSameContentAlready = out.some(x => `${hashText(x.text)}:${Math.floor((x.timestamp || 0) / 3000)}:${String(x.category || 'Uncategorized')}` === contentKey);
          if (hasSameContentAlready) {
            changed = true;
            continue;
          }
          c.id = `${key}__r${ts}_${i}`;
          changed = true;
        }
        seen.add(String(c.id));
        out.push(c);
      }

      return { out, changed };
    };

    const active = normalize(clipsRaw);
    const archived = normalize(searchOnlyRaw);

    return {
      changed: !!(active.changed || archived.changed),
      activeChanged: !!active.changed,
      archivedChanged: !!archived.changed,
      clips: active.out,
      searchOnlyClips: archived.out
    };
  }
  
  async performBackgroundSync({ force = false, reason = 'background-sync' } = {}) {
    try {
      // Guardrail: after a local restore, don't auto-sync for a short window unless explicitly forced.
      if (!force) {
        try {
          const res = await chrome.storage.local.get([this._lastRestoreAtKey]);
          const lastRestoreAt = typeof res?.[this._lastRestoreAtKey] === 'number' ? res[this._lastRestoreAtKey] : 0;
          if (lastRestoreAt && (Date.now() - lastRestoreAt) < this._restoreSkipCloudSyncWindowMs) {
            console.log('⏸️ Skipping background sync (recent restore):', { reason, lastRestoreAt });
            return;
          }
        } catch (_) {}
      }

      console.log('🔄 Starting background sync with database...', { reason, force });
      const syncResult = await pasteCraftSupabase.performFullSync();
      
      if (syncResult.success) {
        console.log('✅ Background sync complete:', syncResult.stats);
        // Reload data after sync
        await this.loadData();
        this.renderChips();
        this.renderCategories();
        this.updateCategoryFilter();
        this.updateManualInputCategories();
        
        // 🔄 RELOAD USER PROFILE AFTER SYNC (fixes image disappearing after cache clear)
        await this.loadUserProfile();
        // Always refresh top bar identity (name + image) after sync
        this.updateTopBarIdentity(this.userProfile?.profileImageUrl || undefined);
      } else {
        console.warn('⚠️ Background sync failed:', syncResult.message);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
      // Don't block app - local data still works
    }
  }
  
  hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        overlay.style.display = 'none';
        console.log('✅ Loading overlay hidden');
      }, 300);
    }
  }

  // ── Upgrade UI (Freemium → Basic/Enhanced) ──────────────────────────
  _isFreemiumUser() {
    const sub = this.userSubscription;
    if (!sub) return true;
    const tier = String(sub.subscription_tier || '').toLowerCase();
    const status = String(sub.subscription_status || '').toLowerCase();
    if (tier === 'admin') return false;
    if ((tier === 'premium' || tier === 'basic') && (status === 'active' || status === 'past_due')) return false;
    // Coupon-based AI access counts as paid
    if (sub.has_unlimited_ai === true) return false;
    const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
    if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) return false;
    return true;
  }

  updateUpgradeUI() {
    const isFree = this._isFreemiumUser();
    const banner = document.getElementById('upgradeBanner');
    const profileBtn = document.getElementById('upgradeSubBtn');
    if (banner) banner.style.display = isFree ? 'flex' : 'none';
    if (profileBtn) profileBtn.style.display = isFree ? 'block' : 'none';
  }

  openUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.add('active');
  }

  closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.remove('active');
  }

  _openPricingPage() {
    chrome.tabs.create({ url: 'https://pastecraft.com/pricing.html' });
  }

  async _createCheckout(priceId) {
    if (!this.currentUser) {
      alert('Please sign in to subscribe');
      return;
    }

    try {
      const session = await pasteCraftSupabase.getSession();
      const accessToken = session?.access_token || '';
      const supabaseUrl = PASTECRAFT_CONFIG?.supabase?.url || '';
      const anonKey = PASTECRAFT_CONFIG?.supabase?.anonKey || '';

      if (!supabaseUrl || !anonKey) {
        alert('Configuration error. Please try again later.');
        return;
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'pcCreateCheckout',
          priceId,
          accessToken,
          supabaseUrl,
          anonKey
        }, resolve);
      });

      if (!response?.success) {
        const errorMsg = response?.error || 'Failed to create checkout session';
        alert(`Error: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
    }
  }

  setupVisibilityListener() {
    // Reload data when popup is shown
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Popup became visible - reloading data...');
        await this.loadData();
        await this.loadUserProfile(); // Reload profile too
        this.renderChips();
        this.updateLastCapture();
        this.updatePreview();
        this.renderCategories();
        this.updateCategoryFilter();
        
        // Always refresh top bar identity (name + image) on visibility
        this.updateTopBarIdentity(this.userProfile?.profileImageUrl || undefined);
        console.log('✅ Data reloaded successfully');
      }
    });
  }
  
  setupSyncStatusListeners() {
    // Listen for sync status changes
    window.addEventListener('syncStatusChanged', (event) => {
      const { status, queueLength } = event.detail;
      this.updateSyncIndicator(status, queueLength);
    });
    
    // Listen for sync progress updates
    window.addEventListener('syncProgress', (event) => {
      const { current, total, percentage } = event.detail;
      this.updateSyncProgress(current, total, percentage);
    });
  }

  _clearSyncAutoRefresh() {
    if (this._syncAutoRefreshTimeout) {
      clearTimeout(this._syncAutoRefreshTimeout);
      this._syncAutoRefreshTimeout = null;
    }
  }

  _isSyncProgressVisible() {
    const el = document.getElementById('syncProgressContainer');
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  _scheduleSyncAutoRefreshTick() {
    if (this._syncAutoRefreshTimeout) return;
    this._syncAutoRefreshTimeout = setTimeout(() => {
      this._runSyncAutoRefreshTick().catch(() => {});
    }, this._syncAutoRefreshIntervalMs);
  }

  async _runSyncAutoRefreshTick() {
    // clear first so we can reschedule in finally
    this._syncAutoRefreshTimeout = null;

    if (!this._isSyncProgressVisible()) return;
    if (this._syncAutoRefreshInFlight) {
      this._scheduleSyncAutoRefreshTick();
      return;
    }

    this._syncAutoRefreshInFlight = true;
    try {
      // Soft refresh: reload from storage + re-render (avoid killing in-flight sync work)
      await this.loadData();
      await this.loadUserProfile();
      this.renderChips();
      this.updateLastCapture();
      this.updatePreview();
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderSearchResults();

      // Always refresh top bar identity (name + image) after sync
      this.updateTopBarIdentity(this.userProfile?.profileImageUrl || undefined);
    } finally {
      this._syncAutoRefreshInFlight = false;
    }

    // Keep refreshing every 5s while progress bar is visible
    if (this._isSyncProgressVisible()) {
      this._scheduleSyncAutoRefreshTick();
    }
  }
  
  setupRealtimeListeners() {
    // Listen for realtime data changes
    window.addEventListener('dataChanged', async (event) => {
      const { type } = event.detail;
      console.log(`🔔 Realtime change detected: ${type}`);
      
      // Reload and re-render based on data type
      if (type === 'clips' || type === 'archivedClips') {
        await this.loadData();
        this.renderChips();
        this.updateLastCapture();
        this.renderSearchResults();
      } else if (type === 'categories') {
        await this.loadData();
        this.renderCategories();
        this.updateCategoryFilter();
      } else if (type === 'settings') {
        await this.loadSettings();
      } else if (type === 'profile') {
        await this.loadUserProfile();
        // Always refresh top bar identity (name + image) on profile change
        this.updateTopBarIdentity(this.userProfile?.profileImageUrl || undefined);
      }
    });
  }
  
  updateSyncIndicator(status, queueLength = 0) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    const queueCount = document.getElementById('syncQueueCount');
    
    if (!indicator || !statusText) return;

    // If we’re no longer syncing, stop any auto-refresh loop.
    if (status !== 'syncing') {
      this._clearSyncAutoRefresh();
    }
    
    // Update indicator color and status text
    indicator.className = `sync-indicator ${status}`;
    
    const statusMessages = {
      'synced': '🟢 Synced',
      'syncing': '🟡 Syncing...',
      'offline': '🔴 Offline'
    };
    
    statusText.textContent = statusMessages[status] || status;
    
    // Show queue count if pending operations
    if (queueLength > 0 && queueCount) {
      queueCount.textContent = `${queueLength} pending`;
      queueCount.style.display = 'inline-block';
    } else if (queueCount) {
      queueCount.style.display = 'none';
    }
  }
  
  updateSyncProgress(current, total, percentage) {
    const progressContainer = document.getElementById('syncProgressContainer');
    const progressFill = document.getElementById('syncProgressFill');
    const progressText = document.getElementById('syncProgressText');
    
    if (!progressContainer || !progressFill || !progressText) return;
    
    // Show progress bar if syncing large dataset
    if (total > 100 && current < total) {
      progressContainer.style.display = 'block';
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${current} / ${total} (${percentage}%)`;
      this._scheduleSyncAutoRefreshTick();
    } else {
      // Hide progress bar when done
      progressContainer.style.display = 'none';
      this._clearSyncAutoRefresh();
    }
  }

  async loadData() {
    await this._ensureIndexedDbReadyAndMigrate();
    const result = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
    
    let { clips = [], categories = [], searchOnlyClips = [] } = result;
    let normalizedChanged = false;
    if (this._idbReady && this.idb) {
      const [idbClips, idbCategories] = await Promise.all([
        this.idb.getAllPayloads('clips'),
        this.idb.getAllPayloads('categories')
      ]);
      if (Array.isArray(idbClips) && idbClips.length > 0) clips = idbClips;
      if (Array.isArray(idbCategories) && idbCategories.length > 0) categories = idbCategories;
    }

    // ── DEMO SEED: Preset categories + example clips (PC 1.0 release) ──
    // Research-backed preset categories based on most commonly copied/pasted
    // clipboard items: code, links, emails, AI prompts, reference info, math,
    // diagrams, and docs. 4 markup demo clips + 4 common-use clips.
    if (clips.length === 0 && categories.length === 0) {
      const now = Date.now();
      categories = [
        { id: now - 800000, name: '💻 Code Snippets', icon: '💻', createdAt: now - 800000, updatedAt: now - 800000 },
        { id: now - 700000, name: '🔗 Links & URLs', icon: '🔗', createdAt: now - 700000, updatedAt: now - 700000 },
        { id: now - 600000, name: '📧 Email Templates', icon: '📧', createdAt: now - 600000, updatedAt: now - 600000 },
        { id: now - 500000, name: '🤖 AI Prompts', icon: '🤖', createdAt: now - 500000, updatedAt: now - 500000 },
        { id: now - 400000, name: '📋 Quick Reference', icon: '📋', createdAt: now - 400000, updatedAt: now - 400000 },
        { id: now - 300000, name: '📐 Math & Formulas', icon: '📐', createdAt: now - 300000, updatedAt: now - 300000 },
        { id: now - 200000, name: '🔀 Diagrams & Charts', icon: '🔀', createdAt: now - 200000, updatedAt: now - 200000 },
        { id: now - 100000, name: '📝 Notes & Docs', icon: '📝', createdAt: now - 100000, updatedAt: now - 100000 }
      ];
      clips = [
        // ── 4 MARKUP DEMO CLIPS (showcase rendering capabilities) ──
        { id: 'demo_markup_1', text: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\n\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', category: '📐 Math & Formulas', timestamp: now - 800000, meta: { markupHint: 'latex' } },
        { id: 'demo_markup_2', text: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D', category: '🔀 Diagrams & Charts', timestamp: now - 700000, meta: { markupHint: 'mermaid' } },
        { id: 'demo_markup_3', text: 'async function fetchJSON(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(res.statusText);\n    return await res.json();\n  } catch (err) {\n    console.error("Fetch failed:", err);\n    return null;\n  }\n}', category: '💻 Code Snippets', timestamp: now - 600000, meta: { markupHint: 'javascript' } },
        { id: 'demo_markup_4', text: '# Quick Notes\n\n## Today\'s Tasks\n- [ ] Review pull request\n- [x] Update dependencies\n- [ ] Write unit tests\n\n> **Tip:** PasteCraft auto-detects markup like Markdown, LaTeX, and code.\n\nDelete these examples anytime — they\'re just here to show what\'s possible!', category: '📝 Notes & Docs', timestamp: now - 500000, meta: { markupHint: 'markdown' } },
        // ── 4 COMMON CLIPBOARD CLIPS (research-backed presets) ──
        { id: 'demo_common_1', text: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript\nhttps://stackoverflow.com/questions\nhttps://github.com/trending', category: '🔗 Links & URLs', timestamp: now - 400000 },
        { id: 'demo_common_2', text: 'Hi [Name],\n\nThank you for reaching out. I wanted to follow up regarding [topic].\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]', category: '📧 Email Templates', timestamp: now - 300000 },
        { id: 'demo_common_3', text: 'Act as an expert [role]. I need you to [task]. The context is [context]. Format your response as [format]. Keep it concise and actionable.', category: '🤖 AI Prompts', timestamp: now - 200000 },
        { id: 'demo_common_4', text: 'Company: PasteCraft Inc.\nSupport: support@pastecraft.com\nDocs: https://pastecraft.com/docs\nVersion: 1.0.0', category: '📋 Quick Reference', timestamp: now - 100000 }
      ];
      await chrome.storage.local.set({ clips, categories, searchOnlyClips });
      normalizedChanged = false;
      console.log('🧪 Seeded 8 preset categories + 8 example clips (PC 1.0)');
    }
    // ── END DEMO SEED ──

    const hashText = (t) => {
      const s = String(t || '');
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };
    
    // Load active clips (max 20, shown in clips tab and quick paste)
    this.clips = clips.map(clip => {
      // Handle both old string format and new object format
      if (typeof clip === 'string') {
        normalizedChanged = true;
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts
        };
      } else {
        const text = clip?.text || clip;
        const ts = (typeof clip?.timestamp === 'number') ? clip.timestamp : Date.now();
        const id = clip?.id ?? clip?.clip_id ?? clip?.clipId ?? `${ts}_${hashText(text)}`;
        if (clip?.id == null || typeof clip?.timestamp !== 'number') normalizedChanged = true;
        return {
          id,
          text,
          title: this._clipTitle(clip),
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
          ...(clip && typeof clip === 'object' && Number.isFinite(clip.updatedAt ?? clip.updated_at) ? { updatedAt: Number(clip.updatedAt ?? clip.updated_at) } : {}),
          ...(clip && typeof clip === 'object' && Number.isFinite(clip.deletedAt ?? clip.deleted_at) ? { deletedAt: Number(clip.deletedAt ?? clip.deleted_at) } : {}),
          ...(clip && typeof clip === 'object' && (clip.deviceId || clip.device_id) ? { deviceId: clip.deviceId || clip.device_id } : {}),
          ...(clip && typeof clip === 'object' && clip.meta ? { meta: clip.meta } : {})
        };
      }
    });
    // Always sort newest first (IndexedDB returns key order, storage order can vary)
    this.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Load search-only clips (archived clips, only shown in search)
    this.searchOnlyClips = searchOnlyClips.map(clip => {
      if (typeof clip === 'string') {
        normalizedChanged = true;
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts
        };
      } else {
        const text = clip?.text || clip;
        const ts = (typeof clip?.timestamp === 'number') ? clip.timestamp : Date.now();
        const id = clip?.id ?? clip?.clip_id ?? clip?.clipId ?? `${ts}_${hashText(text)}`;
        if (clip?.id == null || typeof clip?.timestamp !== 'number') normalizedChanged = true;
        return {
          id,
          text,
          title: this._clipTitle(clip),
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
          ...(clip && typeof clip === 'object' && Number.isFinite(clip.updatedAt ?? clip.updated_at) ? { updatedAt: Number(clip.updatedAt ?? clip.updated_at) } : {}),
          ...(clip && typeof clip === 'object' && Number.isFinite(clip.deletedAt ?? clip.deleted_at) ? { deletedAt: Number(clip.deletedAt ?? clip.deleted_at) } : {}),
          ...(clip && typeof clip === 'object' && (clip.deviceId || clip.device_id) ? { deviceId: clip.deviceId || clip.device_id } : {}),
          ...(clip && typeof clip === 'object' && clip.meta ? { meta: clip.meta } : {})
        };
      }
    });
    
    this.categories = categories;

    if (normalizedChanged) {
      await chrome.storage.local.set({
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips
      });
    }
    if (this._idbReady && this.idb) {
      await this.idb.syncEntityFromLocalStorage('clips', this.clips);
      await this.idb.syncEntityFromLocalStorage('categories', this.categories);
    }

    // Enforce pagination clip limit
    await this.enforceClipLimit();

    // Initialize tiered storage for lazy loading (non-blocking)
    this._initializeTieredStorage().catch(e => {
      console.warn('Tiered storage initialization failed (will use local only):', e);
    });
  }

  /**
   * Initialize tiered storage and get remote counts for lazy loading
   * @private
   */
  async _initializeTieredStorage() {
    // Only initialize if StorageMeter and TieredStorage are available
    if (typeof StorageMeter === 'undefined' || typeof tieredStorageManager === 'undefined') {
      return;
    }

    try {
      // Initialize clips tiered storage
      this.tieredClipsStore = tieredStorageManager.getStore('clips', {
        pageSize: this.clipsPerPage,
        localStorageKey: 'clips',
        supabaseTable: 'clips',
        timestampField: 'timestamp'
      });
      await this.tieredClipsStore.initialize();
      this.tieredClipsStore.localCount = this.clips.length;

      // Initialize archived clips tiered storage
      this.tieredArchivedStore = tieredStorageManager.getStore('archived', {
        pageSize: 20,
        localStorageKey: 'searchOnlyClips',
        supabaseTable: 'archived_clips',
        timestampField: 'timestamp'
      });
      await this.tieredArchivedStore.initialize();
      this.tieredArchivedStore.localCount = this.searchOnlyClips.length;

      // Get remote counts if authenticated (for accurate pagination)
      if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
        const [clipsCount, archivedCount] = await Promise.all([
          pasteCraftSupabase.getClipsCount().catch(() => 0),
          pasteCraftSupabase.getArchivedClipsCount().catch(() => 0)
        ]);
        
        this.totalClipsCount = Math.max(clipsCount, this.clips.length);
        this.totalArchivedCount = Math.max(archivedCount, this.searchOnlyClips.length);
        
        this.tieredClipsStore.totalCount = this.totalClipsCount;
        this.tieredArchivedStore.totalCount = this.totalArchivedCount;
        
        console.log(`📊 Tiered storage initialized: ${this.clips.length} local clips, ${this.totalClipsCount} total`);
      } else {
        // No Supabase - use local counts
        this.totalClipsCount = this.clips.length;
        this.totalArchivedCount = this.searchOnlyClips.length;
      }
    } catch (e) {
      console.warn('Failed to initialize tiered storage:', e);
      this.totalClipsCount = this.clips.length;
      this.totalArchivedCount = this.searchOnlyClips.length;
    }
  }
  
  async enforceClipLimit() {
    return this.clipsFeature.service.enforceClipLimit(this);
  }
  
  setupEventListeners() {
    // Category-page clip action delegation — one listener on the stable
    // parent container survives every renderCategories() re-render.
    this.setupCategoryClipDelegation();

    // Upgrade banner + modal (must run on init; banner is visible for freemium users)
    const upgradeBanner = document.getElementById('upgradeBanner');
    if (upgradeBanner) {
      upgradeBanner.addEventListener('click', () => this.openUpgradeModal());
      upgradeBanner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openUpgradeModal(); } });
    }
    const upgradeSubBtn = document.getElementById('upgradeSubBtn');
    if (upgradeSubBtn) upgradeSubBtn.addEventListener('click', () => this.openUpgradeModal());
    const upgradeModalClose = document.getElementById('upgradeModalClose');
    if (upgradeModalClose) upgradeModalClose.addEventListener('click', () => this.closeUpgradeModal());
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) upgradeModal.addEventListener('click', (e) => {
      if (e.target === upgradeModal) this.closeUpgradeModal();
    });
    const upgradeBtnBasic = document.getElementById('upgradeBtnBasic');
    if (upgradeBtnBasic) upgradeBtnBasic.addEventListener('click', () => {
      this.closeUpgradeModal();
      this._createCheckout('price_1SsbTZLOdeLTrjap9UnXhu0M');
    });
    const upgradeBtnEnhanced = document.getElementById('upgradeBtnEnhanced');
    if (upgradeBtnEnhanced) upgradeBtnEnhanced.addEventListener('click', () => {
      this.closeUpgradeModal();
      this._createCheckout('price_1SUYs3LOdeLTrjapCFFDe7td');
    });

    // Tab navigation
    document.querySelector('.tab-nav').addEventListener('click', async (e) => {
      const target = e.target;
      const tabBtn = (target && target.closest)
        ? target.closest('.tab-btn')
        : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

      if (tabBtn) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        tabBtn.classList.add('active');
        this.currentTab = tabBtn.dataset.tab;
        document.getElementById(this.currentTab + 'Tab').classList.add('active');
        
        // Persist active tab so it survives popup close
        this._saveActiveTabState();
        
        // Format controls, preview, and magic wand are always visible across all tabs
        
        // Auto-reload data when switching tabs to ensure fresh counts
        if (this.currentTab === 'clips') {
          console.log('🔄 Clips tab opened - reloading data...');
          await this.loadData();
          this.renderChips();
          console.log('✅ Clips data refreshed');
        } else if (this.currentTab === 'categories') {
          console.log('🔄 Categories tab opened - reloading data...');
          await this.loadData();
          this.renderCategories();
          this.updateCategoryBulkActions();
          console.log('✅ Categories data refreshed');
        } else if (this.currentTab === 'search') {
          console.log('🔄 Search tab opened - reloading data...');
          await this.loadData();
          this.renderSearchResults();
          this.updateSearchBulkActions();
          console.log('✅ Search data refreshed');
        } else if (this.currentTab === 'ai') {
          this.loadAIGallery();
          this.migrateProfileImageToGallery();
        } else if (this.currentTab === 'notes') {
          console.log('🔄 Notes tab opened - loading notes...');
          await this.loadNotes();
          this.renderNotes();
          console.log('✅ Notes loaded');
        } else if (this.currentTab === 'aiHistory') {
          console.log('🔄 AI History tab opened - loading history...');
          await this.loadAiHistory();
          this.renderAiHistoryList();
          console.log('✅ AI History loaded');
        } else if (this.currentTab === 'activity') {
          await this.loadActivityLog();
          this.renderActivityList();
        }
      }
    });

    // Manual Text Input functionality
    const manualInputToggle = document.getElementById('manualInputToggle');
    const manualInputBody = document.getElementById('manualInputBody');
    const manualInputHeader = document.querySelector('.manual-input-header');
    
    if (manualInputToggle && manualInputBody && manualInputHeader) {
      manualInputHeader.addEventListener('click', () => {
        const isVisible = manualInputBody.style.display !== 'none';
        manualInputBody.style.display = isVisible ? 'none' : 'block';
        manualInputToggle.classList.toggle('active', !isVisible);
      });
    }

    const manualInputSaveBtn = document.getElementById('manualInputSaveBtn');
    const manualInputTextarea = document.getElementById('manualInputTextarea');
    const manualInputCategory = document.getElementById('manualInputCategory');
    const manualInputClearBtn = document.getElementById('manualInputClearBtn');
    const manualInputSaveSpinner = document.getElementById('manualInputSaveSpinner');
    const manualInputSaveIcon = document.getElementById('manualInputSaveIcon');
    const manualInputSaveLabel = document.getElementById('manualInputSaveLabel');

    const setManualInputSavingState = (isSaving) => {
      if (manualInputSaveBtn) manualInputSaveBtn.disabled = !!isSaving;
      if (manualInputSaveSpinner) manualInputSaveSpinner.style.display = isSaving ? 'inline-block' : 'none';
      if (manualInputSaveIcon) manualInputSaveIcon.style.display = isSaving ? 'none' : '';
      if (manualInputSaveLabel) manualInputSaveLabel.textContent = isSaving ? 'Saving…' : 'Save Clip';
    };

    const manualInputMarkup = document.getElementById('manualInputMarkup');

    if (manualInputSaveBtn && manualInputTextarea && manualInputCategory) {
      manualInputSaveBtn.addEventListener('click', async () => {
        if (this.manualClipSaveInProgress) return;

        const text = manualInputTextarea.value.trim();
        if (!text) {
          this.showToast('Please enter some text to save');
          return;
        }

        const category = manualInputCategory.value || 'Uncategorized';
        
        // Check category limit (Uncategorized = unlimited, others = 150 max)
        if (category !== 'Uncategorized') {
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clipsInCategory = allClips.filter(clip => clip.category === category);
          
          if (clipsInCategory.length >= 150) {
            this.showToast(`Category "${category}" is full (150 clips max)`);
            return;
          }
        }

        // Build meta with markup hint if user selected a specific format
        const selectedMarkup = manualInputMarkup ? manualInputMarkup.value : 'auto';
        const clipMeta = selectedMarkup && selectedMarkup !== 'auto'
          ? { markupHint: selectedMarkup }
          : null;

        try {
          setManualInputSavingState(true);
          this.manualClipSaveInProgress = true;

          const newClip = {
            id: Date.now() + Math.random(),
            text: text,
            category: category,
            timestamp: Date.now(),
            ...(clipMeta ? { meta: clipMeta } : {})
          };

          this.clips.unshift(newClip);
          
          await this.enforceClipLimit();

          this.currentPage = 0; // Jump to first page so new clip is visible

          // Persist immediately (fast path)
          await chrome.storage.local.set({
            clips: this.clips,
            searchOnlyClips: this.searchOnlyClips,
            pc_local_updatedAt: Date.now()
          });
          
          // Notify content scripts (without auto-showing Quick View)
          try {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'clipSaved',
                  clip: newClip,
                  autoShow: false
                }).catch(() => {});
              });
            });
          } catch (error) {
            console.log('Could not notify content scripts:', error);
          }
          
          this.renderChips();
          this.renderCategories();
          this.updateCategoryFilter();
          this.updateManualInputCategories();
          this.showToast(`Saved to ${category}!`);
          
          // Clear textarea
          manualInputTextarea.value = '';

          // Background sync (do NOT block UI on network)
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncClips', this.clips, pasteCraftSupabase.syncClipsToSupabase))
            .catch(() => {});
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncArchivedClips', this.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
            .catch(() => {});
          
        } finally {
          this.manualClipSaveInProgress = false;
          setManualInputSavingState(false);
        }
      });
    }

    if (manualInputClearBtn && manualInputTextarea) {
      manualInputClearBtn.addEventListener('click', () => {
        manualInputTextarea.value = '';
        manualInputTextarea.focus();
      });
    }

    // PDF Upload functionality
    this.initPdfExtraction();

    // Populate category dropdown
    this.updateManualInputCategories();

    // Notes functionality
    this.notesFeature.events.registerNotesEvents(this);

    this.clipsFeature.events.registerClipEvents(this);

    // Category management
    document.getElementById('createCategoryBtn').addEventListener('click', () => {
      this.showCreateCategoryDialog();
    });

    // Crafted Output is editable: mark as manual when user types
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
      previewArea.addEventListener('input', () => {
        this.previewIsManual = true;
      });
    }

    // Category modal events
    this.categoriesFeature.events.registerCategoryModalEvents(this);

    // Profile modal events
    document.getElementById('profileBtn').addEventListener('click', () => {
      this.showProfileModal();
    });

    document.getElementById('closeProfileModal').addEventListener('click', () => {
      this.hideProfileModal();
    });

    // Settings events — delegated to settingsFeature
    if (this.settingsFeature?.events?.initSettingsEvents) {
      try {
        this.settingsFeature.events.initSettingsEvents();
      } catch (e) {
        console.error('[Popup] Settings event init failed:', e);
      }
    } else {
      console.error('[Popup] settingsFeature not initialized');
    }

    // Breakdown modal events
    document.getElementById('closeBreakdownModal').addEventListener('click', () => {
      this.hideBreakdownModal();
    });

    document.getElementById('closeBreakdownBtn').addEventListener('click', () => {
      this.hideBreakdownModal();
    });

    document.getElementById('copyBreakdownBtn').addEventListener('click', () => {
      this.copyBreakdownText();
    });

    // Italics toggle button
    document.getElementById('breakdownItalicsBtn').addEventListener('click', () => {
      this.toggleBreakdownItalics();
    });

    // Breakdown modal overlay click to close
    document.getElementById('breakdownModal').addEventListener('click', (e) => {
      if (e.target.id === 'breakdownModal') {
        this.hideBreakdownModal();
      }
    });

    // AI History modal events
    const closeAiHistoryModal = document.getElementById('closeAiHistoryModal');
    if (closeAiHistoryModal) {
      closeAiHistoryModal.addEventListener('click', () => {
        document.getElementById('aiHistoryModal').style.display = 'none';
      });
    }
    const closeAiHistoryModalBtn = document.getElementById('closeAiHistoryModalBtn');
    if (closeAiHistoryModalBtn) {
      closeAiHistoryModalBtn.addEventListener('click', () => {
        document.getElementById('aiHistoryModal').style.display = 'none';
      });
    }
    const copyAiHistoryBtn = document.getElementById('copyAiHistoryBtn');
    if (copyAiHistoryBtn) {
      copyAiHistoryBtn.addEventListener('click', () => {
        this.copyHistoryContent();
      });
    }
    // Edit title button
    const editAiHistoryTitleBtn = document.getElementById('editAiHistoryTitleBtn');
    if (editAiHistoryTitleBtn) {
      editAiHistoryTitleBtn.addEventListener('click', () => this._startEditHistoryTitle());
    }
    const aiHistoryTitleSaveBtn = document.getElementById('aiHistoryTitleSaveBtn');
    if (aiHistoryTitleSaveBtn) {
      aiHistoryTitleSaveBtn.addEventListener('click', () => this._saveEditHistoryTitle());
    }
    const aiHistoryTitleCancelBtn = document.getElementById('aiHistoryTitleCancelBtn');
    if (aiHistoryTitleCancelBtn) {
      aiHistoryTitleCancelBtn.addEventListener('click', () => this._cancelEditHistoryTitle());
    }
    const aiHistoryTitleInput = document.getElementById('aiHistoryTitleInput');
    if (aiHistoryTitleInput) {
      aiHistoryTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._saveEditHistoryTitle();
        if (e.key === 'Escape') this._cancelEditHistoryTitle();
      });
    }
    // Continue conversation button
    const continueConversationBtn = document.getElementById('continueConversationBtn');
    if (continueConversationBtn) {
      continueConversationBtn.addEventListener('click', () => this.continueHistoryConversation());
    }
    const aiHistoryModal = document.getElementById('aiHistoryModal');
    if (aiHistoryModal) {
      aiHistoryModal.addEventListener('click', (e) => {
        if (e.target.id === 'aiHistoryModal') {
          aiHistoryModal.style.display = 'none';
        }
      });
    }
    // Clear all AI history button
    const clearAiHistoryBtn = document.getElementById('clearAiHistoryBtn');
    if (clearAiHistoryBtn) {
      clearAiHistoryBtn.addEventListener('click', () => {
        this.clearAllAiHistory();
      });
    }

    // AI History search bar
    const aiHistorySearchInput = document.getElementById('aiHistorySearchInput');
    const aiHistorySearchClear = document.getElementById('aiHistorySearchClear');
    if (aiHistorySearchInput) {
      aiHistorySearchInput.addEventListener('input', () => {
        this._aiHistorySearchQuery = aiHistorySearchInput.value.trim().toLowerCase();
        this.renderAiHistoryList();
      });
    }
    if (aiHistorySearchClear) {
      aiHistorySearchClear.addEventListener('click', () => {
        if (aiHistorySearchInput) aiHistorySearchInput.value = '';
        this._aiHistorySearchQuery = '';
        this.renderAiHistoryList();
      });
    }

    // AI History filter chips
    document.querySelectorAll('.ai-history-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ai-history-filter-chip').forEach(c => {
          c.classList.remove('active');
          c.style.background = '#f8fafc';
          c.style.color = '#64748b';
          c.style.borderColor = '#e5e7eb';
        });
        chip.classList.add('active');
        chip.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        chip.style.color = 'white';
        chip.style.borderColor = '#3b82f6';
        this._aiHistoryFilterType = chip.dataset.filter;
        this.renderAiHistoryList();
      });
      // Style the initial active chip
      if (chip.classList.contains('active')) {
        chip.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        chip.style.color = 'white';
        chip.style.borderColor = '#3b82f6';
      }
    });

    // Clip Viewer modal events
    const closeClipViewerModal = document.getElementById('closeClipViewerModal');
    if (closeClipViewerModal) {
      closeClipViewerModal.addEventListener('click', () => this.hideClipViewerModal());
    }
    const closeClipViewerBtn = document.getElementById('closeClipViewerBtn');
    if (closeClipViewerBtn) {
      closeClipViewerBtn.addEventListener('click', () => this.hideClipViewerModal());
    }
    const copyClipViewerBtn = document.getElementById('copyClipViewerBtn');
    if (copyClipViewerBtn) {
      copyClipViewerBtn.addEventListener('click', () => this.copyClipViewerText());
    }
    const clipViewerModal = document.getElementById('clipViewerModal');
    if (clipViewerModal) {
      clipViewerModal.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'clipViewerModal') {
          this.hideClipViewerModal();
        }
      });
    }

    // Breakdown tab switching
    document.querySelector('.breakdown-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.breakdown-tab');
      if (tab) {
        const level = tab.dataset.level;
        
        // Update active tab
        document.querySelectorAll('.breakdown-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update level info text
        this.updateLevelInfo(level);
        
        // Generate breakdown for this level
        this.currentBreakdownLevel = level;
        this.generateBreakdown(level);
      }
    });

    // settingsModal overlay click handled by settingsFeature.events.initSettingsEvents()

    // Delimiter controls
    document.getElementById('delimiterControl').addEventListener('click', (e) => {
      if (e.target.classList.contains('segment-btn')) {
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.delimiter = e.target.dataset.delimiter;
        this.updatePreview();
        this.updatePreviewFromSelection(); // Also update category selection preview
        this.updateDelimiterExample(); // Update example text
        
        // Handle custom delimiter
        const customInput = document.getElementById('customDelimiter');
        if (this.delimiter === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Custom delimiter input
    document.getElementById('customDelimiter').addEventListener('input', () => {
      if (this.delimiter === 'custom') {
        this.updatePreview();
        this.updatePreviewFromSelection();
        this.updateDelimiterExample(); // Update example text
      }
    });
    
    // Toggle controls
    document.getElementById('deduplicateToggle').addEventListener('change', (e) => {
      this.options.deduplicate = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('sortToggle').addEventListener('change', (e) => {
      this.options.sort = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('uppercaseToggle').addEventListener('change', (e) => {
      this.options.uppercase = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      this.copyToClipboard();
    });
    
    // Magic wand — opens preview modal
    document.getElementById('magicWand').addEventListener('click', () => {
      this.magicFormat();
    });

    // Magic info button — opens info modal
    const magicInfoBtn = document.getElementById('magicInfoBtn');
    if (magicInfoBtn) magicInfoBtn.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'flex';
    });
    const closeMagicInfo = document.getElementById('closeMagicInfo');
    if (closeMagicInfo) closeMagicInfo.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'none';
    });
    const magicInfoDone = document.getElementById('magicInfoDone');
    if (magicInfoDone) magicInfoDone.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'none';
    });
    const magicInfoOverlay = document.getElementById('magicInfoModal');
    if (magicInfoOverlay) magicInfoOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicInfoModal') magicInfoOverlay.style.display = 'none';
    });

    // Magic preview modal: close / cancel
    const closeMagicPreview = document.getElementById('closeMagicPreview');
    if (closeMagicPreview) closeMagicPreview.addEventListener('click', () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
    });
    const magicCancelBtn = document.getElementById('magicCancelBtn');
    if (magicCancelBtn) magicCancelBtn.addEventListener('click', () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
    });
    const magicPreviewOverlay = document.getElementById('magicPreviewModal');
    if (magicPreviewOverlay) magicPreviewOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicPreviewModal') magicPreviewOverlay.style.display = 'none';
    });

    // Magic preview: Craft the Magic (selected only)
    const craftSelectedBtn = document.getElementById('magicCraftSelectedBtn');
    if (craftSelectedBtn) craftSelectedBtn.addEventListener('click', async () => {
      if (this._magicSelected.size === 0) return;
      document.getElementById('magicPreviewModal').style.display = 'none';
      const stats = await this._craftMagic([...this._magicSelected]);
      this._showMagicResults(stats);
    });

    // Magic preview: Craft all Magic to clips
    const craftAllBtn = document.getElementById('magicCraftAllBtn');
    if (craftAllBtn) craftAllBtn.addEventListener('click', async () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
      const stats = await this._craftAllMagic();
      this._showMagicResults(stats);
    });

    // Magic preview: Undo
    const magicUndoBtn = document.getElementById('magicUndoBtn');
    if (magicUndoBtn) magicUndoBtn.addEventListener('click', () => {
      this._undoMagic();
    });

    // Magic results modal: close
    const closeMagicResults = document.getElementById('closeMagicResults');
    if (closeMagicResults) closeMagicResults.addEventListener('click', () => {
      document.getElementById('magicResultsModal').style.display = 'none';
    });
    const magicDoneBtn = document.getElementById('magicResultsDone');
    if (magicDoneBtn) magicDoneBtn.addEventListener('click', () => {
      document.getElementById('magicResultsModal').style.display = 'none';
    });
    const magicResultsOverlay = document.getElementById('magicResultsModal');
    if (magicResultsOverlay) magicResultsOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicResultsModal') magicResultsOverlay.style.display = 'none';
    });
    
    // AI button and tab handlers
    const aiBtn = document.getElementById('aiBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        // Switch to AI tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const aiTabBtn = document.querySelector('.tab-btn[data-tab="ai"]');
        if (aiTabBtn) {
          aiTabBtn.classList.add('active');
        }
        
        this.currentTab = 'ai';
        document.getElementById('aiTab').classList.add('active');

        // Persist active tab
        this._saveActiveTabState();

        // Refresh credits view when entering AI Lab.
        this.updateAiCreditsPills('ai-tab');

        // Defer heavy work one frame so the tab-switch paints first. Avoids
        // a stutter where layout + gallery network reads happen in the same
        // frame as the CSS class change.
        requestAnimationFrame(() => {
          this.loadAIGallery();
          this.migrateProfileImageToGallery();
        });
      });
    }

    // AI Lab internal tab navigation
    const aiLabTabsContainer = document.querySelector('.ai-lab-tabs');
    if (aiLabTabsContainer) {
      aiLabTabsContainer.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.ai-lab-tab');
        if (clickedTab) {
          // Remove active class from all AI Lab tabs
          document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
          document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
          
          // Add active class to clicked tab
          clickedTab.classList.add('active');
          
          // Show corresponding section
          const tabName = clickedTab.dataset.aiTab;
          this._currentAiLabSubTab = tabName;
          this._saveActiveTabState();

          if (tabName === 'generator') {
            document.getElementById('aiGeneratorSection').classList.add('active');
          } else if (tabName === 'gallery') {
            document.getElementById('aiGallerySection').classList.add('active');
            this.loadAIGallery();
            this.migrateProfileImageToGallery();
          } else if (tabName === 'summary') {
            document.getElementById('aiSummarySection').classList.add('active');
          }
        }
      });
    }

    // AI Breakdown standalone button
    const breakdownButton = document.querySelector('.ai-breakdown-feature');
    if (breakdownButton) {
      breakdownButton.addEventListener('click', () => {
        // Remove active class from all tabs and sections
        document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
        
        // Show breakdown section
        document.getElementById('aiBreakdownSection').classList.add('active');
        this._currentAiLabSubTab = 'breakdown';
        this._saveActiveTabState();
      });
    }

    // AI Workflow controls (toggle + selects)
    try {
      const overrideToggle = document.getElementById('aiWorkflowOverrideToggle');
      const providerEl = document.getElementById('aiProviderSelect');
      const presetEl = document.getElementById('aiWorkflowPresetSelect');

      const onChange = () => {
        // Clear stale AI result caches when model/preset changes
        this.breakdownCache = {};
        // Save quietly, then ensure UI enabled/disabled state is correct.
        this.saveAiWorkflowFromUi(true).catch(() => {});
      };

      // When provider changes, rebuild presets then save
      const onProviderChange = () => {
        const selectedProvider = providerEl ? providerEl.value : 'openai';
        this.aiWorkflow.provider = selectedProvider;
        this.aiWorkflow.preset = 'default'; // reset preset on provider switch
        // Clear stale AI result caches when provider changes
        this.breakdownCache = {};
        this.applyAiWorkflowToUi();
        // Refresh tooltip with new provider's credit costs
        this.updateAiCreditsPills('provider-change');
        // Immediately sync cache so any in-flight AI call uses new provider
        if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.setAiWorkflowConfigDirect) {
          pasteCraftSupabase.setAiWorkflowConfigDirect(this.aiWorkflow);
        }
        this.saveAiWorkflowFromUi(true).catch(() => {});
      };

      if (overrideToggle) overrideToggle.addEventListener('change', onChange);
      if (providerEl) providerEl.addEventListener('change', onProviderChange);
      if (presetEl) presetEl.addEventListener('change', onChange);

      // Initial UI state
      this.applyAiWorkflowToUi();
    } catch (_) {}

    // AI Breakdown page state
    this.selectedBreakdownLevel = null;

    // AI Breakdown page event listeners
    const clearBreakdownInput = document.getElementById('clearBreakdownInput');
    const breakdownInput = document.getElementById('breakdownInput');
    const charCounter = document.getElementById('breakdownCharCounter');
    const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
    const levelChips = document.querySelectorAll('.level-chip');
    const levelSelectionHint = document.getElementById('levelSelectionHint');

    if (clearBreakdownInput && breakdownInput) {
      clearBreakdownInput.addEventListener('click', () => {
        breakdownInput.value = '';
        if (charCounter) charCounter.textContent = '0 characters';
        this.selectedBreakdownLevel = null;
        
        // Disable and deselect all level chips
        levelChips.forEach(chip => {
          chip.disabled = true;
          chip.classList.remove('selected');
        });
        
        // Disable analyze button
        if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        
        // Reset hint
        if (levelSelectionHint) {
          levelSelectionHint.textContent = 'Type at least one sentence above to enable levels';
        }
        
        // Hide inline results
        const bdInlineResults = document.getElementById('bdInlineResults');
        if (bdInlineResults) bdInlineResults.style.display = 'none';
        this.inlineBreakdownCache = {};
        this.inlineBreakdownThreads = [];
        this.currentInlineBreakdownThreadIndex = 0;

        breakdownInput.focus();
        // Persist cleared state
        this._saveBreakdownPageState();
      });
    }

    // Character counter and level chip enabler
    if (breakdownInput && charCounter) {
      // Debounce timer for persisting breakdown input
      let _bdInputSaveTimer = null;

      breakdownInput.addEventListener('input', () => {
        const text = breakdownInput.value.trim();
        const length = breakdownInput.value.length;
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        
        // Enable level chips if at least 5 words (roughly one sentence)
        const hasEnoughText = wordCount >= 5;
        
        levelChips.forEach(chip => {
          chip.disabled = !hasEnoughText;
        });
        
        // Update hint text
        if (levelSelectionHint) {
          if (hasEnoughText) {
            levelSelectionHint.textContent = 'Select a level below to continue';
          } else {
            const remaining = 5 - wordCount;
            levelSelectionHint.textContent = `Type ${remaining} more word${remaining !== 1 ? 's' : ''} to enable levels`;
          }
        }
        
        // If text is cleared, disable analyze button and reset selection
        if (!hasEnoughText) {
          this.selectedBreakdownLevel = null;
          levelChips.forEach(chip => chip.classList.remove('selected'));
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        }

        // Persist breakdown input (debounced)
        clearTimeout(_bdInputSaveTimer);
        _bdInputSaveTimer = setTimeout(() => this._saveBreakdownPageState(), 400);
      });
    }

    // Level chip selection
    levelChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (!chip.disabled) {
          // Deselect all chips
          levelChips.forEach(c => c.classList.remove('selected'));
          
          // Select this chip
          chip.classList.add('selected');
          this.selectedBreakdownLevel = chip.dataset.level;
          
          // Enable analyze button
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = false;
          
          // Update hint
          if (levelSelectionHint) {
            const levelName = chip.querySelector('strong').textContent;
            levelSelectionHint.textContent = `${levelName} level selected - Click analyze button below`;
          }

          // Persist selected level
          this._saveBreakdownPageState();
        }
      });
    });

    // Analyze button - renders INLINE (not in modal) when from AI Lab page
    if (analyzeLevelBtn && breakdownInput) {
      analyzeLevelBtn.addEventListener('click', () => {
        const text = breakdownInput.value.trim();
        if (text && this.selectedBreakdownLevel) {
          this.startInlineBreakdown(text, this.selectedBreakdownLevel);
        }
      });
    }

    // Inline level tab clicks (switch levels inside inline results)
    document.querySelectorAll('.bd-inline-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const level = tab.dataset.inlineLevel;
        if (!level || !this.currentBreakdownText) return;

        // Update active tab
        document.querySelectorAll('.bd-inline-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Also update Step 2 chip selection
        const levelChips = document.querySelectorAll('.level-chip');
        levelChips.forEach(c => c.classList.remove('selected'));
        const matchingChip = document.querySelector(`.level-chip[data-level="${level}"]`);
        if (matchingChip) matchingChip.classList.add('selected');

        this.selectedBreakdownLevel = level;
        this.currentBreakdownLevel = level;

        // Update badge
        const badge = document.getElementById('bdInlineLevelBadge');
        const levelNames = { eli5: 'Child', elementary: 'Elementary', highschool: 'High School', college: 'College', phd: 'PhD', wiseman: 'Wise Man' };
        if (badge) badge.textContent = levelNames[level] || level;

        // Generate for this level
        this.generateBreakdownInline(level);
      });
    });

    // Inline follow-up button
    const bdInlineFollowupBtn = document.getElementById('bdInlineFollowupBtn');
    const bdInlineFollowupInput = document.getElementById('bdInlineFollowupInput');
    if (bdInlineFollowupBtn && bdInlineFollowupInput) {
      const sendInlineFollowup = () => {
        const question = bdInlineFollowupInput.value.trim();
        if (!question || !this.currentBreakdownText) return;
        bdInlineFollowupInput.value = '';
        this.sendInlineBreakdownFollowup(question);
      };
      bdInlineFollowupBtn.addEventListener('click', sendInlineFollowup);
      bdInlineFollowupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendInlineFollowup();
      });
    }

    // AI Summary page event listeners
    const summaryInput = document.getElementById('summaryInput');
    const summaryCharCounter = document.getElementById('summaryCharCounter');
    const clearSummaryInput = document.getElementById('clearSummaryInput');
    const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
    const customQuestionInput = document.getElementById('customQuestionInput');
    const customQuestionBtn = document.getElementById('customQuestionBtn');
    const backToInputBtn = document.getElementById('backToInputBtn');
    const newQuestionBtn = document.getElementById('newQuestionBtn');
    const newSummaryBtn = document.getElementById('newSummaryBtn');
    const copySummaryBtn = document.getElementById('copySummaryBtn');

    // Summary input character counter
    // Debounce timer for persisting summary input
    let _sumInputSaveTimer = null;

    if (summaryInput && summaryCharCounter) {
      summaryInput.addEventListener('input', () => {
        const length = summaryInput.value.length;
        const wordCount = summaryInput.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        summaryCharCounter.textContent = `${length} characters`;
        
        // Enable generate questions button if enough text (at least 5 words)
        if (generateQuestionsBtn) {
          generateQuestionsBtn.disabled = wordCount < 5;
        }

        // Persist summary input (debounced)
        clearTimeout(_sumInputSaveTimer);
        _sumInputSaveTimer = setTimeout(() => {
          this._currentSummarySection = 'input';
          this._saveSummaryState();
        }, 400);
      });
    }

    // Clear summary input
    if (clearSummaryInput && summaryInput) {
      clearSummaryInput.addEventListener('click', () => {
        summaryInput.value = '';
        if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
        if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
        summaryInput.focus();
        // Persist cleared state
        this._currentSummarySection = 'input';
        this._saveSummaryState();
      });
    }

    // Generate questions button
    if (generateQuestionsBtn) {
      generateQuestionsBtn.addEventListener('click', () => {
        const text = summaryInput.value.trim();
        if (text) {
          this.currentSummaryText = text;
          this.generateSummaryQuestions(text);
        }
      });
    }

    // Custom question input
    if (customQuestionInput && customQuestionBtn) {
      customQuestionInput.addEventListener('input', () => {
        customQuestionBtn.disabled = customQuestionInput.value.trim().length < 5;
      });
      
      customQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !customQuestionBtn.disabled) {
          customQuestionBtn.click();
        }
      });
    }

    // Custom question button
    if (customQuestionBtn) {
      customQuestionBtn.addEventListener('click', () => {
        const question = customQuestionInput.value.trim();
        if (question && this.currentSummaryText) {
          this.currentSummaryQuestion = question;
          this.generateSummary(this.currentSummaryText, question);
        }
      });
    }

    // Back to input button
    if (backToInputBtn) {
      backToInputBtn.addEventListener('click', () => {
        this.showSummarySection('input');
        this.currentSummaryText = null;
        this.generatedQuestions = [];
        this._currentSummarySection = 'input';
        this._saveSummaryState();
      });
    }

    // New question button
    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', () => {
        this.showSummarySection('questions');
        this._currentSummarySection = 'questions';
        this._saveSummaryState();
      });
    }

    // New summary button
    if (newSummaryBtn) {
      newSummaryBtn.addEventListener('click', () => {
        this._resetSummaryToEmpty();
        this._saveSummaryState();
      });
    }

    // Copy summary button
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', async () => {
        const content = document.getElementById('summaryResultContent').textContent;
        if (content) {
          try {
            await this.copyToClipboardFallback(content);
            this.showToast('Summary copied to clipboard!');
          } catch (error) {
            console.error('Summary copy failed:', error);
            this.showToast('Failed to copy summary', 'error');
          }
        }
      });
    }

    // Summary follow-up handlers
    const summaryFollowupInput = document.getElementById('summaryFollowupInput');
    const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');

    if (summaryFollowupInput) {
      summaryFollowupInput.addEventListener('input', (e) => {
        if (summaryFollowupBtn) {
          summaryFollowupBtn.disabled = e.target.value.trim() === '';
        }
      });

      summaryFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && this.currentSummaryText) {
          this.handleSummaryFollowup(e.target.value.trim());
        }
      });
    }

    if (summaryFollowupBtn) {
      summaryFollowupBtn.disabled = true;
      summaryFollowupBtn.addEventListener('click', () => {
        if (summaryFollowupInput && this.currentSummaryText) {
          const followupQuestion = summaryFollowupInput.value.trim();
          if (followupQuestion) {
            this.handleSummaryFollowup(followupQuestion);
          }
        }
      });
    }

    // Breakdown follow-up handlers
    const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
    const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');

    if (breakdownFollowupInput) {
      breakdownFollowupInput.addEventListener('input', (e) => {
        const hasText = e.target.value.trim() !== '';
        
        // Enable/disable send button
        if (breakdownFollowupBtn) {
          breakdownFollowupBtn.disabled = !hasText;
        }
        
        // Enable/disable level tabs
        this.toggleFollowupLevelTabs(hasText);
      });

      breakdownFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && this.currentBreakdownText) {
          this.handleBreakdownFollowup(e.target.value.trim());
        }
      });
    }

    if (breakdownFollowupBtn) {
      breakdownFollowupBtn.disabled = true;
      breakdownFollowupBtn.addEventListener('click', () => {
        if (breakdownFollowupInput && this.currentBreakdownText) {
          const followupQuestion = breakdownFollowupInput.value.trim();
          if (followupQuestion) {
            this.handleBreakdownFollowup(followupQuestion);
          }
        }
      });
    }

    // Follow-up level tab handlers
    const followupLevelTabs = document.querySelectorAll('.followup-level-tab');
    followupLevelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (!tab.classList.contains('disabled')) {
          // Remove selected from all
          followupLevelTabs.forEach(t => t.classList.remove('selected'));
          // Add selected to clicked
          tab.classList.add('selected');
          // Store selected level
          this.selectedFollowupLevel = tab.dataset.followupLevel;
          console.log('📊 Selected follow-up level:', this.selectedFollowupLevel);
          
          // ✅ FIX: Auto-submit the followup when level is clicked
          if (breakdownFollowupInput && this.currentBreakdownText) {
            const followupQuestion = breakdownFollowupInput.value.trim();
            if (followupQuestion) {
              this.handleBreakdownFollowup(followupQuestion);
            }
          }
        }
      });
    });
    
    // AI generation buttons
    const aiGenerateFromProfileBtn = document.getElementById('aiGenerateFromProfileBtn');
    const aiGenerateRandomBtn = document.getElementById('aiGenerateRandomBtn');
    const aiTimerDismiss = document.getElementById('aiTimerDismiss');
    
    if (aiGenerateFromProfileBtn) {
      aiGenerateFromProfileBtn.addEventListener('click', () => {
        this.generateAIImageFromProfile();
      });
    }
    
    if (aiGenerateRandomBtn) {
      aiGenerateRandomBtn.addEventListener('click', () => {
        this.generateRandomAIImage();
      });
    }
    
    if (aiTimerDismiss) {
      aiTimerDismiss.addEventListener('click', () => {
        this.hideAIGenerationTimer();
      });
    }
    
    // Quick Copy Button
    document.getElementById('quickCopyBtn').addEventListener('click', () => {
      this.handleQuickCopy();
    });

    // Quick Delete Button (2+ selected)
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (quickDeleteBtn) {
      quickDeleteBtn.addEventListener('click', () => {
        this.handleQuickDelete();
      });
    }

    // Bulk AI Actions (2+ selected clips) — modularized so Clips and Categories reuse the same wiring
    this._wireBulkAiButtons({
      summaryBtnId: 'bulkAiSummaryBtn',
      sendCategoriesBtnId: 'bulkSendCategoriesBtn',
      sendNotesBtnId: 'bulkSendNotesBtn',
      breakdownBtnId: 'bulkAiBreakdownBtn',
      getText: () => this._getSelectedClipsText(),
      getIdKeys: () => this._getSelectedClipIdKeys(),
      getClipObjects: () => this._getSelectedClipObjects()
    });

    this._wireBulkAiButtons({
      summaryBtnId: 'categoriesBulkAiSummaryBtn',
      sendCategoriesBtnId: 'categoriesBulkSendCategoriesBtn',
      sendNotesBtnId: 'categoriesBulkSendNotesBtn',
      breakdownBtnId: 'categoriesBulkAiBreakdownBtn',
      getText: () => this._getSelectedCategoryClipsText(),
      getIdKeys: () => this._getSelectedCategoryClipIdKeys(),
      getClipObjects: () => this._getSelectedCategoryClipObjects()
    });

    // Setup image viewer for expanded view
    this.setupImageViewer();
    
    // Initialize delimiter example text
    this.updateDelimiterExample();

    // Activity log event listeners
    this.initActivityEventListeners();
  }
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================
  
  async checkOAuthCallback() {
    try {
      const result = await chrome.storage.local.get('oauth_callback');
      if (result.oauth_callback) {
        const { access_token, refresh_token } = result.oauth_callback;
        console.log('🔐 Found OAuth callback tokens, completing sign in...');
        
        // Set session with tokens (timeout to prevent hang)
        try {
          const { error } = await Promise.race([
            pasteCraftSupabase.client.auth.setSession({ access_token, refresh_token }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('setSession timeout')), 3000))
          ]);
          
          if (!error) {
            console.log('✅ OAuth sign in completed!');
            try {
              const { data: { user } } = await Promise.race([
                pasteCraftSupabase.client.auth.getUser(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 3000))
              ]);
              
              // Create subscription for new user
              if (user) {
                await pasteCraftSupabase.createUserSubscription(user.id, user.email);
              }
            } catch (_) {}
          } else {
            console.error('❌ Failed to set session:', error);
          }
        } catch (timeoutErr) {
          console.warn('⚠️ setSession timed out, session bridge will handle auth');
        }
        
        // Clear the temporary tokens regardless
        await chrome.storage.local.remove('oauth_callback');
      }
    } catch (error) {
      console.error('❌ Error checking OAuth callback:', error);
    }
  }

  async checkPasswordResetCallback() {
    try {
      console.log('=================================');
      console.log('🔍 CHECKING PASSWORD RESET CALLBACK');
      console.log('=================================');
      console.log('📦 Reading from chrome.storage.local...');
      
      const result = await chrome.storage.local.get('password_reset_callback');
      console.log('📥 Storage result:', result);
      
      if (result.password_reset_callback) {
        const { access_token, refresh_token, type, timestamp } = result.password_reset_callback;
        console.log('✅ Password reset callback data found!');
        console.log('📦 Data details:', {
          access_token_length: access_token?.length,
          refresh_token_length: refresh_token?.length,
          type: type,
          timestamp: new Date(timestamp).toISOString(),
          age_seconds: (Date.now() - timestamp) / 1000
        });
        
        if (type === 'recovery') {
          console.log('🔑 Type is "recovery" - setting database session...');
          
          // Set session with recovery tokens
          const { error } = await pasteCraftSupabase.client.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (!error) {
            console.log('✅ Password reset session established successfully!');
            
            // Verify session
            const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
            console.log('👤 Current user after session:', user?.email);
            
            // Clear the temporary tokens
            console.log('🧹 Clearing temporary tokens from storage...');
            await chrome.storage.local.remove('password_reset_callback');
            console.log('✅ Tokens cleared');
            
            return true;
          } else {
            console.error('❌ Failed to set password reset session:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
          }
        } else {
          console.warn('⚠️ Type is not "recovery":', type);
        }
      } else {
        console.log('ℹ️ No password reset callback data in storage');
      }
    } catch (error) {
      console.error('❌ Error checking password reset callback:', error);
      console.error('Error stack:', error.stack);
    }
    return false;
  }

  async setPasswordResetSession(accessToken, refreshToken) {
    try {
      console.log('🔑 Setting password reset session from URL tokens');
      
      const { error } = await pasteCraftSupabase.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (!error) {
        console.log('✅ Password reset session established from URL!');
      } else {
        console.error('❌ Failed to set password reset session:', error);
      }
    } catch (error) {
      console.error('❌ Error setting password reset session:', error);
    }
  }
  
  showAuthModal() {
    console.log('🔐 Showing auth modal...');
    this.hideLoadingOverlay();
    document.getElementById('authModal').style.display = 'flex';
  }

  hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  // =====================================================
  // AUTH SESSION RESTORE (from chrome.storage.local bridge)
  // =====================================================

  async _getSessionBridgePayload() {
    try {
      const res = await chrome.storage.local.get(['pc_supabase_session_v1']);
      const p = res?.pc_supabase_session_v1 || null;
      return {
        access_token: p?.access_token ? String(p.access_token) : '',
        refresh_token: p?.refresh_token ? String(p.refresh_token) : '',
        expires_at: p?.expires_at ?? null,
        user_id: p?.user_id ? String(p.user_id) : '',
      };
    } catch (_) {
      return { access_token: '', refresh_token: '', expires_at: null, user_id: '' };
    }
  }

  async _refreshSupabaseTokenViaBackground(refreshToken) {
    try {
      const supabaseUrl = String(PASTECRAFT_CONFIG?.supabase?.url || '');
      const anonKey = String(PASTECRAFT_CONFIG?.supabase?.anonKey || '');
      const rt = String(refreshToken || '');
      if (!supabaseUrl || !anonKey || !rt) return null;

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'pcRefreshSupabaseToken',
          supabaseUrl,
          anonKey,
          refreshToken: rt
        }, (resp) => {
          const err = chrome.runtime?.lastError?.message ? String(chrome.runtime.lastError.message) : '';
          if (err) return resolve({ success: false, ok: false, status: 0, error: err });
          resolve(resp || null);
        });
      });

      if (!result || result.success !== true || !result.ok) return null;
      const data = result.data || {};
      const nextAccess = data?.access_token ? String(data.access_token) : '';
      const nextRefresh = data?.refresh_token ? String(data.refresh_token) : rt;
      const nextExpiresIn = Number(data?.expires_in || 0);
      const nextExpiresAt = nextExpiresIn ? Math.floor(Date.now() / 1000) + nextExpiresIn : null;
      const nextUserId = data?.user?.id ? String(data.user.id) : '';
      if (!nextAccess) return null;

      return { access_token: nextAccess, refresh_token: nextRefresh, expires_at: nextExpiresAt, user_id: nextUserId };
    } catch (_) {
      return null;
    }
  }

  async restoreSupabaseSessionFromBridge(reason = 'unknown') {
    try {
      if (!pasteCraftSupabase?.client?.auth?.getSession || !pasteCraftSupabase?.client?.auth?.setSession) return false;

      const bridge = await this._getSessionBridgePayload();
      const refreshToken = String(bridge?.refresh_token || '');
      if (!refreshToken) return false;

      // If we already have a session, do nothing.  3s timeout prevents hang.
      try {
        const existing = await Promise.race([
          pasteCraftSupabase.client.auth.getSession(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        const sess = existing?.data?.session || null;
        if (sess?.user?.id) return true;
      } catch (_) {}

      let accessToken = String(bridge?.access_token || '');
      let expiresAt = bridge?.expires_at;

      const expSec = (typeof expiresAt === 'number') ? expiresAt : Number(expiresAt);
      const needsRefresh = !accessToken || !Number.isFinite(expSec) || ((expSec * 1000) - Date.now()) < 60000;
      if (needsRefresh) {
        const refreshed = await this._refreshSupabaseTokenViaBackground(refreshToken);
        if (refreshed?.access_token) {
          accessToken = String(refreshed.access_token);
          expiresAt = refreshed.expires_at ?? expiresAt;
          // Update bridge with refreshed tokens so other contexts benefit.
          try {
            await chrome.storage.local.set({
              pc_supabase_session_v1: {
                access_token: accessToken,
                refresh_token: refreshed.refresh_token || refreshToken,
                expires_at: refreshed.expires_at ?? null,
                user_id: refreshed.user_id || bridge.user_id || null,
                updated_at: Date.now()
              }
            });
          } catch (_) {}
        }
      }

      if (!accessToken) return false;

      // 3s timeout on setSession to prevent hang
      const result = await Promise.race([
        pasteCraftSupabase.client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
      ]);

      if (result?.error) return false;
      return true;
    } catch (_) {
      return false;
    }
  }
  
  setupAuthModalEvents() {
    console.log('🔧 Setting up auth modal event listeners...');
    // Sync auth modal defaults (non-blocking)
    Promise.resolve().then(() => this.applyAuthPrefsToUi()).catch(() => {});

    // Tab switching - support both old and new tab classes
    document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const targetTab = e.target.dataset.authTab;
        document.getElementById('signinForm').style.display = targetTab === 'signin' ? 'flex' : 'none';
        document.getElementById('signupForm').style.display = targetTab === 'signup' ? 'flex' : 'none';
      });
    });

    // Password strength indicator
    const signupPassword = document.getElementById('signupPassword');
    if (signupPassword) {
      signupPassword.addEventListener('input', (e) => {
        this.updatePasswordStrength(e.target.value);
      });
    }

    // Resend Verification Email
    document.getElementById('resendVerificationLink').addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signinEmail').value;
      
      if (!email) {
        alert('📧 Please enter your email address in the Sign In form first!');
        return;
      }
      
      this.showToast('📧 Sending verification email...', 'info');
      
      const result = await pasteCraftSupabase.resendVerificationEmail(email);
      
      if (result.success) {
        alert(`✅ Verification Email Sent!\n\nCheck your inbox at: ${email}\n\nThe verification link has been sent. Click it to activate your account.\n\n⚠️ Check your spam folder if you don't see it within a few minutes.`);
        this.showToast('✅ Verification email sent! Check your inbox.', 'success');
      } else {
        this.showToast(`❌ Failed to resend: ${result.error}`, 'error');
      }
    });

    // Sign In Handler Function
    const handleSignIn = async () => {
      console.log('🔐 Sign In triggered');
      const email = document.getElementById('signinEmail').value;
      const password = document.getElementById('signinPassword').value;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInWithEmail(email, password);
      
      if (result.success) {
        // Clear freemium guest flag on successful sign-in
        this._isFreemiumGuest = false;
        chrome.storage.local.remove('pc_freemium_guest');
        await this.clearLegacyAuthPrefs();

        this.showToast('✅ Welcome back!', 'success');

        this.hideAuthModal();
        // Reload page to initialize with authenticated user
        window.location.reload();
      } else {
        // Provide helpful error messages
        let errorMessage = result.error;
        
        if (result.error.toLowerCase().includes('email not confirmed') || 
            result.error.toLowerCase().includes('email_not_confirmed')) {
          errorMessage = '📧 Email Not Verified!\n\nYou must verify your email before signing in.\n\nCheck your inbox for the verification email and click the link.\n\nCheck spam if needed.';
          alert(errorMessage);
        } else if (result.error.toLowerCase().includes('invalid') || 
                   result.error.toLowerCase().includes('credentials')) {
          errorMessage = '❌ Invalid email or password.\n\nPlease check your credentials and try again.\n\nIf you just signed up, make sure you verified your email first!';
        }
        
        this.showToast(`❌ ${errorMessage}`, 'error');
      }
    };
    
    // Sign In Button Click
    document.getElementById('signinBtn').addEventListener('click', handleSignIn);
    
    // Sign In with Enter Key
    document.getElementById('signinEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });
    
    document.getElementById('signinPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });

    // Sign Up Handler Function
    const handleSignUp = async () => {
      console.log('📝 Sign Up triggered');
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupPasswordConfirm').value;
      const agreeTerms = document.getElementById('agreeTerms').checked;
      
      if (!email || !password || !confirmPassword) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        this.showToast('⚠️ Passwords do not match', 'error');
        return;
      }
      
      // Validate password requirements
      if (!this.validatePassword(password)) {
        this.showToast('⚠️ Password does not meet requirements. Check the red requirements below.', 'error');
        return;
      }
      
      if (!agreeTerms) {
        this.showToast('⚠️ Please agree to terms and conditions', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signUpWithEmail(email, password);
      
      if (result.success) {
        // Clear freemium guest flag — user is creating an account
        this._isFreemiumGuest = false;
        chrome.storage.local.remove('pc_freemium_guest');

        // Show detailed verification instructions
        alert(`✅ Account Created Successfully!\n\n📧 IMPORTANT: Check your email (${email})\n\n1️⃣ Open the verification email\n2️⃣ Click the verification link\n3️⃣ Come back here and sign in\n\n⚠️ You CANNOT sign in until you verify your email!\n\nCheck your spam folder if you don't see it.`);
        this.showToast('✅ Check your email to verify your account!', 'success');
        // Switch to sign in tab
        document.querySelector('[data-auth-tab="signin"]').click();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    };
    
    // Sign Up Button Click
    document.getElementById('signupBtn').addEventListener('click', handleSignUp);
    
    // Sign Up with Enter Key
    document.getElementById('signupEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });
    
    document.getElementById('signupPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });
    
    document.getElementById('signupPasswordConfirm').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });

    // Google Sign In
    document.getElementById('googleSigninBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign In button clicked');
      this._isFreemiumGuest = false;
      chrome.storage.local.remove('pc_freemium_guest');
      this.showToast('🔵 Opening Google sign in...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        await this.clearLegacyAuthPrefs();
        this.showToast('✅ Signed in with Google!', 'success');
        window.location.reload();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Google Sign Up
    document.getElementById('googleSignupBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign Up button clicked');
      this._isFreemiumGuest = false;
      chrome.storage.local.remove('pc_freemium_guest');
      this.showToast('🔵 Opening Google sign up...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        await this.clearLegacyAuthPrefs();
        this.showToast('✅ Signed in with Google!', 'success');
        window.location.reload();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // =====================================================
    // SKIP TO FREEMIUM (guest mode)
    // =====================================================
    const skipBtn = document.getElementById('skipToFreemiumBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', async () => {
        console.log('🚀 Skip to PasteCraft (freemium guest) clicked');
        this._isFreemiumGuest = true;
        // ─── V2: atomically set local flag + clear cloud state ───
        await chrome.storage.local.set({ pc_freemium_guest: true });
        try { await chrome.storage.local.remove(['pc_supabase_session_v1']); } catch (_) {}
        try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}
        this.hideAuthModal();
        this.currentUser = null;
        this.userSubscription = null;

        // Show top bar
        document.getElementById('topBar').style.display = 'flex';

        // Load local-only data
        await Promise.all([
          this.loadData(),
          this.loadSettings(),
        ]);
        this.updateTopBarIdentity();
        this.setupEventListeners();
        this.renderChips();
        this.updateLastCapture();
        this.updatePreview();
        this.renderCategories();
        this.updateCategoryFilter();
        this.hideLoadingOverlay();
        this.showToast('🚀 Welcome to PasteCraft! Using free local mode.', 'success');
      });
    }

    // =====================================================
    // FORGOT PASSWORD FLOW
    // =====================================================

    // Forgot Password Link Click
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔑 Forgot password link clicked');
        // Hide main auth modal, show reset modal
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('passwordResetModal').style.display = 'flex';
        
        // Pre-fill email if user already entered it
        const signinEmail = document.getElementById('signinEmail').value;
        if (signinEmail) {
          document.getElementById('resetEmail').value = signinEmail;
        }
      });
    }

    // Cancel Reset - Back to Sign In
    document.getElementById('cancelResetBtn').addEventListener('click', () => {
      console.log('🔙 Cancel reset, back to sign in');
      document.getElementById('passwordResetModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Password Reset Handler Function
    const handlePasswordReset = async () => {
      const email = document.getElementById('resetEmail').value;
      
      if (!email) {
        this.showToast('⚠️ Please enter your email', 'error');
        return;
      }
      
      console.log('📧 Requesting password reset for:', email);
      this.showToast('📧 Sending reset link...', 'info');
      
      const result = await pasteCraftSupabase.resetPassword(email);
      
      if (result.success) {
        alert(`✅ Password Reset Email Sent!\n\nCheck your inbox at: ${email}\n\n1️⃣ Click the link in the email\n2️⃣ Set your new password on the PasteCraft website\n3️⃣ Return here and sign in with your new password\n\n⚠️ Check spam if you don't see it within 5 minutes.`);
        this.showToast('✅ Reset email sent! Check your inbox.', 'success');
        
        // Hide reset modal, show sign in
        document.getElementById('passwordResetModal').style.display = 'none';
        document.getElementById('authModal').style.display = 'flex';
      } else {
        this.showToast(`❌ Failed: ${result.error}`, 'error');
      }
    };
    
    // Submit Reset Request
    document.getElementById('resetRequestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handlePasswordReset();
    });
    
    // Password Reset with Enter Key
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePasswordReset();
      }
    });

    // =====================================================
    // NEW PASSWORD FLOW (after clicking email link)
    // =====================================================

    // Password strength for new password
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', (e) => {
        this.updateNewPasswordStrength(e.target.value);
        this.checkPasswordMatch();
      });
    }

    // Check password match on confirm password input
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    if (confirmNewPasswordInput) {
      confirmNewPasswordInput.addEventListener('input', () => {
        this.checkPasswordMatch();
      });
    }

    // New Password Handler Function
    const handleNewPassword = async () => {
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      
      // Validate password requirements
      if (!this.validatePassword(newPassword)) {
        this.showToast('⚠️ Password does not meet requirements', 'error');
        return;
      }
      
      // Check if passwords match
      if (newPassword !== confirmPassword) {
        this.showToast('⚠️ Passwords do not match', 'error');
        return;
      }
      
      console.log('🔐 Updating password...');
      this.showToast('🔄 Updating password...', 'info');
      
      const result = await pasteCraftSupabase.updatePassword(newPassword);
      
      if (result.success) {
        alert('✅ Password Updated Successfully!\n\nYou can now sign in with your new password.');
        this.showToast('✅ Password updated!', 'success');
        
        // Hide new password modal, show sign in
        document.getElementById('newPasswordModal').style.display = 'none';
        document.getElementById('authModal').style.display = 'flex';
        
        // Clear the hash from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        this.showToast(`❌ Failed: ${result.error}`, 'error');
      }
    };
    
    // Submit New Password
    document.getElementById('newPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleNewPassword();
    });
    
    // New Password with Enter Key
    document.getElementById('newPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNewPassword();
      }
    });
    
    document.getElementById('confirmNewPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNewPassword();
      }
    });

    // Close App Button
    document.getElementById('closeAppBtn').addEventListener('click', () => {
      // If we're in an iframe (content-script overlay), send message to parent
      if (window.self !== window.top) {
        const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
        window.parent.postMessage({ type: 'PASTECRAFT_CLOSE_POPUP' }, parentOrigin);
      } else {
        // Otherwise just close the window (for standalone popup)
        window.close();
      }
    });

    // Support Forms (Team/Help/Support/Improve/Report Bugs)
    const openSupport = (type) => {
      try {
        this.openSupportForm(type);
      } catch (e) {
        console.error('Support form open failed:', e);
        this.showToast('❌ Could not open support form', 'error');
      }
    };

    const teamBtn = document.getElementById('supportTeamBtn');
    const helpBtn = document.getElementById('supportHelpBtn');
    const supportBtn = document.getElementById('supportSupportBtn');
    const improveBtn = document.getElementById('supportImproveBtn');
    const reportBugsBtn = document.getElementById('supportReportBugsBtn');

    teamBtn && teamBtn.addEventListener('click', () => openSupport('team'));
    helpBtn && helpBtn.addEventListener('click', () => openSupport('help'));
    supportBtn && supportBtn.addEventListener('click', () => openSupport('support'));
    improveBtn && improveBtn.addEventListener('click', () => openSupport('howcanweimprove'));
    reportBugsBtn && reportBugsBtn.addEventListener('click', () => openSupport('reportbugs'));

    const closeSupportBtn = document.getElementById('closeSupportFormModal');
    const cancelSupportBtn = document.getElementById('cancelSupportForm');
    const sendSupportBtn = document.getElementById('sendSupportForm');
    const supportModal = document.getElementById('supportFormModal');

    closeSupportBtn && closeSupportBtn.addEventListener('click', () => this.closeSupportForm());
    cancelSupportBtn && cancelSupportBtn.addEventListener('click', () => this.closeSupportForm());
    supportModal && supportModal.addEventListener('click', (e) => {
      if (e && e.target && e.target.id === 'supportFormModal') {
        this.closeSupportForm();
      }
    });
    sendSupportBtn && sendSupportBtn.addEventListener('click', async () => {
      await this.submitSupportForm();
    });
    
    // Sign Out
    document.getElementById('signOutBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        // UI-first: make sign-out feel instant.
        try {
          const topBar = document.getElementById('topBar');
          if (topBar) topBar.style.display = 'none';
        } catch (_) {}

        this.currentUser = null;
        this.userSubscription = null;
        this._isFreemiumGuest = false;
        // ─── V2: clear ALL auth state atomically ───
        chrome.storage.local.remove(['pc_freemium_guest', 'pc_supabase_session_v1']);
        this.showAuthModal();
        this.showToast('Signed out.', 'success');

        // Best-effort: clear local auth + stop background sync/realtime without blocking UI.
        pasteCraftSupabase.signOutFast()
          .catch((e) => {
            // User is already signed out locally; only surface if useful.
            console.warn('Sign-out cleanup failed:', e?.message || e);
          });
      }
    });
  }

  openSupportForm(type) {
    this.currentSupportFormType = type;
    const titleEl = document.getElementById('supportFormTitle');
    const infoEl = document.getElementById('supportFormInfo');
    const fieldsEl = document.getElementById('supportFormFields');
    const subjectEl = document.getElementById('supportFormSubject');
    const descEl = document.getElementById('supportFormDescription');
    const statusEl = document.getElementById('supportFormStatus');

    const SUPPORT_FORM_SCHEMAS = {
      reportbugs: {
        blurb: 'Report bugs and UX/UI discrepancies.',
        fields: [
          { key: 'where', label: 'Where did it happen? (optional)', type: 'text', maxLen: 160, placeholder: 'Page, feature, or screen' },
          { key: 'steps', label: 'Steps to reproduce (optional)', type: 'textarea', maxLen: 800, placeholder: '1) …\n2) …\n3) …' },
          { key: 'expected_vs_actual', label: 'Expected vs actual (optional)', type: 'textarea', maxLen: 800, placeholder: 'Expected …\nActual …' },
        ],
      },
      help: {
        blurb: 'How do I use the app? Where do I find this feature? Add examples.',
        fields: [
          { key: 'feature', label: 'Feature / question (optional)', type: 'text', maxLen: 160, placeholder: 'What are you trying to do?' },
          { key: 'example', label: 'Example (optional)', type: 'textarea', maxLen: 800, placeholder: 'Example input/output or scenario…' },
        ],
      },
      support: {
        blurb: 'Login, signup, errors, and account/subscription concerns.',
        fields: [
          { key: 'category', label: 'Category (optional)', type: 'select', options: ['Login', 'Signup', 'Error', 'Account', 'Subscription', 'Other'] },
          { key: 'error_message', label: 'Error message (optional)', type: 'textarea', maxLen: 800, placeholder: 'Paste the exact error message (if any)…' },
        ],
      },
      howcanweimprove: {
        blurb: 'Feature requests and UX/UI improvements.',
        fields: [
          { key: 'request_type', label: 'Request type (optional)', type: 'select', options: ['Feature request', 'UX/UI improvement', 'Other'] },
          { key: 'why', label: 'Why this matters (optional)', type: 'textarea', maxLen: 800, placeholder: 'What problem does this solve? What would “better” look like?' },
        ],
      },
      team: {
        blurb: 'Talk to the team, work for us, partnerships, etc.',
        fields: [
          { key: 'topic', label: 'Topic (optional)', type: 'select', options: ['Talk to the team', 'Work for us', 'Partnership', 'Press', 'Other'] },
          { key: 'contact', label: 'Best way to contact you (optional)', type: 'text', maxLen: 160, placeholder: 'Email/phone/link (we’ll reply to your account email by default)' },
          { key: 'links', label: 'Links (optional)', type: 'textarea', maxLen: 800, placeholder: 'Portfolio, LinkedIn, website, docs…' },
        ],
      },
    };

    const schema = SUPPORT_FORM_SCHEMAS[type] || { blurb: '', fields: [] };

    const titles = {
      team: '👥 Team',
      help: '🆘 Help',
      support: '💬 Support',
      howcanweimprove: '💡 How can we improve?',
      reportbugs: '🐞 Report a bug',
    };

    if (titleEl) titleEl.textContent = `📨 ${titles[type] || 'Contact PasteCraft'}`;

    const userEmail = this.currentUser?.email || '';
    if (infoEl) {
      infoEl.innerHTML = '';

      // Freemium guest notice — prompt to create account for email support
      if (this._isFreemiumGuest) {
        const notice = document.createElement('div');
        notice.className = 'freemium-account-notice';
        notice.innerHTML = '<div class="notice-title">\u26A0\uFE0F Account Required for Email Support</div>'
          + '<div class="notice-text">Create a free account to get email support priority.<br>Without an account, we cannot reply to your request.</div>'
          + '<button class="notice-btn" id="freemiumCreateAccountBtn">Create Free Account</button>';
        infoEl.appendChild(notice);
        setTimeout(() => {
          const btn = document.getElementById('freemiumCreateAccountBtn');
          if (btn) {
            btn.addEventListener('click', () => {
              this.closeSupportForm();
              this._isFreemiumGuest = false;
              chrome.storage.local.remove('pc_freemium_guest');
              this.showAuthModal();
              const signupTab = document.querySelector('[data-auth-tab="signup"]');
              if (signupTab) signupTab.click();
            });
          }
        }, 0);
      }

      const line1 = document.createElement('div');
      line1.textContent = this._isFreemiumGuest
        ? 'You are using PasteCraft without an account.'
        : userEmail
        ? `From: ${userEmail} • We’ll reply to this email.`
        : `We’ll reply to your PasteCraft account email.`;
      infoEl.appendChild(line1);

      if (schema.blurb) {
        const line2 = document.createElement('div');
        line2.textContent = schema.blurb;
        line2.style.marginTop = '6px';
        line2.style.color = '#374151';
        infoEl.appendChild(line2);
      }
    }

    if (fieldsEl) {
      fieldsEl.innerHTML = '';
      for (const field of schema.fields || []) {
        if (!field || !field.key) continue;
        const wrapper = document.createElement('div');
        wrapper.className = 'support-form-field';

        const label = document.createElement('label');
        const inputId = `supportField_${field.key}`;
        label.htmlFor = inputId;
        label.textContent = field.label || field.key;

        let inputEl = null;
        if (field.type === 'textarea') {
          const ta = document.createElement('textarea');
          ta.className = 'support-form-textarea';
          if (field.maxLen) ta.maxLength = field.maxLen;
          if (field.placeholder) ta.placeholder = field.placeholder;
          ta.rows = 3;
          inputEl = ta;
        } else if (field.type === 'select') {
          const sel = document.createElement('select');
          sel.className = 'support-form-input';
          const optEmpty = document.createElement('option');
          optEmpty.value = '';
          optEmpty.textContent = 'Select…';
          sel.appendChild(optEmpty);
          for (const opt of field.options || []) {
            const o = document.createElement('option');
            o.value = String(opt);
            o.textContent = String(opt);
            sel.appendChild(o);
          }
          inputEl = sel;
        } else {
          const inp = document.createElement('input');
          inp.className = 'support-form-input';
          inp.type = 'text';
          if (field.maxLen) inp.maxLength = field.maxLen;
          if (field.placeholder) inp.placeholder = field.placeholder;
          inputEl = inp;
        }

        inputEl.id = inputId;
        inputEl.setAttribute('data-support-field', field.key);

        wrapper.appendChild(label);
        wrapper.appendChild(inputEl);
        fieldsEl.appendChild(wrapper);
      }
    }
    if (subjectEl) subjectEl.value = '';
    if (descEl) descEl.value = '';
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      statusEl.style.color = '#111827';
    }

    const modal = document.getElementById('supportFormModal');
    if (modal) modal.style.display = 'flex';
  }

  closeSupportForm() {
    const modal = document.getElementById('supportFormModal');
    if (modal) modal.style.display = 'none';
  }

  async submitSupportForm() {
    const type = this.currentSupportFormType;
    const subjectEl = document.getElementById('supportFormSubject');
    const descEl = document.getElementById('supportFormDescription');
    const statusEl = document.getElementById('supportFormStatus');
    const sendBtn = document.getElementById('sendSupportForm');

    const subject = (subjectEl?.value || '').trim();
    const description = (descEl?.value || '').trim();
    const fields = {};
    try {
      const fieldEls = document.querySelectorAll('#supportFormFields [data-support-field]');
      fieldEls.forEach((el) => {
        const key = el?.getAttribute && el.getAttribute('data-support-field');
        if (!key) return;
        const raw = typeof el.value === 'string' ? el.value : '';
        const val = raw.trim();
        if (val) fields[key] = val;
      });
    } catch (_) {
      // ignore field collection failures
    }

    if (!subject || !description) {
      this.showToast('⚠️ Please add subject and description', 'error');
      return;
    }

    try {
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
      }

      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#111827';
        statusEl.textContent = 'Sending…';
      }

      const { data: { session } } = await pasteCraftSupabase.client.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        this.showToast('❌ Please sign in again', 'error');
        return;
      }

      const endpoint = `https://pastecraft.com/.netlify/functions/support-ticket?v=${Date.now()}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          subject,
          description,
          fields,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('Support ticket failed:', resp.status, text);
        this.showToast('❌ Could not send message', 'error');
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.color = '#b91c1c';
          statusEl.textContent = resp.status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'Failed to send. Please try again.';
        }
        return;
      }

      this.showToast('✅ Sent', 'success');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#065f46';
        statusEl.textContent = 'Sent successfully.';
      }

      setTimeout(() => this.closeSupportForm(), 600);
    } catch (e) {
      console.error('Support ticket error:', e);
      this.showToast('❌ Could not send message', 'error');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#b91c1c';
        statusEl.textContent = 'Failed to send. Please try again.';
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    }
  }
  
  renderChips() {
    return this.clipsFeature.render.renderChips(this);
  }

  /**
   * Lazy load a page of clips from Supabase
   * @private
   */
  async _lazyLoadClipsPage(startIndex, pageSize, container) {
    return this.clipsFeature.render.lazyLoadClipsPage(this, startIndex, pageSize, container);
  }
  
  renderPagination() {
    return this.clipsFeature.render.renderPagination(this);
  }
  
  createChip(clip, index) {
    return this.clipsFeature.render.createChip(this, clip, index);
  }
  
  toggleChip(clipIdKey, chipElement) {
    return this.clipsFeature.state.toggleChip(this, clipIdKey, chipElement);
  }
  
  toggleSearchClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleSearchClip(this, clipId, itemElement);
  }
  
  toggleCategoryClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleCategoryClip(this, clipId, itemElement);
  }
  
  syncOptionToggles() {
    // Sync UI toggle states with internal options
    const deduplicateToggle = document.getElementById('deduplicateToggle');
    const sortToggle = document.getElementById('sortToggle');
    const uppercaseToggle = document.getElementById('uppercaseToggle');
    
    if (deduplicateToggle) deduplicateToggle.checked = this.options.deduplicate;
    if (sortToggle) sortToggle.checked = this.options.sort;
    if (uppercaseToggle) uppercaseToggle.checked = this.options.uppercase;
  }
  
  async removeChip(clipIdKey) {
    return this.clipsFeature.service.removeChip(this, clipIdKey);
  }
  
  updateLastCapture() {
    return this.clipsFeature.render.updateLastCapture(this);
  }
  
  getTimeAgo(timestamp) {
    return this.clipsFeature.render.getTimeAgo(timestamp);
  }
  
  updatePreview() {
    const previewArea = document.getElementById('previewArea');
    const orderedIds = this.getSelectedClipIdsInUiOrder();
    const selectedTexts = orderedIds
      .map(id => this.clips.find(c => this._clipIdKey(c?.id) === id)?.text)
      .filter(Boolean);
    
    if (selectedTexts.length === 0) {
      // Don't wipe user edits when nothing is selected
      if (!this.previewIsManual && this.previewLastAutoValue) {
        previewArea.value = '';
        this.previewLastAutoValue = '';
      }
      return;
    }
    
    let processedTexts = [...selectedTexts];
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    
    if (this.options.sort) {
      processedTexts.sort();
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }
    
    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      pipe: ' | ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const output = processedTexts.join(delimiters[this.delimiter] || ', ');
    previewArea.value = output;
    this.previewIsManual = false;
    this.previewLastAutoValue = output;
    
    // Update quick copy button visibility
    this.updateQuickCopyButton();
  }
  
  updateDelimiterExample() {
    const exampleText = document.querySelector('.example-text');
    if (!exampleText) return;
    
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ' | '
    };
    
    const delimiter = delimiters[this.delimiter] || ', ';
    const items = ['apple', 'banana', 'cherry'];
    
    // For newline, show it visually
    if (this.delimiter === 'newline') {
      exampleText.textContent = 'apple ↵ banana ↵ cherry';
    } else {
      exampleText.textContent = items.join(delimiter);
    }
  }
  
  // Fallback clipboard method for extension popups (Clipboard API blocked by permissions policy)
  async copyToClipboardFallback(text) {
    return this.clipsFeature.service.copyToClipboardFallback(text);
  }
  
  async copyToClipboard() {
    return this.clipsFeature.service.copyToClipboard(this);
  }
  
  async handleQuickCopy() {
    return this.clipsFeature.service.handleQuickCopy(this);
  }

  async handleQuickDelete() {
    return this.clipsFeature.service.handleQuickDelete(this);
  }
  
  updateQuickCopyButton() {
    return this.clipsFeature.render.updateQuickCopyButton(this);
  }

  _getSelectedClipsText() {
    return this._getSelectedClipObjects().map(c => c.text).join('\n\n');
  }

  _getSelectedClipIdKeys() {
    return this.clipsFeature.state.getSelectedClipIdKeys(this);
  }

  _getSelectedClipObjects() {
    return this.clipsFeature.state.getSelectedClipObjects(this);
  }

  _getSelectedCategoryClipIdKeys() {
    return this.clipsFeature.state.getSelectedCategoryClipIdKeys(this);
  }

  _getSelectedCategoryClipObjects() {
    return this.clipsFeature.state.getSelectedCategoryClipObjects(this);
  }

  _getSelectedCategoryClipsText() {
    return this._getSelectedCategoryClipObjects().map(c => c.text).join('\n\n');
  }

  _wireBulkAiButtons(config) {
    if (!config) return;
    const {
      summaryBtnId,
      sendCategoriesBtnId,
      sendNotesBtnId,
      breakdownBtnId,
      getText,
      getIdKeys,
      getClipObjects
    } = config;

    const summaryBtn = summaryBtnId ? document.getElementById(summaryBtnId) : null;
    if (summaryBtn && typeof getText === 'function') {
      summaryBtn.addEventListener('click', () => {
        const text = getText();
        if (text) this.showSummaryModal(text);
      });
    }

    const sendCategoriesBtn = sendCategoriesBtnId ? document.getElementById(sendCategoriesBtnId) : null;
    if (sendCategoriesBtn && typeof getIdKeys === 'function') {
      sendCategoriesBtn.addEventListener('click', () => {
        const ids = getIdKeys();
        if (!ids || ids.length === 0) return;
        this.pendingBulkClipIds = ids;
        this.pendingText = null;
        this.pendingClipId = null;
        this.showCategoryModal(true);
      });
    }

    const sendNotesBtn = sendNotesBtnId ? document.getElementById(sendNotesBtnId) : null;
    if (sendNotesBtn && typeof getClipObjects === 'function') {
      sendNotesBtn.addEventListener('click', async () => {
        const clips = getClipObjects();
        if (!clips || clips.length === 0) return;
        await this.loadNotes();
        this.pendingBulkClipsForNotes = clips;
        this.pendingClipForNotes = null;
        this.showAlbumPicker();
      });
    }

    const breakdownBtn = breakdownBtnId ? document.getElementById(breakdownBtnId) : null;
    if (breakdownBtn && typeof getText === 'function') {
      breakdownBtn.addEventListener('click', () => {
        const text = getText();
        if (text) this.showBreakdownModal(text);
      });
    }
  }
  
  // ─── Magic Button: Content Type Detection ───
  _detectContentType(text, meta) {
    return this.aiLabFeature.magic._detectContentType.call(this, text, meta);
  }

  // ─── Magic Button: Category Suggestion ───
  _suggestCategory(contentType) {
    return this.aiLabFeature.magic._suggestCategory.call(this, contentType);
  }

  // ─── Magic Button: Content Enhancement ───
  _enhanceContent(text, contentType) {
    return this.aiLabFeature.magic._enhanceContent.call(this, text, contentType);
  }

  // ─── Magic Button: Type Labels (shared) ───
  _magicTypeLabels() {
    return this.aiLabFeature.magic._magicTypeLabels.call(this);
  }

  // ─── Magic Button: Analyze All Clips ───
  _analyzeMagicClips() {
    return this.aiLabFeature.magic._analyzeMagicClips.call(this);
  }

  // ─── Magic Button: Open Preview Modal ───
  magicFormat() {
    return this.aiLabFeature.magic.magicFormat.call(this);
  }

  // ─── Magic Button: Render a Page of Clips in Modal ───
  _renderMagicPage(page) {
    return this.aiLabFeature.magic._renderMagicPage.call(this, page);
  }

  // ─── Magic Button: Escape HTML helper ───
  _escHtml(str) {
    return this.aiLabFeature.magic._escHtml.call(this, str);
  }

  // ─── Magic Button: Pagination Controls ───
  _renderMagicPagination() {
    return this.aiLabFeature.magic._renderMagicPagination.call(this);
  }

  // ─── Magic Button: Update Selected Count ───
  _updateMagicSelectedCount() {
    return this.aiLabFeature.magic._updateMagicSelectedCount.call(this);
  }

  // ─── Magic Button: Check if user has AI (premium) access ───
  _hasAiAccess() {
    const sub = this.userSubscription;
    if (!sub) return false;
    const tier = String(sub.subscription_tier || '').toLowerCase();
    const status = String(sub.subscription_status || '').toLowerCase();
    const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
    const hasCouponAi = !!(sub.has_unlimited_ai === true || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()));
    const isPaidPremium = (tier === 'premium' || tier === 'admin') && (status === 'active' || status === 'past_due');
    return isPaidPremium || hasCouponAi;
  }

  // ─── Magic Button: Content types that should skip AI formatting ───
  _skipAiFormatTypes() {
    return this.aiLabFeature.magic._skipAiFormatTypes.call(this);
  }

  // ─── Magic Button: Apply Magic to Specific Clips ───
  async _craftMagic(clipIds) {
    return this.aiLabFeature.magic._craftMagic.call(this, clipIds);
  }

  // ─── Magic Button: Craft All with Undo Snapshot ───
  async _craftAllMagic() {
    return this.aiLabFeature.magic._craftAllMagic.call(this);
  }

  // ─── Magic Button: Undo Last Magic ───
  async _undoMagic() {
    return this.aiLabFeature.magic._undoMagic.call(this);
  }

  // ─── Magic Button: Show Results Modal ───
  _showMagicResults(stats) {
    return this.aiLabFeature.magic._showMagicResults.call(this, stats);
  }

  
  showConfetti() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const container = document.body;
    
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: 6px;
          height: 6px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -10px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          animation: confetti 3s linear forwards;
        `;
        
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
      }, i * 50);
    }
  }

  // Search and Filter Functions
  renderSearchResults() {
    return this.clipsFeature.render.renderSearchResults(this);
  }

  // Backwards-compat: older code paths still call this name
  performSearch() {
    return this.renderSearchResults();
  }

  filterClips() {
    return this.clipsFeature.render.filterClips(this);
  }

  createSearchResultItem(clip) {
    return this.clipsFeature.render.createSearchResultItem(this, clip);
  }

  // Category Management Functions
  renderCategories() {
    return this.categoriesFeature.render.renderCategories(this);
  }

  createCategoryItem(category) {
    return this.categoriesFeature.render.createCategoryItem(this, category);
  }

  showCreateCategoryDialog() {
    return this.categoriesFeature.render.showCreateCategoryDialog(this);
  }

  setActionButtonLoading(buttonId, isLoading, loadingText = 'Loading...') {
    if (!buttonId) return;
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }

    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-loading-spinner" aria-hidden="true"></span>${this.escapeHtml(loadingText)}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  async createCategory(name, icon, options = {}) {
    return this.categoriesFeature.service.createCategory(this, name, icon, options);
  }

  async editCategory(category) {
    return this.categoriesFeature.service.editCategory(this, category);
  }

  async deleteCategory(category) {
    return this.categoriesFeature.service.deleteCategory(this, category);
  }

  updateCategoryFilter() {
    return this.categoriesFeature.render.updateCategoryFilter(this);
  }

  updateManualInputCategories() {
    return this.categoriesFeature.render.updateManualInputCategories(this);
  }

  // ── PDF Extraction ──────────────────────────────────────────────
  initPdfExtraction() {
    const pdfBtn = document.getElementById('pdfUploadBtn');
    const pdfInput = document.getElementById('pdfFileInput');
    if (!pdfBtn || !pdfInput) return;

    pdfBtn.addEventListener('click', () => pdfInput.click());

    pdfInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      pdfInput.value = ''; // reset so same file can be re-selected
      await this.openPdfExtractModal(file);
    });

    // Modal controls
    const closeBtn = document.getElementById('pdfExtractCloseBtn');
    const cancelBtn = document.getElementById('pdfExtractCancelBtn');
    const saveBtn = document.getElementById('pdfExtractSaveBtn');
    const modal = document.getElementById('pdfExtractModal');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closePdfModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closePdfModal());
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closePdfModal();
    });
    if (saveBtn) saveBtn.addEventListener('click', () => this.savePdfClips());

    // Radio change: update save label + auto-switch to "All" tab when not in selectedPage mode
    document.querySelectorAll('input[name="pdfSaveMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this._updatePdfSaveLabel();
        const mode = radio.value;
        if (mode !== 'selectedPage' && typeof this._pdfActiveTab !== 'number') return;
        if (mode === 'selectedPage' && this._pdfActiveTab === 'all') {
          // Nudge user to pick a page — switch to P1
          if (this._pdfPages && this._pdfPages.length > 0) {
            this.switchPdfTab(0);
          }
        }
      });
    });
  }

  async openPdfExtractModal(file) {
    const modal = document.getElementById('pdfExtractModal');
    const loading = document.getElementById('pdfExtractLoading');
    const options = document.getElementById('pdfExtractOptions');
    const preview = document.getElementById('pdfExtractPreview');
    const saveBtn = document.getElementById('pdfExtractSaveBtn');
    const fileNameEl = document.getElementById('pdfFileName');
    const pageCountEl = document.getElementById('pdfPageCount');
    const loadingText = document.getElementById('pdfLoadingText');

    // Reset state
    this._pdfPages = [];
    this._pdfActiveTab = 'all';
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (pageCountEl) pageCountEl.textContent = '…';
    if (saveBtn) saveBtn.disabled = true;
    if (loading) loading.style.display = 'flex';
    if (options) options.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (modal) modal.style.display = 'flex';

    // Populate category dropdown in modal
    this.populatePdfCategoryDropdown();

    try {
      if (loadingText) loadingText.textContent = 'Reading PDF…';
      const arrayBuffer = await file.arrayBuffer();

      if (loadingText) loadingText.textContent = 'Extracting text…';
      const pages = await this.extractPdfText(arrayBuffer);
      this._pdfPages = pages;

      if (pageCountEl) pageCountEl.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;

      // Build page tabs
      this.buildPdfPageTabs(pages);

      // Show all text by default
      const textarea = document.getElementById('pdfPreviewTextarea');
      if (textarea) textarea.value = pages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n');

      if (loading) loading.style.display = 'none';
      if (options) options.style.display = 'flex';
      if (preview) preview.style.display = 'flex';
      if (saveBtn) saveBtn.disabled = false;
    } catch (err) {
      console.error('PDF extraction failed:', err);
      if (loading) loading.style.display = 'none';
      this.showToast('Failed to extract PDF text. The file may be scanned/image-only.');
      this.closePdfModal();
    }
  }

  async extractPdfText(arrayBuffer) {
    // Configure pdf.js worker
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      pages.push(strings.join(' ').replace(/\s{2,}/g, ' ').trim());
    }
    return pages;
  }

  buildPdfPageTabs(pages) {
    const container = document.getElementById('pdfPreviewTabs');
    if (!container) return;
    container.innerHTML = '';

    // "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'pdf-page-tab active';
    allTab.textContent = 'All';
    allTab.dataset.page = 'all';
    allTab.addEventListener('click', () => this.switchPdfTab('all'));
    container.appendChild(allTab);

    pages.forEach((_, idx) => {
      const tab = document.createElement('button');
      tab.className = 'pdf-page-tab';
      tab.textContent = `P${idx + 1}`;
      tab.dataset.page = String(idx);
      tab.addEventListener('click', () => this.switchPdfTab(idx));
      container.appendChild(tab);
    });
  }

  switchPdfTab(pageIndex) {
    this._pdfActiveTab = pageIndex;
    const tabs = document.querySelectorAll('.pdf-page-tab');
    tabs.forEach(t => t.classList.remove('active'));

    const textarea = document.getElementById('pdfPreviewTextarea');
    if (!textarea) return;

    if (pageIndex === 'all') {
      textarea.value = this._pdfPages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n');
      tabs[0]?.classList.add('active');
    } else {
      textarea.value = this._pdfPages[pageIndex] || '';
      tabs[pageIndex + 1]?.classList.add('active');

      // If "Save selected page" mode is active, auto-switch radio to it when clicking a numbered page tab
      const selectedPageRadio = document.querySelector('input[name="pdfSaveMode"][value="selectedPage"]');
      if (selectedPageRadio) {
        selectedPageRadio.checked = true;
        this._updatePdfSaveLabel();
      }
    }
  }

  /** Update the Save button label to reflect current mode + selection */
  _updatePdfSaveLabel() {
    const label = document.getElementById('pdfSaveLabel');
    if (!label) return;
    const mode = document.querySelector('input[name="pdfSaveMode"]:checked')?.value || 'single';
    if (mode === 'selectedPage' && typeof this._pdfActiveTab === 'number') {
      label.textContent = `Save Page ${this._pdfActiveTab + 1} to Clips`;
    } else {
      label.textContent = 'Save to Clips';
    }
  }

  populatePdfCategoryDropdown() {
    return this.categoriesFeature.render.populatePdfCategoryDropdown(this);
  }

  async savePdfClips() {
    if (!this._pdfPages || this._pdfPages.length === 0) return;

    const saveBtn = document.getElementById('pdfExtractSaveBtn');
    const spinner = document.getElementById('pdfSaveSpinner');
    const label = document.getElementById('pdfSaveLabel');
    if (saveBtn) saveBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (label) label.textContent = 'Saving…';

    try {
      const mode = document.querySelector('input[name="pdfSaveMode"]:checked')?.value || 'single';
      const category = document.getElementById('pdfExtractCategory')?.value || 'Uncategorized';
      const fileName = document.getElementById('pdfFileName')?.textContent || 'PDF';

      let clipsToSave = [];

      if (mode === 'single') {
        const allText = this._pdfPages.join('\n\n');
        if (allText.trim()) {
          clipsToSave.push({
            id: Date.now() + Math.random(),
            text: allText.trim(),
            category,
            timestamp: Date.now(),
            meta: { source: 'pdf', fileName }
          });
        }
      } else if (mode === 'selectedPage') {
        // Save only the currently selected page tab
        const pageIdx = (typeof this._pdfActiveTab === 'number') ? this._pdfActiveTab : null;
        if (pageIdx === null || pageIdx < 0 || pageIdx >= this._pdfPages.length) {
          this.showToast('Please select a specific page tab (P1, P2, …) first.');
          if (saveBtn) saveBtn.disabled = false;
          if (spinner) spinner.style.display = 'none';
          if (label) label.textContent = 'Save to Clips';
          return;
        }
        const pageText = this._pdfPages[pageIdx];
        if (pageText && pageText.trim()) {
          clipsToSave.push({
            id: Date.now() + Math.random(),
            text: pageText.trim(),
            category,
            timestamp: Date.now(),
            meta: { source: 'pdf', fileName, page: pageIdx + 1 }
          });
        }
      } else {
        // per-page
        this._pdfPages.forEach((pageText, idx) => {
          if (pageText.trim()) {
            clipsToSave.push({
              id: Date.now() + Math.random() + idx,
              text: pageText.trim(),
              category,
              timestamp: Date.now() - idx, // slightly stagger timestamps for ordering
              meta: { source: 'pdf', fileName, page: idx + 1 }
            });
          }
        });
      }

      if (clipsToSave.length === 0) {
        this.showToast('No text found in PDF to save.');
        return;
      }

      // Category limit check
      if (category !== 'Uncategorized') {
        const allClips = [...this.clips, ...this.searchOnlyClips];
        const inCat = allClips.filter(c => c.category === category).length;
        if (inCat + clipsToSave.length > 150) {
          this.showToast(`Category "${category}" would exceed 150 clip limit.`);
          return;
        }
      }

      // Add clips to the front
      this.clips.unshift(...clipsToSave);
      await this.enforceClipLimit();

      this.currentPage = 0; // Jump to first page so new clips are visible

      // Persist
      await chrome.storage.local.set({
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips,
        pc_local_updatedAt: Date.now()
      });

      // Notify content scripts
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'clipSaved',
              clip: clipsToSave[0],
              autoShow: false
            }).catch(() => {});
          });
        });
      } catch (_) {}

      // Refresh UI
      this.renderChips();
      this.renderCategories();
      this.updateCategoryFilter();
      this.updateManualInputCategories();
      this.showToast(`Saved ${clipsToSave.length} clip${clipsToSave.length > 1 ? 's' : ''} from PDF!`);

      // Background sync
      Promise.resolve()
        .then(() => pasteCraftSupabase.syncWithQueue('syncClips', this.clips, pasteCraftSupabase.syncClipsToSupabase))
        .catch(() => {});
      Promise.resolve()
        .then(() => pasteCraftSupabase.syncWithQueue('syncArchivedClips', this.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
        .catch(() => {});

      this.closePdfModal();
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (label) label.textContent = 'Save to Clips';
    }
  }

  closePdfModal() {
    const modal = document.getElementById('pdfExtractModal');
    if (modal) modal.style.display = 'none';
    this._pdfPages = [];
    this._pdfActiveTab = 'all';
  }

  // Utility Functions
  // getTimeAgo moved up to line ~1483 to avoid duplication

  async appendDeletedItems(storageKey, items) {
    if (!storageKey || !Array.isArray(items) || items.length === 0) {
      return;
    }

    try {
      const result = await chrome.storage.local.get([storageKey]);
      const existing = Array.isArray(result[storageKey]) ? result[storageKey] : [];
      const merged = [...existing, ...items];
      await chrome.storage.local.set({ [storageKey]: merged });
    } catch (error) {
      throw error;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async copyClipToClipboard(text) {
    return this.clipsFeature.service.copyClipToClipboard(this, text);
  }

  showToast(message) {
    // Single-instance toast (no stacking) + safe auto-dismiss.
    const TOAST_DURATION_MS = 3000;

    this._toastState = this._toastState || {
      el: null,
      timerId: null,
      lastMessage: null,
      lastShownAt: 0
    };

    const now = Date.now();
    const msg = String(message ?? '');
    if (!msg) return;

    // Dedupe: ignore rapid repeats of the same message (prevents "stuck" toasts from re-firing).
    if (this._toastState.lastMessage === msg && (now - this._toastState.lastShownAt) < 1200) {
      return;
    }
    this._toastState.lastMessage = msg;
    this._toastState.lastShownAt = now;

    // Create once, then reuse.
    if (!this._toastState.el || !this._toastState.el.isConnected) {
      const toast = document.createElement('div');
      toast.setAttribute('data-pastecraft-toast', '1');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
      this._toastState.el = toast;
    }

    const toast = this._toastState.el;
    toast.textContent = msg;

    // Reset any pending dismissal.
    if (this._toastState.timerId) {
      clearTimeout(this._toastState.timerId);
      this._toastState.timerId = null;
    }

    // Show (animate in).
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Hide after duration (animate out, then remove).
    this._toastState.timerId = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, TOAST_DURATION_MS);
  }

  // Category Modal Functions
  showCategoryModal(isReassignment = false) {
    return this.categoriesFeature.events.showCategoryModal(this, isReassignment);
  }

  hideCategoryModal() {
    return this.categoriesFeature.events.hideCategoryModal(this);
  }

  // Breakdown Modal Functions
  showBreakdownModalWithLevel(text, level) {
    this.currentBreakdownText = text;
    this.currentBreakdownLevel = level;
    this.breakdownCache = {}; // Cache explanations to avoid re-generating
    this._activeBreakdownHistoryId = null; // New breakdown conversation
    
    // Set original text
    document.getElementById('breakdownOriginalText').textContent = text;
    
    // Set text length
    const wordCount = text.trim().split(/\s+/).length;
    document.getElementById('breakdownTextLength').textContent = `${wordCount} words`;
    
    // Clear previous result
    document.getElementById('breakdownResult').innerHTML = '';
    
    // Set active tab to the selected level
    document.querySelectorAll('.breakdown-tab').forEach(tab => {
      if (tab.dataset.level === level) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update level info for the pre-selected level
    this.updateLevelInfo(level);
    
    // Show modal
    document.getElementById('breakdownModal').style.display = 'flex';
    
    // Auto-generate explanation for the selected level
    this.generateBreakdown(level);
  }

  hideBreakdownModal() {
    document.getElementById('breakdownModal').style.display = 'none';
    this.currentBreakdownText = null;
    this.currentBreakdownLevel = null;
    this.breakdownCache = {};
    
    // Reset threads
    this.breakdownThreads = [];
    this.currentBreakdownThreadIndex = 0;
    
    // Hide follow-up and pagination
    const followupContainer = document.getElementById('breakdownFollowupContainer');
    const paginationContainer = document.getElementById('breakdownThreadPagination');
    if (followupContainer) followupContainer.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';
    
    // Reset italics state
    const breakdownResult = document.getElementById('breakdownResult');
    const italicsBtn = document.getElementById('breakdownItalicsBtn');
    if (breakdownResult && italicsBtn) {
      breakdownResult.classList.remove('italics');
      italicsBtn.classList.remove('active');
    }
  }

  toggleBreakdownItalics() {
    const breakdownResult = document.getElementById('breakdownResult');
    const italicsBtn = document.getElementById('breakdownItalicsBtn');
    
    if (breakdownResult && italicsBtn) {
      const isActive = breakdownResult.classList.toggle('italics');
      italicsBtn.classList.toggle('active');
      console.log(`✒️ Breakdown Result Italics ${isActive ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.error('❌ Elements not found:', {breakdownResult, italicsBtn});
    }
  }

  updateLevelInfo(level) {
    const levelDescriptions = {
      eli5: '<strong>Child Level:</strong> Super simple explanation using basic words and fun examples',
      elementary: '<strong>Elementary School Level:</strong> Clear explanation for kids ages 8-11 with relatable examples',
      highschool: '<strong>High School Level:</strong> More sophisticated explanation with relevant concepts for teenagers',
      college: '<strong>College Level:</strong> Academic explanation with detailed analysis and nuanced understanding',
      phd: '<strong>PhD/Expert Level:</strong> Technical analysis with advanced concepts and scholarly depth',
      wiseman: '<strong>Wise Man:</strong> Philosophical wisdom with metaphors, life lessons, and profound insights'
    };

    document.getElementById('levelInfoText').innerHTML = levelDescriptions[level] || '';
  }

  async generateBreakdown(level) {
    // Premium check
    let _premiumOk = true;
    if (this.currentUser) {
      _premiumOk = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown');
    }
    if (!_premiumOk) return;

    // Check cache first
    if (this.breakdownCache[level]) {
      const resultEl = document.getElementById('breakdownResult');
      resultEl.innerHTML = await this._renderAiResponse(this.breakdownCache[level]);
      return;
    }

    const loadingEl = document.getElementById('breakdownLoading');
    const resultEl = document.getElementById('breakdownResult');

    try {
      // Show loading
      loadingEl.style.display = 'flex';
      resultEl.innerHTML = '';

      // Generate explanation
      const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);

      // Cache the raw result (for copy + persistence)
      const formatted = this._formatAiOutput(explanation);
      this.breakdownCache[level] = formatted;

      // Render as rich HTML and display
      resultEl.innerHTML = await this._renderAiResponse(formatted);
      loadingEl.style.display = 'none';

      // Add to threads (store raw text)
      this.breakdownThreads.push({
        question: `Breakdown at ${level} level`,
        answer: formatted,
        level,
        timestamp: Date.now()
      });
      this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;

      // Show follow-up input after first response
      const followupContainer = document.getElementById('breakdownFollowupContainer');
      if (followupContainer) {
        followupContainer.style.display = 'block';
      }

      // Update thread pagination (only show after 2nd response)
      if (this.breakdownThreads.length >= 2) {
        this.renderThreadPagination('breakdown');
      }

      // Persist breakdown modal state (results + threads)
      this._saveBreakdownModalState();

      // Save to AI history
      await this.saveAiHistory('breakdown', this.currentBreakdownText, this.breakdownThreads);

    } catch (error) {
      console.error('Failed to generate breakdown:', error);
      resultEl.innerHTML = '❌ Failed to generate explanation. Please check your OpenAI API key configuration.';
      loadingEl.style.display = 'none';
      this.showToast('Failed to generate explanation');
    }
  }

  copyBreakdownText() {
    const text = document.getElementById('breakdownResult').textContent;
    if (text) {
      this.copyToClipboardFallback(text)
        .then(() => this.showToast('Explanation copied to clipboard!'))
        .catch((error) => {
          console.error('Breakdown copy failed:', error);
          this.showToast('Failed to copy explanation', 'error');
        });
    }
  }

  // ==================== INLINE BREAKDOWN (AI Lab Page) ====================

  startInlineBreakdown(text, level) {
    this.currentBreakdownText = text;
    this.currentBreakdownLevel = level;
    this.inlineBreakdownCache = {};
    this.inlineBreakdownThreads = [];
    this.currentInlineBreakdownThreadIndex = 0;

    // Show the results section
    const resultsSection = document.getElementById('bdInlineResults');
    if (resultsSection) {
      resultsSection.style.display = 'block';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Set active tab
    document.querySelectorAll('.bd-inline-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.inlineLevel === level);
    });

    // Update badge
    const levelNames = { eli5: 'Child', elementary: 'Elementary', highschool: 'High School', college: 'College', phd: 'PhD', wiseman: 'Wise Man' };
    const badge = document.getElementById('bdInlineLevelBadge');
    if (badge) badge.textContent = levelNames[level] || level;

    // Generate
    this.generateBreakdownInline(level);
  }

  async generateBreakdownInline(level) {
    return this.aiLabFeature.summary.generateBreakdownInline.call(this, level);
  }

  async sendInlineBreakdownFollowup(question) {
    return this.aiLabFeature.summary.sendInlineBreakdownFollowup.call(this, question);
  }

  renderInlineBreakdownPagination() {
    return this.aiLabFeature.summary.renderInlineBreakdownPagination.call(this);
  }

  showSummarySection(section) {
    return this.aiLabFeature.summary.showSummarySection.call(this, section);
  }

  async generateSummaryQuestions(text) {
    return this.aiLabFeature.summary.generateSummaryQuestions.call(this, text);
  }

  async generateSummary(text, question) {
    return this.aiLabFeature.summary.generateSummary.call(this, text, question);
  }

  _formatAiOutput(raw) {
    return this.aiLabFeature.summary._formatAiOutput.call(this, raw);
  }

  async _renderAiResponse(rawText) {
    return this.aiLabFeature.summary._renderAiResponse.call(this, rawText);
  }

  async handleSummaryFollowup(followupQuestion) {
    const summaryFollowupInput = document.getElementById('summaryFollowupInput');
    if (summaryFollowupInput) {
      summaryFollowupInput.value = '';
      summaryFollowupInput.disabled = true;
    }
    
    const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');
    if (summaryFollowupBtn) {
      summaryFollowupBtn.disabled = true;
    }

    // Generate summary with follow-up question
    await this.generateSummary(this.currentSummaryText, followupQuestion);

    // Re-enable input
    if (summaryFollowupInput) {
      summaryFollowupInput.disabled = false;
    }
  }

  // Handle Breakdown Follow-up
  async handleBreakdownFollowup(followupQuestion) {
    return this.aiLabFeature.summary.handleBreakdownFollowup.call(this, followupQuestion);
  }

  toggleFollowupLevelTabs(enable) {
    const tabs = document.querySelectorAll('.followup-level-tab');
    tabs.forEach(tab => {
      if (enable) {
        tab.classList.remove('disabled');
        tab.disabled = false;
      } else {
        tab.classList.add('disabled');
        tab.disabled = true;
      }
    });
  }

  // Render Thread Pagination Boxes
  renderThreadPagination(type) {
    const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
    const currentIndex = type === 'summary' ? this.currentSummaryThreadIndex : this.currentBreakdownThreadIndex;
    const paginationContainer = document.getElementById(`${type}ThreadPagination`);

    console.log('🔍 renderThreadPagination called:', { type, threadsLength: threads.length, containerFound: !!paginationContainer });

    if (!paginationContainer || threads.length < 2) {
      console.log('⚠️ Early return:', { containerExists: !!paginationContainer, threadsLength: threads.length });
      return;
    }

    // Show pagination
    paginationContainer.style.display = 'flex';
    paginationContainer.style.gap = '8px';
    paginationContainer.innerHTML = '';

    console.log('✅ Rendering', threads.length, 'thread boxes for', type);

    threads.forEach((thread, index) => {
      const box = document.createElement('div');
      box.className = `thread-box ${index === currentIndex ? 'active' : ''}`;
      box.textContent = index + 1;
      
      // Force styling inline as fallback
      box.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: ${index === currentIndex ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
        border: 2px solid ${index === currentIndex ? '#2563eb' : '#cbd5e1'};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: ${index === currentIndex ? 'white' : '#64748b'};
        transition: all 0.25s ease;
        position: relative;
      `;
      
      // Generate tooltip with AI summary title
      const tooltipText = this.generateThreadTooltip(thread, index + 1);
      box.setAttribute('data-tooltip', tooltipText);
      box.setAttribute('title', tooltipText); // Fallback native tooltip
      
      box.addEventListener('click', () => {
        this.navigateToThread(type, index);
      });

      paginationContainer.appendChild(box);
      console.log(`✅ Added thread box ${index + 1}, className: "${box.className}"`);
    });

    console.log('✅ Pagination rendered. Container display:', paginationContainer.style.display);
  }

  // Generate tooltip text for thread box
  generateThreadTooltip(thread, number) {
    // Extract first few words as summary title
    const question = thread.question || 'Response';
    const summaryTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
    return `${number}. "${summaryTitle}"`;
  }

  // Navigate to specific thread
  async navigateToThread(type, index) {
    const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
    if (index < 0 || index >= threads.length) return;

    const thread = threads[index];
    const contentEl = document.getElementById(type === 'summary' ? 'summaryResultContent' : 'breakdownResult');

    if (contentEl) {
      contentEl.innerHTML = await this._renderAiResponse(thread.answer);
    }

    // Update current index
    if (type === 'summary') {
      this.currentSummaryThreadIndex = index;
    } else {
      this.currentBreakdownThreadIndex = index;
    }

    // Re-render pagination to update active state
    this.renderThreadPagination(type);
  }

  populateCategoryOptions() {
    return this.categoriesFeature.render.populateCategoryOptions(this);
  }

  async handleClipDelete() {
    if (!this.pendingClipId) return;
    
    if (confirm('Delete this clip permanently?')) {
      const result = await this.deleteClipsByIdKeys([this.pendingClipId], {
        includeArchived: true,
        reason: 'delete:handleClipDelete',
        closeCategoryModal: true,
        clearSelection: true,
        rerender: true
      });
      this.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
    }
  }

  async saveTextWithCategory() {
    return this.categoriesFeature.service.saveTextWithCategory(this);
  }

  showCreateCategoryFromModal() {
    return this.categoriesFeature.service.showCreateCategoryFromModal(this);
  }

  // Settings Management Functions — delegated to settingsFeature
  async loadSettings() {
    return this.settingsFeature.storage.loadSettings();
  }

  async saveSettings(silent = false, skipAuthPrefs = false) {
    return this.settingsFeature.storage.saveSettings(silent, skipAuthPrefs);
  }

  syncThemeToggles() {
    return this.settingsFeature.storage.syncThemeToggles();
  }

  async saveThemeOnly(nextTheme, silent = false) {
    return this.settingsFeature.storage.saveThemeOnly(nextTheme, silent);
  }

  async getCurrentProfileImageForWidget() {
    return this.settingsFeature.storage.getCurrentProfileImageForWidget();
  }

  async saveWidgetIconUseProfileImage(enabled, silent = false) {
    return this.settingsFeature.storage.saveWidgetIconUseProfileImage(enabled, silent);
  }

  async exportBackupToJson() {
    return this.settingsFeature.backup.exportBackupToJson();
  }

  async exportClipsToCsv() {
    return this.settingsFeature.backup.exportClipsToCsv();
  }

  async importBackupFromJsonMerge(file) {
    return this.settingsFeature.backup.importBackupFromJsonMerge(file);
  }

  async showSettingsModal() {
    return this.settingsFeature.render.showSettingsModal();
  }

  hideSettingsModal() {
    return this.settingsFeature.render.hideSettingsModal();
  }

  showHelpModal() {
    return this.settingsFeature.render.showHelpModal();
  }

  hideHelpModal() {
    return this.settingsFeature.render.hideHelpModal();
  }

  updateStorageStats() {
    return this.settingsFeature.render.updateStorageStats();
  }

  async cleanupOldClips() {
    return this.settingsFeature.storage.cleanupOldClips();
  }

  getCutoffTime(period) {
    return this.settingsFeature.storage.getCutoffTime(period);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    return this.clipsFeature.render.createCategoryClipsHTML(this, clips, categoryId);
  }

  toggleCategoryDropdown(categoryItem, category) {
    return this.categoriesFeature.render.toggleCategoryDropdown(this, categoryItem, category);
  }

  /**
   * Category-page clip handlers are wired via a single delegated click listener
   * on `#categoriesList` (see `setupCategoryClipDelegation`). This method is
   * kept as a no-op stub so existing callers (`toggleCategoryDropdown`) stay
   * safe — delegation survives every `renderCategories()` re-render, unlike
   * the previous per-button listeners which detached whenever the list was
   * re-rendered while a dropdown was open.
   */
  attachClipHandlers(_dropdown, _category) {
    // Intentionally empty. Delegated handler on #categoriesList owns all
    // clicks for .category-clip rows and .category-clip-*-btn buttons.
  }

  /**
   * Mirrors the clips-page pattern (see `createChip`): one click handler on
   * the stable parent container resolves the action button via
   * `e.target.closest('.category-clip-*-btn')` at click time, so it keeps
   * working even when `renderCategories()` wipes and rebuilds the DOM while
   * a dropdown is open.
   *
   * Idempotent: guarded by `_categoryClipDelegationAttached` so repeat calls
   * from `setupEventListeners()` don't stack listeners.
   */
  setupCategoryClipDelegation() {
    return this.clipsFeature.events.setupCategoryClipDelegation(this);
  }

  toggleClipSelection(clipElement, category) {
    const clipId = this._clipIdKey(clipElement.dataset.clipId);
    const isSelected = clipElement.classList.contains('selected');
    
    console.log(`🎯 Toggling clip selection - ID: ${clipId} (${typeof clipId}), Currently selected: ${isSelected}`);
    
    if (isSelected) {
      clipElement.classList.remove('selected');
      console.log(`❌ Deselecting clip ${clipId}`);
      // Remove from selection tracking
      this.removeClipFromSelection(clipId);
    } else {
      clipElement.classList.add('selected');
      console.log(`✅ Selecting clip ${clipId}`);
      // Add to selection tracking
      this.addClipToSelection(clipId);
    }
    
    this.updatePreviewFromSelection();
  }

  addClipToSelection(clipId) {
    if (!this.selectedCategoryClips) {
      this.selectedCategoryClips = new Set();
    }
    this.selectedCategoryClips.add(this._clipIdKey(clipId));
    console.log(`✅ Added clip ${clipId} to selection. Total:`, Array.from(this.selectedCategoryClips));
  }

  removeClipFromSelection(clipId) {
    if (this.selectedCategoryClips) {
      this.selectedCategoryClips.delete(this._clipIdKey(clipId));
    }
    console.log(`🗑️ Removed clip ${clipId} from selection. Remaining:`, Array.from(this.selectedCategoryClips));
  }

  _findClipLocationById(clipId) {
    const idKey = this._clipIdKey(clipId);
    const activeIndex = this.clips.findIndex(c => this._clipIdKey(c?.id) === idKey);
    if (activeIndex >= 0) return { listName: 'clips', index: activeIndex, clip: this.clips[activeIndex] };

    const archivedIndex = this.searchOnlyClips.findIndex(c => this._clipIdKey(c?.id) === idKey);
    if (archivedIndex >= 0) return { listName: 'searchOnlyClips', index: archivedIndex, clip: this.searchOnlyClips[archivedIndex] };

    return null;
  }

  promptEditClipTitle(clipId) {
    const location = this._findClipLocationById(clipId);
    if (!location?.clip) {
      this.showToast('Clip not found');
      return;
    }

    const currentTitle = this._clipTitle(location.clip);
    const fallback = this._clipFallbackTitle(location.clip, 80);
    const nextTitle = prompt('Edit clip title (leave blank to clear):', currentTitle || fallback);
    if (nextTitle === null) return;

    this.updateClipTitleById(clipId, nextTitle);
  }

  async updateClipTitleById(clipId, title) {
    const idKey = this._clipIdKey(clipId);
    const normalizedTitle = typeof PCClipTitle !== 'undefined'
      ? PCClipTitle.normalizeTitle(title)
      : String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);

    return this._queueClipOp(async () => {
      const location = this._findClipLocationById(idKey);
      if (!location?.clip) {
        this.showToast('Clip not found');
        return false;
      }

      const snapshot = {
        clips: PasteCraftCRUD.createSnapshot(this.clips),
        searchOnlyClips: PasteCraftCRUD.createSnapshot(this.searchOnlyClips),
        notes: PasteCraftCRUD.createSnapshot(this.notes)
      };

      const updatedAt = Date.now();
      const nextClip = {
        ...location.clip,
        title: normalizedTitle,
        updatedAt
      };

      if (location.listName === 'clips') {
        this.clips[location.index] = nextClip;
      } else {
        this.searchOnlyClips[location.index] = nextClip;
      }

      const changedNotes = this._updateNoteClipTitlesById(idKey, normalizedTitle, updatedAt);

      try {
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({
            clips: this.clips,
            searchOnlyClips: this.searchOnlyClips,
            notes: this.notes,
            pc_local_updatedAt: updatedAt
          });
        });

        const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
        const verifiedPool = [...(verification.clips || []), ...(verification.searchOnlyClips || [])];
        const verifiedClip = verifiedPool.find(c => this._clipIdKey(c?.id) === idKey);
        if (!verifiedClip || this._clipTitle(verifiedClip) !== normalizedTitle) {
          throw new Error('Verification failed: clip title was not persisted');
        }

        const syncName = location.listName === 'clips' ? 'syncClips' : 'syncArchivedClips';
        const syncFn = location.listName === 'clips'
          ? pasteCraftSupabase.syncClipsToSupabase
          : pasteCraftSupabase.syncArchivedClipsToSupabase;
        Promise.resolve()
          .then(() => pasteCraftSupabase.syncWithQueue(syncName, [nextClip], syncFn))
          .catch((error) => console.error('Failed to sync clip title:', error));

        if (changedNotes.length > 0) {
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncNotes', changedNotes, pasteCraftSupabase.syncNotesToSupabase))
            .catch((error) => console.error('Failed to sync note clip titles:', error));
        }

        this.renderChips();
        this.renderSearchResults();
        this.renderCategories();
        this.renderNotes();
        this.showToast(normalizedTitle ? 'Clip title updated' : 'Clip title cleared');
        return true;
      } catch (error) {
        this.clips = snapshot.clips;
        this.searchOnlyClips = snapshot.searchOnlyClips;
        this.notes = snapshot.notes;
        await chrome.storage.local.set({
          clips: this.clips,
          searchOnlyClips: this.searchOnlyClips,
          notes: this.notes,
          pc_local_updatedAt: Date.now()
        });
        console.error('❌ Clip title update failed:', error);
        this.showToast('Failed to update clip title');
        return false;
      }
    });
  }

  _updateNoteClipTitlesById(clipId, title, updatedAt) {
    const changedNotes = [];
    const idKey = this._clipIdKey(clipId);

    (this.notes || []).forEach(note => {
      if (!Array.isArray(note?.clips)) return;
      let changed = false;
      note.clips = note.clips.map(clip => {
        if (this._clipIdKey(clip?.id) !== idKey) return clip;
        changed = true;
        return { ...clip, title };
      });
      if (changed) {
        note.updatedAt = updatedAt;
        changedNotes.push(PasteCraftCRUD.createSnapshot(note));
      }
    });

    return changedNotes;
  }

  updatePreviewFromSelection() {
    return this.clipsFeature.state.updatePreviewFromSelection(this);
  }

  getSelectedCategoryClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedCategoryClipIdsInUiOrder(this);
  }

  updateCategoryBulkActions() {
    return this.clipsFeature.render.updateCategoryBulkActions(this);
  }

  async handleCategoryBulkCopy() {
    return this.clipsFeature.service.handleCategoryBulkCopy(this);
  }

  async handleCategoryBulkDelete() {
    return this.clipsFeature.service.handleCategoryBulkDelete(this);
  }

  getSelectedSearchClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedSearchClipIdsInUiOrder(this);
  }

  updatePreviewFromSearchSelection() {
    return this.clipsFeature.state.updatePreviewFromSearchSelection(this);
  }

  updateSearchBulkActions() {
    return this.clipsFeature.render.updateSearchBulkActions(this);
  }

  async handleSearchBulkCopy() {
    return this.clipsFeature.service.handleSearchBulkCopy(this);
  }

  // Search-Only Storage Management
  async moveToSearchStorage(overflowClips) {
    const { searchOnlyClips = [] } = await chrome.storage.local.get(['searchOnlyClips']);
    searchOnlyClips.unshift(...overflowClips);
    
    // Keep search storage reasonable (max 1000 total archived clips)
    if (searchOnlyClips.length > 1000) {
      searchOnlyClips.splice(1000);
    }
    
    this.searchOnlyClips = searchOnlyClips;
    await chrome.storage.local.set({ searchOnlyClips });
    console.log(`📦 Moved ${overflowClips.length} clips to search-only storage`);
    
    // 🔄 AUTO-SYNC TO DATABASE
    try {
      await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
      console.log('✅ Archived clips synced to database');
    } catch (error) {
      console.error('⚠️ Failed to sync archived clips to database:', error);
    }
  }

  // Profile Management Functions
  async loadUserProfile() {
    try {
      console.log('🔄 Loading user profile from chrome.storage.local...');
      const { userProfile = null } = await chrome.storage.local.get(['userProfile']);
      this.userProfile = userProfile;
      console.log('✅ Loaded user profile:', this.userProfile);
      
      if (this.userProfile?.profileImageUrl) {
        console.log('✅ Profile image URL found:', this.userProfile.profileImageUrl);
      } else {
        console.log('ℹ️ No profile image URL in saved profile');
      }
    } catch (error) {
      console.error('❌ CRITICAL: Failed to load user profile:', error);
    }
  }

  updateTopBarIdentity(imageUrlOverride = undefined) {
    const topBar = document.getElementById('topBar');
    const topLeftContainer = document.getElementById('topLeftProfileImage');
    const topLeftImg = document.getElementById('topLeftProfileImg');
    const topLeftPlaceholder = document.getElementById('topLeftProfilePlaceholder');
    const nameEl = document.getElementById('topBarFunkyName');
    const nameSection = nameEl?.closest?.('.top-bar-name-section') || null;

    if (!topBar || !topLeftContainer) return;

    // Always show top bar when authenticated
    topBar.style.display = 'flex';
    topLeftContainer.style.display = 'flex';

    const profileImageUrl =
      (typeof imageUrlOverride === 'string' ? imageUrlOverride : null) ??
      this.userProfile?.profileImageUrl ??
      '';

    // Image / placeholder
    if (!profileImageUrl) {
      if (topLeftImg) {
        topLeftImg.src = '';
        topLeftImg.style.display = 'none';
      }
      if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
    } else if (topLeftImg) {
      topLeftImg.src = profileImageUrl;
      topLeftImg.style.display = 'block';
      if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'none';

      topLeftImg.onerror = () => {
        // Fallback: if URL fails, try local base64 before placeholder
        try {
          const b = typeof this.userProfile?.profileImageBase64 === 'string' ? this.userProfile.profileImageBase64 : '';
          if (b && b.startsWith('data:image/') && topLeftImg.src !== b) {
            topLeftImg.src = b;
            topLeftImg.style.display = 'block';
            if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'none';
            return;
          }
        } catch (_) {}
        topLeftImg.style.display = 'none';
        if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
      };
    }

    // Display name: prefer funky animal name (top-left), then user's name, then email prefix
    const userName = typeof this.userProfile?.userName === 'string' ? this.userProfile.userName.trim() : '';
    const funkyName = typeof this.userProfile?.aiGeneratedName === 'string' ? this.userProfile.aiGeneratedName.trim() : '';
    const emailPrefix = typeof this.currentUser?.email === 'string' ? this.currentUser.email.split('@')[0] : '';
    const displayName = funkyName || userName || emailPrefix || (this._isFreemiumGuest ? 'Guest' : '');

    if (nameEl) {
      nameEl.textContent = displayName;
      // Must be inline-block BEFORE measuring scrollWidth
      nameEl.style.display = displayName ? 'inline-block' : 'none';
    }

    // Enable marquee only if name overflows.
    // IDEMPOTENT: skip teardown if marquee is already running with the same name
    // to prevent repeated storage-change calls from resetting the CSS animation.
    if (nameSection) {
      const prevMarqueeName = nameSection.dataset.pcMarqueeName || '';
      if (nameSection.classList.contains('is-marquee') && displayName && prevMarqueeName === displayName) {
        // Already animating this name — do nothing.
      } else {
        nameSection.classList.remove('is-marquee');
        nameSection.style.removeProperty('--pc-marquee-distance');
        nameSection.style.removeProperty('--pc-marquee-duration');
        nameSection.dataset.pcMarqueeName = '';

        if (displayName && nameEl) {
          // Measure and optionally enable marquee. Retries once if layout
          // hasn't settled (available === 0) which can happen when topBar
          // transitions from display:none → flex.
          const applyMarquee = (retryCount = 0) => {
            const available = nameSection.clientWidth;
            const needed = nameEl.scrollWidth;
            if (available === 0 && retryCount < 2) {
              setTimeout(() => applyMarquee(retryCount + 1), 120);
              return;
            }
            const distance = Math.max(0, needed - available);
            if (distance > 6) {
              const duration = Math.min(18, Math.max(8, distance / 30));
              nameSection.style.setProperty('--pc-marquee-distance', String(distance));
              nameSection.style.setProperty('--pc-marquee-duration', `${duration}s`);
              nameSection.classList.add('is-marquee');
              nameSection.dataset.pcMarqueeName = displayName;
            }
          };
          // Double-rAF: first rAF schedules layout, second rAF measures after paint.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => applyMarquee(0));
          });
        }
      }
    }
  }

  async saveUserProfile() {
    try {
      console.log('💾 Attempting to save user profile:', this.userProfile);

      await chrome.storage.local.set({ userProfile: this.userProfile });
      console.log('✅ User profile saved successfully to chrome.storage.local');
      
      // Verify the save worked
      const verification = await chrome.storage.local.get(['userProfile']);
      console.log('🔍 Verification - Profile in storage:', verification.userProfile);
      
      if (!verification.userProfile || !verification.userProfile.profileImageUrl) {
        console.error('⚠️ WARNING: Profile saved but verification failed!');
      }
      
      // 🔄 AUTO-SYNC TO DATABASE
      try {
        await pasteCraftSupabase.syncUserProfileToSupabase(this.userProfile);
        console.log('✅ User profile synced to database');
      } catch (syncError) {
        console.error('⚠️ Failed to sync profile to database:', syncError);
        // Don't fail the whole save if sync fails
      }

      // Keep top bar in sync with latest profile data
      this.updateTopBarIdentity();
    } catch (error) {
      console.error('❌ CRITICAL: Failed to save user profile:', error);
      this.showToast('❌ Failed to save profile image', 'error');
    }
  }

  showProfileModal() {
    document.getElementById('profileModal').style.display = 'flex';

    // Keep theme toggle in sync (single source of truth)
    try {
      const profileToggle = document.getElementById('profileDarkModeToggle');
      if (profileToggle) profileToggle.checked = this.theme === 'dark';
    } catch (_) {}

    // Keep widget icon toggle in sync
    try {
      const widgetIconToggle = document.getElementById('widgetIconUseProfileToggle');
      if (widgetIconToggle) {
        chrome.storage.local.get(['widgetSettings'], (res) => {
          const ws = res && res.widgetSettings && typeof res.widgetSettings === 'object' ? res.widgetSettings : {};
          widgetIconToggle.checked = !!ws.widgetIconUseProfileImage;
        });
      }
    } catch (_) {}
    
    // Load existing profile data
    if (this.userProfile) {
      if (this.userProfile.userName) {
        document.getElementById('userName').value = this.userProfile.userName;
      }
      if (this.userProfile.aiGeneratedName) {
        document.getElementById('aiNameValue').textContent = this.userProfile.aiGeneratedName;
        document.getElementById('aiNameDisplay').style.display = 'flex';
      }
      if (this.userProfile.profileImageUrl) {
        document.getElementById('profileImage').src = this.userProfile.profileImageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
      }
    }

    // Update AI Generate button state based on uploaded photo
    this.updateAIGenerateButtonState();

    // Setup profile modal event listeners
    this.setupProfileModalEvents();
    
    // Add scroll listener for sticky profile image effect
    const modalBody = document.querySelector('#profileModal .modal-body');
    const imageContainer = document.querySelector('.profile-image-container');
    
    if (modalBody && imageContainer) {
      // Remove old listener if exists
      modalBody.removeEventListener('scroll', this.profileScrollHandler);
      
      // Create new handler
      this.profileScrollHandler = () => {
        if (modalBody.scrollTop > 50) {
          imageContainer.classList.add('scrolled');
        } else {
          imageContainer.classList.remove('scrolled');
        }
      };
      
      // Add listener
      modalBody.addEventListener('scroll', this.profileScrollHandler);
      console.log('✅ Profile image sticky scroll behavior enabled');
    }
  }
  
  updateAIGenerateButtonState() {
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');
    
    console.log('🔄 Updating button states...');
    console.log('AI Generated Name:', this.userProfile?.aiGeneratedName);
    console.log('Photo uploaded:', !!this.userProfile?.profileImageBase64);
    
    // Enable Animal Avatar if AI name is generated
    if (this.userProfile && this.userProfile.aiGeneratedName) {
      const match = this.userProfile.aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      console.log('Animal match found:', match ? match[1] : 'none');
      if (match) {
        generateAnimalBtn.disabled = false;
        generateAnimalBtn.classList.remove('btn-disabled');
        generateAnimalBtn.textContent = `🐾 ${match[1]} Avatar`;
        generateAnimalBtn.title = `Generate funky ${match[1]} avatar`;
        console.log(`✅ Animal Avatar button enabled for ${match[1]}`);
      } else {
        generateAnimalBtn.disabled = true;
        generateAnimalBtn.classList.add('btn-disabled');
        generateAnimalBtn.title = 'No animal detected in funky animal name';
        console.log('⚠️ AI name has no animal type');
      }
    } else {
      generateAnimalBtn.disabled = true;
      generateAnimalBtn.classList.add('btn-disabled');
      generateAnimalBtn.title = 'Generate funky animal name first';
      console.log('⚠️ No AI name generated yet');
    }
    
    // Enable My Cartoon if photo is uploaded
    if (this.userProfile && this.userProfile.profileImageBase64) {
      generateCartoonBtn.disabled = false;
      generateCartoonBtn.classList.remove('btn-disabled');
      generateCartoonBtn.title = 'Generate cartoon from your photo';
    } else {
      generateCartoonBtn.disabled = true;
      generateCartoonBtn.classList.add('btn-disabled');
      generateCartoonBtn.title = 'Upload a photo first';
    }
  }

  hideProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
  }

  setupProfileModalEvents() {
    // Idempotent: bind once per popup lifetime. Re-running on every modal
    // open forced expensive cloneNode(true)+replaceWith on ~9 nodes, which
    // caused perceptible lag when opening Profile.
    if (this._profileModalEventsBound) return;
    this._profileModalEventsBound = true;
    // Prevent multiple event listener attachments
    const profileModal = document.getElementById('profileModal');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const generateImageBtn = document.getElementById('generateImageBtn');
    const generateNameBtn = document.getElementById('generateNameBtn');
    const saveUserNameBtn = document.getElementById('saveUserNameBtn');
    const saveAiNameBtn = document.getElementById('saveAiNameBtn');
    const unsubscribeBtn = document.getElementById('unsubscribeBtn');
    const profileImageUpload = document.getElementById('profileImageUpload');
    const nameToggleBtn = document.getElementById('nameToggleBtn');
    const photoToggleBtn = document.getElementById('photoToggleBtn');
    const nameRegHeader = document.getElementById('nameRegHeader');
    const photoCreationHeader = document.getElementById('photoCreationHeader');

    // Get new buttons
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');

    
    // Remove old listeners by cloning and replacing nodes (for buttons)
    const newUploadBtn = uploadImageBtn.cloneNode(true);
    uploadImageBtn.replaceWith(newUploadBtn);
    
    const newGenerateAnimalBtn = generateAnimalBtn.cloneNode(true);
    generateAnimalBtn.replaceWith(newGenerateAnimalBtn);
    
    const newGenerateCartoonBtn = generateCartoonBtn.cloneNode(true);
    generateCartoonBtn.replaceWith(newGenerateCartoonBtn);
    
    const newSaveUserNameBtn = saveUserNameBtn.cloneNode(true);
    saveUserNameBtn.replaceWith(newSaveUserNameBtn);

    const newGenerateNameBtn = generateNameBtn.cloneNode(true);
    generateNameBtn.replaceWith(newGenerateNameBtn);

    const newSaveAiNameBtn = saveAiNameBtn.cloneNode(true);
    saveAiNameBtn.replaceWith(newSaveAiNameBtn);
    
    const newUnsubscribeBtn = unsubscribeBtn.cloneNode(true);
    unsubscribeBtn.replaceWith(newUnsubscribeBtn);

    // ✅ FIX: Clone and replace headers to remove stacked event listeners
    const newNameRegHeader = nameRegHeader.cloneNode(true);
    nameRegHeader.replaceWith(newNameRegHeader);
    
    const newPhotoCreationHeader = photoCreationHeader.cloneNode(true);
    photoCreationHeader.replaceWith(newPhotoCreationHeader);

    // Collapse/Expand handlers for Name Registration (using new cloned element)
    newNameRegHeader.addEventListener('click', () => {
      this.toggleSection('nameRegContent', 'nameToggleBtn');
    });

    // Collapse/Expand handlers for Photo Creation (using new cloned element)
    newPhotoCreationHeader.addEventListener('click', () => {
      this.toggleSection('photoCreationContent', 'photoToggleBtn');
    });

    // Loading exit button - allows user to skip waiting
    const loadingExitBtn = document.getElementById('loadingExitBtn');
    if (loadingExitBtn) {
      loadingExitBtn.addEventListener('click', () => {
        console.log('⏭️ User clicked exit button - hiding loading overlay');
        document.getElementById('profileImageLoading').style.display = 'none';
        // Show placeholder or existing image
        const profileImage = document.getElementById('profileImage');
        const placeholder = document.getElementById('profileImagePlaceholder');
        if (profileImage && profileImage.src) {
          profileImage.style.display = 'block';
        } else if (placeholder) {
          placeholder.style.display = 'flex';
        }
        // Generation continues in background
        console.log('✅ Loading screen closed - generation continues in background');
      });
    }

    // Upload image button - attach to NEW cloned button
    newUploadBtn.addEventListener('click', (e) => {
      profileImageUpload.click();
    });

    // Profile image upload
    profileImageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.handleProfileImageUpload(file);
      }
    });

    // Generate Animal Avatar - attach to NEW cloned button
    console.log('🔘 Attaching Generate Animal listener');
    newGenerateAnimalBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Animal Avatar button CLICKED!');
      await this.generateAnimalAvatar();
    });
    console.log('✅ Generate Animal event listener attached');
    
    // Generate Cartoon from Photo - attach to NEW cloned button
    console.log('🔘 Attaching Generate Cartoon listener');
    newGenerateCartoonBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate My Cartoon button CLICKED!');
      await this.generateMyCartoon();
    });
    console.log('✅ Generate Cartoon event listener attached');

    // Generate AI name - attach to NEW cloned button
    newGenerateNameBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Name button CLICKED!');
      await this.generateAIName();
    });

    // Save user name - attach to NEW cloned button
    newSaveUserNameBtn.addEventListener('click', async () => {
      try {
        const userName = document.getElementById('userName').value.trim();
        if (!userName) {
          this.showToast('⚠️ Please enter a name first', 'error');
          return;
        }

        if (!this.userProfile) this.userProfile = {};
        this.userProfile.userName = userName;

        await this.saveUserProfile();
        this.showToast('✅ Name saved', 'success');
      } catch (error) {
        console.error('Failed to save name:', error);
        this.showToast('❌ Failed to save name', 'error');
      }
    });

    // Save funky animal name - attach to NEW cloned button
    newSaveAiNameBtn.addEventListener('click', async () => {
      try {
        const aiNameFromUi = document.getElementById('aiNameValue')?.textContent?.trim() || '';
        const aiName = aiNameFromUi || (typeof this.userProfile?.aiGeneratedName === 'string' ? this.userProfile.aiGeneratedName.trim() : '');

        if (!aiName || aiName === '-') {
          this.showToast('⚠️ Please generate a funky animal name first', 'error');
          return;
        }

        if (!this.userProfile) this.userProfile = {};
        this.userProfile.aiGeneratedName = aiName;

        await this.saveUserProfile();
        this.updateAIGenerateButtonState();
        this.showToast('✅ Funky name saved', 'success');
      } catch (error) {
        console.error('Failed to save funky name:', error);
        this.showToast('❌ Failed to save funky name', 'error');
      }
    });

    // Unsubscribe - attach to NEW cloned button
    newUnsubscribeBtn.addEventListener('click', () => {
      console.log('🖱️ Unsubscribe button CLICKED!');
      this.showUnsubscribeConfirmation();
    });

    // Modal overlay click to close
    profileModal.addEventListener('click', (e) => {
      if (e.target.id === 'profileModal') {
        this.hideProfileModal();
      }
    });
  }
  
  toggleSection(contentId, toggleBtnId) {
    const content = document.getElementById(contentId);
    const toggleBtn = document.getElementById(toggleBtnId);
    
    if (content.classList.contains('collapsed')) {
      // Expand
      content.classList.remove('collapsed');
      toggleBtn.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    } else {
      // Collapse
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
    }
  }

  async handleProfileImageUpload(file) {
    try {
      this.showToast('📤 Uploading image...', 'info');

      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageUrl = typeof e?.target?.result === 'string' ? e.target.result : '';
        if (!imageUrl) {
          this.showToast('❌ Failed to read image file', 'error');
          return;
        }
        
        // Display image
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageBase64 = imageUrl;

        // Prefer storing a stable (non-data) URL to avoid gallery/storage issues.
        let finalUrl = imageUrl;
        try {
          const userIdForUpload = (this.currentUser && this.currentUser.id)
            ? this.currentUser.id
            : await pasteCraftSupabase.getChromeUserId();
          const converted = await pasteCraftSupabase.convertToPermanentProfileImageUrl(imageUrl, userIdForUpload);
          if (typeof converted === 'string' && converted) {
            finalUrl = converted;
          }
        } catch (_) {}

        this.userProfile.profileImageUrl = finalUrl;
        
        await this.saveUserProfile();

        // Keep top-left in sync immediately.
        this.displayImageTopLeft(finalUrl || imageUrl);

        // Ensure it appears in the AI Gallery right away (using stable URL if available).
        try {
          await this.addToGallery(finalUrl || imageUrl, 'upload');
          this.loadAIGallery();
        } catch (_) {}
        
        // Update AI Generate button state (enable it now)
        this.updateAIGenerateButtonState();
        
        this.showToast('✅ Profile image uploaded! Now you can generate AI avatar!', 'success');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      this.showToast('❌ Failed to upload image', 'error');
    }
  }

  async generateAnimalAvatar() {
    console.log('🐾 generateAnimalAvatar() CALLED!');
    
    // Premium check
    let hasAvatarAccess = true;
    if (this.currentUser) {
      hasAvatarAccess = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'avatar');
    }
    if (!hasAvatarAccess) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      const aiGeneratedName = this.userProfile?.aiGeneratedName;
      const animalMatch = aiGeneratedName?.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      
      if (!userName || !aiGeneratedName) {
        this.showToast('⚠️ Please generate a funky animal name first', 'error');
        return;
      }
      
      // Extract animal type
      const match = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      if (!match) {
        this.showToast('⚠️ No animal found in your funky animal name', 'error');
        return;
      }
      
      const animalType = match[1];
      
      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = `Creating your ${animalType}...`;
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast(`🐾 Creating your funky ${animalType}...`, 'info');
      document.getElementById('generateAnimalBtn').disabled = true;
      document.getElementById('generateAnimalBtn').textContent = `⏳ Creating...`;

      const description = `${userName} - ${animalType} avatar`;
      const gen = await pasteCraftSupabase.generateProfileImage(description, 'animal', aiGeneratedName);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.generatedImageUrl = imageUrl;
        this.userProfile.profileImageUrl = imageUrl; // Set as active profile image
        await this.saveUserProfile();
        console.log('✅ Animal avatar auto-saved to storage');
        
        // ✅ ADD TO AI GALLERY
        await this.addToGallery(imageUrl, 'profile');
        console.log('✅ Animal avatar added to AI Gallery');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION AFTER 10 SECONDS (with timer countdown)
        this.startProfileImageCollapse();
        
        const animalType = match[1];
        this.showToast(`✅ ${animalType} avatar created and saved!`, 'success');
        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      }
      
    } catch (error) {
      console.error('Failed to generate animal avatar:', error);
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      this.showToast('❌ Failed to generate animal avatar', 'error');
    } finally {
      document.getElementById('generateAnimalBtn').disabled = false;
      document.getElementById('generateAnimalBtn').textContent = '🐾 Animal Avatar';
    }
  }
  
  async generateMyCartoon() {
    console.log('🎨 generateMyCartoon() CALLED!');
    
    // Premium check
    let hasCartoonAccess = true;
    if (this.currentUser) {
      hasCartoonAccess = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'cartoon');
    }
    if (!hasCartoonAccess) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      const userImageBase64 = this.userProfile?.profileImageBase64;
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }
      
      if (!userImageBase64) {
        this.showToast('⚠️ Please upload a photo first', 'error');
        return;
      }

      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = 'Creating your cartoon...';
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast('🎨 Creating your cartoon avatar...', 'info');
      document.getElementById('generateCartoonBtn').disabled = true;
      document.getElementById('generateCartoonBtn').textContent = '⏳ Creating...';

      const description = `${userName} - cartoon avatar`;
      const gen = await pasteCraftSupabase.generateProfileImage(description, userImageBase64, null);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';

        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageUrl = imageUrl;
        this.userProfile.aiGeneratedImage = true;
        await this.saveUserProfile();
        console.log('✅ Cartoon image auto-saved to storage');
        
        // ✅ ADD TO AI GALLERY
        await this.addToGallery(imageUrl, 'profile');
        console.log('✅ Cartoon image added to AI Gallery');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION AFTER 10 SECONDS (with timer countdown)
        this.startProfileImageCollapse();
        
        if (userImageBase64) {
          this.showToast('✅ Your funky cartoon remix is ready and saved!', 'success');
        } else {
          this.showToast('✅ AI image generated and saved!', 'success');
        }

        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      } else {
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImagePlaceholder').style.display = 'flex';
        this.showToast('❌ Failed to generate AI image', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI profile image:', error);
      
      // Hide loading on error
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      
      // Show more helpful error message
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        this.showToast('❌ OpenAI API quota exceeded. Check your billing.', 'error');
      } else if (errorMessage.includes('invalid')) {
        this.showToast('❌ Invalid API key. Check config.js', 'error');
      } else {
        this.showToast(`❌ Error: ${errorMessage}`, 'error');
      }
    } finally {
      document.getElementById('generateCartoonBtn').disabled = false;
      document.getElementById('generateCartoonBtn').textContent = '🎨 My Cartoon';
    }
  }

  async generateAIName() {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'name')) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }

      this.showToast('🎭 Generating funky animal name...', 'info');
      document.getElementById('generateNameBtn').disabled = true;
      document.getElementById('generateNameBtn').textContent = '⏳ Generating...';

      const aiName = await pasteCraftSupabase.generateAIName(userName);

      if (aiName) {
        // Display AI name
        document.getElementById('aiNameValue').textContent = aiName;
        document.getElementById('aiNameDisplay').style.display = 'flex';

        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.userName = userName;
        this.userProfile.aiGeneratedName = aiName; // Fixed: was aiName, now aiGeneratedName
        
        await this.saveUserProfile();
        
        // Update button states to enable Animal Avatar
        this.updateAIGenerateButtonState();
        
        // ✅ SHOW COUNTDOWN TIMER AND AUTO-COLLAPSE SECTION
        this.startNameSectionCollapse();
        
        this.showToast('✅ Funky animal name generated!', 'success');
      } else {
        this.showToast('❌ Failed to generate funky animal name', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI name:', error);
      this.showToast('❌ Failed to generate funky animal name', 'error');
    } finally {
      document.getElementById('generateNameBtn').disabled = false;
      document.getElementById('generateNameBtn').textContent = 'Generate Funky Animal Name';
    }
  }

  showUnsubscribeConfirmation() {
    if (confirm('⚠️ Are you sure you want to unsubscribe from PasteCraft?\n\nThis will:\n• Delete all your clips\n• Remove all categories\n• Clear your profile data\n• This action cannot be undone!')) {
      if (confirm('🚨 FINAL WARNING: This will permanently delete ALL your data. Continue?')) {
        this.handleUnsubscribe();
      }
    }
  }

  async handleUnsubscribe() {
    try {
      this.showToast('🗑️ Deleting all data...', 'info');

      // Clear all storage
      await chrome.storage.local.clear();

      // Clear in-memory data
      this.clips = [];
      this.searchOnlyClips = [];
      this.categories = [];
      this.userProfile = null;

      // Update UI
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
      this.hideProfileModal();

      this.showToast('✅ All data deleted. You have been unsubscribed.', 'success');

      console.log('🗑️ User unsubscribed - all data cleared');

    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      this.showToast('❌ Failed to unsubscribe', 'error');
    }
  }

  // Display image and funky name in top bar
  displayImageTopLeft(imageUrl) {
    console.log('🖼️ displayImageTopLeft() called with URL:', imageUrl);
    this.updateTopBarIdentity(imageUrl);
    console.log('✅ Top bar identity updated');
  }

  // Auto-collapse profile name section after generation
  autoCollapseNameSection() {
    const content = document.getElementById('nameRegContent');
    const toggleBtn = document.getElementById('nameToggleBtn');
    const timer = document.getElementById('nameCountdownTimer');
    
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      // Hide countdown timer
      if (timer) {
        timer.style.display = 'none';
      }
      
      // Collapse the section
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
      
      console.log('✅ Name section auto-collapsed');
    }
  }

  // Start 10-second countdown with visible timer before collapsing name section
  startNameSectionCollapse() {
    const timer = document.getElementById('nameCountdownTimer');
    const countdownValue = document.getElementById('nameCountdownValue');
    
    if (!timer || !countdownValue) return;
    
    let timeLeft = 10;
    timer.style.display = 'flex';
    countdownValue.textContent = timeLeft;
    
    console.log(`⏱️ Starting 10-second visible countdown for name section`);
    
    // Clear any existing countdown
    if (this.nameCollapseInterval) {
      clearInterval(this.nameCollapseInterval);
    }
    
    this.nameCollapseInterval = setInterval(() => {
      timeLeft--;
      countdownValue.textContent = timeLeft;
      console.log(`⏱️ Name section collapse in ${timeLeft}s...`);
      
      if (timeLeft <= 0) {
        clearInterval(this.nameCollapseInterval);
        this.nameCollapseInterval = null;
        this.autoCollapseNameSection();
      }
    }, 1000);
  }

  // Auto-collapse profile photo section after generation
  autoCollapsePhotoSection() {
    const content = document.getElementById('photoCreationContent');
    const toggleBtn = document.getElementById('photoToggleBtn');
    const timer = document.getElementById('photoCountdownTimer');
    
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      // Hide countdown timer
      if (timer) {
        timer.style.display = 'none';
      }
      
      // Collapse the section
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
      
      console.log('✅ Photo section auto-collapsed');
    }
  }

  // Start 10-second countdown with visible timer before collapsing profile image section
  startProfileImageCollapse() {
    const timer = document.getElementById('photoCountdownTimer');
    const countdownValue = document.getElementById('photoCountdownValue');
    
    if (!timer || !countdownValue) return;
    
    let timeLeft = 10;
    timer.style.display = 'flex';
    countdownValue.textContent = timeLeft;
    
    console.log(`⏱️ Starting 10-second visible countdown for photo section`);
    
    // Clear any existing countdown
    if (this.profileCollapseInterval) {
      clearInterval(this.profileCollapseInterval);
    }
    
    this.profileCollapseInterval = setInterval(() => {
      timeLeft--;
      countdownValue.textContent = timeLeft;
      console.log(`⏱️ Photo section collapse in ${timeLeft}s...`);
      
      if (timeLeft <= 0) {
        clearInterval(this.profileCollapseInterval);
        this.profileCollapseInterval = null;
        this.autoCollapsePhotoSection();
      }
    }, 1000);
  }

  // Setup Image Viewer for expanded view
  setupImageViewer() {
    const modal = document.getElementById('imageViewerModal');
    const modalImg = document.getElementById('imageViewerImg');
    const closeBtn = document.getElementById('imageViewerClose');
    const profileImage = document.getElementById('profileImage');
    const topLeftImg = document.getElementById('topLeftProfileImg');
    
    // Function to show expanded image
    const showExpandedImage = (imgSrc) => {
      if (!imgSrc || imgSrc === '') return;
      modalImg.src = imgSrc;
      modal.style.display = 'flex';
    };
    
    // Click on profile image in modal
    if (profileImage) {
      profileImage.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        if (profileImage.style.display !== 'none') {
          showExpandedImage(profileImage.src);
        }
      });
    }
    
    // Click on top-left profile image
    if (topLeftImg) {
      // Remove the old onclick that opens profile modal
      const topLeftContainer = document.getElementById('topLeftProfileImage');
      if (topLeftContainer) {
        topLeftContainer.onclick = null; // Remove old handler
        topLeftImg.addEventListener('click', (e) => {
          e.stopPropagation();
          showExpandedImage(topLeftImg.src);
        });
      }
    }
    
    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    
    // Click outside image to close
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });
  }

  // Password strength indicator and validation
  updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check all requirements (matching Supabase settings)
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('req-length', hasLength);
    this.updateRequirement('req-lowercase', hasLowercase);
    this.updateRequirement('req-uppercase', hasUppercase);
    this.updateRequirement('req-number', hasNumber);
    this.updateRequirement('req-special', hasSpecial);
    
    // Calculate strength (20% each requirement)
    if (hasLength) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecial) strength += 20;
    
    strengthBar.style.width = `${strength}%`;
    
    // Color based on strength
    if (strength < 60) {
      strengthBar.style.background = '#EF4444'; // Red
    } else if (strength < 100) {
      strengthBar.style.background = '#F59E0B'; // Orange
    } else {
      strengthBar.style.background = '#10B981'; // Green
    }
  }

  // Update password requirement indicator
  updateRequirement(elementId, isValid) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const icon = element.querySelector('.requirement-icon');
    if (isValid) {
      element.classList.add('valid');
      if (icon) icon.textContent = '✓';
    } else {
      element.classList.remove('valid');
      if (icon) icon.textContent = '✗';
    }
  }

  // Validate password meets all requirements (matching Supabase settings)
  validatePassword(password) {
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return hasLength && hasLowercase && hasUppercase && hasNumber && hasSpecial;
  }

  // Update password strength for new password form (matching Supabase settings)
  updateNewPasswordStrength(password) {
    const strengthBar = document.querySelector('#newPasswordStrength .strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check all requirements
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('new-req-length', hasLength);
    this.updateRequirement('new-req-lowercase', hasLowercase);
    this.updateRequirement('new-req-uppercase', hasUppercase);
    this.updateRequirement('new-req-number', hasNumber);
    this.updateRequirement('new-req-special', hasSpecial);
    
    // Calculate strength (20% each requirement)
    if (hasLength) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecial) strength += 20;
    
    strengthBar.style.width = `${strength}%`;
    
    if (strength < 60) {
      strengthBar.style.background = '#EF4444';
    } else if (strength < 100) {
      strengthBar.style.background = '#F59E0B';
    } else {
      strengthBar.style.background = '#10B981';
    }
  }

  // Check if passwords match
  checkPasswordMatch() {
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
    const matchHint = document.getElementById('passwordMatchHint');
    
    if (!matchHint) return;
    
    if (confirmPassword.length > 0) {
      if (newPassword === confirmPassword) {
        matchHint.textContent = '✅ Passwords match';
        matchHint.style.color = '#10B981';
        matchHint.style.display = 'block';
      } else {
        matchHint.textContent = '❌ Passwords do not match';
        matchHint.style.color = '#DC2626';
        matchHint.style.display = 'block';
      }
    } else {
      matchHint.style.display = 'none';
    }
  }

  // Global message handler for background script
  static async handleMessage(message) {
    const popup = window.pasteCraftPopup;
    if (!popup) return;
    
    if (message.action === 'showCategoryModal' && message.text) {
      // This will be called from background script
      popup.pendingText = message.text;
      popup.showCategoryModal(false);
    } else if (message.action === 'clipSaved') {
      // Clip was saved externally (e.g., via context menu)
      console.log('📢 Received clipSaved message - reloading data...');

      // Fast-path: apply the clip immediately (optimistic), then reconcile from storage shortly after.
      const incoming = message.clip && typeof message.clip === 'object' ? message.clip : null;
      if (incoming && incoming.id != null) {
        const idKey = popup._clipIdKey(incoming.id);
        const exists = popup.clips && popup.clips.some(c => popup._clipIdKey(c?.id) === idKey);
        if (!exists) {
          popup.clips.unshift(incoming);
          popup.currentPage = 0; // Jump to first page so new clip is visible
        }
      }

      if (popup.currentTab === 'clips') {
        popup.renderChips();
        popup.updateLastCapture();
        popup.updatePreview();
      }
      popup.renderCategories();
      popup.updateCategoryFilter();
      popup.updateManualInputCategories();

      // Reconcile from storage (handles pagination/archive edge cases).
      setTimeout(() => {
        Promise.resolve()
          .then(() => popup.loadData())
          .then(() => {
            if (popup.currentTab === 'clips') {
              popup.renderChips();
              popup.updateLastCapture();
              popup.updatePreview();
            } else if (popup.currentTab === 'search') {
              popup.renderSearchResults();
            } else if (popup.currentTab === 'categories') {
              popup.renderCategories();
            }
          })
          .catch(() => {});
      }, 120);

      console.log('✅ UI refreshed with new clip data');
    }
  }

  // =====================================================
  // AI GALLERY & GENERATION METHODS
  // =====================================================

  async loadAIGallery() {
    try {
      // Get gallery from storage
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      this.renderAIGallery(gallery);

    } catch (error) {
      console.error('Failed to load AI gallery:', error);
    }
  }

  renderAIGallery(gallery) {
    const galleryGrid = document.getElementById('aiGalleryGrid');
    const galleryCount = document.getElementById('aiGalleryCount');
    const paginationContainer = document.getElementById('aiGalleryPagination');
    
    if (!galleryGrid || !galleryCount) return;
    
    const imagesPerPage = 4;
    const totalPages = Math.ceil(gallery.length / imagesPerPage);
    
    if (!this.currentGalleryPage) this.currentGalleryPage = 1;
    if (this.currentGalleryPage > totalPages && totalPages > 0) this.currentGalleryPage = totalPages;
    
    galleryCount.textContent = `${gallery.length} image${gallery.length !== 1 ? 's' : ''}`;
    
    if (gallery.length === 0) {
      galleryGrid.innerHTML = `
        <div class="ai-gallery-empty">
          <div class="ai-empty-icon"><i data-lucide="palette"></i></div>
          <h4>No images yet</h4>
          <p>Generate your first AI image to start your gallery</p>
        </div>
      `;
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }
    
    const startIndex = (this.currentGalleryPage - 1) * imagesPerPage;
    const endIndex = startIndex + imagesPerPage;
    const currentPageImages = gallery.slice(startIndex, endIndex);
    const currentProfileUrl = this.userProfile?.profileImageUrl;
    
    galleryGrid.innerHTML = currentPageImages.map((item, pageIndex) => {
      const actualIndex = startIndex + pageIndex;
      const isCurrentProfile = item.url === currentProfileUrl;
      const safeImageUrl = /^(https?:\/\/|data:image\/)/i.test(String(item.url || ''))
        ? this.escapeHtml(item.url || '')
        : '';
      return `
      <div class="ai-gallery-item ${isCurrentProfile ? 'is-profile' : ''}" data-index="${actualIndex}">
        <img src="${safeImageUrl}" alt="AI Generated ${actualIndex + 1}" />
        ${isCurrentProfile ? '<div class="ai-profile-badge">✓ Profile</div>' : ''}
        <div class="ai-gallery-item-actions">
          <button class="ai-gallery-action-btn set-profile" data-action="set-profile" data-index="${actualIndex}" title="Set as Profile Image">
            👤
          </button>
          <button class="ai-gallery-action-btn delete" data-action="delete" data-index="${actualIndex}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
    }).join('');
    
    this.setupGalleryEventListeners();
    this.renderGalleryPagination(totalPages);
  }

  setupGalleryEventListeners() {
    const galleryGrid = document.getElementById('aiGalleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.removeEventListener('click', this.handleGalleryClick);
    this.handleGalleryClick = (e) => {
      const button = e.target.closest('.ai-gallery-action-btn');
      if (!button) return;
      
      e.stopPropagation();
      const action = button.dataset.action;
      const index = parseInt(button.dataset.index);

      if (action === 'set-profile') {
        this.setAsProfile(index);
      } else if (action === 'delete') {
        this.deleteFromGallery(index);
      }
    };
    
    galleryGrid.addEventListener('click', this.handleGalleryClick);
  }

  renderGalleryPagination(totalPages) {
    const paginationContainer = document.getElementById('aiGalleryPagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }
    
    paginationContainer.style.display = 'flex';
    
    let paginationHTML = '';
    
    paginationHTML += `
      <button class="pagination-btn" ${this.currentGalleryPage === 1 ? 'disabled' : ''} 
        data-page="${this.currentGalleryPage - 1}">
        ◀
      </button>
    `;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentGalleryPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button class="pagination-btn ${i === this.currentGalleryPage ? 'active' : ''}" 
          data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    paginationHTML += `
      <button class="pagination-btn" ${this.currentGalleryPage === totalPages ? 'disabled' : ''} 
        data-page="${this.currentGalleryPage + 1}">
        ▶
      </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
    
    this.setupPaginationEventListeners();
  }

  setupPaginationEventListeners() {
    const paginationContainer = document.getElementById('aiGalleryPagination');
    if (!paginationContainer) return;
    
    paginationContainer.removeEventListener('click', this.handlePaginationClick);
    this.handlePaginationClick = (e) => {
      const button = e.target.closest('.pagination-btn');
      if (!button || button.disabled) return;
      
      const page = parseInt(button.dataset.page);
      if (!isNaN(page)) {
        this.goToGalleryPage(page);
      }
    };
    
    paginationContainer.addEventListener('click', this.handlePaginationClick);
  }

  async goToGalleryPage(page) {
    this.currentGalleryPage = page;
    const result = await chrome.storage.local.get('aiGallery');
    const gallery = result.aiGallery || [];
    this.renderAIGallery(gallery);
  }

  async setAsProfile(index) {
    // PRACTICE #1: VALIDATION - Verify gallery image exists and URL is valid
    const result = await chrome.storage.local.get('aiGallery');
    const gallery = result.aiGallery || [];

    if (index < 0 || index >= gallery.length) {
      this.showToast('❌ Invalid gallery image', 'error');
      return;
    }

    const imageUrl = gallery[index].url;
    if (!imageUrl || typeof imageUrl !== 'string') {
      this.showToast('❌ Gallery image has no URL', 'error');
      return;
    }

    // PRACTICE #2: SNAPSHOT / ROLLBACK - Capture previous state before mutation
    if (!this.userProfile) this.userProfile = {};
    const previousImageUrl = this.userProfile.profileImageUrl || '';

    const rollback = async () => {
      try {
        this.userProfile.profileImageUrl = previousImageUrl;
        await chrome.storage.local.set({ userProfile: this.userProfile });
        this.updateTopBarIdentity(previousImageUrl || undefined);
        this.renderAIGallery(gallery);
      } catch (_) {}
    };

    try {
      // PRACTICE #5: OPTIMISTIC UI - Immediately show the image in top bar
      this.displayImageTopLeft(imageUrl);
      this.userProfile.profileImageUrl = imageUrl;

      // Convert to permanent URL (with retry)
      const userIdForUpload = (this.currentUser && this.currentUser.id)
        ? this.currentUser.id
        : await pasteCraftSupabase.getChromeUserId();

      // PRACTICE #3: RETRY - Wrap URL conversion in retry logic
      let finalUrl = imageUrl;
      try {
        finalUrl = await PasteCraftCRUD.retryOperation(async () => {
          const converted = await pasteCraftSupabase.convertToPermanentProfileImageUrl(imageUrl, userIdForUpload);
          return converted || imageUrl;
        }, 2, 500);
      } catch (_) {
        finalUrl = imageUrl; // Fallback to original URL on conversion failure
      }

      // Update gallery entry with stable URL if it changed
      if (finalUrl && finalUrl !== imageUrl) {
        gallery[index].url = finalUrl;
        try { await chrome.storage.local.set({ aiGallery: gallery }); } catch (_) {}
      }

      this.userProfile.profileImageUrl = finalUrl;

      // PRACTICE #3: RETRY - Save profile with retry
      await PasteCraftCRUD.retryOperation(async () => {
        await this.saveUserProfile();
      }, 2, 300);

      // PRACTICE #4: VERIFICATION - Confirm the profile image persisted
      const verification = await chrome.storage.local.get(['userProfile']);
      if (!verification.userProfile || verification.userProfile.profileImageUrl !== finalUrl) {
        console.error('Profile image verification failed, rolling back');
        await rollback();
        this.showToast('❌ Failed to save profile image', 'error');
        return;
      }

      // Update UI with final stable URL
      this.displayImageTopLeft(finalUrl);
      this.renderAIGallery(gallery);

      // PRACTICE #5: SYNC ALL UI CONSUMERS - update profile modal image too
      const profileImg = document.getElementById('profileImage');
      const profilePlaceholder = document.getElementById('profileImagePlaceholder');
      if (profileImg) {
        profileImg.src = finalUrl;
        profileImg.style.display = 'block';
      }
      if (profilePlaceholder) profilePlaceholder.style.display = 'none';

      this.showToast('✓ Profile image updated!', 'success');
    } catch (error) {
      console.error('Failed to set profile image:', error);
      await rollback();
      this.showToast('❌ Failed to set profile image', 'error');
    }
  }

  async deleteFromGallery(index) {
    try {
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      if (index >= 0 && index < gallery.length) {
        gallery.splice(index, 1);
        await chrome.storage.local.set({ aiGallery: gallery });
        
        this.renderAIGallery(gallery);
        this.showToast('🗑️ Image removed from gallery', 'success');
      }
    } catch (error) {
      console.error('Failed to delete from gallery:', error);
      this.showToast('❌ Failed to delete image', 'error');
    }
  }

  async generateAIImageFromProfile() {
    try {
      if (!this.userProfile?.aiGeneratedName) {
        this.showToast('⚠️ Generate your funky name first in Profile!', 'error');
        return;
      }
      
      this.showToast('🎨 Generating AI image...', 'info');
      document.getElementById('aiGenerateFromProfileBtn').disabled = true;
      document.getElementById('aiGenerateFromProfileBtn').textContent = '⏳ Generating...';
      
      const gen = await pasteCraftSupabase.generateProfileImage(null, null, this.userProfile.aiGeneratedName);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'profile');
        
        this.showToast('✅ AI image generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      } else {
        this.showToast('❌ Failed to generate AI image', 'error');
      }
    } catch (error) {
      console.error('Failed to generate AI image:', error);
      this.showToast('❌ Failed to generate AI image', 'error');
    } finally {
      document.getElementById('aiGenerateFromProfileBtn').disabled = false;
      document.getElementById('aiGenerateFromProfileBtn').innerHTML = '<span class="ai-gen-icon">✨</span><span>Generate from Profile</span>';
    }
  }

  async generateRandomAIImage() {
    try {
      this.showToast('🎲 Generating random avatar...', 'info');
      document.getElementById('aiGenerateRandomBtn').disabled = true;
      document.getElementById('aiGenerateRandomBtn').textContent = '⏳ Generating...';
      
      // Generate a random animal name
      const animals = ['Tiger', 'Dragon', 'Fox', 'Wolf', 'Lion', 'Eagle', 'Phoenix', 'Panda', 'Bear', 'Owl'];
      const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
      const randomName = `Random${randomAnimal}`;
      
      const gen = await pasteCraftSupabase.generateProfileImage(null, null, randomName);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'random');
        
        this.showToast('✅ Random avatar generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      } else {
        this.showToast('❌ Failed to generate random avatar', 'error');
      }
    } catch (error) {
      console.error('Failed to generate random avatar:', error);
      this.showToast('❌ Failed to generate random avatar', 'error');
    } finally {
      document.getElementById('aiGenerateRandomBtn').disabled = false;
      document.getElementById('aiGenerateRandomBtn').innerHTML = '<span class="ai-gen-icon">🎲</span><span>Random Avatar</span>';
    }
  }

  async addToGallery(imageUrl, type) {
    try {
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];

      gallery.push({
        url: imageUrl,
        type: type,
        timestamp: Date.now()
      });
      
      await chrome.storage.local.set({ aiGallery: gallery });
    } catch (error) {
      console.error('Failed to add to gallery:', error);
    }
  }

  async migrateProfileImageToGallery() {
    try {
      if (!this.userProfile?.profileImageUrl) {
        return;
      }

      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      const imageExists = gallery.some(item => item.url === this.userProfile.profileImageUrl);
      
      if (!imageExists) {
        console.log('📸 Migrating existing profile image to gallery...');
        await this.addToGallery(this.userProfile.profileImageUrl, 'profile');
        this.loadAIGallery();
        console.log('✅ Profile image migrated to gallery');
      }
    } catch (error) {
      console.error('Failed to migrate profile image:', error);
    }
  }

  showAIGenerationTimer() {
    const timer = document.getElementById('aiGenerationTimer');
    const countdown = document.getElementById('aiTimerCountdown');
    
    if (!timer || !countdown) return;
    
    timer.style.display = 'flex';
    
    let timeLeft = 10;
    countdown.textContent = timeLeft;
    
    // Clear any existing timer
    if (this.aiGenerationTimerInterval) {
      clearInterval(this.aiGenerationTimerInterval);
    }
    
    this.aiGenerationTimerInterval = setInterval(() => {
      timeLeft--;
      countdown.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(this.aiGenerationTimerInterval);
        this.aiGenerationTimerInterval = null;
        this.hideAIGenerationTimer();
      }
    }, 1000);
  }

  hideAIGenerationTimer() {
    const timer = document.getElementById('aiGenerationTimer');
    if (timer) {
      timer.style.display = 'none';
    }
    
    if (this.aiGenerationTimerInterval) {
      clearInterval(this.aiGenerationTimerInterval);
      this.aiGenerationTimerInterval = null;
    }
  }
  
  showBreakdownModal(text) {
    // Use the existing breakdown modal from the page
    const breakdownModal = document.getElementById('breakdownModal');
    const breakdownOriginalText = document.getElementById('breakdownOriginalText');
    const breakdownTextLength = document.getElementById('breakdownTextLength');

    if (breakdownModal && breakdownOriginalText) {
      this.currentBreakdownText = text;
      this.currentBreakdownLevel = null;
      this.breakdownCache = {};
      this.breakdownThreads = [];
      this.currentBreakdownThreadIndex = 0;
      this._activeBreakdownHistoryId = null;
      this.selectedFollowupLevel = null;

      // Show FULL text, not truncated - let CSS handle scrolling
      breakdownOriginalText.textContent = text;
      
      if (breakdownTextLength) {
        const wordCount = text.trim().split(/\s+/).length;
        breakdownTextLength.textContent = `${wordCount} words`;
      }
      
      // Force reflow to ensure scrollbar appears correctly
      breakdownOriginalText.style.display = 'none';
      breakdownOriginalText.offsetHeight; // Trigger reflow
      breakdownOriginalText.style.display = 'block';
      
      // Scroll to top of the original text box
      breakdownOriginalText.scrollTop = 0;
      
      // Show the modal
      breakdownModal.style.display = 'flex';
      
      // Clear any previous result
      const breakdownResult = document.getElementById('breakdownResult');
      if (breakdownResult) {
        breakdownResult.innerHTML = '';
      }
      const loadingEl = document.getElementById('breakdownLoading');
      const followupContainer = document.getElementById('breakdownFollowupContainer');
      const paginationContainer = document.getElementById('breakdownThreadPagination');
      if (loadingEl) loadingEl.style.display = 'none';
      if (followupContainer) followupContainer.style.display = 'none';
      if (paginationContainer) paginationContainer.style.display = 'none';
      
      // Reset tabs - no active tab initially
      document.querySelectorAll('.breakdown-tab').forEach(tab => tab.classList.remove('active'));
      
      // Show initial level info
      const levelInfoText = document.getElementById('levelInfoText');
      if (levelInfoText) {
        levelInfoText.innerHTML = `
          <strong>Choose a level:</strong> Select a comprehension level above to get an AI-powered explanation tailored to that audience
        `;
      }
      
      // Show toast if multiple clips were added
      const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
      if (clipCount > 1) {
        this.showToast(`🧠 ${clipCount} clips ready for breakdown (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'breakdown-initiated');

      // Persist breakdown page state (input prefilled from clip)
      this._saveBreakdownPageState();
      this._currentAiLabSubTab = 'breakdown';
      this._saveActiveTabState();
    }
  }
  
  showSummaryModal(text) {
    // Navigate to AI Lab > Summary tab and pre-fill text
    const aiTab = document.querySelector('[data-tab="ai"]');
    const summarySubTab = document.querySelector('[data-ai-tab="summary"]');
    const summaryInput = document.getElementById('summaryInput');
    
    if (aiTab && summarySubTab && summaryInput) {
      // Switch to AI Lab tab
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      aiTab.classList.add('active');
      document.getElementById('aiTab').classList.add('active');
      
      // Switch to Summary sub-tab
      document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
      summarySubTab.classList.add('active');
      document.getElementById('aiSummarySection').classList.add('active');
      
      // Pre-fill the text
      summaryInput.value = text;
      summaryInput.dispatchEvent(new Event('input'));
      
      // Scroll to top of textarea to show the first clip
      summaryInput.scrollTop = 0;
      
      // Focus the textarea
      summaryInput.focus();
      
      // Show toast if multiple clips were added
      const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
      if (clipCount > 1) {
        this.showToast(`📝 ${clipCount} clips added to summary (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'summary-initiated');

      // Persist summary state (input prefilled from clip)
      this._currentSummarySection = 'input';
      this._saveSummaryState();
      this._currentAiLabSubTab = 'summary';
      this._saveActiveTabState();
      
      // Clear selections and hide buttons
      this.clearAllSelections();
    }
  }

  formatClipViewerPlainText(text) {
    return this.aiLabFeature.summary.formatClipViewerPlainText.call(this, text);
  }

  openClipViewer(clip) {
    const modal = document.getElementById('clipViewerModal');
    const titleEl = document.getElementById('clipViewerTitle');
    const metaEl = document.getElementById('clipViewerMeta');
    const bodyEl = document.getElementById('clipViewerBody');
    const renderedEl = document.getElementById('clipViewerRendered');
    const rawEl = document.getElementById('clipViewerRaw');
    const htmlDetails = document.getElementById('clipViewerHtmlDetails');
    const htmlPre = document.getElementById('clipViewerHtml');
    const toggleBtn = document.getElementById('clipViewerToggleRaw');

    if (!modal || !titleEl || !bodyEl) return;

    this.currentClipViewerClip = clip || null;
    this._clipViewerShowingRaw = false;

    const text = (clip && clip.text != null) ? String(clip.text) : '';
    const meta = (clip && clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
    const clipTitle = this._clipTitle(clip);

    // Detect markup type
    const markupType = (typeof PCMarkup !== 'undefined') ? PCMarkup.detectMarkupType(text, meta) : 'text';

    titleEl.textContent = clipTitle
      ? `🔎 ${clipTitle}`
      : meta && meta.kind === 'image'
      ? '🖼️ Clip Viewer'
      : meta && meta.kind === 'url'
        ? '🔗 Clip Viewer'
        : '🔎 Clip Viewer';

    // Meta section
    if (metaEl) {
      const bits = [];
      if (meta && meta.kind) bits.push(`<strong>Type:</strong> ${this.escapeHtml(meta.kind)}`);
      if (markupType !== 'text') bits.push(`<strong>Format:</strong> ${this.escapeHtml(markupType.toUpperCase())}`);
      if (meta && meta.sourcePageUrl) bits.push(`<strong>From:</strong> ${this.escapeHtml(meta.sourcePageUrl)}`);
      if (clip && typeof clip.timestamp === 'number') bits.push(`<strong>Saved:</strong> ${this.escapeHtml(this.getTimeAgo(clip.timestamp))}`);

      if (bits.length) {
        metaEl.innerHTML = bits.join('<br>');
        metaEl.style.display = 'block';
      } else {
        metaEl.textContent = '';
        metaEl.style.display = 'none';
      }
    }

    // Body
    const safeText = this.escapeHtml(text);
    let srcHtml = '';
    let url = '';
    let imgSrc = '';

    if (meta) {
      if (typeof meta.html === 'string' && meta.html.trim()) srcHtml = meta.html;
      if (typeof meta.url === 'string' && meta.url.trim()) url = meta.url.trim();
      if (meta.image && typeof meta.image === 'object') {
        imgSrc = (meta.image.dataUrl || meta.image.srcUrl || '').trim();
      }
    }

    const headerParts = [];

    // URL link section
    if (!url) {
      const raw = String(text || '').trim();
      if (/^https?:\/\/\S+$/i.test(raw)) url = raw;
    }
    if (url) {
      const safeUrl = this.escapeHtml(url);
      headerParts.push(`
        <div class="clip-viewer-link-card">
          <div class="clip-viewer-section-label">Link</div>
          <a data-pc-open-url="1" href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>
        </div>
      `);
    }

    // Image section
    const isRenderableImageSrc = imgSrc && (
      imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'));

    if (imgSrc && !isRenderableImageSrc) {
      headerParts.push('<div class="clip-viewer-note">Image preview unavailable (non-renderable source).</div>');
    } else if (imgSrc && isRenderableImageSrc) {
      headerParts.push(`<img class="clip-viewer-image" src="${this.escapeHtml(imgSrc)}" alt="Clip image" />`);
      if (meta && meta.image && meta.image.tooLarge) {
        headerParts.push('<div class="clip-viewer-note">Image payload too large to embed; showing what is available.</div>');
      }
      if (meta && meta.image && meta.image.exportFailed) {
        headerParts.push('<div class="clip-viewer-note">Image export blocked by the page (canvas/security restrictions).</div>');
      }
    }

    // Render markup content
    const hasMarkup = markupType !== 'text' && typeof PCMarkup !== 'undefined';

    if (renderedEl) {
      if (hasMarkup) {
        const rendered = PCMarkup.renderMarkup(text, meta, { type: markupType });
        if (rendered && typeof rendered.then === 'function') {
          renderedEl.innerHTML = headerParts.join('') + '<div class="clip-viewer-note">Rendering diagram...</div>';
          rendered.then(rHtml => { renderedEl.innerHTML = headerParts.join('') + rHtml; })
            .catch(() => { renderedEl.innerHTML = headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`; });
        } else {
          renderedEl.innerHTML = headerParts.join('') + rendered;
        }
        renderedEl.style.display = 'block';
      } else {
        renderedEl.innerHTML = headerParts.join('') + this.formatClipViewerPlainText(text);
        renderedEl.style.display = 'block';
      }
    }

    // Raw view
    if (rawEl) {
      rawEl.textContent = text;
      rawEl.style.display = 'none';
    }

    // Toggle button (View Raw / View Rendered)
    if (toggleBtn) {
      if (hasMarkup) {
        toggleBtn.style.display = '';
        toggleBtn.querySelector('span:last-child').textContent = 'View Raw';
        const newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
        newBtn.addEventListener('click', () => {
          this._clipViewerShowingRaw = !this._clipViewerShowingRaw;
          const rEl = document.getElementById('clipViewerRendered');
          const rwEl = document.getElementById('clipViewerRaw');
          const tBtn = document.getElementById('clipViewerToggleRaw');
          if (this._clipViewerShowingRaw) {
            if (rEl) rEl.style.display = 'none';
            if (rwEl) rwEl.style.display = 'block';
            if (tBtn) tBtn.querySelector('span:last-child').textContent = 'View Rendered';
          } else {
            if (rEl) rEl.style.display = 'block';
            if (rwEl) rwEl.style.display = 'none';
            if (tBtn) tBtn.querySelector('span:last-child').textContent = 'View Raw';
          }
        });
      } else {
        toggleBtn.style.display = 'none';
      }
    }

    // Ensure link opens in a new TAB
    try {
      if (!this._clipViewerLinkHandlerAttached) {
        bodyEl.addEventListener('click', (e) => {
          const a = e && e.target ? e.target.closest('a[data-pc-open-url="1"]') : null;
          if (!a) return;
          e.preventDefault();
          const targetUrl = String(a.getAttribute('href') || '').trim();
          if (!targetUrl) return;
          chrome.tabs.create({ url: targetUrl, active: true }, () => {
            if (chrome.runtime.lastError) {
              window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
          });
        });
        this._clipViewerLinkHandlerAttached = true;
      }
    } catch (e) {
      // Non-fatal
    }

    // Source HTML (collapsed)
    if (htmlDetails && htmlPre) {
      if (srcHtml) {
        htmlPre.textContent = String(srcHtml);
        htmlDetails.style.display = 'block';
      } else {
        htmlPre.textContent = '';
        htmlDetails.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
  }

  hideClipViewerModal() {
    const modal = document.getElementById('clipViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentClipViewerClip = null;
  }

  async copyClipViewerText() {
    const clip = this.currentClipViewerClip;
    const text = (clip && clip.text != null) ? String(clip.text) : '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Content copied!');
    } catch (e) {
      console.error('Copy failed:', e);
      this.showToast('Copy failed');
    }
  }
  
  clearAllSelections() {
    this.selectedChips.clear();
    this.selectedSearchClips.clear();
    this.selectedCategoryClips.clear();
    
    // Re-render to update UI
    this.renderChips();
    // Refresh search UI (performSearch was removed/renamed)
    this.renderSearchResults();
    this.renderCategories();
  }
  
  getSelectedOrCurrentText(currentClipText, source) {
    // Check if there are any selected clips based on the source
    let selectedTexts = [];
    
    if (source === 'clips' && this.selectedChips.size > 0) {
      // Get texts from selected chips
      this.selectedChips.forEach(idKey => {
        const clip = this.clips.find(c => this._clipIdKey(c?.id) === String(idKey));
        if (clip) selectedTexts.push(clip.text);
      });
    } else if (source === 'search' && this.selectedSearchClips.size > 0) {
      // Get texts from selected search clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedSearchClips.forEach(clipId => {
        const clip = allClips.find(c => this._clipIdKey(c?.id) === this._clipIdKey(clipId));
        if (clip) {
          selectedTexts.push(clip.text);
        }
      });
    } else if (source === 'categories' && this.selectedCategoryClips.size > 0) {
      // Get texts from selected category clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedCategoryClips.forEach(clipId => {
        const clip = allClips.find(c => this._clipIdKey(c?.id) === this._clipIdKey(clipId));
        if (clip) {
          selectedTexts.push(clip.text);
        }
      });
    }
    
    // If we have selected clips, join them with delimiter
    if (selectedTexts.length > 0) {
      return selectedTexts.join('\n\n---\n\n');
    }
    
    // Otherwise, return the current clip text
    return currentClipText;
  }
  
  showBreakdownModalWithLevel(text, level) {
    this.showBreakdownModal(text);
    this.currentBreakdownLevel = level;

    document.querySelectorAll('.breakdown-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.level === level);
    });
    this.updateLevelInfo(level);
    this.generateBreakdown(level);
  }
  
  // ==================== SESSION PERSISTENCE ====================
  // Persist UI state (active tab, AI breakdown/summary content, etc.)
  // so everything survives popup close, browser restart, sign-out/sign-in.

  /** Save active main tab + AI Lab sub-tab to storage */
  async _saveActiveTabState() {
    try {
      await chrome.storage.local.set({
        pc_activeTab_v1: this.currentTab || 'clips',
        pc_aiLabSubTab_v1: this._currentAiLabSubTab || 'generator'
      });
    } catch (_) {}
  }

  /** Get current browser tab ID (for tab-scoped AI session) */
  async _getCurrentTabId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs?.[0]?.id ?? null;
    } catch (_) {
      return null;
    }
  }

  /** Save AI Breakdown page state (input text, selected level, NOT the modal) */
  async _saveBreakdownPageState() {
    try {
      const breakdownInput = document.getElementById('breakdownInput');
      const tabId = await this._getCurrentTabId();
      const state = {
        inputText: breakdownInput ? breakdownInput.value : '',
        selectedLevel: this.selectedBreakdownLevel || null,
        tabId
      };
      await chrome.storage.local.set({ pc_breakdownPageState_v1: state });
    } catch (_) {}
  }

  /** Save AI Breakdown modal state (results, threads, cache) */
  async _saveBreakdownModalState() {
    try {
      const tabId = await this._getCurrentTabId();
      const state = {
        originalText: this.currentBreakdownText || null,
        activeLevel: this.currentBreakdownLevel || null,
        cache: this.breakdownCache || {},
        threads: (this.breakdownThreads || []).slice(0, 20),
        threadIndex: this.currentBreakdownThreadIndex || 0,
        timestamp: Date.now(),
        tabId
      };
      await chrome.storage.local.set({ pc_breakdownModalState_v1: state });
    } catch (_) {}
  }

  /** Save AI Summary state (input text, questions, result, threads) */
  async _saveSummaryState() {
    try {
      const summaryInput = document.getElementById('summaryInput');
      const tabId = await this._getCurrentTabId();
      // Use raw text from current thread for persistence (not rendered HTML)
      const currentThread = this.summaryThreads?.[this.currentSummaryThreadIndex];
      const rawResult = currentThread?.answer || this._currentRawSummary || '';
      const state = {
        inputText: summaryInput ? summaryInput.value : '',
        currentSummaryText: this.currentSummaryText || null,
        generatedQuestions: (this.generatedQuestions || []).slice(0, 20),
        currentQuestion: this.currentSummaryQuestion || null,
        resultContent: rawResult,
        threads: (this.summaryThreads || []).slice(0, 20),
        threadIndex: this.currentSummaryThreadIndex || 0,
        activeSection: this._currentSummarySection || 'input',
        timestamp: Date.now(),
        tabId
      };
      await chrome.storage.local.set({ pc_summaryState_v1: state });
    } catch (_) {}
  }

  /** Reset AI Summary to empty state (used when opening in new tab) */
  _resetSummaryToEmpty() {
    this.currentSummaryText = null;
    this.generatedQuestions = [];
    this.currentSummaryQuestion = null;
    this._activeSummaryHistoryId = null;
    this.summaryThreads = [];
    this.currentSummaryThreadIndex = 0;
    this._currentRawSummary = null;
    this._currentSummarySection = 'input';
    const summaryInput = document.getElementById('summaryInput');
    const summaryCharCounter = document.getElementById('summaryCharCounter');
    const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
    const followupContainer = document.getElementById('summaryFollowupContainer');
    const paginationContainer = document.getElementById('summaryThreadPagination');
    if (summaryInput) summaryInput.value = '';
    if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
    if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
    if (followupContainer) followupContainer.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';
    this.showSummarySection('input');
    this._renderOpenRecentConversation();
  }

  /** Reset AI Breakdown to empty state (used when opening in new tab) */
  _resetBreakdownToEmpty() {
    this.currentBreakdownText = null;
    this.currentBreakdownLevel = null;
    this.breakdownCache = {};
    this.breakdownThreads = [];
    this.currentBreakdownThreadIndex = 0;
    this.selectedBreakdownLevel = null;
    const breakdownInput = document.getElementById('breakdownInput');
    const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
    const levelChips = document.querySelectorAll('.level-chip');
    if (breakdownInput) {
      breakdownInput.value = '';
      breakdownInput.dispatchEvent(new Event('input'));
    }
    if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
    levelChips.forEach(c => {
      c.classList.remove('selected');
      c.disabled = true;
    });
    const breakdownCharCounter = document.getElementById('breakdownCharCounter');
    if (breakdownCharCounter) breakdownCharCounter.textContent = '0 characters';
  }

  /** Render "Open recent conversation" in empty Summary state */
  async _renderOpenRecentConversation() {
    const container = document.getElementById('openRecentConversationContainer');
    if (!container) return;
    const { pc_aiHistory_v1 = [] } = await chrome.storage.local.get(['pc_aiHistory_v1']);
    const recent = (pc_aiHistory_v1 || []).slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';
    container.innerHTML = `
      <div class="open-recent-header">
        <span class="open-recent-icon">📂</span>
        <span>Open recent conversation</span>
      </div>
      <div class="open-recent-list">
        ${recent.map(e => {
          const icon = e.type === 'breakdown' ? '🧠' : '📝';
          const label = e.type === 'breakdown' ? 'Breakdown' : 'Summary';
          const title = (e.title || 'Untitled').substring(0, 40) + (e.title?.length > 40 ? '…' : '');
          const timeStr = e.createdAt ? this.getTimeAgo(e.createdAt) : '';
          return `<button class="open-recent-item" data-history-id="${e.id}" type="button">
            <span class="open-recent-item-icon">${icon}</span>
            <span class="open-recent-item-title">${this.escapeHtml(title)}</span>
            <span class="open-recent-item-meta">${label} · ${timeStr}</span>
          </button>`;
        }).join('')}
      </div>
    `;
    this.aiHistoryEntries = pc_aiHistory_v1;
    container.querySelectorAll('.open-recent-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.historyId);
        const entry = this.aiHistoryEntries?.find(e => e.id === id);
        if (entry) this.openAiHistoryModal(entry);
      });
    });
  }

  /** Restore all persisted UI state on popup open */
  // Race a promise against a timer. Returns `fallback` if the promise throws
  // or exceeds `ms`. Keeps the underlying fetch alive in the background, so
  // the second call (or a visibility refresh) can use the warmed-up result.
  _withTimeout(promise, ms, fallback = undefined, label = '') {
    const wrapped = Promise.resolve()
      .then(() => promise)
      .catch((e) => {
        if (label) console.warn(`${label} failed:`, e);
        return fallback;
      });
    const timer = new Promise((resolve) => setTimeout(() => {
      if (label) console.warn(`${label} timed out after ${ms}ms — using fallback`);
      resolve(fallback);
    }, ms));
    return Promise.race([wrapped, timer]);
  }

  async _restoreSessionState() {
    try {
      const keys = [
        'pc_activeTab_v1',
        'pc_aiLabSubTab_v1',
        'pc_breakdownPageState_v1',
        'pc_breakdownModalState_v1',
        'pc_summaryState_v1'
      ];
      const stored = await chrome.storage.local.get(keys);

      // 1. Restore active main tab
      const savedTab = stored.pc_activeTab_v1;
      if (savedTab && savedTab !== 'clips') {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        if (tabBtn) {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tabBtn.classList.add('active');
          this.currentTab = savedTab;
          const tabEl = document.getElementById(savedTab + 'Tab');
          if (tabEl) tabEl.classList.add('active');

          // Trigger tab-specific loads
          if (savedTab === 'categories') {
            this.renderCategories();
            this.updateCategoryBulkActions();
          } else if (savedTab === 'search') {
            this.renderSearchResults();
            this.updateSearchBulkActions();
          } else if (savedTab === 'ai') {
            this.loadAIGallery();
            this.migrateProfileImageToGallery();
          } else if (savedTab === 'notes') {
            await this._withTimeout(this.loadNotes(), 3000, undefined, 'loadNotes');
            this.renderNotes();
          } else if (savedTab === 'activity') {
            await this._withTimeout(this.loadActivityLog(), 3000, undefined, 'loadActivityLog');
            this.renderActivityList();
          } else if (savedTab === 'aiHistory') {
            await this._withTimeout(this.loadAiHistory(), 3000, undefined, 'loadAiHistory');
            this.renderAiHistoryList();
          }
        }
      }

      // 2. Restore AI Lab sub-tab
      const savedAiSubTab = stored.pc_aiLabSubTab_v1;
      if (savedAiSubTab && savedAiSubTab !== 'generator') {
        this._currentAiLabSubTab = savedAiSubTab;
        const subTabBtn = document.querySelector(`.ai-lab-tab[data-ai-tab="${savedAiSubTab}"]`);
        if (subTabBtn) {
          document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
          subTabBtn.classList.add('active');

          if (savedAiSubTab === 'generator') {
            const el = document.getElementById('aiGeneratorSection');
            if (el) el.classList.add('active');
          } else if (savedAiSubTab === 'gallery') {
            const el = document.getElementById('aiGallerySection');
            if (el) el.classList.add('active');
          } else if (savedAiSubTab === 'summary') {
            const el = document.getElementById('aiSummarySection');
            if (el) el.classList.add('active');
          } else if (savedAiSubTab === 'breakdown') {
            const el = document.getElementById('aiBreakdownSection');
            if (el) el.classList.add('active');
          }
        }
      }

      // Tab-scoped AI session: only restore Summary/Breakdown when same tab
      const currentTabId = await this._getCurrentTabId();
      const shouldRestoreBreakdown = (stored) => {
        const savedId = stored?.pc_breakdownPageState_v1?.tabId ?? stored?.pc_breakdownModalState_v1?.tabId;
        return currentTabId != null && savedId != null && currentTabId === savedId;
      };
      const shouldRestoreSummary = (stored) => {
        const savedId = stored?.pc_summaryState_v1?.tabId;
        return currentTabId != null && savedId != null && currentTabId === savedId;
      };

      // 3. Restore AI Breakdown page state (input + level) — only if same tab
      const bdPage = stored.pc_breakdownPageState_v1;
      if (bdPage && shouldRestoreBreakdown(stored)) {
        const breakdownInput = document.getElementById('breakdownInput');
        if (breakdownInput && bdPage.inputText) {
          breakdownInput.value = bdPage.inputText;
          breakdownInput.dispatchEvent(new Event('input'));
        }
        if (bdPage.selectedLevel) {
          this.selectedBreakdownLevel = bdPage.selectedLevel;
          const chip = document.querySelector(`.level-chip[data-level="${bdPage.selectedLevel}"]`);
          if (chip) {
            document.querySelectorAll('.level-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
          }
          const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
          if (analyzeLevelBtn && bdPage.inputText) analyzeLevelBtn.disabled = false;
        }
      } else if ((bdPage || stored.pc_breakdownModalState_v1) && !shouldRestoreBreakdown(stored)) {
        this._resetBreakdownToEmpty();
      }

      // 4. Restore AI Breakdown modal state (last conversation) — only if same tab
      const bdModal = stored.pc_breakdownModalState_v1;
      if (bdModal && bdModal.originalText && bdModal.threads && bdModal.threads.length > 0 && shouldRestoreBreakdown(stored)) {
        this.currentBreakdownText = bdModal.originalText;
        this.currentBreakdownLevel = bdModal.activeLevel;
        this.breakdownCache = bdModal.cache || {};
        this.breakdownThreads = bdModal.threads || [];
        this.currentBreakdownThreadIndex = bdModal.threadIndex || 0;
      }

      // 5. Restore AI Summary state — only if same tab; else start fresh
      const sum = stored.pc_summaryState_v1;
      if (sum && shouldRestoreSummary(stored)) {
        // Restore input text (same-tab restore)
        const summaryInput = document.getElementById('summaryInput');
        if (summaryInput && sum.inputText) {
          summaryInput.value = sum.inputText;
          summaryInput.dispatchEvent(new Event('input'));
        }

        // Restore in-memory state
        if (sum.currentSummaryText) this.currentSummaryText = sum.currentSummaryText;
        if (sum.generatedQuestions) this.generatedQuestions = sum.generatedQuestions;
        if (sum.currentQuestion) this.currentSummaryQuestion = sum.currentQuestion;
        if (sum.threads) this.summaryThreads = sum.threads;
        if (sum.threadIndex != null) this.currentSummaryThreadIndex = sum.threadIndex;

        // Restore the visible section (input → questions → result)
        if (sum.activeSection && sum.activeSection !== 'input') {
          if (sum.activeSection === 'questions' && sum.generatedQuestions && sum.generatedQuestions.length > 0) {
            this.showSummarySection('questions');
            const questionsList = document.getElementById('questionsList');
            if (questionsList) {
              questionsList.innerHTML = '';
              sum.generatedQuestions.forEach(question => {
                const chip = document.createElement('button');
                chip.className = 'question-chip';
                chip.textContent = question;
                chip.addEventListener('click', () => {
                  this.currentSummaryQuestion = question;
                  this.generateSummary(this.currentSummaryText || sum.inputText, question);
                });
                questionsList.appendChild(chip);
              });
            }
          } else if (sum.activeSection === 'result' && sum.resultContent) {
            this.showSummarySection('result');
            const summaryContent = document.getElementById('summaryResultContent');
            if (summaryContent) {
              this._renderAiResponse(sum.resultContent).then(html => {
                summaryContent.innerHTML = html;
              });
            }

            // Restore follow-up container visibility
            const followupContainer = document.getElementById('summaryFollowupContainer');
            if (followupContainer && sum.threads && sum.threads.length > 0) {
              followupContainer.style.display = 'block';
            }

            // Restore thread pagination
            if (sum.threads && sum.threads.length >= 2) {
              this.renderThreadPagination('summary');
            }
          }
        }
      } else {
        // New tab or new session: start Summary fresh, show Open recent
        this._resetSummaryToEmpty();
      }

      console.log('✅ Session state restored:', {
        tab: savedTab || 'clips',
        aiSubTab: savedAiSubTab || 'generator',
        hasBreakdownPage: !!bdPage?.inputText,
        hasBreakdownModal: !!bdModal?.originalText,
        hasSummary: !!sum?.inputText
      });
    } catch (err) {
      console.warn('⚠️ Failed to restore session state:', err);
    }
  }

  // Analysis History Functions
  async saveToAnalysisHistory(text, type, level = null, result = null) {
    const historyEntry = {
      id: Date.now(),
      text: text.substring(0, 500), // Store first 500 chars
      type,
      level,
      result: result ? result.substring(0, 1000) : null,
      timestamp: Date.now(),
      source: this.currentTab
    };
    
    // Load existing history
    const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
    
    // Add new entry at the beginning
    analysisHistory.unshift(historyEntry);
    
    // Keep only last 50 entries
    if (analysisHistory.length > 50) {
      analysisHistory.splice(50);
    }
    
    // Save to storage
    await chrome.storage.local.set({ analysisHistory });
    this.analysisHistory = analysisHistory;
    
    console.log('✅ Saved to analysis history:', historyEntry);
  }
  
  async loadAnalysisHistory() {
    const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
    this.analysisHistory = analysisHistory;
    return analysisHistory;
  }
  
  renderAnalysisHistory() {
    // This will be called when user navigates to AI Lab, Breakdown, or Summary tabs
    const history = this.analysisHistory;
    
    if (history.length === 0) {
      return `
        <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
          <p style="font-size: 48px; margin: 0 0 16px 0;">📊</p>
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #6b7280;">No Analysis History</h3>
          <p style="margin: 0; font-size: 14px;">Start analyzing clips to see your history here</p>
        </div>
      `;
    }
    
    return history.map(entry => {
      const icon = entry.type === 'breakdown' ? '🧠' : entry.type === 'summary' ? '📝' : '🤖';
      const timeAgo = this.getTimeAgo(entry.timestamp);
      const levelBadge = entry.level ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${entry.level}</span>` : '';
      
      return `
        <div class="history-entry" style="padding: 16px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s;" data-entry-id="${entry.id}">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px;">${icon}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 13px; font-weight: 600; color: #1f2937; text-transform: capitalize;">${entry.type}</span>
                ${levelBadge}
                <span style="font-size: 12px; color: #9ca3af; margin-left: auto;">${timeAgo}</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(entry.text.substring(0, 100))}...</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==================== AI HISTORY SYSTEM ====================

  /** Load AI history entries from local + cloud (merged) */
  async loadAiHistory() {
    return this.aiLabFeature.history.loadAiHistory.call(this);
  }

  async _persistAiHistory() {
    return this.aiLabFeature.history._persistAiHistory.call(this);
  }

  async saveAiHistory(type, originalText, threads) {
    return this.aiLabFeature.history.saveAiHistory.call(this, type, originalText, threads);
  }

  async _generateAiHistoryTitle(entryId, originalText) {
    return this.aiLabFeature.history._generateAiHistoryTitle.call(this, entryId, originalText);
  }

  renderAiHistoryList() {
    return this.aiLabFeature.history.renderAiHistoryList.call(this);
  }

  async openAiHistoryModal(entry) {
    return this.aiLabFeature.history.openAiHistoryModal.call(this, entry);
  }

  _renderHistoryPagination() {
    return this.aiLabFeature.history._renderHistoryPagination.call(this);
  }

  async navigateHistoryThread(index) {
    return this.aiLabFeature.history.navigateHistoryThread.call(this, index);
  }

  copyHistoryContent() {
    return this.aiLabFeature.history.copyHistoryContent.call(this);
  }

  _startEditHistoryTitle() {
    return this.aiLabFeature.history._startEditHistoryTitle.call(this);
  }

  async _saveEditHistoryTitle() {
    return this.aiLabFeature.history._saveEditHistoryTitle.call(this);
  }

  _cancelEditHistoryTitle() {
    return this.aiLabFeature.history._cancelEditHistoryTitle.call(this);
  }

  async continueHistoryConversation() {
    return this.aiLabFeature.history.continueHistoryConversation.call(this);
  }

  /** Delete all AI history entries */
  async clearAllAiHistory() {
    return this.aiLabFeature.history.clearAllAiHistory.call(this);
  }

  async loadNotes() {
    return this.notesFeature.service.loadNotes(this);
  }

  async _initializeTieredNotesStorage() {
    return this.notesFeature.service.initializeTieredNotesStorage(this);
  }

  /**
   * Migrate excess local data to Supabase if storage is near quota
   * Only runs once per installation (tracked by flag)
   * @private
   */
  async _maybeMigrateTieredStorage() {
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

      console.log('📦 Starting tiered storage migration...');
      console.log(`📊 Current storage: ${StorageMeter.formatBytes(report.total.used)} / ${StorageMeter.formatBytes(report.total.quota)} (${Math.round(report.total.percentage * 100)}%)`);

      // Calculate budgets
      const budgets = report.budgets;
      let migrated = { clips: 0, notes: 0, archived: 0 };

      // Migrate clips if over budget
      if (this.clips.length > budgets.clips) {
        const excessClips = this.clips.slice(budgets.clips);
        console.log(`📤 Migrating ${excessClips.length} excess clips to cloud...`);
        
        // Push excess to Supabase
        try {
          await pasteCraftSupabase.syncClipsToSupabase(excessClips);
          migrated.clips = excessClips.length;
          
          // Keep only budget amount locally
          this.clips = this.clips.slice(0, budgets.clips);
          await chrome.storage.local.set({ clips: this.clips });
          if (this._idbReady && this.idb) {
            await this.idb.syncEntityFromLocalStorage('clips', this.clips);
          }
        } catch (e) {
          console.warn('Failed to migrate clips:', e);
        }
      }

      // Migrate notes if over budget
      if (this.notes.length > budgets.notes) {
        const excessNotes = this.notes.slice(budgets.notes);
        console.log(`📤 Migrating ${excessNotes.length} excess notes to cloud...`);
        
        try {
          await pasteCraftSupabase.syncNotesToSupabase(excessNotes);
          migrated.notes = excessNotes.length;
          
          // Keep only budget amount locally
          this.notes = this.notes.slice(0, budgets.notes);
          await this.saveNotes();
        } catch (e) {
          console.warn('Failed to migrate notes:', e);
        }
      }

      // Migrate archived clips if over budget
      if (this.searchOnlyClips.length > budgets.archived) {
        const excessArchived = this.searchOnlyClips.slice(budgets.archived);
        console.log(`📤 Migrating ${excessArchived.length} excess archived clips to cloud...`);
        
        try {
          await pasteCraftSupabase.syncArchivedClipsToSupabase(excessArchived);
          migrated.archived = excessArchived.length;
          
          // Keep only budget amount locally
          this.searchOnlyClips = this.searchOnlyClips.slice(0, budgets.archived);
          await chrome.storage.local.set({ searchOnlyClips: this.searchOnlyClips });
        } catch (e) {
          console.warn('Failed to migrate archived clips:', e);
        }
      }

      // Mark migration as complete
      await chrome.storage.local.set({ pc_tiered_storage_migrated_v1: Date.now() });

      // Log results
      const totalMigrated = migrated.clips + migrated.notes + migrated.archived;
      if (totalMigrated > 0) {
        console.log(`✅ Tiered storage migration complete: ${migrated.clips} clips, ${migrated.notes} notes, ${migrated.archived} archived`);
        
        // Update total counts
        this.totalClipsCount = this.clips.length + migrated.clips;
        this.totalNotesCount = this.notes.length + migrated.notes;
        this.totalArchivedCount = this.searchOnlyClips.length + migrated.archived;
        
        // Re-render to show updated pagination
        this.renderChips();
      } else {
        console.log('✅ Tiered storage migration complete (no migration needed)');
      }

    } catch (e) {
      console.error('Tiered storage migration failed:', e);
    }
  }

  _getNoteContentForHash(note) {
    return this.notesFeature.service.getNoteContentForHash(note);
  }

  async saveNotes() {
    return this.notesFeature.service.saveNotes(this);
  }

  async saveNotesPrefs() {
    return this.notesFeature.service.saveNotesPrefs(this);
  }

  renderNotes() {
    return this.notesFeature.render.renderNotes(this);
  }

  async _lazyLoadNotesPage(startIndex, pageSize, container, paginationEl, pageCount) {
    return this.notesFeature.service.lazyLoadNotesPage(this, { startIndex, pageSize, container, paginationEl, pageCount });
  }

  _renderNoteCard(note) {
    return this.notesFeature.render.renderNoteCard(note, this);
  }

  _attachNoteCardListeners(container) {
    return this.notesFeature.render.attachNoteCardListeners(this, container);
  }

  updateNoteAiControls() {
    return this.notesFeature.render.updateNoteAiControls(this);
  }

  async generateNoteTitleFromContent() {
    return this.notesFeature.editor.generateNoteTitleFromContent(this);
  }

  async generateNoteDescriptionFromContent() {
    return this.notesFeature.editor.generateNoteDescriptionFromContent(this);
  }

  openNoteEditor(type = 'note', noteId = null, showBack = false) {
    return this.notesFeature.editor.openNoteEditor(this, type, noteId, showBack);
  }

  closeNoteEditor() {
    return this.notesFeature.editor.closeNoteEditor(this);
  }

  renderNoteAttachments() {
    return this.notesFeature.render.renderNoteAttachments(this);
  }

  async saveNote() {
    return this.notesFeature.editor.saveNote(this);
  }

  refreshAlbumsForNote(sourceNote) {
    return this.notesFeature.album.refreshAlbumsForNote(this, sourceNote);
  }

  showAlbumPicker() {
    return this.notesFeature.album.showAlbumPicker(this);
  }

  showAlbumPickerForNote(noteId) {
    return this.notesFeature.album.showAlbumPickerForNote(this, noteId);
  }

  closeAlbumPicker() {
    return this.notesFeature.album.closeAlbumPicker(this);
  }

  showBackToAlbumPicker() {
    return this.notesFeature.album.showBackToAlbumPicker(this);
  }

  hideBackToAlbumPicker() {
    return this.notesFeature.album.hideBackToAlbumPicker(this);
  }

  renderAlbumPicker(albums, selectedNoteId) {
    return this.notesFeature.album.renderAlbumPicker(this, albums, selectedNoteId);
  }

  filterAlbumPicker(searchTerm) {
    return this.notesFeature.album.filterAlbumPicker(this, searchTerm);
  }

  async addCurrentClipToNote(noteId) {
    return this.notesFeature.editor.addCurrentClipToNote(this, noteId);
  }

  async addNoteToAlbum(albumId) {
    return this.notesFeature.album.addNoteToAlbum(this, albumId);
  }

  openNoteViewer(noteId) { return this.notesFeature.album.openNoteViewer(this, noteId); }
  closeNoteViewer() { return this.notesFeature.album.closeNoteViewer(this); }
  getAlbumAttachmentOpenMode() { return this.notesFeature.album.getAlbumAttachmentOpenMode(this); }
  openAlbumAttachment(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachment(this, noteId, attachmentIndex); }
  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachmentInEdgePopup(this, noteId, attachmentIndex); }
  openAlbumAttachmentOverlay(note, att) { return this.notesFeature.album.openAlbumAttachmentOverlay(this, note, att); }
  closeAlbumAttachmentViewer() { return this.notesFeature.album.closeAlbumAttachmentViewer(this); }
  openAlbumSourceNoteOverlay(sourceNoteId, albumId) { return this.notesFeature.album.openAlbumSourceNoteOverlay(this, sourceNoteId, albumId); }
  closeAlbumSourceNoteOverlay() { return this.notesFeature.album.closeAlbumSourceNoteOverlay(this); }
  copyAllNoteAttachments() { return this.notesFeature.album.copyAllNoteAttachments(this); }

  deleteNote(noteId) { return this.notesFeature.service.deleteNote(this, noteId); }

  showClipPickerForNote() { return this.notesFeature.editor.showClipPickerForNote(this); }
  closeClipPicker() { return this.notesFeature.editor.closeClipPicker(this); }
  updateClipPickerFooter() { return this.notesFeature.editor.updateClipPickerFooter(this); }
  togglePickerClip(clipId, itemElement) { return this.notesFeature.editor.togglePickerClip(this, clipId, itemElement); }
  normalizePickerText(text) { return this.notesFeature.editor.normalizePickerText(text); }
  createPickerSearchRowHTML(clip) { return this.notesFeature.editor.createPickerSearchRowHTML(this, clip); }
  createPickerChipElement(clip) { return this.notesFeature.editor.createPickerChipElement(this, clip); }
  attachPickerSearchRowHandlers(container) { return this.notesFeature.editor.attachPickerSearchRowHandlers(this, container); }
  switchClipPickerTab(tabName) { return this.notesFeature.editor.switchClipPickerTab(this, tabName); }
  renderClipPickerRecentClips() { return this.notesFeature.editor.renderClipPickerRecentClips(this); }
  searchClipsInPicker(query) { return this.notesFeature.editor.searchClipsInPicker(this, query); }
  renderClipPickerSearchResults(results) { return this.notesFeature.editor.renderClipPickerSearchResults(this, results); }
  renderClipPickerCategories() { return this.notesFeature.editor.renderClipPickerCategories(this); }
  addSelectedClipsToNote() { return this.notesFeature.editor.addSelectedClipsToNote(this); }
  showImagePickerForNote() { return this.notesFeature.editor.showImagePickerForNote(this); }
  addURLToNote() { return this.notesFeature.editor.addURLToNote(this); }
  async exportNoteToPDF(noteId) { return this.notesFeature.editor.exportNoteToPDF(this, noteId); }

  /** Load activity log entries from change_audit_log table */
  async loadActivityLog() {
    try {
      this.activityEntries = [];
      this.activityOffset = 0;
      this.activityFilter = 'all';
      this.activityHasMore = true;

      if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase?.client) {
        console.warn('⚠️ Supabase client not available for activity log');
        return;
      }

      const supabase = pasteCraftSupabase.client;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ User not logged in - activity log unavailable');
        return;
      }

      await this.fetchActivityPage();
    } catch (error) {
      console.error('❌ Failed to load activity log:', error);
    }
  }

  /** Fetch a page of activity entries */
  async fetchActivityPage(append = false) {
    try {
      if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase?.client) return;
      const supabase = pasteCraftSupabase.client;

      const pageSize = 20;
      let query = supabase
        .from('change_audit_log')
        .select('id, occurred_at, table_name, operation, row_old, row_new')
        .order('occurred_at', { ascending: false })
        .range(this.activityOffset, this.activityOffset + pageSize - 1);

      if (this.activityFilter && this.activityFilter !== 'all') {
        query = query.eq('operation', this.activityFilter);
      }

      const dateFrom = document.getElementById('activityDateFrom')?.value;
      const dateTo = document.getElementById('activityDateTo')?.value;
      if (dateFrom) {
        query = query.gte('occurred_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('occurred_at', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Activity query error:', error);
        return;
      }

      if (append) {
        this.activityEntries = [...this.activityEntries, ...(data || [])];
      } else {
        this.activityEntries = data || [];
      }

      this.activityHasMore = (data?.length || 0) >= pageSize;
      this.activityOffset += data?.length || 0;

    } catch (error) {
      console.error('❌ Failed to fetch activity page:', error);
    }
  }

  /** Render activity list UI */
  renderActivityList() {
    const container = document.getElementById('activityList');
    const loadMoreBtn = document.getElementById('loadMoreActivityBtn');
    if (!container) return;

    if (!this.activityEntries || this.activityEntries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
          <h3>No cloud activity yet</h3>
          <p>Activity appears here after clips sync to the cloud.<br>Try clicking Refresh after making changes.</p>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    container.innerHTML = this.activityEntries.map(entry => {
      const icon = this.getActivityIcon(entry.operation);
      const iconClass = entry.operation.toLowerCase();
      const tableBadge = this.getTableBadge(entry.table_name);
      const summary = this.getActivitySummary(entry);
      const timeAgo = this.formatTimeAgo(new Date(entry.occurred_at));

      return `
        <div class="activity-entry" data-id="${entry.id}">
          <div class="activity-entry-icon ${iconClass}">${icon}</div>
          <div class="activity-entry-info">
            <div class="activity-entry-title">${summary}</div>
            <div class="activity-entry-meta">${timeAgo}</div>
          </div>
          <span class="activity-entry-badge ${entry.table_name}">${tableBadge}</span>
        </div>
      `;
    }).join('');

    if (loadMoreBtn) {
      loadMoreBtn.style.display = this.activityHasMore ? 'block' : 'none';
    }
  }

  /** Get icon for operation type */
  getActivityIcon(operation) {
    switch (operation) {
      case 'INSERT': return '➕';
      case 'UPDATE': return '✏️';
      case 'DELETE': return '🗑️';
      default: return '📝';
    }
  }

  /** Get badge label for table name */
  getTableBadge(tableName) {
    const badges = {
      clips: 'Clip',
      categories: 'Category',
      notes: 'Note',
      settings: 'Settings',
      user_profiles: 'Profile',
      archived_clips: 'Archive'
    };
    return badges[tableName] || tableName;
  }

  /** Generate human-readable summary of the activity */
  getActivitySummary(entry) {
    const action = entry.operation === 'INSERT' ? 'Created' :
                   entry.operation === 'UPDATE' ? 'Updated' :
                   entry.operation === 'DELETE' ? 'Deleted' : 'Modified';
    
    const table = this.getTableBadge(entry.table_name).toLowerCase();
    
    // Try to extract a meaningful identifier
    let identifier = '';
    const data = entry.row_new || entry.row_old;
    if (data) {
      if (data.text) {
        identifier = `: "${data.text.substring(0, 30)}${data.text.length > 30 ? '...' : ''}"`;
      } else if (data.name) {
        identifier = `: "${data.name}"`;
      } else if (data.title) {
        identifier = `: "${data.title}"`;
      }
    }

    return `${action} ${table}${identifier}`;
  }

  /** Format timestamp as relative time */
  formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  /** Initialize activity tab event listeners */
  initActivityEventListeners() {
    // Refresh button
    document.getElementById('refreshActivityBtn')?.addEventListener('click', async () => {
      this.activityOffset = 0;
      await this.fetchActivityPage();
      this.renderActivityList();
      this.showToast('Activity refreshed');
    });

    // Filter chips
    document.querySelectorAll('.activity-filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        document.querySelectorAll('.activity-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activityFilter = chip.dataset.filter;
        this.activityOffset = 0;
        await this.fetchActivityPage();
        this.renderActivityList();
      });
    });

    // Date filters
    document.getElementById('activityDateFrom')?.addEventListener('change', async () => {
      this.activityOffset = 0;
      await this.fetchActivityPage();
      this.renderActivityList();
    });

    document.getElementById('activityDateTo')?.addEventListener('change', async () => {
      this.activityOffset = 0;
      await this.fetchActivityPage();
      this.renderActivityList();
    });

    // Load more button
    document.getElementById('loadMoreActivityBtn')?.addEventListener('click', async () => {
      await this.fetchActivityPage(true);
      this.renderActivityList();
    });
  }
}

// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
window.renderLucideIcons = function renderLucideIcons() {
  try {
    if (typeof window.lucide === 'undefined' || !window.lucide.createIcons) return;
    window.lucide.createIcons({
      icons: window.lucide.icons || window.lucide,
      attrs: { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' }
    });
  } catch (e) {
    console.warn('Lucide render failed:', e);
  }
};

(function initLucideObserver() {
  if (window.__lucideObserverInstalled) return;
  window.__lucideObserverInstalled = true;
  const schedule = (() => {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        window.renderLucideIcons();
      });
    };
  })();
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && (node.matches?.('[data-lucide]') || node.querySelector?.('[data-lucide]'))) {
          schedule();
          return;
        }
      }
    }
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
})();

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup script loaded');
  window.renderLucideIcons();
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    // Fallback simple interface
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2><i data-lucide="clipboard"></i> PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
  }
  window.renderLucideIcons();
});

// Also boot immediately if DOMContentLoaded already fired (resilience for any non-blocking script load edge-cases)
if (document.readyState !== 'loading' && !window.pasteCraftPopup) {
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed (immediate boot):', error);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  PasteCraftPopup.handleMessage(message);
  sendResponse(true);
});

async function loadSimpleClips() {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const container = document.getElementById('simpleClips');
  
  if (clips.length === 0) {
    container.innerHTML = '<p style="color: #999;">No clips yet</p>';
    return;
  }
  
  clips.forEach((clip, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'background: #f0f0f0; margin: 8px 0; padding: 8px; border-radius: 4px; cursor: pointer;';
    div.textContent = clip.text.substring(0, 50) + (clip.text.length > 50 ? '...' : '');
    div.onclick = async () => {
      await navigator.clipboard.writeText(clip.text);
      div.style.background = '#90EE90';
      setTimeout(() => div.style.background = '#f0f0f0', 500);
    };
    container.appendChild(div);
  });
}
