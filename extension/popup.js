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

      // Step 3: Update state
      await stateSetter(currentState);

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

      // PRACTICE #5: VERIFICATION - Verify deletion persisted
      if (verifier) {
        const verification = await verifier(entityId);
        if (!verification) {
          throw new Error(`Verification failed: ${entityType} still exists in storage`);
        }
      }

      // Update UI
      uiUpdater?.();
      const msg = successMessage?.({ id: entityId, name: entityName }) || `${entityType} deleted`;
      showToast?.(msg, 'success');

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

      // Step 2: Update state
      await stateSetter(currentState);

      // Step 3: Persist with retry
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

      // PRACTICE #5: VERIFICATION
      if (verifier) {
        const verification = await verifier(entity);
        if (!verification) {
          throw new Error('Verification failed: entity not found in storage');
        }
      }

      uiUpdater?.();
      const msg = successMessage?.(entity) || 'Entity created';
      showToast?.(msg, 'success');

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

      // Step 2: Update state
      await stateSetter(currentState);

      // Step 3: Persist with retry
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

      // PRACTICE #5: VERIFICATION
      if (verifier) {
        const verification = await verifier(entityId, updates);
        if (!verification) {
          throw new Error('Verification failed: update not persisted');
        }
      }

      uiUpdater?.();
      const msg = successMessage?.({ ...entity, ...updates }) || 'Entity updated';
      showToast?.(msg, 'success');

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
    this.darkModeComingSoon = false;
    this._themeSyncing = false;
    this.searchOnlyClips = [];
    // These store stable clip id keys (String(clip.id)), not numbers.
    this.selectedCategoryClips = new Set();
    this.selectedSearchClips = new Set();
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
    this.pendingNoteForAlbum = null;
    this.currentViewerNoteId = null;
    this.currentAlbumAttachmentContext = null;
    this.noteViewerParentAlbumId = null;
    this.notesViewMode = 'notes'; // 'notes' | 'albums'
    this.notesPageIndex = 0; // starts at 0
    this.notesAiEnabled = false;
    this.albumAttachmentOpenMode = 'overlay'; // 'edgePopup' | 'overlay'
    this.cloudClipboardItems = [];
    this.cloudClipboardItemIds = new Set();
    this.pastecraftDevices = [];
    this.cloudSyncAccess = null;
    this.pastecraftDevicesOpen = false;
    this._currentDeviceId = null;

    // (debug instrumentation removed)

    // Serialize clip mutations to prevent races / double-click issues.
    this._clipOpQueue = Promise.resolve();

    // PIN lock (3-digit) state
    this._pinConfig = null; // { enabled, salt, hash, updatedAt }
    // sessionStorage is per-popup-document; use chrome.storage.session for whole-browser-session unlock.
    this._pinUnlockSessionKey = 'pc_pin_unlocked_v2'; // chrome.storage.session + sessionStorage fallback
    this._pinUnlockWindowsKey = 'pc_pin_unlocked_windows_v1'; // chrome.storage.session, window-scoped unlocks
    this._pinUnlimitedSessionKey = 'pc_pin_unlimited_session_v1'; // chrome.storage.session, session-wide unlimited flag
    // NOTE: PIN storage is account-scoped for cross-device use (via browser sync).
    // Legacy (pre-scope) key is still supported for migration.
    this._pinConfigKey = 'pc_pin_v1'; // base key (scoped as `${base}:${userId}`) in chrome.storage.sync + local cache
    this._pinAttemptsKey = 'pc_pin_attempts_v1'; // chrome.storage.local only (scoped as `${base}:${userId}`)

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
    
    // Real-Time State Synchronization: BroadcastChannel API for cross-tab/browser communication
    try {
      this._broadcastChannel = new BroadcastChannel('pastecraft-settings-sync');
      this._broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'settingsUpdated') {
          // Reload settings from storage (optimistic UI update)
          this.loadSettings().then(async () => {
            // If settings modal is open, refresh it (now async)
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.style.display === 'flex') {
              await this.showSettingsModal();
            }
          }).catch(() => {});
        }
      };
    } catch (error) {
      console.warn('⚠️ BroadcastChannel not available:', error);
      this._broadcastChannel = null;
    }
    
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
    const obj = (raw && typeof raw === 'object') ? raw : {};
    const enabled = obj.enabled === true;
    const provider = PasteCraftPopup.AI_ALLOWED_PROVIDERS.has(String(obj.provider || 'openai'))
      ? String(obj.provider || 'openai')
      : 'openai';
    const presets = PasteCraftPopup.AI_PROVIDER_PRESETS[provider] || PasteCraftPopup.AI_PROVIDER_PRESETS.openai;
    const allowedPresets = new Set(presets.map(p => p.value));
    const preset = allowedPresets.has(String(obj.preset || 'default')) ? String(obj.preset || 'default') : 'default';
    const updatedAt = Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0;

    return { enabled, provider, preset, updatedAt };
  }

  async loadAiWorkflow() {
    const key = this._aiWorkflowKey;
    const defaults = { enabled: false, provider: 'openai', preset: 'default', updatedAt: 0 };

    let syncCfg = null;
    let localCfg = null;
    try {
      syncCfg = await new Promise((resolve) => chrome.storage.sync.get([key], resolve));
    } catch (_) {
      syncCfg = null;
    }
    try {
      localCfg = await chrome.storage.local.get([key]);
    } catch (_) {
      localCfg = null;
    }

    const fromSync = this._normalizeAiWorkflow(syncCfg ? syncCfg[key] : null);
    const fromLocal = this._normalizeAiWorkflow(localCfg ? localCfg[key] : null);

    const hasSync = !!(syncCfg && syncCfg[key]);
    const hasLocal = !!(localCfg && localCfg[key]);

    const preferSync = hasSync && fromSync.updatedAt >= fromLocal.updatedAt;
    const next = preferSync ? fromSync : (hasLocal ? fromLocal : defaults);

    this.aiWorkflow = this._normalizeAiWorkflow(next);

    // Local cache for offline access (best-effort)
    try { await chrome.storage.local.set({ [key]: this.aiWorkflow }); } catch (_) {}

    this.applyAiWorkflowToUi();
    return this.aiWorkflow;
  }

  applyAiWorkflowToUi() {
    try {
      const toggle = document.getElementById('aiWorkflowOverrideToggle');
      const providerEl = document.getElementById('aiProviderSelect');
      const presetEl = document.getElementById('aiWorkflowPresetSelect');

      const cfg = this._normalizeAiWorkflow(this.aiWorkflow);
      this.aiWorkflow = cfg;

      if (toggle) toggle.checked = !!cfg.enabled;
      if (providerEl) providerEl.value = cfg.provider || 'openai';

      // Rebuild preset options for the selected provider
      if (presetEl) {
        const presets = PasteCraftPopup.AI_PROVIDER_PRESETS[cfg.provider] || PasteCraftPopup.AI_PROVIDER_PRESETS.openai;
        presetEl.innerHTML = '';
        for (const p of presets) {
          const opt = document.createElement('option');
          opt.value = p.value;
          opt.textContent = p.label;
          presetEl.appendChild(opt);
        }
        presetEl.value = cfg.preset || 'default';
      }

      const disabled = !cfg.enabled;
      if (providerEl) providerEl.disabled = disabled;
      if (presetEl) presetEl.disabled = disabled;
    } catch (_) {}
  }

  async saveAiWorkflowFromUi(silent = true) {
    // Use CRUD utility for reliable update
    const key = this._aiWorkflowKey;
    const snapshot = PasteCraftCRUD.createSnapshot(this.aiWorkflow);

    const rollback = async () => {
      try {
        this.aiWorkflow = this._normalizeAiWorkflow(snapshot);
        this.applyAiWorkflowToUi();
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({ [key]: this.aiWorkflow });
        });
      } catch (rollbackError) {
        console.error('❌ AI workflow rollback failed:', rollbackError);
      }
    };

    try {
      const toggle = document.getElementById('aiWorkflowOverrideToggle');
      const providerEl = document.getElementById('aiProviderSelect');
      const presetEl = document.getElementById('aiWorkflowPresetSelect');
      if (!toggle || !providerEl || !presetEl) {
        throw new Error('AI workflow UI elements not found');
      }

      const next = this._normalizeAiWorkflow({
        enabled: !!toggle.checked,
        provider: String(providerEl.value || 'openai'),
        preset: String(presetEl.value || 'default'),
        updatedAt: Date.now()
      });

      this.aiWorkflow = next;
      this.applyAiWorkflowToUi();

      // PRACTICE #3: RETRY LOGIC - Save locally with retry
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({ [key]: this.aiWorkflow });
      });

      // Best-effort: sync storage for cross-device
      try {
        await new Promise((resolve) => chrome.storage.sync.set({ [key]: this.aiWorkflow }, resolve));
      } catch (_) {}

      // PRACTICE #5: VERIFICATION - Verify persisted
      const verification = await chrome.storage.local.get([key]);
      const verified = this._normalizeAiWorkflow(verification ? verification[key] : null);
      if (verified.updatedAt !== this.aiWorkflow.updatedAt || verified.preset !== this.aiWorkflow.preset || verified.enabled !== this.aiWorkflow.enabled) {
        throw new Error('Verification failed: AI workflow not persisted correctly');
      }

      // Immediately sync in-memory cache so next AI call uses the new config
      if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.setAiWorkflowConfigDirect) {
        pasteCraftSupabase.setAiWorkflowConfigDirect(this.aiWorkflow);
      }

      if (!silent) this.showToast('✅ AI workflow saved!');
      return this.aiWorkflow;
    } catch (error) {
      console.error('❌ AI workflow save failed, rolling back:', error);
      await rollback();
      if (!silent) this.showToast(`❌ Failed to save AI workflow: ${error.message || 'Unknown error'}`, 'error');
      return null;
    }
  }

  // =====================================================
  // AUTH PREFS (local-only; never store passwords)
  // =====================================================

  async loadAuthPrefs() {
    const defaults = { staySignedIn: true, rememberEmail: false, rememberedEmail: '' };
    try {
      const res = await chrome.storage.local.get([this._authPrefsKey]);
      const raw = res?.[this._authPrefsKey] || null;
      const staySignedIn = raw && typeof raw.staySignedIn === 'boolean' ? raw.staySignedIn : defaults.staySignedIn;
      const rememberEmail = raw && typeof raw.rememberEmail === 'boolean' ? raw.rememberEmail : defaults.rememberEmail;
      const rememberedEmail = (raw && typeof raw.rememberedEmail === 'string') ? raw.rememberedEmail : defaults.rememberedEmail;
      return {
        staySignedIn,
        rememberEmail,
        rememberedEmail: rememberedEmail.slice(0, 320)
      };
    } catch (_) {
      return { ...defaults };
    }
  }

  async saveAuthPrefs(next) {
    try {
      const current = await this.loadAuthPrefs();
      const merged = {
        ...current,
        ...next
      };
      // Never store passwords; only store email if explicitly requested.
      const rememberEmail = !!merged.rememberEmail;
      const rememberedEmail = rememberEmail ? String(merged.rememberedEmail || '').slice(0, 320) : '';
      const payload = {
        staySignedIn: merged.staySignedIn !== false,
        rememberEmail,
        rememberedEmail,
        updatedAt: Date.now()
      };
      await chrome.storage.local.set({ [this._authPrefsKey]: payload });
      return payload;
    } catch (_) {
      return null;
    }
  }

  async applyAuthPrefsToUi() {
    const prefs = await this.loadAuthPrefs();

    // Auth modal
    try {
      const stayEl = document.getElementById('staySignedIn');
      if (stayEl) stayEl.checked = prefs.staySignedIn !== false;

      const rememberEmailEl = document.getElementById('rememberEmail');
      if (rememberEmailEl) rememberEmailEl.checked = !!prefs.rememberEmail;

      const emailEl = document.getElementById('signinEmail');
      if (emailEl && prefs.rememberEmail && prefs.rememberedEmail) {
        if (!emailEl.value) emailEl.value = prefs.rememberedEmail;
      }
    } catch (_) {}

    // Settings modal
    try {
      const stayEl = document.getElementById('staySignedInSetting');
      if (stayEl) stayEl.checked = prefs.staySignedIn !== false;
      const rememberEl = document.getElementById('rememberEmailSetting');
      if (rememberEl) rememberEl.checked = !!prefs.rememberEmail;
    } catch (_) {}

    return prefs;
  }

  // =====================================================
  // PIN STORAGE KEYS (account-scoped)
  // =====================================================

  async _getAuthedUserIdForPin() {
    // Best-effort: avoid throwing; return '' if not signed in.
    try {
      if (this.currentUser?.id) return String(this.currentUser.id);
    } catch (_) {}
    try {
      const u = await pasteCraftSupabase.getCurrentUser();
      const userId = u?.id ? String(u.id) : '';
      return userId;
    } catch (_) {
      return '';
    }
  }

  _pinScopedKey(base, userId) {
    const uid = String(userId || '').trim();
    return uid ? `${String(base)}:${uid}` : String(base);
  }

  _clipIdKey(id) {
    return String(id);
  }

  _queueClipOp(fn) {
    const run = this._clipOpQueue.then(fn, fn);
    // Keep queue alive even if an operation fails
    this._clipOpQueue = run.catch(() => {});
    return run;
  }

  getSelectedClipIdsInUiOrder() {
    if (!this.selectedChips || this.selectedChips.size === 0) return [];

    const selected = this.selectedChips;
    const ordered = [];

    // UI order = DOM order of current page chips
    const domChips = document.querySelectorAll('#chipContainer .chip');
    if (domChips && domChips.length > 0) {
      domChips.forEach(el => {
        const id = el?.dataset?.clipId;
        if (id && selected.has(id)) ordered.push(id);
      });
    }

    // Fallback: storage order
    if (ordered.length === 0) {
      this.clips.forEach(c => {
        const id = this._clipIdKey(c?.id);
        if (selected.has(id)) ordered.push(id);
      });
    }

    return ordered;
  }

  async deleteClipsByIdKeys(idKeys, {
    includeArchived = true,
    reason = 'delete:unknown',
    closeCategoryModal = false,
    clearSelection = true,
    rerender = true
  } = {}) {
    const ids = Array.isArray(idKeys) ? idKeys.map(k => String(k)).filter(Boolean) : [];
    if (ids.length === 0) return { requested: 0, deleted: 0, missing: 0 };

    return this._queueClipOp(async () => {
      const idSet = new Set(ids);
      const beforeActive = Array.isArray(this.clips) ? this.clips.length : 0;
      const beforeArchived = Array.isArray(this.searchOnlyClips) ? this.searchOnlyClips.length : 0;

      // Compute next state (no index splicing)
      const nextClips = (Array.isArray(this.clips) ? this.clips : []).filter(c => !idSet.has(this._clipIdKey(c?.id)));
      const nextArchived = includeArchived
        ? (Array.isArray(this.searchOnlyClips) ? this.searchOnlyClips : []).filter(c => !idSet.has(this._clipIdKey(c?.id)))
        : (Array.isArray(this.searchOnlyClips) ? this.searchOnlyClips : []);

      // PRACTICE #2: STATE SNAPSHOT for rollback
      const snapshot = {
        clips: PasteCraftCRUD.createSnapshot(this.clips),
        searchOnlyClips: PasteCraftCRUD.createSnapshot(this.searchOnlyClips)
      };

      const rollback = async () => {
        try {
          this.clips = snapshot.clips;
          this.searchOnlyClips = snapshot.searchOnlyClips;
          await PasteCraftCRUD.retryOperation(async () => {
            await chrome.storage.local.set({
              clips: this.clips,
              searchOnlyClips: this.searchOnlyClips,
              pc_local_updatedAt: Date.now()
            });
          });
          if (rerender) {
            this.renderChips();
            this.renderSearchResults();
            this.renderCategories();
          }
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
      };

      try {
        // PRACTICE #4: IDEMPOTENCY CHECK - Verify clips were removed
        const stillExists = [...nextClips, ...nextArchived].some(c => idSet.has(this._clipIdKey(c?.id)));
        if (stillExists) {
          throw new Error('Clips still exist after filter operation');
        }

        // Update in-memory state
        this.clips = nextClips;
        this.searchOnlyClips = nextArchived;

        // PRACTICE #3: RETRY LOGIC - Atomic write with retry
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({
            clips: this.clips,
            searchOnlyClips: this.searchOnlyClips,
            pc_local_updatedAt: Date.now()
          });
        });

        // PRACTICE #5: VERIFICATION - Verify deletion persisted
        const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
        const verifiedClips = [...(verification.clips || []), ...(includeArchived ? (verification.searchOnlyClips || []) : [])];
        const verifiedDeleted = !verifiedClips.some(c => idSet.has(this._clipIdKey(c?.id)));
        if (!verifiedDeleted) {
          throw new Error('Verification failed: clips still exist in storage');
        }

        // UI updates
        if (clearSelection) {
          ids.forEach(id => this.selectedChips.delete(id));
          this.selectedSearchClips.clear();
          this.selectedCategoryClips.clear();
        }
        if (closeCategoryModal) {
          this.hideCategoryModal();
        }
        if (rerender) {
          this.renderChips();
          this.renderSearchResults();
          this.renderCategories();
          this.updateCategoryFilter();
          this.updateManualInputCategories();
          this.updatePreview();
          this.updateQuickCopyButton();
          this.updateCategoryBulkActions();
          this.updateSearchBulkActions();
        }

        // Background sync (non-blocking)
        Promise.resolve()
          .then(() => this.backupLocalToSync(reason))
          .catch(() => {});
        Promise.resolve()
          .then(() => pasteCraftSupabase.syncWithQueue('syncClips', this.clips, pasteCraftSupabase.syncClipsToSupabase))
          .catch(() => {});
        if (includeArchived) {
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncArchivedClips', this.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
            .catch(() => {});
        }

        const afterActive = this.clips.length;
        const afterArchived = this.searchOnlyClips.length;
        const deleted = (beforeActive - afterActive) + (includeArchived ? (beforeArchived - afterArchived) : 0);
        const missing = Math.max(0, idSet.size - deleted);

        return { requested: idSet.size, deleted, missing };
      } catch (error) {
        // Rollback on any failure
        console.error('❌ Clip deletion failed, rolling back:', error);
        await rollback();
        return { requested: idSet.size, deleted: 0, missing: idSet.size };
      }
    });
  }
  
  async init() {
    console.log('🚀 Initializing PasteCraft popup...');
    
    // Setup auth modal events FIRST (before checking auth)
    this.setupAuthModalEvents();
    this.setupPinModalEvents();
    
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
    
    if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery') {
      console.log('🔑 Password reset callback detected from URL');
      const accessToken = hashParams.get('access_token');
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

    // Best-effort: restore database auth session from the session bridge (non-blocking).
    // Runs in background so startup is not delayed; getCurrentUser uses bridge fast path.
    try {
      const prefs = await this.loadAuthPrefs();
      if (prefs.staySignedIn !== false) {
        Promise.resolve()
          .then(() => this.restoreSupabaseSessionFromBridge('startup'))
          .catch(() => {});
      }
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

    // If PIN lock is enabled, require unlock before proceeding.
    const pinOk = await this.maybeRequirePinUnlock();
    if (!pinOk) {
      return;
    }
    
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
    
    this.setupStorageSyncListener();
    this.setupLocalStorageListener();

    // Parallelize independent storage reads for faster startup
    await Promise.all([
      this.loadData(),
      this.loadSettings(),
      this.loadAiWorkflow(),
      this.loadUserProfile(),
      this.loadAnalysisHistory(),
    ]);

    // Always update top bar name/image (even if no image saved yet)
    this.updateTopBarIdentity();
    
    // ✅ DISPLAY SAVED PROFILE IMAGE
    console.log('🔍 Checking for saved profile image...');
    if (this.userProfile?.profileImageUrl) {
      console.log('✅ Saved profile image found, displaying in top-left...');
      this.displayImageTopLeft(this.userProfile.profileImageUrl);
    } else {
      console.log('ℹ️ No saved profile image found');
    }
    
    this.setupEventListeners();
    this.renderChips();
    this.updateLastCapture();
    this.updatePreview();
    this.renderCategories();
    this.updateCategoryFilter();

    // 🔄 RESTORE SESSION STATE (active tab, AI content, etc.)
    await this._restoreSessionState();
    
    // 🎯 HIDE LOADING OVERLAY (local data loaded, ready to show)
    this.hideLoadingOverlay();

    // Run potentially heavy maintenance tasks in background (do not block popup render)
    Promise.resolve()
      .then(() => this.bootstrapStorageSyncTransfer())
      .catch(() => {});

    Promise.resolve()
      .then(() => this.maybeCreateDailyRestorePoint('startup'))
      .catch(() => {});

    // Auto-delete cleanup can be slow with large clip sets; run in background.
    Promise.resolve()
      .then(() => this.cleanupOldClips())
      .catch(() => {});
    
    // 🔄 SYNC WITH SUPABASE IN BACKGROUND (don't await - let it happen naturally)
    this.performBackgroundSync();
    
    // Reload data whenever popup becomes visible
    this.setupVisibilityListener();
    
    // Setup realtime data sync listeners
    this.setupRealtimeListeners();
    this.setupCloudClipboardSync().catch(() => {});
    
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
    if (!subscription) {
      return { state: 'unknown', text: 'Image credits: —', css: 'is-muted', title: 'Sign in to view image credits' };
    }

    const tier = String(subscription.subscription_tier || '').toLowerCase();
    const status = String(subscription.subscription_status || '').toLowerCase();
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponAiAccess = !!(subscription && (
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ));

    const isEntitledTier = (tier === 'premium' || tier === 'admin');
    const isActiveStatus = (status === 'active' || status === 'past_due');
    const entitled = (isEntitledTier && isActiveStatus) || hasCouponAiAccess;

    if (!entitled) {
      return { state: 'no_access', text: 'Image credits: 0', css: 'is-empty', title: 'Upgrade to access AI image generation' };
    }

    if (subscription.has_unlimited_ai === true || tier === 'admin') {
      return { state: 'unlimited', text: 'Image credits: ∞', css: '', title: 'Unlimited AI image credits' };
    }

    const limit = Number.isFinite(Number(subscription.ai_image_credits_limit))
      ? Number(subscription.ai_image_credits_limit)
      : NaN;
    const used = Number.isFinite(Number(subscription.ai_image_credits_used))
      ? Number(subscription.ai_image_credits_used)
      : 0;

    const resetAt = subscription.ai_image_credits_reset_at
      || subscription.stripe_current_period_end
      || subscription.current_period_end
      || null;

    if (!Number.isFinite(limit) || limit <= 0) {
      const resetShort = resetAt ? this._formatShortDate(resetAt) : null;
      const base = 'Image credits: —';
      const suffix = resetShort ? ` • resets ${resetShort}` : '';
      return { state: 'pending', text: `${base}${suffix}`, css: 'is-muted', title: 'Credits pending billing sync' };
    }

    const remaining = Math.max(0, limit - Math.max(0, used));
    const resetShort = resetAt ? this._formatShortDate(resetAt) : null;
    const suffix = resetShort ? ` • resets ${resetShort}` : '';
    const css = remaining <= 0 ? 'is-empty' : (remaining <= Math.min(3, Math.floor(limit * 0.15)) ? 'is-low' : '');
    return {
      state: 'ok',
      text: `Image credits: ${remaining}/${limit}${suffix}`,
      css,
      title: `AI image credits remaining: ${remaining} of ${limit}${resetShort ? ` (resets ${resetShort})` : ''}`
    };
  }

  _computeAiTextCreditsView(subscription) {
    if (!subscription) {
      return { state: 'unknown', text: 'AI text credits: —', css: 'is-muted', title: 'Sign in to view AI text credits' };
    }

    const tier = String(subscription.subscription_tier || '').toLowerCase();
    const status = String(subscription.subscription_status || '').toLowerCase();
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponAiAccess = !!(subscription && (
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ));

    const isEntitledTier = (tier === 'premium' || tier === 'admin');
    const isActiveStatus = (status === 'active' || status === 'past_due');
    const entitled = (isEntitledTier && isActiveStatus) || hasCouponAiAccess;

    if (!entitled) {
      return { state: 'no_access', text: 'AI text credits: 0', css: 'is-empty', title: 'Upgrade to access AI text features' };
    }

    // If you later add `ai_text_credits_*` fields, we will use them automatically.
    const limit = Number.isFinite(Number(subscription.ai_text_credits_limit))
      ? Number(subscription.ai_text_credits_limit)
      : NaN;
    const used = Number.isFinite(Number(subscription.ai_text_credits_used))
      ? Number(subscription.ai_text_credits_used)
      : 0;

    const resetAt = subscription.ai_text_credits_reset_at
      || subscription.stripe_current_period_end
      || subscription.current_period_end
      || null;

    if (!Number.isFinite(limit) || limit <= 0) {
      return { state: 'unlimited', text: 'AI text credits: ∞', css: '', title: 'AI text credits are currently unlimited' };
    }

    const remaining = Math.max(0, limit - Math.max(0, used));
    const resetShort = resetAt ? this._formatShortDate(resetAt) : null;
    const suffix = resetShort ? ` • resets ${resetShort}` : '';
    const css = remaining <= 0 ? 'is-empty' : (remaining <= Math.min(3, Math.floor(limit * 0.15)) ? 'is-low' : '');
    return {
      state: 'ok',
      text: `AI text credits: ${remaining}/${limit}${suffix}`,
      css,
      title: `AI text credits remaining: ${remaining} of ${limit}${resetShort ? ` (resets ${resetShort})` : ''}`
    };
  }

  /** Update the label text of a credit pill without destroying child elements (tooltips). */
  _setPillLabel(el, text) {
    // Find or create the first text node to hold the label.
    const firstTextNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
      firstTextNode.textContent = text + ' ';
    } else {
      el.insertBefore(document.createTextNode(text + ' '), el.firstChild);
    }
  }

  /** Build provider-aware cost breakdown HTML for the text-credits tooltip. */
  _buildCreditCostHtml() {
    const cfg = this._normalizeAiWorkflow(this.aiWorkflow);
    const provider = cfg.provider || 'openai';
    const costs = PasteCraftPopup.AI_CREDIT_COSTS[provider] || PasteCraftPopup.AI_CREDIT_COSTS.openai;
    const presets = PasteCraftPopup.AI_PROVIDER_PRESETS[provider] || PasteCraftPopup.AI_PROVIDER_PRESETS.openai;
    const providerName = provider === 'google' ? 'Google Gemini' : 'OpenAI';

    const lines = presets
      .filter(p => costs[p.value] !== undefined)
      .map(p => {
        // Strip the " · XX cr" suffix we added to labels to get the clean model name
        const cleanLabel = p.label.replace(/\s*·\s*\d+\s*cr$/i, '');
        return `${cleanLabel} · <strong>${costs[p.value]}</strong> cr`;
      });

    return `<strong>${providerName} — Cost per call:</strong><br>` + lines.join('<br>');
  }

  updateAiCreditsPills(source = '') {
    const imgEl = document.getElementById('aiCreditsPill');
    if (imgEl) {
      const view = this._computeAiImageCreditsView(this.userSubscription);
      this._setPillLabel(imgEl, view.text);
      imgEl.title = view.title || imgEl.title || '';
      imgEl.classList.remove('is-muted', 'is-low', 'is-empty');
      if (view.css) view.css.split(/\s+/).filter(Boolean).forEach(c => imgEl.classList.add(c));
    }

    const textEl = document.getElementById('aiTextCreditsPill');
    if (textEl) {
      const view = this._computeAiTextCreditsView(this.userSubscription);
      this._setPillLabel(textEl, view.text);
      textEl.title = view.title || textEl.title || '';
      textEl.classList.remove('is-muted', 'is-low', 'is-empty');
      if (view.css) view.css.split(/\s+/).filter(Boolean).forEach(c => textEl.classList.add(c));

      // Inject dynamic model-cost breakdown into the tooltip
      const costsEl = document.getElementById('aiTextCreditsCosts');
      if (costsEl) {
        costsEl.innerHTML = this._buildCreditCostHtml();
      }
    }

    if (source) {
      try { console.log(`🎫 AI credits pills updated (${source})`); } catch (_) {}
    }
  }

  // Back-compat: older callsites.
  updateAiCreditsPill(source = '') {
    this.updateAiCreditsPills(source);
  }

  setupStorageSyncListener() {
    try {
      // Debounce repeated sync change events (and avoid re-entrancy loops)
      this._handlingSyncChange = false;
      this._lastSyncChangeAt = 0;

      chrome.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName !== 'sync') return;
        if (!changes || !changes.pc_sync_backup_v1) return;
        if (this._handlingSyncChange) return;
        const now = Date.now();
        if (now - this._lastSyncChangeAt < 750) return;
        this._lastSyncChangeAt = now;
        this._handlingSyncChange = true;

        const next = changes.pc_sync_backup_v1?.newValue || null;
        const nextClips = next && Array.isArray(next.clips) ? next.clips.length : 0;
        const nextNotes = next && Array.isArray(next.notes) ? next.notes.length : 0;
        const nextUpdatedAt = next && typeof next.updatedAt === 'number' ? next.updatedAt : 0;


        try {
          await this.bootstrapStorageSyncTransfer();
          await this.loadData();
    await this.loadNotes();
          this.renderChips();
          this.renderCategories();
          this.renderNotes();
          this.updateCategoryFilter();
          this.updateLastCapture();
          this.updatePreview();
        } finally {
          this._handlingSyncChange = false;
        }
      });
    } catch (_) {
      // ignore
    }
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

  async bootstrapStorageSyncTransfer() {
    try {
      const local = await chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'pc_local_updatedAt',
        'notesViewMode',
        'notesPageIndex',
        'notesAiEnabled',
        'settings',
        'userProfile'
      ]);

      // Repair duplicate / missing clip ids in local storage BEFORE any syncing/backup.
      // This prevents clip rows overwriting each other in database and collapsing during merge.
      const repaired = this.repairLocalClipIds(local.clips, local.searchOnlyClips);
      if (repaired.changed) {
        await chrome.storage.local.set({
          clips: repaired.clips,
          searchOnlyClips: repaired.searchOnlyClips
        });
        local.clips = repaired.clips;
        local.searchOnlyClips = repaired.searchOnlyClips;
      }

      const sync = await new Promise((resolve) => chrome.storage.sync.get(['pc_sync_backup_v1'], resolve));
      const backup = sync?.pc_sync_backup_v1 || null;

      const localClipsCount = Array.isArray(local.clips) ? local.clips.length : 0;
      const localNotesCount = Array.isArray(local.notes) ? local.notes.length : 0;

      const backupClipsCount = backup && Array.isArray(backup.clips) ? backup.clips.length : 0;
      const backupNotesCount = backup && Array.isArray(backup.notes) ? backup.notes.length : 0;

      const backupUpdatedAt = backup && typeof backup.updatedAt === 'number' ? backup.updatedAt : 0;
      let localUpdatedAt = typeof local.pc_local_updatedAt === 'number' ? local.pc_local_updatedAt : 0;

      const localHasAny = localClipsCount > 0 || localNotesCount > 0;
      const backupHasAny = backupClipsCount > 0 || backupNotesCount > 0;

      // If local already has data but no updated marker yet, initialize it so we don't
      // incorrectly restore an older sync backup over existing local state.
      let localUpdatedAtInitialized = false;
      if (localHasAny && localUpdatedAt === 0) {
        localUpdatedAt = Date.now();
        localUpdatedAtInitialized = true;
        try {
          await chrome.storage.local.set({ pc_local_updatedAt: localUpdatedAt });
          local.pc_local_updatedAt = localUpdatedAt;
        } catch (_) {
          // ignore
        }
      }

      // Merge helper (works for clips, archived clips, categories, notes)
      const stableKey = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return `s:${item.slice(0, 80)}`;
        // Prefer content-based key for clip-like objects to avoid duplicates across sources with different ids.
        if (typeof item.text === 'string' && typeof item.timestamp === 'number') {
          const s = item.text;
          let h = 2166136261;
          for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
          const textHash = (h >>> 0).toString(36);
          const bucket = Math.floor(item.timestamp / 3000); // 3s bucket to collapse accidental dupes
          const cat = item.category != null ? String(item.category) : '';
          return `clip:${textHash}:${bucket}:${cat}`;
        }
        const id = item.id ?? item.clip_id ?? item.clipId ?? item.category_id ?? item.categoryId ?? null;
        if (id != null) return `id:${String(id)}`;
        const t = item.text ?? item.url ?? item.name ?? '';
        const ts = item.timestamp ?? item.createdAt ?? item.updatedAt ?? 0;
        return `h:${String(t).slice(0, 80)}:${ts}`;
      };

      const mergeArrays = (a, b) => {
        const out = new Map();
        const add = (x) => {
          const k = stableKey(x);
          if (!k) return;
          const prev = out.get(k);
          const ts = (x && typeof x === 'object') ? (x.timestamp ?? x.updatedAt ?? x.createdAt ?? 0) : 0;
          const prevTs = (prev && typeof prev === 'object') ? (prev.timestamp ?? prev.updatedAt ?? prev.createdAt ?? 0) : 0;
          if (!prev || (ts || 0) >= (prevTs || 0)) out.set(k, x);
        };
        (Array.isArray(a) ? a : []).forEach(add);
        (Array.isArray(b) ? b : []).forEach(add);
        return Array.from(out.values());
      };

      const mergedClips = mergeArrays(local.clips, backup?.clips).slice(0, 500);
      const mergedSearchOnlyClips = mergeArrays(local.searchOnlyClips, backup?.searchOnlyClips).slice(0, 1000);
      const mergedCategories = mergeArrays(local.categories, backup?.categories).slice(0, 300);
      const mergedNotes = mergeArrays(local.notes, backup?.notes).slice(0, 300);

      // Prefer newest side by updatedAt, falling back to count-based heuristics when missing.
      // This prevents deleted clips from being restored from an older sync backup.
      const preferLocal = localHasAny && localUpdatedAt > 0 && (backupUpdatedAt === 0 || localUpdatedAt >= backupUpdatedAt);
      const preferBackup = backupHasAny && backupUpdatedAt > 0 && (localUpdatedAt === 0 || backupUpdatedAt > localUpdatedAt);

      // Decide which direction to sync.
      const shouldWriteLocal =
        preferBackup ||
        (
          !preferLocal &&
          backupHasAny && (
            backupClipsCount > localClipsCount ||
            backupNotesCount > localNotesCount
          )
        );

      const shouldWriteSync =
        preferLocal ||
        (
          !preferBackup &&
          localHasAny && (
            !backupHasAny ||
            localClipsCount > backupClipsCount ||
            localNotesCount > backupNotesCount
          )
        );

      // When we prefer one side by updatedAt, do not merge in the other side (merging would resurrect deleted clips).
      const nextLocalClips = preferBackup ? (Array.isArray(backup?.clips) ? backup.clips : []) : mergedClips;
      const nextLocalArchived = preferBackup ? (Array.isArray(backup?.searchOnlyClips) ? backup.searchOnlyClips : []) : mergedSearchOnlyClips;
      const nextLocalCategories = preferBackup ? (Array.isArray(backup?.categories) ? backup.categories : []) : mergedCategories;
      const nextLocalNotes = preferBackup ? (Array.isArray(backup?.notes) ? backup.notes : []) : mergedNotes;

      const nextSyncClips = preferLocal ? (Array.isArray(local.clips) ? local.clips : []) : mergedClips;
      const nextSyncArchived = preferLocal ? (Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : []) : mergedSearchOnlyClips;
      const nextSyncCategories = preferLocal ? (Array.isArray(local.categories) ? local.categories : []) : mergedCategories;
      const nextSyncNotes = preferLocal ? (Array.isArray(local.notes) ? local.notes : []) : mergedNotes;

      const willWriteLocal = shouldWriteLocal && (nextLocalClips.length !== localClipsCount || nextLocalNotes.length !== localNotesCount);
      const willWriteSync = shouldWriteSync && (nextSyncClips.length !== backupClipsCount || nextSyncNotes.length !== backupNotesCount);

      if (willWriteLocal) {
        await chrome.storage.local.set({
          clips: nextLocalClips.slice(0, 500),
          categories: nextLocalCategories.slice(0, 300),
          searchOnlyClips: nextLocalArchived.slice(0, 1000),
          notes: nextLocalNotes.slice(0, 300),
          notesViewMode: backup?.notesViewMode || local.notesViewMode || 'notes',
          notesPageIndex: typeof (backup?.notesPageIndex) === 'number' ? backup.notesPageIndex : (typeof local.notesPageIndex === 'number' ? local.notesPageIndex : 0),
          notesAiEnabled: backup ? !!backup.notesAiEnabled : !!local.notesAiEnabled,
          settings: backup?.settings || local.settings || {},
          userProfile: backup?.userProfile || local.userProfile || null
        });
      }

      if (willWriteSync) {
        const payload = {
          version: 1,
          updatedAt: Date.now(),
          clips: nextSyncClips.slice(0, 500),
          categories: nextSyncCategories.slice(0, 300),
          searchOnlyClips: nextSyncArchived.slice(0, 1000),
          notes: nextSyncNotes.slice(0, 300),
          notesViewMode: local.notesViewMode || backup?.notesViewMode || 'notes',
          notesPageIndex: typeof local.notesPageIndex === 'number' ? local.notesPageIndex : (typeof backup?.notesPageIndex === 'number' ? backup.notesPageIndex : 0),
          notesAiEnabled: !!local.notesAiEnabled,
          settings: local.settings || backup?.settings || {},
          userProfile: local.userProfile || backup?.userProfile || null
        };

        await new Promise((resolve) => chrome.storage.sync.set({ pc_sync_backup_v1: payload }, resolve));
      }
    } catch (e) {
      // Ignore sync failures (quota / sync disabled)
    }
  }

  async backupLocalToSync(reason = 'local-change') {
    try {
      const local = await chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'notesViewMode',
        'notesPageIndex',
        'notesAiEnabled',
        'settings',
        'userProfile'
      ]);

      // Best-effort: maintain 28-day local restore points.
      // (local-only; does not affect cloud)
      try {
        await this.maybeCreateDailyRestorePoint(reason, local);
      } catch (_) {}

      const payload = {
        version: 1,
        updatedAt: Date.now(),
        clips: Array.isArray(local.clips) ? local.clips : [],
        categories: Array.isArray(local.categories) ? local.categories : [],
        searchOnlyClips: Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : [],
        notes: Array.isArray(local.notes) ? local.notes : [],
        notesViewMode: local.notesViewMode || 'notes',
        notesPageIndex: typeof local.notesPageIndex === 'number' ? local.notesPageIndex : 0,
        notesAiEnabled: !!local.notesAiEnabled,
        settings: local.settings || {},
        userProfile: local.userProfile || null
      };

      // Persist local "last updated" marker so sync-transfer doesn't restore older backups over deletions.
      try {
        await chrome.storage.local.set({ pc_local_updatedAt: payload.updatedAt });
      } catch (_) {
        // ignore
      }

      let ok = true;
      try {
        await new Promise((resolve) => {
          chrome.storage.sync.set({ pc_sync_backup_v1: payload }, () => {
            if (chrome.runtime && chrome.runtime.lastError) ok = false;
            resolve();
          });
        });
      } catch (e) {
        ok = false;
      }

    } catch (_) {
      // ignore (quota / sync disabled)
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

    // Ensure the latest sync backup is updated (cross-device transfer) but do not force cloud sync.
    try { await this.backupLocalToSync('restore:apply'); } catch (_) {}

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
      } else if (type === 'clipboardHistory') {
        await this.syncCloudClipboardHistory();
      } else if (type === 'pastecraftDevices') {
        await this.loadPastecraftDevices();
      }
    });
  }

  async ensureCurrentDeviceId() {
    if (this._currentDeviceId) return this._currentDeviceId;
    try {
      this._currentDeviceId = await pasteCraftSupabase.getDeviceId();
    } catch (_) {
      this._currentDeviceId = null;
    }
    return this._currentDeviceId;
  }

  setupCloudClipboardSync() {
    const viewDevicesBtn = document.getElementById('viewPastecraftDevicesBtn');
    const devicesPanel = document.getElementById('pastecraftDevicesPanel');
    const syncedClipContainer = document.getElementById('syncedClipContainer');
    if (!viewDevicesBtn || !devicesPanel || !syncedClipContainer) return Promise.resolve();

    viewDevicesBtn.addEventListener('click', () => {
      this.pastecraftDevicesOpen = !this.pastecraftDevicesOpen;
      devicesPanel.classList.toggle('open', this.pastecraftDevicesOpen);
      viewDevicesBtn.textContent = this.pastecraftDevicesOpen
        ? 'Hide Pastecraft Devices to Sync'
        : 'View Pastecraft Devices to Sync';
    });

    devicesPanel.addEventListener('click', async (event) => {
      const saveBtn = event.target.closest('.pastecraft-device-save-btn');
      if (saveBtn) {
        const row = saveBtn.closest('.pastecraft-device-row');
        if (!row) return;
        const deviceId = String(row.dataset.deviceId || '');
        const input = row.querySelector('.pastecraft-device-name-input');
        const displayName = String(input?.value || '').trim();
        if (!deviceId || !displayName) {
          this.showToast('Enter a device name first.', 'error');
          return;
        }
        const updated = await pasteCraftSupabase.renamePastecraftDevice(deviceId, displayName);
        if (!updated) {
          this.showToast('Failed to rename device.', 'error');
          return;
        }
        this.showToast('Device name synced.', 'success');
        await this.loadPastecraftDevices();
        return;
      }

      const copyBtn = event.target.closest('.synced-clip-copy-btn');
      if (copyBtn) {
        const clipId = String(copyBtn.dataset.clipId || '');
        const item = this.cloudClipboardItems.find((entry) => String(entry.id) === clipId);
        if (!item) return;
        try {
          await navigator.clipboard.writeText(item.content);
          this.showToast('Copied synced clip.', 'success');
        } catch (error) {
          this.showToast('Clipboard write failed.', 'error');
        }
        return;
      }

      const queBtn = event.target.closest('.synced-clip-que-btn');
      if (queBtn) {
        const clipId = String(queBtn.dataset.clipId || '');
        const item = this.cloudClipboardItems.find((entry) => String(entry.id) === clipId);
        if (!item) return;
        await this.addSyncedClipToLocal(item);
        return;
      }
    });

    syncedClipContainer.addEventListener('click', async (event) => {
      const copyBtn = event.target.closest('.synced-clip-copy-btn');
      const queBtn = event.target.closest('.synced-clip-que-btn');
      
      if (!copyBtn && !queBtn) return;
      
      const clipId = String((copyBtn || queBtn).dataset.clipId || '');
      const item = this.cloudClipboardItems.find((entry) => String(entry.id) === clipId);
      if (!item) return;

      if (copyBtn) {
        try {
          await navigator.clipboard.writeText(item.content);
          this.showToast('Copied synced clip.', 'success');
        } catch (error) {
          this.showToast('Clipboard write failed.', 'error');
        }
      } else if (queBtn) {
        await this.addSyncedClipToLocal(item);
      }
    });

    window.addEventListener('focus', () => {
      this.refreshCloudClipboardAndDevices().catch(() => {});
    });

    window.addEventListener('clipboardHistoryChanged', async (event) => {
      const row = event?.detail?.row || null;
      if (row && !this.cloudClipboardItemIds.has(String(row.id))) {
        this.cloudClipboardItems.unshift(row);
        this.cloudClipboardItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.cloudClipboardItems = this.cloudClipboardItems.slice(0, 50);
        this.cloudClipboardItemIds = new Set(this.cloudClipboardItems.map((entry) => String(entry.id)));
        this.renderCloudClipboardList();
      } else {
        await this.syncCloudClipboardHistory();
      }
    });

    window.addEventListener('pastecraftDevicesChanged', () => {
      this.loadPastecraftDevices().catch(() => {});
    });

    return this.ensureCurrentDeviceId()
      .then(() => this.refreshCloudClipboardAndDevices());
  }

  async refreshCloudClipboardAndDevices() {
    try {
      await pasteCraftSupabase.upsertPastecraftDeviceSession();
    } catch (_) {}
    await Promise.all([
      this.syncCloudClipboardHistory(),
      this.loadPastecraftDevices()
    ]);
  }

  async addSyncedClipToLocal(item) {
    if (!item || !item.content) return;
    
    const newClip = {
      id: Date.now() + Math.random(),
      text: item.content,
      category: 'Uncategorized',
      timestamp: Date.now()
    };

    this.clips.unshift(newClip);
    
    await this.enforceClipLimit();

    // Persist immediately
    await chrome.storage.local.set({
      clips: this.clips,
      searchOnlyClips: this.searchOnlyClips,
      pc_local_updatedAt: Date.now()
    });
    
    this.renderChips();
    this.renderCategories();
    this.showToast('Added to your clips!', 'success');
    
    // Background sync
    Promise.resolve()
      .then(() => this.backupLocalToSync('save:addSynced'))
      .catch(() => {});
    Promise.resolve()
      .then(() => pasteCraftSupabase.syncWithQueue('syncClips', this.clips, pasteCraftSupabase.syncClipsToSupabase))
      .catch(() => {});
  }

  async syncCloudClipboardHistory() {
    try {
      const renderedIds = Array.from(this.cloudClipboardItemIds);
      const result = await pasteCraftSupabase.syncClipboardHistory(renderedIds, 50);
      this.cloudClipboardItems = Array.isArray(result?.allRows) ? result.allRows : [];
      this.cloudClipboardItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.cloudClipboardItemIds = new Set(this.cloudClipboardItems.map((entry) => String(entry.id)));
      this.renderCloudClipboardList();
      this.renderPastecraftDevices();
    } catch (_) {
      this.cloudClipboardItems = [];
      this.cloudClipboardItemIds = new Set();
      this.renderCloudClipboardList();
      this.renderPastecraftDevices();
    }
  }

  renderCloudClipboardList() {
    const container = document.getElementById('syncedClipContainer');
    if (!container) return;

    if (!Array.isArray(this.cloudClipboardItems) || this.cloudClipboardItems.length === 0) {
      container.innerHTML = '';
      return;
    }

    const currentDeviceId = this._currentDeviceId || '';
    container.innerHTML = this.cloudClipboardItems.map((item) => {
      const fromOtherDevice = !!(item.deviceId && currentDeviceId && item.deviceId !== currentDeviceId);
      const created = item.timestamp ? this.getTimeAgo(item.timestamp) : '';
      return `
        <div class="synced-clip-card">
          <div class="synced-clip-content">${this.escapeHtml(item.content)}</div>
          <div class="synced-clip-footer">
            <div class="synced-clip-meta">
              <span>${this.escapeHtml(created)}</span>
              ${fromOtherDevice ? '<span class="synced-indicator">Synced</span>' : ''}
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="synced-clip-copy-btn" data-clip-id="${this.escapeHtml(String(item.id))}">Copy</button>
              ${fromOtherDevice ? `<button class="synced-clip-que-btn" data-clip-id="${this.escapeHtml(String(item.id))}">Que</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async loadPastecraftDevices() {
    const container = document.getElementById('pastecraftDevicesPanel');
    if (!container) return;
    try {
      const userId = await pasteCraftSupabase.getSyncUserId();
      const hasAccess = await pasteCraftSupabase.hasCloudSyncAccess(userId);
      this.cloudSyncAccess = !!hasAccess;
      if (!hasAccess) {
        this.pastecraftDevices = [];
        this.renderPastecraftDevices();
        return;
      }
      const devices = await pasteCraftSupabase.getPastecraftDevices();
      this.pastecraftDevices = Array.isArray(devices) ? devices : [];
    } catch (_) {
      this.pastecraftDevices = [];
      this.cloudSyncAccess = null;
    }
    this.renderPastecraftDevices();
  }

  renderPastecraftDevices() {
    const container = document.getElementById('pastecraftDevicesPanel');
    if (!container) return;
    if (this.cloudSyncAccess === false) {
      container.innerHTML = '<div class="pastecraft-device-last-seen">Cloud sync requires Basic, Premium, or Admin plan.</div>';
      return;
    }
    if (!Array.isArray(this.pastecraftDevices) || this.pastecraftDevices.length === 0) {
      container.innerHTML = '<div class="pastecraft-device-last-seen">No devices synced yet.</div>';
      return;
    }

    container.innerHTML = this.pastecraftDevices.map((device) => {
      const safeDeviceId = String(device.deviceId || '');
      const currentDeviceId = this._currentDeviceId || '';
      const isSelf = safeDeviceId === currentDeviceId;
      const fallbackName = `Device ${safeDeviceId.slice(0, 8)}`;
      const displayName = String(device.displayName || fallbackName);
      const lastSeen = device.lastSeenAt ? this.getTimeAgo(Date.parse(device.lastSeenAt) || Date.now()) : 'Unknown';
      
      // Filter clips for this device from the cloud clipboard items
      const deviceClips = (this.cloudClipboardItems || []).filter(item => String(item.deviceId) === safeDeviceId);
      
      return `
        <div class="pastecraft-device-row" data-device-id="${this.escapeHtml(safeDeviceId)}">
          <div class="pastecraft-device-id">ID: ${this.escapeHtml(safeDeviceId)} ${isSelf ? '(This Device)' : ''}</div>
          <div class="pastecraft-device-rename">
            <input class="pastecraft-device-name-input" type="text" value="${this.escapeHtml(displayName)}" />
            <button class="pastecraft-device-save-btn">Save</button>
          </div>
          <div class="pastecraft-device-last-seen">Last seen: ${this.escapeHtml(lastSeen)}</div>
          
          <div class="pastecraft-device-clips">
            ${deviceClips.length > 0 ? deviceClips.map(clip => `
              <div class="synced-clip-card" style="margin-top: 8px;">
                <div class="synced-clip-content">${this.escapeHtml(clip.content)}</div>
                <div class="synced-clip-footer">
                  <div class="synced-clip-meta">
                    <span>${this.escapeHtml(this.getTimeAgo(clip.timestamp))}</span>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    <button class="synced-clip-copy-btn" data-clip-id="${this.escapeHtml(String(clip.id))}">Copy</button>
                    ${!isSelf ? `<button class="synced-clip-que-btn" data-clip-id="${this.escapeHtml(String(clip.id))}">Que</button>` : ''}
                  </div>
                </div>
              </div>
            `).join('') : '<div class="pastecraft-device-last-seen" style="margin-top: 4px; font-style: italic;">No recent clips from this device</div>'}
          </div>
        </div>
      `;
    }).join('');
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
    const result = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
    
    let { clips = [], categories = [], searchOnlyClips = [] } = result;
    let normalizedChanged = false;

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
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
          ...(clip && typeof clip === 'object' && clip.meta ? { meta: clip.meta } : {})
        };
      }
    });
    
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
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
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

    // Enforce pagination clip limit
    await this.enforceClipLimit();

  }
  
  async enforceClipLimit() {
    if (this.clips.length <= this.maxClips) {
      return;
    }
    
    console.log(`📦 Clip limit exceeded: ${this.clips.length}/${this.maxClips}. Moving oldest clips to search...`);
    
    // Sort clips by timestamp (newest first)
    this.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Keep first 500 clips (newest), move rest to searchOnlyClips (oldest)
    const clipsToArchive = this.clips.slice(this.maxClips);
    this.clips = this.clips.slice(0, this.maxClips);
    
    // Add archived clips to searchOnlyClips
    this.searchOnlyClips = [...clipsToArchive, ...this.searchOnlyClips];
    
    // Save to storage
    await chrome.storage.local.set({
      clips: this.clips,
      searchOnlyClips: this.searchOnlyClips
    });
    
    console.log(`✅ Archived ${clipsToArchive.length} clips to search. Active: ${this.clips.length}, Archived: ${this.searchOnlyClips.length}`);
  }
  
  setupEventListeners() {
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
      this._openPricingPage();
    });
    const upgradeBtnEnhanced = document.getElementById('upgradeBtnEnhanced');
    if (upgradeBtnEnhanced) upgradeBtnEnhanced.addEventListener('click', () => {
      this.closeUpgradeModal();
      this._openPricingPage();
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
            .then(() => this.backupLocalToSync('save:manualInput'))
            .catch(() => {});

          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncClips', this.clips, pasteCraftSupabase.syncClipsToSupabase))
            .catch(() => {});
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncArchivedClips', this.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
            .catch(() => {});
          
          // Also sync to cloud clipboard history for cross-device visibility
          Promise.resolve()
            .then(() => pasteCraftSupabase.saveClipboardHistoryItem(newClip.text))
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
    document.getElementById('createNoteBtn').addEventListener('click', () => {
      this.openNoteEditor('note');
    });

    document.getElementById('createAlbumBtn').addEventListener('click', () => {
      this.openNoteEditor('album');
    });

    // Notes info expand button → open modal
    const notesInfoExpandBtn = document.getElementById('notesInfoExpandBtn');
    if (notesInfoExpandBtn) {
      notesInfoExpandBtn.addEventListener('click', () => {
        const modal = document.getElementById('notesInfoModal');
        if (modal) modal.style.display = 'flex';
      });
    }

    // Close notes info modal
    const closeNotesInfoModal = document.getElementById('closeNotesInfoModal');
    if (closeNotesInfoModal) {
      closeNotesInfoModal.addEventListener('click', () => {
        const modal = document.getElementById('notesInfoModal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Close notes info modal on overlay click
    const notesInfoModal = document.getElementById('notesInfoModal');
    if (notesInfoModal) {
      notesInfoModal.addEventListener('click', (e) => {
        if (e.target === notesInfoModal) notesInfoModal.style.display = 'none';
      });
    }

    // Notes search bar
    const notesSearchInput = document.getElementById('notesSearchInput');
    const notesSearchClear = document.getElementById('notesSearchClear');
    if (notesSearchInput) {
      notesSearchInput.addEventListener('input', () => {
        const val = notesSearchInput.value.trim();
        if (notesSearchClear) notesSearchClear.classList.toggle('visible', val.length > 0);
        this.notesPageIndex = 0;
        this.renderNotes();
      });
    }
    if (notesSearchClear) {
      notesSearchClear.addEventListener('click', () => {
        if (notesSearchInput) notesSearchInput.value = '';
        notesSearchClear.classList.remove('visible');
        this.notesPageIndex = 0;
        this.renderNotes();
      });
    }

    const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
    if (viewAlbumsBtn) {
      viewAlbumsBtn.addEventListener('click', async () => {
        this.notesViewMode = this.notesViewMode === 'albums' ? 'notes' : 'albums';
        this.notesPageIndex = 0;
        viewAlbumsBtn.classList.toggle('active', this.notesViewMode === 'albums');
        await this.saveNotesPrefs();
        this.renderNotes();
      });
    }

    const notesAiToggle = document.getElementById('notesAiToggle');
    if (notesAiToggle) {
      notesAiToggle.addEventListener('change', async (e) => {
        this.notesAiEnabled = !!e.target.checked;
        await this.saveNotesPrefs();
        this.updateNoteAiControls();
      });
    }

    document.getElementById('closeNoteEditor').addEventListener('click', () => {
      this.closeNoteEditor();
    });

    document.getElementById('cancelNoteEditor').addEventListener('click', () => {
      this.closeNoteEditor();
    });

    document.getElementById('saveNote').addEventListener('click', () => {
      this.saveNote();
    });

    document.getElementById('addClipToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.showClipPickerForNote();
    });

    // Clip Picker Modal
    document.getElementById('closeClipPicker').addEventListener('click', () => {
      this.closeClipPicker();
    });

    const clipPickerTabs = document.querySelectorAll('.clip-picker-tab');
    clipPickerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.pickerTab;
        this.switchClipPickerTab(targetTab);
      });
    });

    document.getElementById('clipPickerSearchInput').addEventListener('input', (e) => {
      this.searchClipsInPicker(e.target.value);
    });

    document.getElementById('clipPickerAddBtn').addEventListener('click', () => {
      this.addSelectedClipsToNote();
    });

    document.getElementById('addImageToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.showImagePickerForNote();
    });

    document.getElementById('addURLToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.addURLToNote();
    });

    const aiTitleBtn = document.getElementById('aiTitleBtn');
    if (aiTitleBtn) {
      aiTitleBtn.addEventListener('click', async () => {
        await this.generateNoteTitleFromContent();
      });
    }

    const aiDescBtn = document.getElementById('aiDescBtn');
    if (aiDescBtn) {
      aiDescBtn.addEventListener('click', async () => {
        await this.generateNoteDescriptionFromContent();
      });
    }

    const noteBodyInput = document.getElementById('noteBodyInput');
    if (noteBodyInput) {
      noteBodyInput.addEventListener('input', () => {
        this.updateNoteAiControls();
      });
    }

    // Album Picker Modal
    document.getElementById('closeAlbumPicker').addEventListener('click', () => {
      this.closeAlbumPicker();
    });

    document.getElementById('createNewAlbumFromPicker').addEventListener('click', () => {
      this.createdFromPicker = true;
      this.closeAlbumPicker();
      this.openNoteEditor('album', null, true);
    });

    document.getElementById('backToAlbumPicker').addEventListener('click', () => {
      this.closeNoteEditor();
      this.showAlbumPicker();
    });

    document.getElementById('albumPickerSearch').addEventListener('input', (e) => {
      this.filterAlbumPicker(e.target.value);
    });

    // Notes view toggle (delegate to parent to handle dynamic content)
    const notesHeader = document.querySelector('.notes-header');
    if (notesHeader) {
      notesHeader.addEventListener('click', (e) => {
        const _pcTarget = e.target;
        const _pcTargetTag = (_pcTarget && _pcTarget.tagName) ? _pcTarget.tagName : null;
        const _pcTargetType = (_pcTarget && typeof _pcTarget.nodeType === 'number') ? _pcTarget.nodeType : null;
        const _pcTargetHasClosest = !!(_pcTarget && typeof _pcTarget.closest === 'function');

        const toggleBtn = e.target.closest('.view-toggle-btn');
        if (toggleBtn) {
          document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
          toggleBtn.classList.add('active');
          const view = toggleBtn.dataset.view;
          const container = document.getElementById('notesContainer');
          if (container) {
            const _pcBefore = {hasListView:container.classList.contains('list-view')};
            if (view === 'list') {
              container.classList.add('list-view');
            } else {
              container.classList.remove('list-view');
            }
            const _pcAfter = {hasListView:container.classList.contains('list-view')};

            const _pcComputed = {
              gridTemplateColumns: getComputedStyle(container).gridTemplateColumns,
              display: getComputedStyle(container).display
            };
            const _pcFirstCard = container.querySelector('.note-card');
            const _pcFirstCardStyle = _pcFirstCard ? {
              padding: getComputedStyle(_pcFirstCard).padding,
              borderRadius: getComputedStyle(_pcFirstCard).borderRadius
            } : null;

            // Re-render to apply view-dependent pagination (list=3, grid=8)
            this.renderNotes();
          }
        }
      });
    }

    // Note Viewer Modal
    document.getElementById('closeNoteViewer').addEventListener('click', () => {
      this.closeNoteViewer();
    });

    document.getElementById('closeNoteViewerBtn').addEventListener('click', () => {
      this.closeNoteViewer();
    });

    const noteViewerBackBtn = document.getElementById('noteViewerBackBtn');
    if (noteViewerBackBtn) {
      noteViewerBackBtn.addEventListener('click', () => {
        if (this.noteViewerParentAlbumId) {
          const albumId = this.noteViewerParentAlbumId;
          this.noteViewerParentAlbumId = null;
          this.openNoteViewer(albumId);
        }
      });
    }

    document.getElementById('editNoteFromViewer').addEventListener('click', () => {
      const noteId = this.currentViewerNoteId;
      this.closeNoteViewer();
      if (noteId) {
        const note = this.notes.find(n => n.id == noteId);
        this.openNoteEditor(note?.type || 'note', noteId);
      }
    });

    document.getElementById('copyNoteContent').addEventListener('click', () => {
      const content = document.getElementById('noteViewerContent').textContent;
      if (content) {
        navigator.clipboard.writeText(content);
        this.showToast('Content copied!');
      }
    });

    document.getElementById('copyAllAttachments').addEventListener('click', () => {
      this.copyAllNoteAttachments();
    });

    // Album Attachment Viewer (Overlay Mode)
    const albumAttachmentBackBtn = document.getElementById('albumAttachmentBackBtn');
    if (albumAttachmentBackBtn) {
      albumAttachmentBackBtn.addEventListener('click', () => this.closeAlbumAttachmentViewer());
    }

    const closeAlbumAttachmentViewerBtn = document.getElementById('closeAlbumAttachmentViewer');
    if (closeAlbumAttachmentViewerBtn) {
      closeAlbumAttachmentViewerBtn.addEventListener('click', () => this.closeAlbumAttachmentViewer());
    }

    const albumAttachmentOpenInPopupBtn = document.getElementById('albumAttachmentOpenInPopupBtn');
    if (albumAttachmentOpenInPopupBtn) {
      albumAttachmentOpenInPopupBtn.addEventListener('click', () => {
        const ctx = this.currentAlbumAttachmentContext;
        if (ctx && ctx.noteId != null && typeof ctx.attachmentIndex === 'number') {
          this.openAlbumAttachmentInEdgePopup(ctx.noteId, ctx.attachmentIndex);
        }
      });
    }

    // Modal overlay clicks
    document.getElementById('noteEditorModal').addEventListener('click', (e) => {
      if (e.target.id === 'noteEditorModal') {
        this.closeNoteEditor();
      }
    });

    document.getElementById('albumPickerModal').addEventListener('click', (e) => {
      if (e.target.id === 'albumPickerModal') {
        this.closeAlbumPicker();
      }
    });

    document.getElementById('clipPickerModal').addEventListener('click', (e) => {
      if (e.target.id === 'clipPickerModal') {
        this.closeClipPicker();
      }
    });

    document.getElementById('noteViewerModal').addEventListener('click', (e) => {
      if (e.target.id === 'noteViewerModal') {
        this.closeNoteViewer();
      }
    });

    const albumAttachmentViewerModal = document.getElementById('albumAttachmentViewerModal');
    if (albumAttachmentViewerModal) {
      albumAttachmentViewerModal.addEventListener('click', (e) => {
        if (e.target.id === 'albumAttachmentViewerModal') {
          this.closeAlbumAttachmentViewer();
        }
      });
    }

    // Album Source Note Viewer (Overlay Mode)
    const albumSourceNoteBackBtn = document.getElementById('albumSourceNoteBackBtn');
    if (albumSourceNoteBackBtn) {
      albumSourceNoteBackBtn.addEventListener('click', () => this.closeAlbumSourceNoteOverlay());
    }

    const closeAlbumSourceNoteModalBtn = document.getElementById('closeAlbumSourceNoteModal');
    if (closeAlbumSourceNoteModalBtn) {
      closeAlbumSourceNoteModalBtn.addEventListener('click', () => this.closeAlbumSourceNoteOverlay());
    }

    const albumSourceNoteCopyContentBtn = document.getElementById('albumSourceNoteCopyContent');
    if (albumSourceNoteCopyContentBtn) {
      albumSourceNoteCopyContentBtn.addEventListener('click', () => {
        const content = document.getElementById('albumSourceNoteBody')?.textContent;
        if (content) {
          navigator.clipboard.writeText(content);
          this.showToast('Content copied!');
        }
      });
    }

    const albumSourceNoteModal = document.getElementById('albumSourceNoteModal');
    if (albumSourceNoteModal) {
      albumSourceNoteModal.addEventListener('click', (e) => {
        if (e.target.id === 'albumSourceNoteModal') {
          this.closeAlbumSourceNoteOverlay();
        }
      });
    }

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('clearSearch').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      this.searchQuery = '';
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('dateFilter').addEventListener('change', (e) => {
      this.selectedDateFilter = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

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

    // Categories bulk actions (copy | delete)
    const categoryBulkCopyBtn = document.getElementById('categoryBulkCopyBtn');
    const categoryBulkDeleteBtn = document.getElementById('categoryBulkDeleteBtn');
    if (categoryBulkCopyBtn) {
      categoryBulkCopyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleCategoryBulkCopy();
      });
    }
    if (categoryBulkDeleteBtn) {
      categoryBulkDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleCategoryBulkDelete();
      });
    }

    // Search bulk action (copy 2+ selected)
    const searchBulkCopyBtn = document.getElementById('searchBulkCopyBtn');
    if (searchBulkCopyBtn) {
      searchBulkCopyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleSearchBulkCopy();
      });
    }

    // Category modal events
    document.getElementById('closeCategoryModal').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('cancelCategorization').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('createNewCategory').addEventListener('click', () => {
      this.showCreateCategoryFromModal();
    });

    document.getElementById('categoryOptions').addEventListener('click', (e) => {
      // Check if delete button was clicked
      const deleteBtn = e.target.closest('.category-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        this.handleClipDelete();
        return;
      }
      
      const option = e.target.closest('.category-option');
      if (option && !option.classList.contains('category-full')) {
        document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedCategoryForSave = option.dataset.category;
        
        // Enable the Add button
        document.getElementById('addToCategory').disabled = false;
      } else if (option && option.classList.contains('category-full')) {
        // Show feedback for full categories
        this.showToast('This category is full (150 clips max). Remove some clips first.');
      }
    });

    document.getElementById('addToCategory').addEventListener('click', () => {
      this.saveTextWithCategory();
    });

    // Modal overlay click to close
    document.getElementById('categoryModal').addEventListener('click', (e) => {
      if (e.target.id === 'categoryModal') {
        this.hideCategoryModal();
      }
    });

    // Profile modal events
    document.getElementById('profileBtn').addEventListener('click', () => {
      this.showProfileModal();
    });

    document.getElementById('closeProfileModal').addEventListener('click', () => {
      this.hideProfileModal();
    });

    // Settings modal events
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.showSettingsModal();
    });

    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.showHelpModal();
    });

    // Auto-save functionality - removed Cancel and Save buttons
    // Debounced auto-save function
    let autoSaveTimeout = null;
    const triggerAutoSave = (skipPinAndAuth = false) => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        this.saveSettings(true, skipPinAndAuth).catch(() => {});
      }, 300); // 300ms debounce
    };

    // Auto-save listeners for standard settings
    const autoDeletePeriodEl = document.getElementById('autoDeletePeriod');
    if (autoDeletePeriodEl) {
      autoDeletePeriodEl.addEventListener('change', () => triggerAutoSave(true));
    }

    const darkModeToggleEl = document.getElementById('darkModeToggle');
    if (darkModeToggleEl) {
      darkModeToggleEl.addEventListener('change', () => triggerAutoSave(true));
    }

    // Profile dark mode toggle (theme-only save; avoid overwriting other settings with stale UI values)
    const profileDarkModeToggleEl = document.getElementById('profileDarkModeToggle');
    if (profileDarkModeToggleEl) {
      profileDarkModeToggleEl.addEventListener('change', async () => {
        if (this._themeSyncing) return;
        const nextTheme = profileDarkModeToggleEl.checked ? 'dark' : 'light';
        await this.saveThemeOnly(nextTheme, true);
      });
    }

    // Profile: Set current profile image as widget icon (floating widget)
    const widgetIconUseProfileToggleEl = document.getElementById('widgetIconUseProfileToggle');
    if (widgetIconUseProfileToggleEl) {
      widgetIconUseProfileToggleEl.addEventListener('change', async () => {
        const enabled = !!widgetIconUseProfileToggleEl.checked;

        // PRACTICE #1: VALIDATION - require an available profile image if enabling
        if (enabled) {
          const src = await this.getCurrentProfileImageForWidget();
          if (!src) {
            widgetIconUseProfileToggleEl.checked = false;
            this.showToast('⚠️ Set a profile image first (upload or AI)', 'error');
            return;
          }
        }

        await this.saveWidgetIconUseProfileImage(enabled, true);
      });
    }

    const quickPasteAutoHideEl = document.getElementById('quickPasteAutoHidePopup');
    if (quickPasteAutoHideEl) {
      quickPasteAutoHideEl.addEventListener('change', () => triggerAutoSave(true));
    }

    const quickPasteShowTimestampsEl = document.getElementById('quickPasteShowTimestampsPopup');
    if (quickPasteShowTimestampsEl) {
      quickPasteShowTimestampsEl.addEventListener('change', () => triggerAutoSave(true));
    }

    const quickPasteMaxClipsEl = document.getElementById('quickPasteMaxClipsPopup');
    if (quickPasteMaxClipsEl) {
      quickPasteMaxClipsEl.addEventListener('input', () => triggerAutoSave(true));
      quickPasteMaxClipsEl.addEventListener('change', () => triggerAutoSave(true));
    }

    const albumAttachmentOpenModeEl = document.getElementById('albumAttachmentOpenMode');
    if (albumAttachmentOpenModeEl) {
      albumAttachmentOpenModeEl.addEventListener('change', () => triggerAutoSave(true));
    }

    // Auto-save for PIN settings (with special handling)
    const pinAskEachBrowserOpenEl = document.getElementById('pinAskEachBrowserOpen');
    if (pinAskEachBrowserOpenEl) {
      pinAskEachBrowserOpenEl.addEventListener('change', () => {
        // Handle mutual exclusivity first
        const unlimitedEl = document.getElementById('pinUnlimitedSession');
        if (pinAskEachBrowserOpenEl.checked && unlimitedEl && unlimitedEl.checked) {
          unlimitedEl.checked = false;
        }
        triggerAutoSave(false); // Include PIN settings
      });
    }

    const pinUnlimitedSessionEl = document.getElementById('pinUnlimitedSession');
    if (pinUnlimitedSessionEl) {
      pinUnlimitedSessionEl.addEventListener('change', () => {
        // Handle mutual exclusivity first
        const browserScopeEl = document.getElementById('pinAskEachBrowserOpen');
        if (pinUnlimitedSessionEl.checked && browserScopeEl && browserScopeEl.checked) {
          browserScopeEl.checked = false;
        }
        triggerAutoSave(false); // Include PIN settings
      });
    }

    // Auto-save for auth preferences (with special handling for staySignedIn)
    const rememberEmailEl = document.getElementById('rememberEmailSetting');
    if (rememberEmailEl) {
      rememberEmailEl.addEventListener('change', () => triggerAutoSave(false));
    }

    const staySignedInEl = document.getElementById('staySignedInSetting');
    if (staySignedInEl) {
      staySignedInEl.addEventListener('change', async () => {
        // Special handling: if turning off "stay signed in", show confirmation
        const nextStaySignedIn = staySignedInEl.checked;
        if (!nextStaySignedIn) {
          const currentPrefs = await this.loadAuthPrefs();
          if (currentPrefs.staySignedIn !== false) {
            const ok = confirm('This will sign you out and require login next time. Continue?');
            if (!ok) {
              staySignedInEl.checked = true;
              return;
            }
          }
        }
        triggerAutoSave(false);
      });
    }

    // Restore clips (local snapshots)
    const restoreWindowSelect = document.getElementById('restoreWindowSelect');
    const previewRestoreBtn = document.getElementById('previewRestoreBtn');
    const restoreNowBtn = document.getElementById('restoreNowBtn');
    const syncRestoredToCloudBtn = document.getElementById('syncRestoredToCloudBtn');

    if (restoreWindowSelect) {
      restoreWindowSelect.addEventListener('change', async () => {
        // Update preview automatically on selection change (best-effort).
        try { await this.previewRestore(restoreWindowSelect.value); } catch (_) {}
      });
    }
    if (previewRestoreBtn) {
      previewRestoreBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const key = restoreWindowSelect ? restoreWindowSelect.value : '1week';
          await this.previewRestore(key);
        } catch (_) {}
      });
    }
    if (restoreNowBtn) {
      restoreNowBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Ensure preview is up to date
        try {
          const key = restoreWindowSelect ? restoreWindowSelect.value : '1week';
          await this.previewRestore(key);
        } catch (_) {}
        await this.applyRestoreFromPreview();
      });
    }
    if (syncRestoredToCloudBtn) {
      syncRestoredToCloudBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.syncRestoredDataToCloud();
      });
    }

    // Export / Import (JSON/CSV)
    const exportBackupJsonBtn = document.getElementById('exportBackupJsonBtn');
    if (exportBackupJsonBtn) {
      exportBackupJsonBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.exportBackupToJson();
      });
    }
    const exportClipsCsvBtn = document.getElementById('exportClipsCsvBtn');
    if (exportClipsCsvBtn) {
      exportClipsCsvBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.exportClipsToCsv();
      });
    }
    const importBackupJsonBtn = document.getElementById('importBackupJsonBtn');
    const importBackupJsonFile = document.getElementById('importBackupJsonFile');
    if (importBackupJsonBtn && importBackupJsonFile) {
      importBackupJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        importBackupJsonFile.value = '';
        importBackupJsonFile.click();
      });
      importBackupJsonFile.addEventListener('change', async () => {
        const file = importBackupJsonFile.files && importBackupJsonFile.files[0] ? importBackupJsonFile.files[0] : null;
        if (!file) return;
        await this.importBackupFromJsonMerge(file);
      });
    }
    
    // Help modal events
    document.getElementById('closeHelpModal').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backBtn').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backToSettingsFromHelp').addEventListener('click', () => {
      this.hideHelpModal();
    });

    // Help modal overlay click to close
    document.getElementById('helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') {
        this.hideHelpModal();
      }
    });

    // Info modal events
    const clipJoinerInfo = document.getElementById('clipJoinerInfo');
    if (clipJoinerInfo) {
      clipJoinerInfo.addEventListener('click', () => {
        document.getElementById('clipJoinerModal').classList.add('active');
      });
    }

    const clipSettingsInfo = document.getElementById('clipSettingsInfo');
    if (clipSettingsInfo) {
      clipSettingsInfo.addEventListener('click', () => {
        document.getElementById('clipSettingsModal').classList.add('active');
      });
    }

    const closeClipJoinerModal = document.getElementById('closeClipJoinerModal');
    if (closeClipJoinerModal) {
      closeClipJoinerModal.addEventListener('click', () => {
        document.getElementById('clipJoinerModal').classList.remove('active');
      });
    }

    const closeClipSettingsModal = document.getElementById('closeClipSettingsModal');
    if (closeClipSettingsModal) {
      closeClipSettingsModal.addEventListener('click', () => {
        document.getElementById('clipSettingsModal').classList.remove('active');
      });
    }

    // Close info modals when clicking overlay
    const clipJoinerModal = document.getElementById('clipJoinerModal');
    if (clipJoinerModal) {
      clipJoinerModal.addEventListener('click', (e) => {
        if (e.target.id === 'clipJoinerModal') {
          clipJoinerModal.classList.remove('active');
        }
      });
    }

    const clipSettingsModal = document.getElementById('clipSettingsModal');
    if (clipSettingsModal) {
      clipSettingsModal.addEventListener('click', (e) => {
        if (e.target.id === 'clipSettingsModal') {
          clipSettingsModal.classList.remove('active');
        }
      });
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

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.hideSettingsModal();
      }
    });

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
        
        // Load gallery and migrate existing profile image
        this.loadAIGallery();
        this.migrateProfileImageToGallery();
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
      copySummaryBtn.addEventListener('click', () => {
        const content = document.getElementById('summaryResultContent').textContent;
        if (content) {
          navigator.clipboard.writeText(content);
          this.showToast('Summary copied to clipboard!');
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
    
    // Setup image viewer for expanded view
    this.setupImageViewer();
    
    // Initialize delimiter example text
    this.updateDelimiterExample();
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
    // Keep auth modal controls synced to settings.
    Promise.resolve().then(() => this.applyAuthPrefsToUi()).catch(() => {});
    // Pre-check "remember login with PIN" if a PIN already exists
    Promise.resolve().then(async () => {
      try {
        await this.loadPinConfig();
        const el = document.getElementById('rememberLoginWithPin');
        if (el && this._pinConfig?.salt && this._pinConfig?.hash) {
          el.checked = true;
        }
      } catch (_) {}
    }).catch(() => {});
    this.hideLoadingOverlay();
    document.getElementById('authModal').style.display = 'flex';
  }

  hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  // =====================================================
  // PIN LOCK (3-digit) - local UI unlock
  // =====================================================

  async _pinIsSessionUnlocked() {
    const key = this._pinUnlockSessionKey;
    const windowsKey = this._pinUnlockWindowsKey;
    const unlimitedKey = this._pinUnlimitedSessionKey;
    const cfg = this._pinConfig;

    // Unlimited session: never prompt
    if (cfg?.unlimitedSession) return true;

    // Unlimited session active in this browser session (cross-window)
    try {
      const res = await new Promise((resolve) => chrome.storage.session.get([unlimitedKey], resolve));
      if (res && res[unlimitedKey] === '1') return true;
    } catch (_) {}

    // Window-scoped unlocks when "ask on new browser" is enabled
    const windowId = await this._getCurrentWindowId();
    try {
      const res = await new Promise((resolve) => chrome.storage.session.get([windowsKey], resolve));
      const list = Array.isArray(res?.[windowsKey]) ? res[windowsKey] : [];
      if (windowId && list.includes(windowId)) {
        return true;
      }
    } catch (_) {}

    // No global unlock when unlimitedSession is off
    return false;
  }

  async _pinSetSessionUnlocked() {
    const key = this._pinUnlockSessionKey;
    const windowsKey = this._pinUnlockWindowsKey;
    const unlimitedKey = this._pinUnlimitedSessionKey;
    const cfg = this._pinConfig;
    const windowId = await this._getCurrentWindowId();

    if (cfg?.unlimitedSession) {
      try { sessionStorage.setItem(key, '1'); } catch (_) {}
      try { await new Promise((resolve) => chrome.storage.session.set({ [key]: '1' }, resolve)); } catch (_) {}
      try { await new Promise((resolve) => chrome.storage.session.set({ [unlimitedKey]: '1' }, resolve)); } catch (_) {}
    }

    if (windowId) {
      try {
        const res = await new Promise((resolve) => chrome.storage.session.get([windowsKey], resolve));
        const list = Array.isArray(res?.[windowsKey]) ? res[windowsKey] : [];
        if (!list.includes(windowId)) list.push(windowId);
        await new Promise((resolve) => chrome.storage.session.set({ [windowsKey]: list }, resolve));
      } catch (_) {}
    }

  }

  async _pinClearSessionUnlocked() {
    const key = this._pinUnlockSessionKey;
    const windowsKey = this._pinUnlockWindowsKey;
    const unlimitedKey = this._pinUnlimitedSessionKey;
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { await new Promise((resolve) => chrome.storage.session.remove([key, windowsKey, unlimitedKey], resolve)); } catch (_) {}
  }

  async _getCurrentWindowId() {
    try {
      const win = await new Promise((resolve) => chrome.windows.getCurrent(resolve));
      return typeof win?.id === 'number' ? win.id : null;
    } catch (_) {
      return null;
    }
  }

  _pinNormalize(raw) {
    const s = String(raw ?? '').trim();
    if (!/^\d{3}$/.test(s)) return '';
    return s;
  }

  async _sha256Hex(str) {
    const enc = new TextEncoder();
    const data = enc.encode(String(str));
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async _hashPin(pin, salt) {
    return await this._sha256Hex(`${String(salt)}:${String(pin)}`);
  }

  _randomHex(bytesLen = 16) {
    try {
      const bytes = new Uint8Array(bytesLen);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return String(Date.now()) + String(Math.random()).slice(2);
    }
  }

  async loadPinConfig() {
    // Source of truth: chrome.storage.sync, fallback: chrome.storage.local cache.
    const legacyKey = this._pinConfigKey;
    const userId = await this._getAuthedUserIdForPin();
    const key = this._pinScopedKey(this._pinConfigKey, userId);
    let cfg = null;

    try {
      const syncRes = await new Promise((resolve) => chrome.storage.sync.get([key], resolve));
      cfg = syncRes && syncRes[key] ? syncRes[key] : null;
    } catch (_) {
      cfg = null;
    }

    // Migration: if scoped key is missing but legacy exists, promote legacy → scoped.
    if (!cfg && userId) {
      try {
        const legacyRes = await new Promise((resolve) => chrome.storage.sync.get([legacyKey], resolve));
        const legacyCfg = legacyRes && legacyRes[legacyKey] ? legacyRes[legacyKey] : null;
        if (legacyCfg && typeof legacyCfg === 'object') {
          cfg = legacyCfg;
          try { await new Promise((resolve) => chrome.storage.sync.set({ [key]: legacyCfg }, resolve)); } catch (_) {}
          try { await new Promise((resolve) => chrome.storage.local.set({ [key]: legacyCfg }, resolve)); } catch (_) {}
        }
      } catch (_) {}
    }

    if (!cfg) {
      try {
        const localRes = await new Promise((resolve) => chrome.storage.local.get([key, legacyKey], resolve));
        cfg = (localRes && localRes[key]) ? localRes[key] : ((localRes && localRes[legacyKey]) ? localRes[legacyKey] : null);
      } catch (_) {
        cfg = null;
      }
    }

    // Minimal normalization
    if (!cfg || typeof cfg !== 'object') {
      this._pinConfig = null;
      return null;
    }
    const enabled = !!cfg.enabled;
    const salt = typeof cfg.salt === 'string' ? cfg.salt : '';
    const hash = typeof cfg.hash === 'string' ? cfg.hash : '';
    const updatedAt = typeof cfg.updatedAt === 'number' ? cfg.updatedAt : 0;
    // FIX: Preserve unlimitedSession field (was being lost during normalization)
    const unlimitedSession = typeof cfg.unlimitedSession === 'boolean' ? cfg.unlimitedSession : false;
    this._pinConfig = { enabled, salt, hash, updatedAt, unlimitedSession };


    // Best-effort local cache write for offline reads.
    try {
      await new Promise((resolve) => chrome.storage.local.set({ [key]: this._pinConfig }, resolve));
    } catch (_) {}

    return this._pinConfig;
  }

  async _savePinConfig(cfg, userIdOverride = '') {
    const userId = userIdOverride ? String(userIdOverride) : await this._getAuthedUserIdForPin();
    const key = this._pinScopedKey(this._pinConfigKey, userId);
    this._pinConfig = cfg;
    try { await new Promise((resolve) => chrome.storage.sync.set({ [key]: cfg }, resolve)); } catch (_) {}
    try { await new Promise((resolve) => chrome.storage.local.set({ [key]: cfg }, resolve)); } catch (_) {}
  }

  async _getPinAttempts() {
    const userId = await this._getAuthedUserIdForPin();
    const key = this._pinScopedKey(this._pinAttemptsKey, userId);
    try {
      const res = await new Promise((resolve) => chrome.storage.local.get([key], resolve));
      const v = res && res[key] ? res[key] : null;
      const attempts = typeof v?.attempts === 'number' ? v.attempts : 0;
      const lockedUntil = typeof v?.lockedUntil === 'number' ? v.lockedUntil : 0;
      return { attempts, lockedUntil };
    } catch (_) {
      return { attempts: 0, lockedUntil: 0 };
    }
  }

  async _setPinAttempts(next) {
    const userId = await this._getAuthedUserIdForPin();
    const key = this._pinScopedKey(this._pinAttemptsKey, userId);
    try {
      await new Promise((resolve) => chrome.storage.local.set({ [key]: next }, resolve));
    } catch (_) {}
  }

  showPinModal() {
    try { this.hideLoadingOverlay(); } catch (_) {}
    const el = document.getElementById('pinModal');
    if (el) el.style.display = 'flex';
    try {
      const input = document.getElementById('pinUnlockInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    } catch (_) {}
  }

  hidePinModal() {
    const el = document.getElementById('pinModal');
    if (el) el.style.display = 'none';
  }

  showPinSetupModal({ title = 'Set 3-digit code', onComplete = null } = {}) {
    const modal = document.getElementById('pinSetupModal');
    const titleEl = document.getElementById('pinSetupTitle');
    const a = document.getElementById('pinSetupInput');
    const b = document.getElementById('pinSetupConfirmInput');

    if (titleEl) titleEl.textContent = title;
    if (a) a.value = '';
    if (b) b.value = '';

    this._pinSetupOnComplete = typeof onComplete === 'function' ? onComplete : null;

    if (modal) modal.style.display = 'flex';
    try { a && a.focus(); } catch (_) {}
  }

  hidePinSetupModal() {
    const modal = document.getElementById('pinSetupModal');
    if (modal) modal.style.display = 'none';
    this._pinSetupOnComplete = null;
  }

  async attemptPinUnlock() {
    await this.loadPinConfig();
    const cfg = this._pinConfig;
    if (!cfg || !cfg.enabled || !cfg.salt || !cfg.hash) {
      // If config is missing, don't block.
      await this._pinSetSessionUnlocked();
      this.hidePinModal();
      return true;
    }

    const hintEl = document.getElementById('pinUnlockHint');
    const input = document.getElementById('pinUnlockInput');
    const pin = this._pinNormalize(input?.value || '');

    const { attempts, lockedUntil } = await this._getPinAttempts();
    const now = Date.now();
    if (lockedUntil && lockedUntil > now) {
      const seconds = Math.ceil((lockedUntil - now) / 1000);
      if (hintEl) hintEl.textContent = `Too many tries. Try again in ${seconds}s.`;
      return false;
    }

    if (!pin) {
      if (hintEl) hintEl.textContent = 'Enter a 3-digit code.';
      return false;
    }

    const computed = await this._hashPin(pin, cfg.salt);
    if (computed === cfg.hash) {
      await this._setPinAttempts({ attempts: 0, lockedUntil: 0 });
      await this._pinSetSessionUnlocked();
      this.hidePinModal();
      return true;
    }

    // Wrong code: increment + optional lockout.
    const nextAttempts = attempts + 1;
    const MAX = 5;
    const LOCK_MS = 5 * 60 * 1000;
    const nextLockedUntil = nextAttempts >= MAX ? (Date.now() + LOCK_MS) : 0;
    await this._setPinAttempts({ attempts: nextAttempts, lockedUntil: nextLockedUntil });
    if (hintEl) {
      hintEl.textContent = nextLockedUntil
        ? 'Too many tries. Locked for 5 minutes.'
        : `Wrong code. ${Math.max(0, MAX - nextAttempts)} tries left.`;
    }
    if (input) input.value = '';
    return false;
  }

  async maybeRequirePinUnlock() {
    await this.loadPinConfig();
    const sessionUnlocked = await this._pinIsSessionUnlocked();
    const cfg = this._pinConfig;
    if (sessionUnlocked) return true;
    if (!cfg || !cfg.enabled) return true;
    if (!cfg.salt || !cfg.hash) return true;
    this.showPinModal();
    return false;
  }

  async setPinEnabled(enabled) {
    await this.loadPinConfig();
    const cfg = this._pinConfig || { enabled: false, salt: '', hash: '', updatedAt: 0, unlimitedSession: false };
    const next = { ...cfg, enabled: !!enabled, updatedAt: Date.now() };
    await this._savePinConfig(next);
  }

  async setPinUnlimitedSession(unlimitedSession) {
    await this.loadPinConfig();
    const cfg = this._pinConfig || { enabled: false, salt: '', hash: '', updatedAt: 0, unlimitedSession: false };
    const next = { ...cfg, unlimitedSession: !!unlimitedSession, updatedAt: Date.now() };

    await this._savePinConfig(next);
    if (next.unlimitedSession) {
      // Mark unlimited session active for this browser session
      try {
        await this._pinSetSessionUnlocked();
        await new Promise((resolve) => chrome.storage.session.set({ [this._pinUnlimitedSessionKey]: '1' }, resolve));
      } catch (_) {}
    } else {
      // Clear global session unlock so new windows must re-auth
      try { await this._pinClearSessionUnlocked(); } catch (_) {}
      // Keep current window unlocked
      try { await this._pinSetSessionUnlocked(); } catch (_) {}
    }
  }

  async saveNewPin(pinRaw) {
    const pin = this._pinNormalize(pinRaw);
    if (!pin) return { success: false, error: 'Invalid code' };

    const salt = this._randomHex(16);
    const hash = await this._hashPin(pin, salt);
    // FIX: Include unlimitedSession when creating new PIN (defaults to false)
    const next = { enabled: true, salt, hash, updatedAt: Date.now(), unlimitedSession: false };
    await this._savePinConfig(next);
    await this._setPinAttempts({ attempts: 0, lockedUntil: 0 });
    return { success: true };
  }

  setupPinModalEvents() {
    const unlockBtn = document.getElementById('unlockPinBtn');
    const unlockInput = document.getElementById('pinUnlockInput');
    const signInAgainLink = document.getElementById('pinSignInAgainLink');

    unlockBtn && unlockBtn.addEventListener('click', async () => {
      const ok = await this.attemptPinUnlock();
      if (ok) {
        // Re-run init path from a clean state.
        window.location.reload();
      }
    });

    unlockInput && unlockInput.addEventListener('input', (e) => {
      // Keep digits only + max 3
      try {
        const v = String(e.target.value || '').replace(/\D/g, '').slice(0, 3);
        e.target.value = v;
      } catch (_) {}
    });

    unlockInput && unlockInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const ok = await this.attemptPinUnlock();
        if (ok) window.location.reload();
      }
    });

    signInAgainLink && signInAgainLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await this._pinClearSessionUnlocked();
      this.hidePinModal();
      try { await pasteCraftSupabase.signOutFast(); } catch (_) {}
      window.location.reload();
    });

    const changeBtn = document.getElementById('changePinBtn');
    changeBtn && changeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const ok = confirm('Change your 3-digit code? You will need the new code next time you open PasteCraft.');
      if (!ok) return;
      this.showPinSetupModal({ title: 'Change 3-digit code' });
    });

    const disableBtn = document.getElementById('disablePinBtn');
    disableBtn && disableBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const ok = confirm('Disable the 3-digit code? PasteCraft will open without a code on this browser profile.');
      if (!ok) return;
      await this.setPinEnabled(false);
      try { await this.setPinUnlimitedSession(false); } catch (_) {}
      try { await this._pinClearSessionUnlocked(); } catch (_) {}
      const browserScopeEl = document.getElementById('pinAskEachBrowserOpen');
      if (browserScopeEl) browserScopeEl.checked = false;
      const unlimitedToggle = document.getElementById('pinUnlimitedSession');
      if (unlimitedToggle) unlimitedToggle.checked = false;
      try { await this._setPinAttempts({ attempts: 0, lockedUntil: 0 }); } catch (_) {}
      this.showToast('✅ Code disabled');
    });

    const cancelSetup = document.getElementById('cancelPinSetupBtn');
    cancelSetup && cancelSetup.addEventListener('click', (e) => {
      e.preventDefault();
      this.hidePinSetupModal();
    });

    const saveSetup = document.getElementById('savePinSetupBtn');
    saveSetup && saveSetup.addEventListener('click', async (e) => {
      e.preventDefault();
      const a = document.getElementById('pinSetupInput');
      const b = document.getElementById('pinSetupConfirmInput');
      const pinA = this._pinNormalize(a?.value || '');
      const pinB = this._pinNormalize(b?.value || '');
      if (!pinA || !pinB) {
        this.showToast('⚠️ Enter a 3-digit code twice', 'error');
        return;
      }
      if (pinA !== pinB) {
        this.showToast('⚠️ Codes do not match', 'error');
        return;
      }
      const result = await this.saveNewPin(pinA);
      if (!result.success) {
        this.showToast(`❌ ${result.error || 'Could not save code'}`, 'error');
        return;
      }
      await this._pinSetSessionUnlocked();
      // Reflect the selected mode checkboxes (browser prompt vs unlimited).
      try {
        const browserScopeEl = document.getElementById('pinAskEachBrowserOpen');
        const unlimitedToggle = document.getElementById('pinUnlimitedSession');
        const isUnlimited = !!this._pinConfig?.unlimitedSession;
        if (unlimitedToggle) unlimitedToggle.checked = isUnlimited;
        if (browserScopeEl) browserScopeEl.checked = !isUnlimited;
      } catch (_) {}
      // Capture callback BEFORE hide clears it.
      const onComplete = this._pinSetupOnComplete;
      this.hidePinSetupModal();
      this.showToast('✅ Code saved');
      try {
        if (typeof onComplete === 'function') onComplete();
      } catch (_) {}
    });

    // NOTE: PIN checkbox event listeners are handled in setupSettingsModalEvents()
    // to avoid duplicate listeners and ensure auto-save works properly
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
      const staySignedIn = !!document.getElementById('staySignedIn')?.checked;
      const rememberEmail = !!document.getElementById('rememberEmail')?.checked;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInWithEmail(email, password);
      
      if (result.success) {
        // Clear freemium guest flag on successful sign-in
        this._isFreemiumGuest = false;
        chrome.storage.local.remove('pc_freemium_guest');

        // Persist user preferences (no password storage)
        await this.saveAuthPrefs({
          staySignedIn,
          rememberEmail,
          rememberedEmail: rememberEmail ? email : ''
        });

        this.showToast('✅ Welcome back!', 'success');
        const rememberPin = !!document.getElementById('rememberLoginWithPin')?.checked;
        if (rememberPin) {
          // If a PIN already exists, do NOT force re-creation.
          try { await this.loadPinConfig(); } catch (_) {}
          const cfg = this._pinConfig;
          const hasExistingPin = !!(cfg && cfg.salt && cfg.hash);

          this.hideAuthModal();

          if (hasExistingPin) {
            // Ensure the feature is enabled and proceed.
            try { await this.setPinEnabled(true); } catch (_) {}
            await this._pinSetSessionUnlocked();
            window.location.reload();
            return;
          }

          this.showPinSetupModal({
            title: 'Set 3-digit code',
            onComplete: () => window.location.reload()
          });
          return;
        }

        // A successful email+password sign-in should count as unlocked for this session.
        await this._pinSetSessionUnlocked();
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
        alert(`✅ Password Reset Email Sent!\n\nCheck your inbox at: ${email}\n\n1️⃣ Click the link in the email\n2️⃣ Follow instructions on pastecraft.com\n3️⃣ Return here to set your new password\n\n⚠️ Check spam if you don't see it within 5 minutes.`);
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
        window.parent.postMessage({ type: 'PASTECRAFT_CLOSE_POPUP' }, '*');
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
    const container = document.getElementById('chipContainer');
    
    if (this.clips.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <h3>No clips yet</h3>
          <p>Right-click selected text to save it here</p>
          <div class="demo-hint">
            <span class="demo-step">1️⃣ Select text</span>
            <span class="demo-step">2️⃣ Right-click</span>
            <span class="demo-step">3️⃣ Save to PasteCraft</span>
          </div>
        </div>
      `;
      return;
    }
    
    // Calculate pagination
    const startIndex = this.currentPage * this.clipsPerPage;
    const endIndex = Math.min(startIndex + this.clipsPerPage, this.clips.length);
    const pageClips = this.clips.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    pageClips.forEach((clip, pageIndex) => {
      const actualIndex = startIndex + pageIndex;
      const chip = this.createChip(clip, actualIndex);
      container.appendChild(chip);
    });
    
    // Render pagination controls
    this.renderPagination();
    
    // Update quick copy button visibility
    this.updateQuickCopyButton();
  }
  
  renderPagination() {
    const paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;
    
    const totalPages = Math.min(Math.ceil(this.clips.length / this.clipsPerPage), this.maxPages);
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    let paginationHTML = '<div class="pagination-wrapper">';
    
    // Previous button
    paginationHTML += `
      <button class="pagination-btn pagination-prev" ${this.currentPage === 0 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
        ‹ Prev
      </button>
    `;
    
    // Page numbers
    paginationHTML += '<div class="pagination-numbers">';
    
    // Show first page
    if (this.currentPage > 2) {
      paginationHTML += `<button class="pagination-number" data-page="0">0</button>`;
      if (this.currentPage > 3) {
        paginationHTML += '<span class="pagination-ellipsis">...</span>';
      }
    }
    
    // Show pages around current page
    const startPage = Math.max(0, this.currentPage - 2);
    const endPage = Math.min(totalPages - 1, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? 'active' : '';
      paginationHTML += `<button class="pagination-number ${isActive}" data-page="${i}">${i}</button>`;
    }
    
    // Show last page
    if (this.currentPage < totalPages - 3) {
      if (this.currentPage < totalPages - 4) {
        paginationHTML += '<span class="pagination-ellipsis">...</span>';
      }
      paginationHTML += `<button class="pagination-number" data-page="${totalPages - 1}">${totalPages - 1}</button>`;
    }
    
    paginationHTML += '</div>';
    
    // Next button
    paginationHTML += `
      <button class="pagination-btn pagination-next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} data-page="${this.currentPage + 1}">
        Next ›
      </button>
    `;
    
    paginationHTML += '</div>';
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Add click handlers
    paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        if (!isNaN(page) && page >= 0 && page < totalPages) {
          this.currentPage = page;
          this.renderChips();
        }
      });
    });
  }
  
  createChip(clip, index) {
    const chip = document.createElement('div');
    chip.className = 'chip animate-slide-in';
    chip.dataset.index = index;
    const clipIdKey = this._clipIdKey(clip?.id != null ? clip.id : index);
    chip.dataset.clipId = clipIdKey;
    
    const plainText = clip.text.length > 30 ? clip.text.substring(0, 30) + '...' : clip.text;
    const timeAgo = this.getTimeAgo(clip.timestamp);
    
    const clipCategory = clip.category || 'Uncategorized';
    const isSelected = this.selectedChips.has(clipIdKey);
    const clipMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
    const markupBadge = (typeof PCMarkup !== 'undefined') ? PCMarkup.getMarkupBadgeForClip(clip.text, clipMeta) : '';
    const markupPreview = (typeof PCMarkup !== 'undefined') ? PCMarkup.renderMarkupPreview(clip.text, clipMeta, 80) : '';
    const chipTextContent = markupPreview
      ? `<span class="pc-chip-preview">${markupPreview}</span>`
      : this.escapeHtml(plainText);
    
    chip.innerHTML = `
      <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''}>
      ${markupBadge}
      <span class="chip-text" title="${this.escapeHtml(clip.text)}">${chipTextContent}</span>
      <span class="chip-time">${timeAgo}</span>
      <div class="chip-actions">
        <button class="chip-breakdown-btn" title="AI Breakdown">🧠</button>
        <button class="chip-open-btn" title="Open">🔎</button>
        <button class="chip-share-btn" title="Share">🔗</button>
        <button class="chip-summary-btn" title="AI Summary">📝</button>
        <button class="chip-notes-btn" title="Send to Notes">
          <img src="assets/note-icons/sendcreate Album.svg" alt="" class="pc-icon pc-icon-16">
        </button>
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="chip-remove" title="Remove clip">×</button>
      </div>
    `;

    // Add category indicator if not Uncategorized
    if (clipCategory !== 'Uncategorized') {
      const categoryIndicator = document.createElement('span');
      categoryIndicator.className = 'chip-category-indicator';
      categoryIndicator.style.cssText = `
        font-size: 10px;
        background: rgba(0,0,0,0.1);
        padding: 2px 6px;
        border-radius: 8px;
        margin-left: 4px;
      `;
      categoryIndicator.textContent = clipCategory;
      chip.querySelector('.chip-text').appendChild(categoryIndicator);
    }
    
    if (isSelected) {
      chip.classList.add('selected');
    }
    
    // Checkbox handler
    const checkbox = chip.querySelector('.chip-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChip(clipIdKey, chip);
    });
    
    // Click to select/deselect
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip-remove')) {
        this.removeChip(clipIdKey);
      } else if (e.target.classList.contains('chip-breakdown-btn')) {
        e.stopPropagation();
        const textToSend = this.getSelectedOrCurrentText(clip.text, 'clips');
        this.showBreakdownModal(textToSend);
      } else if (e.target.classList.contains('chip-open-btn')) {
        e.stopPropagation();
        if (typeof this.openClipViewer === 'function') {
          this.openClipViewer(clip);
        }
      } else if (e.target.classList.contains('chip-share-btn')) {
        e.stopPropagation();
        this.showShareMenuForClip(clip);
      } else if (e.target.classList.contains('chip-summary-btn')) {
        e.stopPropagation();
        const textToSend = this.getSelectedOrCurrentText(clip.text, 'clips');
        this.showSummaryModal(textToSend);
      } else if (e.target.classList.contains('chip-notes-btn') || e.target.closest('.chip-notes-btn')) {
        e.stopPropagation();
        // Load notes and show album picker
        this.loadNotes().then(() => {
          this.showAlbumPicker();
          // Store the clip to be added
          this.pendingClipForNotes = clip;
        });
      } else if (e.target.classList.contains('chip-category-btn')) {
        e.stopPropagation();
        this.pendingText = clip.text;
        this.pendingClipId = clipIdKey;
        this.showCategoryModal(true);
      } else if (!e.target.classList.contains('chip-checkbox')) {
        this.toggleChip(clipIdKey, chip);
      }
    });
    
    return chip;
  }
  
  toggleChip(clipIdKey, chipElement) {
    const checkbox = chipElement.querySelector('.chip-checkbox');
    if (this.selectedChips.has(clipIdKey)) {
      this.selectedChips.delete(clipIdKey);
      chipElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedChips.add(clipIdKey);
      chipElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.syncOptionToggles();
    this.updatePreview();
  }
  
  toggleSearchClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.search-checkbox');
    const idKey = this._clipIdKey(clipId);
    if (this.selectedSearchClips.has(idKey)) {
      this.selectedSearchClips.delete(idKey);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedSearchClips.add(idKey);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.updatePreviewFromSearchSelection();
    this.updateSearchBulkActions();
  }
  
  toggleCategoryClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.category-checkbox');
    const idKey = this._clipIdKey(clipId);
    if (this.selectedCategoryClips.has(idKey)) {
      this.selectedCategoryClips.delete(idKey);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedCategoryClips.add(idKey);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.updatePreviewFromSelection();
    this.updateCategoryBulkActions();
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
    const id = String(clipIdKey || '');
    if (!id) return;
    await this.deleteClipsByIdKeys([id], {
      includeArchived: false,
      reason: 'delete:removeChip',
      closeCategoryModal: false,
      clearSelection: true,
      rerender: true
    });
  }
  
  updateLastCapture() {
    const lastCaptureEl = document.getElementById('lastCapture');
    if (this.clips.length > 0) {
      const lastClip = this.clips[0];
      const timeAgo = this.getTimeAgo(lastClip.timestamp);
      lastCaptureEl.textContent = `Last: ${timeAgo}`;
    } else {
      lastCaptureEl.textContent = 'No recent captures';
    }
  }
  
  getTimeAgo(timestamp) {
    // Handle both timestamp (number) and date string formats
    const now = Date.now();
    const clipTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    
    // Validate timestamp
    if (isNaN(clipTime)) {
      return 'unknown';
    }
    
    const diffMs = now - clipTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
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
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.log('📋 Clipboard API blocked, using fallback method...');
    }

    // Fallback: Use execCommand with temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!success) throw new Error('execCommand copy failed');
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      throw e;
    }
  }
  
  async copyToClipboard() {
    const previewArea = document.getElementById('previewArea');
    const copyBtn = document.getElementById('copyBtn');
    
    if (!previewArea.value) return;
    
    try {
      await this.copyToClipboardFallback(previewArea.value);
      
      // Success feedback
      copyBtn.textContent = 'Copied! ✓';
      copyBtn.classList.add('success');
      
      // Confetti for large copies
      if (this.selectedChips.size >= 5) {
        this.showConfetti();
      }
      
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
        copyBtn.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('Copy failed:', error);
      copyBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
      }, 2000);
    }
  }
  
  async handleQuickCopy() {
    const quickCopyBtn = document.getElementById('quickCopyBtn');
    
    if (this.selectedChips.size === 0) return;

    // Ensure preview reflects current selection/options/delimiter
    this.updatePreview();
    const previewArea = document.getElementById('previewArea');
    const textToCopy = previewArea ? String(previewArea.value || '') : '';
    if (!textToCopy) {
      // stale selection guard
      this.selectedChips.clear();
      this.updateQuickCopyButton();
      return;
    }
    
    try {
      // Use fallback method for extension popups (Clipboard API is blocked by permissions policy)
      await this.copyToClipboardFallback(textToCopy);
      
      console.log('✅ Quick Copy - Successfully copied to clipboard!');
      
      // Success feedback
      const originalHTML = quickCopyBtn.innerHTML;
      quickCopyBtn.innerHTML = `
        <span class="btn-icon">✓</span>
        <span class="btn-text">Copied!</span>
      `;
      quickCopyBtn.classList.add('success');
      
      // Confetti for large copies
      if (this.selectedChips.size >= 5) {
        this.showConfetti();
      }
      
      setTimeout(() => {
        quickCopyBtn.innerHTML = originalHTML;
        quickCopyBtn.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Quick copy failed:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      const originalHTML = quickCopyBtn.innerHTML;
      quickCopyBtn.innerHTML = `
        <span class="btn-icon">✗</span>
        <span class="btn-text">Failed</span>
      `;
      setTimeout(() => {
        quickCopyBtn.innerHTML = originalHTML;
      }, 2000);
    }
  }

  async handleQuickDelete() {
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (!quickDeleteBtn) return;

    const ids = Array.from(this.selectedChips || []).map(String).filter(Boolean);
    if (ids.length <= 1) return; // only for 2+

    if (!confirm(`Delete ${ids.length} selected clip${ids.length === 1 ? '' : 's'}?`)) {
      return;
    }

    const result = await this.deleteClipsByIdKeys(ids, {
      includeArchived: false,
      reason: 'delete:handleQuickDelete',
      closeCategoryModal: false,
      clearSelection: true,
      rerender: true
    });

    this.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
  }
  
  updateQuickCopyButton() {
    const quickCopyBtn = document.getElementById('quickCopyBtn');
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (!quickCopyBtn) return;
    
    // Show button only if there are selected clips
    if (this.selectedChips.size > 0) {
      quickCopyBtn.style.display = 'flex';
    } else {
      quickCopyBtn.style.display = 'none';
    }

    // Show delete only when 2+ are selected (per requirement)
    if (quickDeleteBtn) {
      if (this.selectedChips.size > 1) {
        quickDeleteBtn.style.display = 'flex';
      } else {
        quickDeleteBtn.style.display = 'none';
        quickDeleteBtn.classList.remove('success');
      }
    }
  }
  
  // ─── Magic Button: Content Type Detection ───
  // Leverages PCMarkup.detectMarkupType for 20+ markup languages, plus non-markup types
  _detectContentType(text, meta) {
    if (!text || typeof text !== 'string') return 'text';
    const trimmed = text.trim();

    // URL (single-line)
    if (/^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+\.\S+/i.test(trimmed)) return 'url';

    // Email (single-line)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';

    // Phone number (single-line)
    if (/^[\+]?[\d\s\-\(\)\.]{7,20}$/.test(trimmed) && /\d{3,}/.test(trimmed)) return 'phone';

    // Delegate to markup renderer for all 20+ markup/code types
    if (window.PCMarkup && typeof window.PCMarkup.detectMarkupType === 'function') {
      const markupType = window.PCMarkup.detectMarkupType(trimmed, meta);
      if (markupType && markupType !== 'text') return markupType;
    }

    // Multi-line long text (likely notes/paragraphs)
    if (trimmed.split('\n').length > 3 || trimmed.length > 300) return 'note';

    return 'text';
  }

  // ─── Magic Button: Category Suggestion ───
  // Maps all detected content types (including markup) to categories
  _suggestCategory(contentType) {
    const map = {
      // Non-markup types
      url:       { name: 'Links', icon: '🔗' },
      email:     { name: 'Contacts', icon: '📧' },
      phone:     { name: 'Contacts', icon: '📧' },
      note:      { name: 'Notes', icon: '📝' },
      text:      { name: 'Quick', icon: '⚡' },
      // Code & data
      code:      { name: 'Code', icon: '💻' },
      json:      { name: 'Data', icon: '📊' },
      yaml:      { name: 'Data', icon: '📊' },
      toml:      { name: 'Data', icon: '📊' },
      xml:       { name: 'Data', icon: '📊' },
      csv:       { name: 'Data', icon: '📊' },
      tsv:       { name: 'Data', icon: '📊' },
      // Markup & documentation
      markdown:  { name: 'Markup', icon: '📄' },
      html:      { name: 'Markup', icon: '📄' },
      latex:     { name: 'Markup', icon: '📄' },
      bbcode:    { name: 'Markup', icon: '📄' },
      asciidoc:  { name: 'Markup', icon: '📄' },
      rst:       { name: 'Markup', icon: '📄' },
      orgmode:   { name: 'Markup', icon: '📄' },
      mediawiki: { name: 'Markup', icon: '📄' },
      textile:   { name: 'Markup', icon: '📄' },
      jira:      { name: 'Markup', icon: '📄' },
      slack:     { name: 'Markup', icon: '📄' },
      // Diagrams
      mermaid:   { name: 'Diagrams', icon: '📐' },
    };
    return map[contentType] || map.text;
  }

  // ─── Magic Button: Content Enhancement ───
  _enhanceContent(text, contentType) {
    if (!text) return text;
    let enhanced = text;

    // Universal cleanup: trim, collapse excessive blank lines, strip trailing whitespace
    enhanced = enhanced.replace(/\r\n/g, '\n');
    enhanced = enhanced.replace(/\n{4,}/g, '\n\n\n');
    enhanced = enhanced.replace(/[ \t]+$/gm, '');
    enhanced = enhanced.trim();

    // Type-specific enhancements
    if (contentType === 'url') {
      try {
        const url = new URL(enhanced);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(p => url.searchParams.delete(p));
        enhanced = url.toString();
      } catch (_) { /* leave as-is */ }
    }

    if (contentType === 'json') {
      try { enhanced = JSON.stringify(JSON.parse(enhanced), null, 2); } catch (_) { /* leave as-is */ }
    }

    if (contentType === 'xml') {
      // Normalize self-closing tags spacing
      enhanced = enhanced.replace(/\s*\/>/g, ' />');
    }

    if (contentType === 'yaml' || contentType === 'toml') {
      // Normalize trailing whitespace on value lines (already done above), ensure final newline
      if (!enhanced.endsWith('\n')) enhanced += '\n';
    }

    if (contentType === 'csv' || contentType === 'tsv') {
      // Remove fully empty rows
      enhanced = enhanced.split('\n').filter(l => l.trim()).join('\n');
    }

    if (contentType === 'email') {
      enhanced = enhanced.toLowerCase().trim();
    }

    if (contentType === 'markdown' || contentType === 'html' || contentType === 'asciidoc' ||
        contentType === 'rst' || contentType === 'orgmode' || contentType === 'mediawiki' ||
        contentType === 'textile' || contentType === 'jira' || contentType === 'bbcode' ||
        contentType === 'slack' || contentType === 'latex') {
      // Ensure consistent line endings (already done), no extra cleanup needed for markup
    }

    return enhanced;
  }

  // ─── Magic Button: Type Labels (shared) ───
  _magicTypeLabels() {
    return {
      url: '🔗 Link', email: '📧 Email', phone: '📞 Phone', note: '📝 Note', text: '⚡ Text',
      code: '💻 Code', json: '📊 JSON', yaml: '📊 YAML', toml: '📊 TOML', xml: '📊 XML', csv: '📊 CSV', tsv: '📊 TSV',
      markdown: '📄 MD', html: '📄 HTML', latex: '📄 LaTeX', bbcode: '📄 BBCode',
      asciidoc: '📄 ADoc', rst: '📄 rST', orgmode: '📄 Org', mediawiki: '📄 Wiki',
      textile: '📄 Textile', jira: '📄 JIRA', slack: '📄 Slack', mermaid: '📐 Diagram'
    };
  }

  // ─── Magic Button: Analyze All Clips ───
  _analyzeMagicClips() {
    const analysis = [];
    // Build duplicate map (text → count)
    const dupMap = new Map();
    for (const clip of this.clips) {
      const key = (clip.text || '').trim().toLowerCase();
      if (!key) continue;
      dupMap.set(key, (dupMap.get(key) || 0) + 1);
    }

    for (const clip of this.clips) {
      const contentType = this._detectContentType(clip.text, clip.meta);
      const issues = [];

      // Uncategorized?
      if (!clip.category || clip.category === 'Uncategorized') {
        const suggested = this._suggestCategory(contentType);
        const aiLabel = this._hasAiAccess() ? ' (AI)' : '';
        issues.push({ tag: '📁 Uncategorized', detail: `→ Smart Categorize${aiLabel}`, color: 'amber' });
      }

      // Duplicate?
      const key = (clip.text || '').trim().toLowerCase();
      if (key && (dupMap.get(key) || 0) > 1) {
        issues.push({ tag: '📋 Duplicate', detail: '', color: 'red' });
      }

      // AI Smart Format + Content Cleanup (show both when both apply)
      const enhanced = this._enhanceContent(clip.text, contentType);
      const skipTypes = this._skipAiFormatTypes();
      const canAiFormat = this._hasAiAccess() && !skipTypes.has(contentType) && (clip.text || '').trim().length > 5;
      const needsCleanup = enhanced !== clip.text;
      if (canAiFormat) {
        issues.push({ tag: '✨ Smart Format (AI)', detail: '', color: 'blue' });
      }
      if (needsCleanup) {
        issues.push({ tag: '🧹 Needs cleanup', detail: '', color: 'blue' });
      }

      if (issues.length === 0) {
        issues.push({ tag: '✓ Already clean', detail: '', color: 'green' });
      }

      analysis.push({ clip, contentType, issues });
    }
    return analysis;
  }

  // ─── Magic Button: Open Preview Modal ───
  magicFormat() {
    // Wand animation
    const wand = document.getElementById('magicWand');
    wand.style.transform = 'scale(1.2) rotate(360deg)';
    setTimeout(() => { wand.style.transform = ''; }, 500);

    // Analyze all clips
    this._magicAnalysis = this._analyzeMagicClips();
    this._magicSelected = new Set();
    this._magicPage = 0;

    // Show/hide undo banner
    const undoBanner = document.getElementById('magicUndoBanner');
    if (undoBanner) {
      undoBanner.style.display = this._magicUndoSnapshot ? 'flex' : 'none';
    }

    // Show/hide AI credit notice for premium users
    const creditNotice = document.getElementById('magicAiCreditNotice');
    if (creditNotice) {
      creditNotice.style.display = this._hasAiAccess() ? 'block' : 'none';
    }

    // Render first page and open modal
    this._renderMagicPage(0);
    this._renderMagicPagination();
    this._updateMagicSelectedCount();

    document.getElementById('magicPreviewModal').style.display = 'flex';
  }

  // ─── Magic Button: Render a Page of Clips in Modal ───
  _renderMagicPage(page) {
    this._magicPage = page;
    const perPage = 10;
    const start = page * perPage;
    const end = Math.min(start + perPage, this._magicAnalysis.length);
    const pageItems = this._magicAnalysis.slice(start, end);
    const labels = this._magicTypeLabels();
    const container = document.getElementById('magicClipList');

    if (this._magicAnalysis.length === 0) {
      container.innerHTML = '<div class="magic-clip-empty">No clips to analyze</div>';
      return;
    }

    container.innerHTML = pageItems.map((item, idx) => {
      const globalIdx = start + idx;
      const clipId = String(item.clip.id);
      const isSelected = this._magicSelected.has(clipId);
      const preview = (item.clip.text || '').replace(/\n/g, ' ').slice(0, 80) + ((item.clip.text || '').length > 80 ? '…' : '');
      const typeBadge = labels[item.contentType] || item.contentType;
      const issueTags = item.issues.map(i =>
        `<span class="magic-issue-tag magic-issue-${i.color}">${i.tag}${i.detail ? ' ' + i.detail : ''}</span>`
      ).join('');

      return `
        <div class="magic-clip-row ${isSelected ? 'magic-clip-selected' : ''}" data-magic-idx="${globalIdx}" data-clip-id="${clipId}">
          <input type="checkbox" class="magic-clip-check" ${isSelected ? 'checked' : ''}>
          <div class="magic-clip-info">
            <div class="magic-clip-text">${this._escHtml(preview)}</div>
            <div class="magic-clip-meta">
              <span class="magic-type-badge">${typeBadge}</span>
              ${issueTags}
            </div>
          </div>
        </div>`;
    }).join('');

    // Attach click handlers to rows
    container.querySelectorAll('.magic-clip-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const clipId = row.dataset.clipId;
        const checkbox = row.querySelector('.magic-clip-check');
        if (this._magicSelected.has(clipId)) {
          this._magicSelected.delete(clipId);
          row.classList.remove('magic-clip-selected');
          checkbox.checked = false;
        } else {
          this._magicSelected.add(clipId);
          row.classList.add('magic-clip-selected');
          checkbox.checked = true;
        }
        this._updateMagicSelectedCount();
      });
    });
  }

  // ─── Magic Button: Escape HTML helper ───
  _escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Magic Button: Pagination Controls ───
  _renderMagicPagination() {
    const perPage = 10;
    const totalPages = Math.max(1, Math.ceil(this._magicAnalysis.length / perPage));
    const container = document.getElementById('magicPagination');

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    // Previous
    html += `<button class="magic-page-btn" data-magic-page="${this._magicPage - 1}" ${this._magicPage === 0 ? 'disabled' : ''}>‹</button>`;

    // Page numbers (show current ±2)
    for (let i = 0; i < totalPages; i++) {
      if (i === 0 || i === totalPages - 1 || Math.abs(i - this._magicPage) <= 2) {
        html += `<button class="magic-page-btn ${i === this._magicPage ? 'active' : ''}" data-magic-page="${i}">${i + 1}</button>`;
      } else if (i === 1 && this._magicPage > 3) {
        html += '<span class="magic-page-dots">…</span>';
      } else if (i === totalPages - 2 && this._magicPage < totalPages - 4) {
        html += '<span class="magic-page-dots">…</span>';
      }
    }

    // Next
    html += `<button class="magic-page-btn" data-magic-page="${this._magicPage + 1}" ${this._magicPage >= totalPages - 1 ? 'disabled' : ''}>›</button>`;
    container.innerHTML = html;

    // Attach page click handlers
    container.querySelectorAll('.magic-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.magicPage);
        if (!isNaN(p) && p >= 0 && p < totalPages) {
          this._renderMagicPage(p);
          this._renderMagicPagination();
        }
      });
    });
  }

  // ─── Magic Button: Update Selected Count ───
  _updateMagicSelectedCount() {
    const countEl = document.getElementById('magicSelectedCount');
    if (countEl) countEl.textContent = `${this._magicSelected.size} selected`;
    const craftBtn = document.getElementById('magicCraftSelectedBtn');
    if (craftBtn) craftBtn.disabled = this._magicSelected.size === 0;
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
    return new Set(['url', 'email', 'phone', 'code', 'json', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'html', 'latex', 'mermaid']);
  }

  // ─── Magic Button: Apply Magic to Specific Clips ───
  async _craftMagic(clipIds) {
    const targetSet = new Set(clipIds.map(String));
    const stats = { categorized: 0, enhanced: 0, duplicatesFound: 0, typesFound: {}, aiCategorized: false, aiFormatted: 0 };
    const categoryCreationQueue = new Map();

    // Pre-compute content types for target clips
    const clipTypeMap = new Map();
    for (const clip of this.clips) {
      if (!targetSet.has(String(clip.id))) continue;
      clipTypeMap.set(String(clip.id), this._detectContentType(clip.text, clip.meta));
    }

    // Collect uncategorized target clips for potential AI batch
    const uncategorizedTargets = [];
    for (const clip of this.clips) {
      if (!targetSet.has(String(clip.id))) continue;
      if (!clip.category || clip.category === 'Uncategorized') {
        uncategorizedTargets.push(clip);
      }
    }

    // Collect formattable text clips for AI smart format
    const skipTypes = this._skipAiFormatTypes();
    const formatTargets = [];
    for (const clip of this.clips) {
      if (!targetSet.has(String(clip.id))) continue;
      const ct = clipTypeMap.get(String(clip.id));
      // Only format natural language text clips (note, text, markdown, etc.)
      if (!skipTypes.has(ct) && (clip.text || '').trim().length > 5) {
        formatTargets.push(clip);
      }
    }

    const hasAi = this._hasAiAccess();

    // ── AI Smart Categorization (premium users) ──
    let aiCategoryMap = new Map();
    if (uncategorizedTargets.length > 0 && hasAi) {
      try {
        const aiResults = await pasteCraftSupabase.aiCategorize(uncategorizedTargets);
        if (Array.isArray(aiResults) && aiResults.length > 0) {
          for (let i = 0; i < uncategorizedTargets.length && i < aiResults.length; i++) {
            const catName = String(aiResults[i] || '').trim();
            if (catName) aiCategoryMap.set(String(uncategorizedTargets[i].id), catName);
          }
          stats.aiCategorized = true;
        }
      } catch (_) { /* AI failed — fall back to rule-based */ }
    }

    // ── AI Smart Format (premium users) ──
    let aiFormatMap = new Map();
    if (formatTargets.length > 0 && hasAi) {
      try {
        const aiResults = await pasteCraftSupabase.aiFormat(formatTargets);
        if (Array.isArray(aiResults) && aiResults.length > 0) {
          for (let i = 0; i < formatTargets.length && i < aiResults.length; i++) {
            const formatted = String(aiResults[i] || '').trim();
            if (formatted && formatted !== (formatTargets[i].text || '').trim()) {
              aiFormatMap.set(String(formatTargets[i].id), formatted);
            }
          }
        }
      } catch (_) { /* AI failed — fall back to rule-based enhance */ }
    }

    for (const clip of this.clips) {
      if (!targetSet.has(String(clip.id))) continue;

      const contentType = clipTypeMap.get(String(clip.id)) || 'text';
      stats.typesFound[contentType] = (stats.typesFound[contentType] || 0) + 1;

      // Categorize: prefer AI category, fall back to rule-based
      if (!clip.category || clip.category === 'Uncategorized') {
        const aiCat = aiCategoryMap.get(String(clip.id));
        const suggested = aiCat
          ? { name: aiCat, icon: '🏷️' }
          : this._suggestCategory(contentType);

        const existingCat = this.categories.find(c => c.name.toLowerCase() === suggested.name.toLowerCase());
        if (existingCat) {
          const clipsInCat = this.clips.filter(c => c.category === existingCat.name);
          if (clipsInCat.length < 150) {
            clip.category = existingCat.name;
            stats.categorized++;
          }
        } else {
          if (!categoryCreationQueue.has(suggested.name)) {
            categoryCreationQueue.set(suggested.name, suggested);
          }
          clip._pendingCategory = suggested.name;
        }
      }

      // ── Sequential pipeline: AI Format → Content Cleanup ──
      // Step A: Apply AI grammar/punctuation polish if available
      const aiFormatted = aiFormatMap.get(String(clip.id));
      if (aiFormatted) {
        clip.text = aiFormatted;
        stats.aiFormatted++;
      }
      // Step B: ALWAYS run rule-based cleanup (whitespace, blank lines, UTM, JSON format, etc.)
      const enhanced = this._enhanceContent(clip.text, contentType);
      if (enhanced !== clip.text) {
        clip.text = enhanced;
        stats.enhanced++;
      }
    }

    // ── Duplicate detection (second pass — after all text modifications) ──
    const dupMap = new Map();
    for (const clip of this.clips) {
      const key = (clip.text || '').trim().toLowerCase();
      if (key) dupMap.set(key, (dupMap.get(key) || 0) + 1);
    }
    for (const clip of this.clips) {
      if (!targetSet.has(String(clip.id))) continue;
      const key = (clip.text || '').trim().toLowerCase();
      if (key && (dupMap.get(key) || 0) > 1) stats.duplicatesFound++;
    }

    // Create missing categories
    for (const [name, { icon }] of categoryCreationQueue) {
      if (!this.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        const now = Date.now();
        this.categories.push({ id: now + Math.random(), name, icon, createdAt: now, updatedAt: now });
      }
    }

    // Assign pending
    for (const clip of this.clips) {
      if (clip._pendingCategory) {
        const cat = this.categories.find(c => c.name.toLowerCase() === clip._pendingCategory.toLowerCase());
        if (cat && this.clips.filter(c => c.category === cat.name).length < 150) {
          clip.category = cat.name;
          stats.categorized++;
        }
        delete clip._pendingCategory;
      }
    }

    // Persist
    await chrome.storage.local.set({
      clips: this.clips,
      categories: this.categories,
      searchOnlyClips: this.searchOnlyClips,
      pc_local_updatedAt: Date.now()
    });
    try {
      await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
    } catch (_) { /* don't block */ }

    // Refresh credit pills after AI calls
    if (stats.aiCategorized || stats.aiFormatted > 0) {
      this.updateAiCreditsPills('fresh');
    }

    // Refresh UI
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();

    return stats;
  }

  // ─── Magic Button: Craft All with Undo Snapshot ───
  async _craftAllMagic() {
    // Snapshot for undo BEFORE any changes
    this._magicUndoSnapshot = {
      clips: JSON.parse(JSON.stringify(this.clips)),
      categories: JSON.parse(JSON.stringify(this.categories))
    };

    const allClipIds = this.clips.map(c => String(c.id));
    const stats = await this._craftMagic(allClipIds);

    this.showToast('🪄 All clips processed! Click Magic again to undo.');
    return stats;
  }

  // ─── Magic Button: Undo Last Magic ───
  async _undoMagic() {
    if (!this._magicUndoSnapshot) {
      this.showToast('⚠️ No magic to undo');
      return;
    }

    this.clips = this._magicUndoSnapshot.clips;
    this.categories = this._magicUndoSnapshot.categories;
    this._magicUndoSnapshot = null;

    await chrome.storage.local.set({
      clips: this.clips,
      categories: this.categories,
      pc_local_updatedAt: Date.now()
    });
    try {
      await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
    } catch (_) { /* don't block */ }

    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();

    // Close modal and notify
    document.getElementById('magicPreviewModal').style.display = 'none';
    this.showToast('🪄 Magic undone! Clips restored.');
  }

  // ─── Magic Button: Show Results Modal ───
  _showMagicResults(stats) {
    const modal = document.getElementById('magicResultsModal');
    if (!modal) {
      const parts = [];
      if (stats.categorized > 0) parts.push(`${stats.categorized} categorized${stats.aiCategorized ? ' (AI)' : ''}`);
      if (stats.enhanced > 0) parts.push(`${stats.enhanced} enhanced${stats.aiFormatted > 0 ? ` (${stats.aiFormatted} AI formatted)` : ''}`);
      if (stats.duplicatesFound > 0) parts.push(`${stats.duplicatesFound} dupes found`);
      this.showToast(parts.length ? `🪄 ${parts.join(', ')}` : '🪄 Clips already organized!');
      return;
    }

    const labels = this._magicTypeLabels();
    const typeBreakdown = Object.entries(stats.typesFound)
      .map(([type, count]) => `<span class="magic-type-tag">${labels[type] || type}: ${count}</span>`)
      .join(' ');

    document.getElementById('magicStatCategorized').textContent = stats.categorized;
    document.getElementById('magicStatEnhanced').textContent = stats.enhanced;
    document.getElementById('magicStatAiFormatted').textContent = stats.aiFormatted || 0;
    document.getElementById('magicStatDupes').textContent = stats.duplicatesFound;
    document.getElementById('magicTypeBreakdown').innerHTML = typeBreakdown || '<span class="magic-type-tag">No clips to analyze</span>';

    modal.style.display = 'flex';
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
    const container = document.getElementById('searchResults');
    
    if (!this.searchQuery && !this.selectedCategory && !this.selectedDateFilter) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">🔍</div>
          <h3>Start searching</h3>
          <p>Type in the search bar to find your clips</p>
        </div>
      `;
      this.updateSearchBulkActions();
      return;
    }

    const filteredClips = this.filterClips();
    
    if (filteredClips.length === 0) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">😔</div>
          <h3>No results found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      `;
      this.updateSearchBulkActions();
      return;
    }

    container.innerHTML = '';
    filteredClips.forEach(clip => {
      const resultItem = this.createSearchResultItem(clip);
      container.appendChild(resultItem);
    });

    this.updateSearchBulkActions();
  }

  // Backwards-compat: older code paths still call this name
  performSearch() {
    this.renderSearchResults();
  }

  filterClips() {
    // Combine active clips and search-only clips for search functionality
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    return allClips.filter(clip => {
      // Text search
      if (this.searchQuery && !clip.text.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (this.selectedCategory && clip.category !== this.selectedCategory) {
        return false;
      }

      // Date filter
      if (this.selectedDateFilter) {
        const clipDate = new Date(clip.timestamp);
        const now = new Date();
        
        switch (this.selectedDateFilter) {
          case 'today':
            if (clipDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (clipDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (clipDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }

  createSearchResultItem(clip) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.dataset.clipId = clip.id;
    
    const isSelected = this.selectedSearchClips.has(this._clipIdKey(clip.id));
    if (isSelected) {
      item.classList.add('selected');
    }

    const truncatedText = clip.text.length > 100 ? clip.text.substring(0, 100) + '...' : clip.text;
    const timeAgo = this.getTimeAgo(clip.timestamp);
    const sMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
    const sBadge = (typeof PCMarkup !== 'undefined') ? PCMarkup.getMarkupBadgeForClip(clip.text, sMeta) : '';
    const sPreview = (typeof PCMarkup !== 'undefined') ? PCMarkup.renderMarkupPreview(clip.text, sMeta, 200) : '';
    const searchTextContent = sPreview
      ? `<div class="pc-search-preview">${sPreview}</div>`
      : `<div>${this.escapeHtml(truncatedText)}</div>`;

    item.innerHTML = `
      <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''}>
      <div class="search-result-content">
        <div class="search-result-text">${sBadge}${searchTextContent}</div>
        <div class="search-result-meta">
          <span class="search-result-category">${clip.category}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
      <div class="search-result-actions">
        <button class="chip-breakdown-btn" title="AI Breakdown">🧠</button>
        <button class="chip-open-btn" title="Open">🔎</button>
        <button class="chip-share-btn" title="Share">🔗</button>
        <button class="chip-summary-btn" title="AI Summary">📝</button>
        <button class="search-notes-btn" title="Send to Notes">
          <img src="assets/note-icons/sendcreate Album.svg" alt="" class="pc-icon pc-icon-16">
        </button>
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="btn-copy" title="Copy to clipboard">📋</button>
      </div>
    `;
    
    // Checkbox handler
    const checkbox = item.querySelector('.search-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSearchClip(clip.id, item);
    });
    
    // Item click handler for selection
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.search-result-actions') && !e.target.classList.contains('search-checkbox')) {
        this.toggleSearchClip(clip.id, item);
      }
    });

    // Copy functionality
    item.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyClipToClipboard(clip.text);
    });

    // Breakdown functionality
    item.querySelector('.chip-breakdown-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSend = this.getSelectedOrCurrentText(clip.text, 'search');
      this.showBreakdownModal(textToSend);
    });

    // Open/view functionality
    const openBtn = item.querySelector('.chip-open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.openClipViewer === 'function') {
          this.openClipViewer(clip);
        }
      });
    }

    // Share functionality
    const shareBtn = item.querySelector('.chip-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showShareMenuForClip(clip);
      });
    }
    
    // Summary functionality
    item.querySelector('.chip-summary-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSend = this.getSelectedOrCurrentText(clip.text, 'search');
      this.showSummaryModal(textToSend);
    });

    // Send to Notes functionality
    item.querySelector('.search-notes-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      // Load notes and show album picker
      await this.loadNotes();
      this.showAlbumPicker();
      // Store the clip to be added
      this.pendingClipForNotes = clip;
    });

    // Category assignment
    item.querySelector('.chip-category-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.pendingText = clip.text;
      this.pendingClipId = this._clipIdKey(clip.id);
      this.showCategoryModal(true);
    });

    return item;
  }

  // Category Management Functions
  renderCategories() {
    const container = document.getElementById('categoriesList');
    
    if (this.categories.length === 0) {
      container.innerHTML = `
        <div class="empty-categories">
          <div class="empty-categories-icon">📁</div>
          <h3>No categories yet</h3>
          <p>Create your first category to organize clips</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    // Newest categories first (top of list)
    const categoriesSorted = [...this.categories].sort((a, b) => {
      const aTs = Number(a?.created ?? a?.id ?? 0);
      const bTs = Number(b?.created ?? b?.id ?? 0);
      return bTs - aTs;
    });

    categoriesSorted.forEach(category => {
      const categoryItem = this.createCategoryItem(category);
      container.appendChild(categoryItem);
    });
  }

  createCategoryItem(category) {
    const item = document.createElement('div');
    item.className = 'category-item';

    // Get clips in this category (from both active and archived)
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const clipsInCategory = allClips.filter(clip => clip.category === category.name);
    const clipCount = clipsInCategory.length;
    
    console.log(`📊 Category "${category.name}" has ${clipCount} clips`);

    item.innerHTML = `
      <div class="category-header">
        <div class="category-info">
          <div class="category-icon">${category.icon}</div>
          <div class="category-details">
            <h4>${this.escapeHtml(category.name)}</h4>
            <p>${clipCount}/150 clips</p>
          </div>
        </div>
        <div class="category-header-actions">
          <button class="category-btn edit-category" data-action="edit" title="Edit category">✏️</button>
          <button class="category-btn delete-category" data-action="delete" title="Delete category">🗑️</button>
          <span class="category-expand-icon">▶</span>
        </div>
      </div>
      <div class="category-dropdown" id="dropdown-${category.id}">
        ${this.createCategoryClipsHTML(clipsInCategory, category.id)}
      </div>
    `;

    // Add click handler for expand/collapse
    const header = item.querySelector('.category-header');
    header.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.category-header-actions button')) return;
      
      this.toggleCategoryDropdown(item, category);
    });

    // Add event listeners for category actions
    item.querySelector('.edit-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.editCategory(category);
    });

    item.querySelector('.delete-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteCategory(category);
    });

    return item;
  }

  showCreateCategoryDialog() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon, { originButtonId: 'createCategoryBtn' });
    }
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
    const originButtonId = options?.originButtonId || null;
    this.setActionButtonLoading(originButtonId, true, 'Creating...');

    const now = Date.now();
    const category = {
      id: Date.now(),
      name: String(name || '').trim(),
      icon: String(icon || '📁'),
      createdAt: now,
      updatedAt: now
    };

    return await PasteCraftCRUD.createOperation({
      entity: category,
      stateGetter: () => ({ categories: this.categories }),
      stateSetter: async (newState) => {
        this.categories = newState.categories;
      },
      stateKeys: ['categories'],
      validator: (entity, state) => {
        if (!entity.name || entity.name.length === 0) {
          return { valid: false, error: 'Category name is required' };
        }
        const duplicate = Array.isArray(state.categories) && 
          state.categories.some(cat => cat.name.toLowerCase() === entity.name.toLowerCase());
        return { valid: !duplicate, error: duplicate ? 'Category already exists' : null };
      },
      duplicateCheck: (entity, state) => {
        return Array.isArray(state.categories) && 
          state.categories.some(cat => cat.name.toLowerCase() === entity.name.toLowerCase());
      },
      storageKeys: ['categories'],
      storageWriter: async (data) => {
        await chrome.storage.local.set({ ...data, pc_local_updatedAt: Date.now() });
      },
      addToArray: (items, entity) => {
        return [...items, entity];
      },
      verifier: async (entity) => {
        const verification = await chrome.storage.local.get(['categories']);
        const categories = Array.isArray(verification.categories) ? verification.categories : [];
        return categories.some(cat => cat.id === entity.id);
      },
      uiUpdater: () => {
        this.renderCategories();
        this.updateCategoryFilter();
        const categoryModal = document.getElementById('categoryModal');
        if (categoryModal && categoryModal.style.display === 'flex') {
          this.populateCategoryOptions();
        }
        this.setActionButtonLoading(originButtonId, false);
      },
      backgroundSync: async (entity) => {
        await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
      },
      successMessage: (entity) => `✅ Category "${entity.name}" created`,
      errorMessage: (error) => `❌ Failed to create category: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => {
        this.showToast(msg, type);
        this.setActionButtonLoading(originButtonId, false);
      }
    });
  }

  async editCategory(category) {
    const newName = prompt('Enter new category name:', category.name);
    if (newName && newName.trim()) {
      const newIcon = prompt('Enter new category icon:', category.icon) || category.icon;
      
      const oldName = category.name;
      category.name = newName.trim();
      category.icon = newIcon;
      category.updatedAt = Date.now();

      // Update clips that use this category
      this.clips.forEach(clip => {
        if (clip.category === oldName) {
          clip.category = newName.trim();
        }
      });

      await chrome.storage.local.set({ 
        categories: this.categories,
        clips: this.clips,
        pc_local_updatedAt: Date.now()
      });
      
      // 🔄 AUTO-SYNC TO DATABASE
      try {
        await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        console.log('✅ Category edit synced to database');
      } catch (error) {
        console.error('⚠️ Failed to sync category edit to database:', error);
      }
      
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderChips();
    }
  }

  /**
   * Category Deletion using CRUD Utility (5 Best Practices)
   */
  async deleteCategory(category) {
    // PRACTICE #1: VALIDATION - Verify category exists and is valid
    if (!category || !category.id || !category.name) {
      this.showToast('❌ Invalid category - cannot delete', 'error');
      return;
    }
    const categoryExists = Array.isArray(this.categories) && this.categories.some(cat => cat.id === category.id);
    if (!categoryExists) {
      this.showToast('✅ Category already deleted', 'success');
      return; // Idempotent: already deleted, safe to return
    }

    const ok = confirm(`Delete category "${category.name}"? Clips will be moved to "Uncategorized".`);
    if (!ok) return;

    return await PasteCraftCRUD.deleteOperation({
      entityId: category.id,
      entityName: category.name,
      entityType: 'category',
      stateGetter: () => ({
        categories: this.categories,
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips
      }),
      stateSetter: async (newState) => {
        this.categories = newState.categories;
        this.clips = newState.clips;
        this.searchOnlyClips = newState.searchOnlyClips;
      },
      stateKeys: ['categories', 'clips', 'searchOnlyClips'],
      validator: (entity, state) => {
        const exists = Array.isArray(state.categories) && state.categories.some(cat => cat.id === entity.id);
        return { valid: exists, error: exists ? null : 'Category not found' };
      },
      idempotencyCheck: (entityId, state) => {
        return !Array.isArray(state.categories) || !state.categories.some(cat => cat.id === entityId);
      },
      storageKeys: ['categories', 'clips', 'searchOnlyClips'],
      storageWriter: async (data) => {
        await chrome.storage.local.set(data);
      },
      deleteFromArray: (items, entityId) => items.filter(item => item.id !== entityId),
      updateRelatedEntities: (state, entity) => {
        // Move clips to Uncategorized
        state.clips.forEach(clip => {
          if (clip.category === entity.name) {
            clip.category = 'Uncategorized';
          }
        });
        state.searchOnlyClips.forEach(clip => {
          if (clip.category === entity.name) {
            clip.category = 'Uncategorized';
          }
        });
      },
      verifier: async (entityId) => {
        const verification = await chrome.storage.local.get(['categories']);
        const categories = Array.isArray(verification.categories) ? verification.categories : [];
        return !categories.some(cat => cat.id === entityId);
      },
      uiUpdater: () => {
        this.renderCategories();
        this.updateCategoryFilter();
        this.renderChips();
      },
      backgroundSync: async (entity, deletedAt) => {
        await this.appendDeletedItems('pc_deleted_categories', [{
          ...category,
          deletedAt,
          updatedAt: deletedAt
        }]);
        try {
          await pasteCraftSupabase.deleteCategoryFromSupabase(String(category?.id ?? ''));
        } catch (_) {}
        await pasteCraftSupabase.syncWithQueue('syncDeletedCategories', [{
          ...category,
          deletedAt,
          updatedAt: deletedAt
        }], pasteCraftSupabase.syncDeletedCategoriesToSupabase);
        await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      },
      successMessage: (entity) => `✅ Category "${entity.name}" deleted`,
      errorMessage: (error) => `❌ Failed to delete category: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => this.showToast(msg, type)
    });
  }

  updateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Categories</option>';
    
    // Include categories from both active and archived clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const uniqueCategories = [...new Set(allClips.map(clip => clip.category))];
    console.log('🎯 Unique categories found in all clips:', uniqueCategories);
    
    uniqueCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  }

  updateManualInputCategories() {
    const select = document.getElementById('manualInputCategory');
    if (!select) return;
    
    const currentValue = select.value;
    
    // Include categories from both active and archived clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const uniqueCategories = [...new Set(allClips.map(clip => clip.category))];
    
    // Always include Uncategorized
    if (!uniqueCategories.includes('Uncategorized')) {
      uniqueCategories.unshift('Uncategorized');
    }
    
    select.innerHTML = '';
    uniqueCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    
    // Restore previous selection or default to Uncategorized
    if (uniqueCategories.includes(currentValue)) {
      select.value = currentValue;
    } else {
      select.value = 'Uncategorized';
    }
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
    const select = document.getElementById('pdfExtractCategory');
    if (!select) return;

    const allClips = [...this.clips, ...this.searchOnlyClips];
    const cats = [...new Set(allClips.map(c => c.category))];
    if (!cats.includes('Uncategorized')) cats.unshift('Uncategorized');

    select.innerHTML = '';
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    select.value = 'Uncategorized';
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
        .then(() => this.backupLocalToSync('save:pdfExtract'))
        .catch(() => {});
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
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
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
    this.populateCategoryOptions();
    document.getElementById('categoryModal').style.display = 'flex';
    
    // Reset Add button to disabled state
    document.getElementById('addToCategory').disabled = true;
    
    // Update modal text for reassignment vs new save
    const modalText = document.querySelector('.modal-text');
    if (isReassignment) {
      modalText.textContent = 'Choose a new category for this clip:';
    } else {
      modalText.textContent = 'Where would you like to save this clip?';
    }
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    this.pendingText = null;
    this.pendingClipId = null;
    this.selectedCategoryForSave = 'Uncategorized';
    
    // Reset Add button to disabled state
    document.getElementById('addToCategory').disabled = true;
    
    // Clear selected state from options
    document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
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
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
      return;
    }

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
      navigator.clipboard.writeText(text);
      this.showToast('Explanation copied to clipboard!');
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
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
      return;
    }

    const loadingEl = document.getElementById('bdInlineLoading');
    const resultEl = document.getElementById('bdInlineResult');

    // Check cache first
    if (this.inlineBreakdownCache && this.inlineBreakdownCache[level]) {
      if (resultEl) resultEl.innerHTML = await this._renderAiResponse(this.inlineBreakdownCache[level]);
      return;
    }

    try {
      // Show loading
      if (loadingEl) loadingEl.style.display = 'flex';
      if (resultEl) resultEl.innerHTML = '';

      // Generate explanation
      const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);

      // Cache
      const formatted = this._formatAiOutput(explanation);
      if (!this.inlineBreakdownCache) this.inlineBreakdownCache = {};
      this.inlineBreakdownCache[level] = formatted;

      // Render
      if (resultEl) resultEl.innerHTML = await this._renderAiResponse(formatted);
      if (loadingEl) loadingEl.style.display = 'none';

      // Add to threads
      if (!this.inlineBreakdownThreads) this.inlineBreakdownThreads = [];
      this.inlineBreakdownThreads.push({
        question: `Breakdown at ${level} level`,
        answer: formatted,
        level,
        timestamp: Date.now()
      });
      this.currentInlineBreakdownThreadIndex = this.inlineBreakdownThreads.length - 1;

      // Show follow-up
      const followupContainer = document.getElementById('bdInlineFollowup');
      if (followupContainer) followupContainer.style.display = 'block';

      // Show thread pagination after 2+ threads
      if (this.inlineBreakdownThreads.length >= 2) {
        this.renderInlineBreakdownPagination();
      }

      // Also persist to breakdown modal state for session restore
      this.breakdownCache = this.inlineBreakdownCache;
      this.breakdownThreads = this.inlineBreakdownThreads;
      this.currentBreakdownThreadIndex = this.currentInlineBreakdownThreadIndex;
      this._saveBreakdownModalState();

      // Save to AI history
      await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);

    } catch (error) {
      console.error('Failed to generate inline breakdown:', error);
      if (resultEl) resultEl.innerHTML = '❌ Failed to generate explanation. Please try again.';
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate explanation');
    }
  }

  async sendInlineBreakdownFollowup(question) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
      return;
    }

    const loadingEl = document.getElementById('bdInlineLoading');
    const resultEl = document.getElementById('bdInlineResult');

    try {
      if (loadingEl) loadingEl.style.display = 'flex';
      if (resultEl) resultEl.innerHTML = '';

      // Build context from previous thread
      const prevThread = this.inlineBreakdownThreads[this.currentInlineBreakdownThreadIndex];
      const contextPrompt = prevThread
        ? `Previous explanation:\n${prevThread.answer}\n\nUser follow-up: ${question}`
        : question;

      const level = this.currentBreakdownLevel || 'college';
      const explanation = await pasteCraftSupabase.breakdownText(contextPrompt, level);

      const formatted = this._formatAiOutput(explanation);

      if (resultEl) resultEl.innerHTML = await this._renderAiResponse(formatted);
      if (loadingEl) loadingEl.style.display = 'none';

      // Add to threads
      this.inlineBreakdownThreads.push({
        question,
        answer: formatted,
        level,
        timestamp: Date.now()
      });
      this.currentInlineBreakdownThreadIndex = this.inlineBreakdownThreads.length - 1;

      // Update pagination
      this.renderInlineBreakdownPagination();

      // Persist
      this.breakdownThreads = this.inlineBreakdownThreads;
      this.currentBreakdownThreadIndex = this.currentInlineBreakdownThreadIndex;
      this._saveBreakdownModalState();
      await this.saveAiHistory('breakdown', this.currentBreakdownText, this.inlineBreakdownThreads);

    } catch (error) {
      console.error('Failed to send inline follow-up:', error);
      if (resultEl) resultEl.innerHTML = '❌ Failed to generate response.';
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate follow-up');
    }
  }

  renderInlineBreakdownPagination() {
    const container = document.getElementById('bdInlineThreadPagination');
    if (!container || !this.inlineBreakdownThreads || this.inlineBreakdownThreads.length < 2) {
      if (container) container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    this.inlineBreakdownThreads.forEach((thread, idx) => {
      const box = document.createElement('button');
      box.className = 'thread-box' + (idx === this.currentInlineBreakdownThreadIndex ? ' active' : '');
      box.textContent = idx + 1;
      box.setAttribute('data-tooltip', thread.question || `Thread ${idx + 1}`);
      box.addEventListener('click', async () => {
        this.currentInlineBreakdownThreadIndex = idx;
        const resultEl = document.getElementById('bdInlineResult');
        if (resultEl) resultEl.innerHTML = await this._renderAiResponse(thread.answer);
        // Update active box
        container.querySelectorAll('.thread-box').forEach((b, i) => {
          b.classList.toggle('active', i === idx);
        });
      });
      container.appendChild(box);
    });
  }

  // AI Summary Methods
  showSummarySection(section) {
    const inputSection = document.getElementById('summaryInputSection');
    const questionsSection = document.getElementById('summaryQuestionsSection');
    const resultSection = document.getElementById('summaryResultSection');

    // Hide all sections
    if (inputSection) inputSection.style.display = 'none';
    if (questionsSection) questionsSection.style.display = 'none';
    if (resultSection) resultSection.style.display = 'none';

    // Show requested section
    if (section === 'input' && inputSection) {
      inputSection.style.display = 'block';
    } else if (section === 'questions' && questionsSection) {
      questionsSection.style.display = 'block';
    } else if (section === 'result' && resultSection) {
      resultSection.style.display = 'block';
    }
  }

  async generateSummaryQuestions(text) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      this.showSummarySection('questions');
      const questionsLoading = document.getElementById('questionsLoading');
      const questionsList = document.getElementById('questionsList');
      
      // Show loading
      if (questionsLoading) questionsLoading.style.display = 'flex';
      if (questionsList) questionsList.innerHTML = '';

      // Generate questions using AI
      const questions = await pasteCraftSupabase.generateSummaryQuestions(text);
      this.generatedQuestions = questions;

      // Hide loading
      if (questionsLoading) questionsLoading.style.display = 'none';

      // Display questions
      if (questionsList) {
        questions.forEach(question => {
          const chip = document.createElement('button');
          chip.className = 'question-chip';
          chip.textContent = question;
          chip.addEventListener('click', () => {
            this.currentSummaryQuestion = question;
            this.generateSummary(text, question);
          });
          questionsList.appendChild(chip);
        });
      }

      // Clear custom question input
      const customInput = document.getElementById('customQuestionInput');
      if (customInput) {
        customInput.value = '';
        document.getElementById('customQuestionBtn').disabled = true;
      }

      // Persist questions state
      this._currentSummarySection = 'questions';
      this._saveSummaryState();

    } catch (error) {
      console.error('Failed to generate questions:', error);
      this.showToast('Failed to generate questions. Please check your API key.');
      this.showSummarySection('input');
    }
  }

  async generateSummary(text, question) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      this.showSummarySection('result');
      const summaryLoading = document.getElementById('summaryLoading');
      const summaryContent = document.getElementById('summaryResultContent');

      // Show loading
      if (summaryLoading) summaryLoading.style.display = 'flex';
      if (summaryContent) summaryContent.innerHTML = '';

      // Generate summary using AI
      const summary = await pasteCraftSupabase.generateSummary(text, question);
      const formatted = this._formatAiOutput(summary);

      // Hide loading
      if (summaryLoading) summaryLoading.style.display = 'none';

      // Render as rich HTML and display
      if (summaryContent) {
        summaryContent.innerHTML = await this._renderAiResponse(formatted);
      }

      // Store raw text for current summary (for copy/persistence)
      this._currentRawSummary = formatted;

      // Add to threads (store raw text)
      this.summaryThreads.push({
        question,
        answer: formatted,
        timestamp: Date.now()
      });
      this.currentSummaryThreadIndex = this.summaryThreads.length - 1;

      // Show follow-up input after first response
      const followupContainer = document.getElementById('summaryFollowupContainer');
      if (followupContainer) {
        followupContainer.style.display = 'block';
      }

      // Update thread pagination (only show after 2nd response)
      if (this.summaryThreads.length >= 2) {
        this.renderThreadPagination('summary');
      }

      // Persist summary result state
      this._currentSummarySection = 'result';
      this._saveSummaryState();

      // Save to AI history
      await this.saveAiHistory('summary', this.currentSummaryText, this.summaryThreads);

    } catch (error) {
      console.error('Failed to generate summary:', error);
      const summaryContent = document.getElementById('summaryResultContent');
      if (summaryContent) {
        summaryContent.innerHTML = '❌ Failed to generate summary. Please check your OpenAI API key configuration.';
      }
      document.getElementById('summaryLoading').style.display = 'none';
      this.showToast('Failed to generate summary');
    }
  }

  _formatAiOutput(raw) {
    // Minimal cleanup: only strip decorative artifacts, preserve all formatting
    const s = String(raw ?? '');
    if (!s.trim()) return '';

    const lines = s.split(/\r?\n/);
    const cleaned = lines.map(line => {
      // Remove leading // comment markers (keep URLs like https://)
      if (/^\s*\/\/\s?/.test(line) && !/^\s*\/\/\s*https?:\/\//i.test(line)) {
        line = line.replace(/^\s*\/\/\s?/, '');
      }
      // Remove leading \\ backslash prefixes (decorative only)
      line = line.replace(/^\s*\\\\+\s?/, '');
      // Strip trailing whitespace
      line = line.replace(/[ \t]+$/, '');
      return line;
    });

    // Normalize excessive blank lines (max 2 consecutive)
    const out = [];
    let blankRun = 0;
    for (const line of cleaned) {
      const isBlank = !String(line).trim();
      if (isBlank) {
        blankRun += 1;
        if (blankRun <= 2) out.push('');
        continue;
      }
      blankRun = 0;
      out.push(line);
    }
    return out.join('\n').trim();
  }

  /**
   * Render AI response text as rich HTML using the markup renderer.
   * Handles Markdown with embedded LaTeX ($...$, $$...$$) and Mermaid diagrams.
   * @param {string} rawText - Raw AI response text
   * @returns {string|Promise<string>} Rendered HTML
   */
  async _renderAiResponse(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    const text = rawText.trim();
    if (!text) return '';

    // Check if PCMarkup is available
    if (typeof PCMarkup === 'undefined') return PCMarkup?.escapeHtml?.(text) || text;

    // Step 1: Extract mermaid code blocks and render them separately
    const mermaidBlocks = [];
    let processed = text.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, code) => {
      const placeholder = `%%MERMAID_BLOCK_${mermaidBlocks.length}%%`;
      mermaidBlocks.push(code.trim());
      return placeholder;
    });

    // Step 2: Extract LaTeX blocks and protect them from Markdown parsing
    const latexBlocks = [];
    // Display math $$...$$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      const placeholder = `%%LATEX_DISPLAY_${latexBlocks.length}%%`;
      latexBlocks.push({ expr: expr.trim(), display: true });
      return placeholder;
    });
    // Display math \[...\]
    processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => {
      const placeholder = `%%LATEX_DISPLAY_${latexBlocks.length}%%`;
      latexBlocks.push({ expr: expr.trim(), display: true });
      return placeholder;
    });
    // Inline math $...$
    processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      const placeholder = `%%LATEX_INLINE_${latexBlocks.length}%%`;
      latexBlocks.push({ expr: expr.trim(), display: false });
      return placeholder;
    });
    // Inline math \(...\)
    processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => {
      const placeholder = `%%LATEX_INLINE_${latexBlocks.length}%%`;
      latexBlocks.push({ expr: expr.trim(), display: false });
      return placeholder;
    });

    // Step 3: Render as Markdown
    let html = PCMarkup.renderMarkup(processed, null, { type: 'markdown' });

    // Step 4: Replace LaTeX placeholders with KaTeX rendered HTML
    if (typeof katex !== 'undefined') {
      for (let i = 0; i < latexBlocks.length; i++) {
        const block = latexBlocks[i];
        const displayPlaceholder = `%%LATEX_DISPLAY_${i}%%`;
        const inlinePlaceholder = `%%LATEX_INLINE_${i}%%`;
        try {
          const rendered = katex.renderToString(block.expr, {
            displayMode: block.display,
            throwOnError: false
          });
          html = html.replace(displayPlaceholder, rendered);
          html = html.replace(inlinePlaceholder, rendered);
        } catch (_) {
          const fallback = `<code>${PCMarkup.escapeHtml(block.expr)}</code>`;
          html = html.replace(displayPlaceholder, fallback);
          html = html.replace(inlinePlaceholder, fallback);
        }
      }
    }

    // Step 5: Replace Mermaid placeholders with rendered diagrams
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const placeholder = `%%MERMAID_BLOCK_${i}%%`;
      // Check if placeholder survived markdown rendering (might be inside <p> tags)
      if (html.includes(placeholder)) {
        try {
          const mermaidHtml = await PCMarkup.renderMarkup(mermaidBlocks[i], null, { type: 'mermaid' });
          html = html.replace(placeholder, mermaidHtml);
        } catch (_) {
          html = html.replace(placeholder, `<pre class="pc-code-block"><code>${PCMarkup.escapeHtml(mermaidBlocks[i])}</code></pre>`);
        }
      }
    }

    return html;
  }

  // Handle Summary Follow-up
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
    const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
    if (breakdownFollowupInput) {
      breakdownFollowupInput.value = '';
      breakdownFollowupInput.disabled = true;
    }
    
    const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');
    if (breakdownFollowupBtn) {
      breakdownFollowupBtn.disabled = true;
    }

    // Disable level tabs during processing
    this.toggleFollowupLevelTabs(false);

    const loadingEl = document.getElementById('breakdownLoading');
    const resultEl = document.getElementById('breakdownResult');

    try {
      // Show loading
      if (loadingEl) loadingEl.style.display = 'flex';
      if (resultEl) resultEl.innerHTML = '';

      let answer;
      
      // Use selected level if specified, otherwise use general summary
      if (this.selectedFollowupLevel) {
        console.log('🎯 Generating follow-up at level:', this.selectedFollowupLevel);
        // Generate with specific breakdown level
        const levelPrompt = `Based on the previous explanation, answer this follow-up question at a ${this.selectedFollowupLevel} comprehension level: ${followupQuestion}. Context: "${this.currentBreakdownText.substring(0, 100)}..."`;
        answer = await pasteCraftSupabase.breakdownText(levelPrompt, this.selectedFollowupLevel);
      } else {
        // Generate standard follow-up response
        const contextPrompt = `Based on the previous explanation about "${this.currentBreakdownText.substring(0, 100)}...", answer this follow-up: ${followupQuestion}`;
        answer = await pasteCraftSupabase.generateSummary(this.currentBreakdownText, contextPrompt);
      }

      // Clean up the raw answer
      const formatted = this._formatAiOutput(answer);

      // Hide loading
      if (loadingEl) loadingEl.style.display = 'none';

      // Render as rich HTML and display
      if (resultEl) {
        resultEl.innerHTML = await this._renderAiResponse(formatted);
      }

      // Add to threads (store raw text)
      this.breakdownThreads.push({
        question: followupQuestion,
        answer: formatted,
        level: this.selectedFollowupLevel || 'standard',
        timestamp: Date.now()
      });
      this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;

      // Update pagination
      if (this.breakdownThreads.length >= 2) {
        this.renderThreadPagination('breakdown');
      }

      // Reset selected level for next follow-up
      this.selectedFollowupLevel = null;
      document.querySelectorAll('.followup-level-tab').forEach(t => t.classList.remove('selected'));

      // Persist breakdown modal state after follow-up
      this._saveBreakdownModalState();

      // Update AI history with new thread
      await this.saveAiHistory('breakdown', this.currentBreakdownText, this.breakdownThreads);

    } catch (error) {
      console.error('Failed to generate follow-up:', error);
      if (resultEl) {
        resultEl.innerHTML = '❌ Failed to generate follow-up response.';
      }
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate follow-up');
    }

    // Re-enable input
    if (breakdownFollowupInput) {
      breakdownFollowupInput.disabled = false;
    }
  }

  // Toggle Follow-up Level Tabs Enabled/Disabled
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
    const container = document.getElementById('categoryOptions');
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    // Count clips in Uncategorized (unlimited capacity)
    const uncategorizedCount = allClips.filter(clip => clip.category === 'Uncategorized').length;
    const uncategorizedFull = false; // Uncategorized is never full
    
    container.innerHTML = `
      <div class="category-option ${uncategorizedFull ? 'category-full' : ''}" data-category="Uncategorized">
        <div class="category-option-icon">📄</div>
        <span>Uncategorized (${uncategorizedCount}/∞)</span>
        ${uncategorizedFull ? '<span class="full-indicator">FULL</span>' : ''}
        <button class="category-delete-btn" title="Delete this clip">🗑️</button>
      </div>
    `;

    this.categories.forEach(category => {
      const clipsInCategory = allClips.filter(clip => clip.category === category.name).length;
      const isFull = clipsInCategory >= 150;
      
      const option = document.createElement('div');
      option.className = `category-option ${isFull ? 'category-full' : ''}`;
      option.dataset.category = category.name;
      option.innerHTML = `
        <div class="category-option-icon">${category.icon}</div>
        <span>${this.escapeHtml(category.name)} (${clipsInCategory}/150)</span>
        ${isFull ? '<span class="full-indicator">FULL</span>' : ''}
        <button class="category-delete-btn" title="Delete this clip">🗑️</button>
      `;
      container.appendChild(option);
    });
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
    if (!this.pendingText) return;

    if (this.pendingClipId !== null) {
      // Reassigning existing clip - check category limit first
      const idKey = String(this.pendingClipId || '');
      const currentClip =
        this.clips.find(c => this._clipIdKey(c?.id) === idKey) ||
        this.searchOnlyClips.find(c => this._clipIdKey(c?.id) === idKey);
      if (!currentClip) return;

      if (currentClip.category !== this.selectedCategoryForSave) {
        // Only check limit if moving to a different category (Uncategorized = unlimited, others = 150 max)
        if (this.selectedCategoryForSave !== 'Uncategorized') {
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clipsInTargetCategory = allClips.filter(clip => 
            clip.category === this.selectedCategoryForSave && clip.id !== currentClip.id
          );
          
          if (clipsInTargetCategory.length >= 150) {
            this.showToast(`Category "${this.selectedCategoryForSave}" is full (150 clips max). Remove some clips first.`);
            return;
          }
        }
      }

      // Update whichever list contains this clip (active or archived)
      const activeIdx = this.clips.findIndex(c => this._clipIdKey(c?.id) === idKey);
      if (activeIdx >= 0) {
        this.clips[activeIdx].category = this.selectedCategoryForSave;
      } else {
        const archivedIdx = this.searchOnlyClips.findIndex(c => this._clipIdKey(c?.id) === idKey);
        if (archivedIdx >= 0) this.searchOnlyClips[archivedIdx].category = this.selectedCategoryForSave;
      }

      await chrome.storage.local.set({
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips,
        pc_local_updatedAt: Date.now()
      });
      await this.backupLocalToSync('category:saveTextWithCategory');
      
      // 🔄 AUTO-SYNC TO DATABASE
      try {
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
        console.log('✅ Clip category update synced to database');
      } catch (error) {
        console.error('⚠️ Failed to sync category update to database:', error);
      }
      
      this.renderChips();
      this.renderSearchResults();
      this.renderCategories();
      this.updateCategoryFilter();
      this.showToast(`Moved to ${this.selectedCategoryForSave}!`);
    } else {
      // New clip save - check category limit first (Uncategorized = unlimited, others = 150 max)
      if (this.selectedCategoryForSave !== 'Uncategorized') {
        const allClips = [...this.clips, ...this.searchOnlyClips];
        const clipsInCategory = allClips.filter(clip => clip.category === this.selectedCategoryForSave);
        
        if (clipsInCategory.length >= 150) {
          this.showToast(`Category "${this.selectedCategoryForSave}" is full (150 clips max). Remove some clips first.`);
          return;
        }
      }

      const newClip = {
        id: Date.now() + Math.random(),
        text: this.pendingText,
        category: this.selectedCategoryForSave,
        timestamp: Date.now()
      };

      this.clips.unshift(newClip);
      
      // Enforce 500 clip limit with auto-archive
      await this.enforceClipLimit();

      await chrome.storage.local.set({
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips,
        pc_local_updatedAt: Date.now()
      });
      await this.backupLocalToSync('save:saveTextWithCategory');
      
      // 🔄 AUTO-SYNC TO DATABASE
      try {
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
        await pasteCraftSupabase.saveClipboardHistoryItem(newClip.text);
        console.log('✅ New clip synced to database');
      } catch (error) {
        console.error('⚠️ Failed to sync new clip to database:', error);
        // Don't block user - local save already succeeded
      }
      await this.syncCloudClipboardHistory().catch(() => {});
      
      // Notify content scripts about new clip (for Quick Paste updates)
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'clipSaved',
              clip: newClip,
              autoShow: true // Auto-show when saving from popup
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
      } catch (error) {
        console.log('Could not notify content scripts:', error);
      }
      
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
      this.showToast(`Saved to ${this.selectedCategoryForSave}!`);
    }

    this.hideCategoryModal();
  }

  showCreateCategoryFromModal() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon, { originButtonId: 'createNewCategory' }).then(() => {
        this.populateCategoryOptions();
      });
    }
  }

  // Settings Management Functions
  async loadSettings() {
    // First, try to fetch settings from Supabase (cloud sync)
    let cloudSettings = null;
    try {
      cloudSettings = await Promise.race([
        pasteCraftSupabase.syncSettingsFromSupabase(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('syncSettingsFromSupabase timeout')), 500))
      ]);
    } catch (error) {
      console.warn('⚠️ Could not fetch settings from Supabase, using local:', error);
    }

    // Load sync + local settings as fallback (sync helps cross-browser refresh)
    let syncData = {};
    try {
      syncData = await new Promise((resolve) => chrome.storage.sync.get(['autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode', 'theme', 'settingsUpdatedAt'], resolve));
    } catch (_) {
      syncData = {};
    }
    const localData = await chrome.storage.local.get(['autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode', 'theme', 'settingsUpdatedAt']);
    const localAutoDeletePeriod = localData.autoDeletePeriod || 'never';
    const localQuickPasteSettings = localData.quickPasteSettings || {};
    const localAlbumAttachmentOpenMode = localData.albumAttachmentOpenMode || 'overlay';
    const localTheme = (localData.theme || localQuickPasteSettings.theme || 'light');
    const localSettingsUpdatedAt = typeof localData.settingsUpdatedAt === 'number' ? localData.settingsUpdatedAt : 0;
    const syncSettingsUpdatedAt = typeof syncData.settingsUpdatedAt === 'number' ? syncData.settingsUpdatedAt : 0;
    const syncHasPayload = !!(syncData && (syncData.autoDeletePeriod || syncData.quickPasteSettings || syncData.albumAttachmentOpenMode || syncData.theme));
    const localHasPayload = !!(localAutoDeletePeriod || (localQuickPasteSettings && Object.keys(localQuickPasteSettings).length) || localAlbumAttachmentOpenMode || localData.theme);

    // Merge: Prefer the newest between sync/local; fall back to cloud if neither has data
    const preferSync = syncHasPayload && syncSettingsUpdatedAt >= localSettingsUpdatedAt;
    const preferLocal = localHasPayload && localSettingsUpdatedAt > syncSettingsUpdatedAt;

    if (preferSync) {
      console.log('✅ Using sync settings from chrome.storage.sync');
      this.autoDeletePeriod = syncData.autoDeletePeriod || localAutoDeletePeriod;
      this.theme = (syncData.theme || syncData.quickPasteSettings?.theme || localTheme) === 'dark' ? 'dark' : 'light';
      this.quickPasteSettings = {
        autoHide: true,
        showTimestamps: true,
        maxClipsDisplay: 20,
        ...localQuickPasteSettings, // Local fallback for missing fields
        ...syncData.quickPasteSettings // Sync takes precedence
      };
      if (this.quickPasteSettings && typeof this.quickPasteSettings === 'object') delete this.quickPasteSettings.theme;
      this.albumAttachmentOpenMode = syncData.albumAttachmentOpenMode || localAlbumAttachmentOpenMode;
      this.settingsUpdatedAt = syncSettingsUpdatedAt || Date.now();
    } else if (preferLocal) {
      console.log('✅ Using local settings (newer than sync)');
      this.autoDeletePeriod = localAutoDeletePeriod;
      this.theme = localTheme === 'dark' ? 'dark' : 'light';
      this.quickPasteSettings = {
        autoHide: true,
        showTimestamps: true,
        maxClipsDisplay: 20,
        ...localQuickPasteSettings
      };
      if (this.quickPasteSettings && typeof this.quickPasteSettings === 'object') delete this.quickPasteSettings.theme;
      this.albumAttachmentOpenMode =
        localAlbumAttachmentOpenMode === 'overlay' || localAlbumAttachmentOpenMode === 'edgePopup'
          ? localAlbumAttachmentOpenMode
          : 'overlay';
      this.settingsUpdatedAt = localSettingsUpdatedAt || Date.now();
    } else if (cloudSettings) {
      console.log('✅ Using cloud settings from Supabase');
      this.autoDeletePeriod = cloudSettings.autoDeletePeriod || localAutoDeletePeriod;
      this.theme = (cloudSettings.theme || cloudSettings.quickPasteSettings?.theme || localTheme) === 'dark' ? 'dark' : 'light';
      this.quickPasteSettings = {
        autoHide: true,
        showTimestamps: true,
        maxClipsDisplay: 20,
        ...localQuickPasteSettings, // Local fallback for fields not in cloud
        ...cloudSettings.quickPasteSettings // Cloud takes precedence
      };
      if (this.quickPasteSettings && typeof this.quickPasteSettings === 'object') delete this.quickPasteSettings.theme;
      this.albumAttachmentOpenMode = cloudSettings.albumAttachmentOpenMode || localAlbumAttachmentOpenMode;
      this.settingsUpdatedAt = Date.now();
    } else {
      console.log('ℹ️ Using local settings (no cloud sync available)');
      this.autoDeletePeriod = localAutoDeletePeriod;
      this.theme = localTheme === 'dark' ? 'dark' : 'light';
      this.quickPasteSettings = {
        autoHide: true,
        showTimestamps: true,
        maxClipsDisplay: 20,
        ...localQuickPasteSettings
      };
      if (this.quickPasteSettings && typeof this.quickPasteSettings === 'object') delete this.quickPasteSettings.theme;
      this.albumAttachmentOpenMode =
        localAlbumAttachmentOpenMode === 'overlay' || localAlbumAttachmentOpenMode === 'edgePopup'
          ? localAlbumAttachmentOpenMode
          : 'overlay';
      this.settingsUpdatedAt = localSettingsUpdatedAt || Date.now();
    }

    // Dark mode is not released yet.
    if (this.darkModeComingSoon) {
      this.theme = 'light';
    }

    // Save merged settings back to local storage for offline access
    try {
      await chrome.storage.local.set({
        autoDeletePeriod: this.autoDeletePeriod,
        quickPasteSettings: this.quickPasteSettings,
        albumAttachmentOpenMode: this.albumAttachmentOpenMode,
        theme: this.theme,
        settingsUpdatedAt: this.settingsUpdatedAt || Math.max(localSettingsUpdatedAt, syncSettingsUpdatedAt) || Date.now()
      });
    } catch (_) {}

    this.syncThemeToggles();
  }

  async saveSettings(silent = false, skipPinAndAuth = false) {
    // Use CRUD utility for reliable settings update with 5 best practices
    const snapshot = {
      autoDeletePeriod: this.autoDeletePeriod,
      theme: this.theme,
      quickPasteSettings: PasteCraftCRUD.createSnapshot(this.quickPasteSettings),
      albumAttachmentOpenMode: this.albumAttachmentOpenMode
    };

    const rollback = async () => {
      try {
        this.autoDeletePeriod = snapshot.autoDeletePeriod;
        this.theme = snapshot.theme;
        this.quickPasteSettings = snapshot.quickPasteSettings;
        this.albumAttachmentOpenMode = snapshot.albumAttachmentOpenMode;
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({ 
            autoDeletePeriod: this.autoDeletePeriod,
            theme: this.theme,
            quickPasteSettings: this.quickPasteSettings,
            albumAttachmentOpenMode: this.albumAttachmentOpenMode
          });
        });
      } catch (rollbackError) {
        console.error('❌ Settings rollback failed:', rollbackError);
      }
    };

    try {
      // PRACTICE #1: VALIDATION - Get and validate settings from UI
      const newAutoDeletePeriod = document.getElementById('autoDeletePeriod')?.value;
      if (!newAutoDeletePeriod) {
        throw new Error('Invalid auto-delete period');
      }

      const darkModeEl = document.getElementById('darkModeToggle');
      const autoHideEl = document.getElementById('quickPasteAutoHidePopup');
      const showTimestampsEl = document.getElementById('quickPasteShowTimestampsPopup');
      const maxClipsEl = document.getElementById('quickPasteMaxClipsPopup');
      
      if (!darkModeEl || !autoHideEl || !showTimestampsEl || !maxClipsEl) {
        throw new Error('Settings UI elements not found');
      }

      // Update settings
      this.autoDeletePeriod = newAutoDeletePeriod;
      this.theme = darkModeEl.checked ? 'dark' : 'light';
      this.quickPasteSettings.autoHide = autoHideEl.checked;
      this.quickPasteSettings.showTimestamps = showTimestampsEl.checked;
      this.quickPasteSettings.maxClipsDisplay = parseInt(maxClipsEl.value) || 20;
      if (this.quickPasteSettings && typeof this.quickPasteSettings === 'object') delete this.quickPasteSettings.theme;

      const albumAttachmentOpenModeEl = document.getElementById('albumAttachmentOpenMode');
      this.albumAttachmentOpenMode =
        albumAttachmentOpenModeEl && (albumAttachmentOpenModeEl.value === 'overlay' || albumAttachmentOpenModeEl.value === 'edgePopup')
          ? albumAttachmentOpenModeEl.value
          : 'edgePopup';
      
      const settingsUpdatedAt = Date.now();
      this.settingsUpdatedAt = settingsUpdatedAt;
      // PRACTICE #3: RETRY LOGIC - Save to local storage with retry
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({ 
          autoDeletePeriod: this.autoDeletePeriod,
          theme: this.theme,
          quickPasteSettings: this.quickPasteSettings,
          albumAttachmentOpenMode: this.albumAttachmentOpenMode,
          settingsUpdatedAt
        });
      });
      // Also persist to chrome.storage.sync for cross-browser sync
      try {
        await new Promise((resolve) => chrome.storage.sync.set({
          autoDeletePeriod: this.autoDeletePeriod,
          theme: this.theme,
          quickPasteSettings: this.quickPasteSettings,
          albumAttachmentOpenMode: this.albumAttachmentOpenMode,
          settingsUpdatedAt
        }, resolve));
      } catch (_) {}

      // PRACTICE #5: VERIFICATION - Verify settings persisted
      const verification = await chrome.storage.local.get(['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode']);
      if (verification.autoDeletePeriod !== this.autoDeletePeriod ||
          verification.theme !== this.theme) {
        throw new Error('Verification failed: settings not persisted correctly');
      }
    
      // 🔄 AUTO-SYNC TO DATABASE (background, non-blocking)
      const settingsData = {
        autoDeletePeriod: this.autoDeletePeriod,
        theme: this.theme,
        quickPasteSettings: this.quickPasteSettings,
        albumAttachmentOpenMode: this.albumAttachmentOpenMode
      };
      
      pasteCraftSupabase.syncSettingsToSupabase(settingsData)
        .then(() => {
          console.log('✅ Settings synced to database');
          // Real-Time Sync: Broadcast settings change to other tabs/browsers via BroadcastChannel
          if (this._broadcastChannel) {
            try {
              this._broadcastChannel.postMessage({
                type: 'settingsUpdated',
                settings: settingsData,
                timestamp: Date.now()
              });
            } catch (broadcastError) {
              console.warn('⚠️ Failed to broadcast settings update:', broadcastError);
            }
          }
          
          if (!silent) this.showToast('✅ Settings saved and synced!');
        })
        .catch((error) => {
          console.error('⚠️ Failed to sync settings to database:', error);
          // Still broadcast locally saved settings for cross-tab sync
          if (this._broadcastChannel) {
            try {
              this._broadcastChannel.postMessage({
                type: 'settingsUpdated',
                settings: settingsData,
                timestamp: Date.now()
              });
            } catch (broadcastError) {
              console.warn('⚠️ Failed to broadcast settings update:', broadcastError);
            }
          }
          
          if (!silent) this.showToast('✅ Settings saved locally');
        });

    // PIN lock setting (do NOT sync to database) - skip during auto-save
    if (!skipPinAndAuth) {
      try {
        // Read desired state from checkboxes FIRST (before loadPinConfig overwrites _pinConfig)
        const browserScopeEl = document.getElementById('pinAskEachBrowserOpen');
        const unlimitedEl = document.getElementById('pinUnlimitedSession');
        const askBrowserRequested = browserScopeEl ? !!browserScopeEl.checked : false;
        const unlimitedRequested = unlimitedEl ? !!unlimitedEl.checked : false;
        const enableRequested = askBrowserRequested || unlimitedRequested;

        // Only load config to verify PIN hash exists (not to derive checkbox state)
        await this.loadPinConfig();

        if (enableRequested) {
          if (!this._pinConfig?.salt || !this._pinConfig?.hash) {
            // Need a code first - show modal
            if (!silent) {
              this.hideSettingsModal();
              this.showPinSetupModal({ title: 'Set 3-digit code' });
            }
          } else {
            // Ensure PIN is enabled first, then update unlimitedSession state
            if (!this._pinConfig.enabled) {
              await this.setPinEnabled(true);
            }
            
            // Update unlimitedSession to match checkbox state (uses user's requested value, not stale config)
            await this.setPinUnlimitedSession(unlimitedRequested);
          }
        } else {
          if (this._pinConfig?.enabled) {
            await this.setPinEnabled(false);
            await this._pinClearSessionUnlocked();
          }
        }

        // Re-read saved config and sync checkboxes to confirm persistence
        await this.loadPinConfig();
        const savedEnabled = !!this._pinConfig?.enabled;
        const savedUnlimited = savedEnabled && !!this._pinConfig?.unlimitedSession;
        if (browserScopeEl) {
          browserScopeEl.checked = savedEnabled && !savedUnlimited;
          browserScopeEl.disabled = !savedEnabled;
        }
        if (unlimitedEl) {
          unlimitedEl.checked = savedUnlimited;
          unlimitedEl.disabled = !savedEnabled;
        }
      } catch (error) {
        console.error('❌ PIN save failed:', error);
      }
    }

    // Auth preferences (local-only; can override login screen defaults) - skip during auto-save
    if (!skipPinAndAuth) {
      try {
        const stayEl = document.getElementById('staySignedInSetting');
        const rememberEl = document.getElementById('rememberEmailSetting');
        const nextStaySignedIn = stayEl ? !!stayEl.checked : true;
        const nextRememberEmail = rememberEl ? !!rememberEl.checked : false;

        const currentPrefs = await this.loadAuthPrefs();

        let rememberedEmail = currentPrefs.rememberedEmail || '';
        if (!nextRememberEmail) rememberedEmail = '';

        await this.saveAuthPrefs({
          staySignedIn: nextStaySignedIn,
          rememberEmail: nextRememberEmail,
          rememberedEmail
        });

        // If the user turns off "stay signed in", sign out immediately to enforce it.
        if (currentPrefs.staySignedIn !== false && nextStaySignedIn === false) {
          const ok = confirm('This will sign you out and require login next time. Continue?');
          if (ok) {
            try { await pasteCraftSupabase.signOutFast(); } catch (_) {}
            try { await chrome.storage.local.remove(['pc_supabase_session_v1']); } catch (_) {}
            window.location.reload();
            return;
          } else {
            // Revert UI checkbox if user cancels.
            try { if (stayEl) stayEl.checked = true; } catch (_) {}
            await this.saveAuthPrefs({ staySignedIn: true });
          }
        }
      } catch (_) {}
    }
    
      // Show feedback and close modal only if not silent
      if (!silent) {
        this.showToast('✅ Settings saved!');
        this.hideSettingsModal();
      }
      
      // Update UI immediately
      this.renderChips();
      this.updateCategoryFilter();

      // Run cleanup after changing settings (deferred, non-blocking)
      this.cleanupOldClips().catch(() => {});
      
      // Notify content scripts about settings change (non-blocking)
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'settingsUpdated',
              settings: { ...this.quickPasteSettings, theme: this.theme }
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
      } catch (error) {
        console.log('Could not notify content scripts about settings:', error);
      }
    } catch (error) {
      // Rollback on any failure
      console.error('❌ Settings save failed, rolling back:', error);
      await rollback();
      if (!silent) {
        this.showToast(`❌ Failed to save settings: ${error.message || 'Unknown error'}`, 'error');
      }
    }
  }

  syncThemeToggles() {
    this._themeSyncing = true;
    try {
      const settingsToggle = document.getElementById('darkModeToggle');
      const profileToggle = document.getElementById('profileDarkModeToggle');
      const isDark = this.theme === 'dark';
      if (settingsToggle) {
        settingsToggle.checked = isDark;
      }
      if (profileToggle) {
        profileToggle.checked = isDark;
      }
    } finally {
      this._themeSyncing = false;
    }
  }

  async saveThemeOnly(nextTheme, silent = false) {
    // Theme-only save to avoid overwriting other settings with stale UI values.
    const normalized = nextTheme === 'dark' ? 'dark' : 'light';
    const prev = this.theme;
    this.theme = normalized;
    this.syncThemeToggles();

    try {
      const settingsUpdatedAt = Date.now();
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({ theme: this.theme, settingsUpdatedAt });
      });
      try {
        await new Promise((resolve) => chrome.storage.sync.set({ theme: this.theme, settingsUpdatedAt }, resolve));
      } catch (_) {}

      const verification = await chrome.storage.local.get(['theme']);
      if (verification.theme !== this.theme) {
        throw new Error('Verification failed: theme not persisted correctly');
      }

      // Best-effort cloud sync
      const settingsData = {
        autoDeletePeriod: this.autoDeletePeriod,
        theme: this.theme,
        quickPasteSettings: this.quickPasteSettings,
        albumAttachmentOpenMode: this.albumAttachmentOpenMode
      };
      pasteCraftSupabase.syncSettingsToSupabase(settingsData).catch(() => {});

      // Nudge content scripts (Quick Paste reads theme too)
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'settingsUpdated',
              settings: { theme: this.theme }
            }).catch(() => {});
          });
        });
      } catch (_) {}

      if (!silent) this.showToast('✅ Theme updated!', 'success');
      return true;
    } catch (e) {
      this.theme = prev;
      this.syncThemeToggles();
      if (!silent) this.showToast(`❌ Theme update failed: ${e.message}`, 'error');
      return false;
    }
  }

  async getCurrentProfileImageForWidget() {
    // Prefer stable URL; allow small data:image as fallback.
    try {
      if (!this.userProfile) {
        const res = await chrome.storage.local.get(['userProfile']);
        this.userProfile = res ? res.userProfile : null;
      }
    } catch (_) {}

    const url = typeof this.userProfile?.profileImageUrl === 'string' ? this.userProfile.profileImageUrl : '';
    if (url) return url;

    const b64 = typeof this.userProfile?.profileImageBase64 === 'string' ? this.userProfile.profileImageBase64 : '';
    if (b64 && b64.startsWith('data:image/') && b64.length <= 250000) return b64;
    return '';
  }

  async saveWidgetIconUseProfileImage(enabled, silent = false) {
    // Persist into widgetSettings so content-script widget can react instantly.
    const snapshot = await chrome.storage.local.get(['widgetSettings']);
    const prev = snapshot && snapshot.widgetSettings && typeof snapshot.widgetSettings === 'object' ? snapshot.widgetSettings : {};

    const rollback = async () => {
      try {
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({ widgetSettings: prev });
        });
      } catch (e) {
        console.error('❌ Widget icon rollback failed:', e);
      }
    };

    try {
      // PRACTICE #1: VALIDATION
      const nextEnabled = !!enabled;

      // PRACTICE #2: SAFE DEFAULTS
      const next = { ...prev, widgetIconUseProfileImage: nextEnabled };

      // PRACTICE #3: RETRY LOGIC
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({ widgetSettings: next, pc_local_updatedAt: Date.now() });
      });

      // Best-effort: persist to sync as well (cross-device)
      try {
        await new Promise((resolve) => chrome.storage.sync.set({ widgetSettings: next }, resolve));
      } catch (_) {}

      // PRACTICE #5: VERIFICATION
      const verification = await chrome.storage.local.get(['widgetSettings']);
      const ok = !!verification.widgetSettings && verification.widgetSettings.widgetIconUseProfileImage === nextEnabled;
      if (!ok) throw new Error('Verification failed: widget icon preference not persisted');

      // Notify content scripts immediately (non-blocking)
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'widgetSettingsUpdated',
              widgetSettings: { widgetIconUseProfileImage: nextEnabled }
            }).catch(() => {});
          });
        });
      } catch (_) {}

      if (!silent) this.showToast('✅ Widget icon preference saved');
      return true;
    } catch (e) {
      console.error('❌ Failed to save widget icon preference:', e);
      await rollback();
      if (!silent) this.showToast(`❌ Failed to save: ${e.message || 'Unknown error'}`, 'error');
      return false;
    }
  }

  async showSettingsModal() {
    const startTime = Date.now();
    // OPTIMIZATION: Show modal immediately with cached values, then update in background
    // This prevents the delay users experience when clicking Settings
    
    // Update storage statistics
    this.updateStorageStats();
    
    // Set current auto-delete period (use cached values)
    document.getElementById('autoDeletePeriod').value = this.autoDeletePeriod || 'never';

    // Theme toggle (single source of truth)
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      if (this.darkModeComingSoon) {
        darkModeToggle.checked = false;
        darkModeToggle.disabled = true;
      } else {
        darkModeToggle.disabled = false;
        darkModeToggle.checked = this.theme === 'dark';
      }
    }
    
    // Set current quick paste settings (use cached values)
    document.getElementById('quickPasteAutoHidePopup').checked = this.quickPasteSettings?.autoHide !== false;
    document.getElementById('quickPasteShowTimestampsPopup').checked = this.quickPasteSettings?.showTimestamps !== false;
    document.getElementById('quickPasteMaxClipsPopup').value = this.quickPasteSettings?.maxClipsDisplay || 20;

    const albumAttachmentOpenModeEl = document.getElementById('albumAttachmentOpenMode');
    if (albumAttachmentOpenModeEl) albumAttachmentOpenModeEl.value = this.albumAttachmentOpenMode || 'edgePopup';

    // PIN lock UI - Refresh config from storage before reflecting checkbox state
    try {
      await this.loadPinConfig();
      const enabled = !!this._pinConfig?.enabled;
      const isUnlimited = enabled && !!this._pinConfig?.unlimitedSession;
      
      const browserScopeEl = document.getElementById('pinAskEachBrowserOpen');
      const unlimitedToggle = document.getElementById('pinUnlimitedSession');
      
      if (browserScopeEl) {
        browserScopeEl.checked = enabled && !isUnlimited;
        browserScopeEl.disabled = !enabled;
      }
      if (unlimitedToggle) {
        unlimitedToggle.checked = isUnlimited;
        unlimitedToggle.disabled = !enabled;
      }

      const disableBtn = document.getElementById('disablePinBtn');
      if (disableBtn) disableBtn.disabled = !enabled;
    } catch (_) {}

    // Auth prefs UI
    Promise.resolve().then(() => this.applyAuthPrefsToUi()).catch(() => {});

    // Restore UI (preview + button state)
    try {
      const restoreWindowSelect = document.getElementById('restoreWindowSelect');
      if (restoreWindowSelect && !restoreWindowSelect.value) restoreWindowSelect.value = '1week';

      const previewEl = document.getElementById('restorePreviewText');
      if (previewEl) previewEl.textContent = 'Select a window to preview what will be restored.';

      const syncBtn = document.getElementById('syncRestoredToCloudBtn');
      if (syncBtn) syncBtn.disabled = !(this._lastAppliedRestore && this._lastAppliedRestore.point);

      // Best-effort initial preview (keeps UI informative)
      const key = restoreWindowSelect ? restoreWindowSelect.value : '1week';
      Promise.resolve().then(() => this.previewRestore(key)).catch(() => {});
    } catch (_) {}
    
    // Show modal immediately
    document.getElementById('settingsModal').style.display = 'flex';
    
    const modalShownTime = Date.now();

    // Load fresh settings in background and update UI when ready (non-blocking)
    Promise.all([
      this.loadSettings().catch(() => {}),
      this.loadPinConfig().catch(() => {})
    ]).then(() => {
      const loadCompleteTime = Date.now();

      // Update UI with fresh values
      document.getElementById('autoDeletePeriod').value = this.autoDeletePeriod || 'never';
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) darkModeToggle.checked = this.theme === 'dark';
      document.getElementById('quickPasteAutoHidePopup').checked = this.quickPasteSettings?.autoHide !== false;
      document.getElementById('quickPasteShowTimestampsPopup').checked = this.quickPasteSettings?.showTimestamps !== false;
      document.getElementById('quickPasteMaxClipsPopup').value = this.quickPasteSettings?.maxClipsDisplay || 20;
      
      if (albumAttachmentOpenModeEl) albumAttachmentOpenModeEl.value = this.albumAttachmentOpenMode || 'edgePopup';

      // NOTE: PIN checkboxes are NOT refreshed here. The initial blocking
      // loadPinConfig() above already set them correctly. Re-setting them in
      // this background callback would overwrite any user interaction that
      // occurred between modal-show and this callback firing (race condition).
    }).catch(() => {});
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }
  
  showHelpModal() {
    console.log('🔍 Help modal requested');
    document.getElementById('helpModal').style.display = 'flex';
    console.log('✅ Help modal shown');
  }
  
  hideHelpModal() {
    console.log('🙈 Help modal hidden');
    document.getElementById('helpModal').style.display = 'none';
  }
  

  updateStorageStats() {
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const totalClips = allClips.length;
    const categorizedClips = allClips.filter(clip => clip.category !== 'Uncategorized').length;
    const uncategorizedClips = totalClips - categorizedClips;

    document.getElementById('totalClipsCount').textContent = `${totalClips} (${this.clips.length} active, ${this.searchOnlyClips.length} archived)`;
    document.getElementById('categorizedClipsCount').textContent = categorizedClips;
    document.getElementById('uncategorizedClipsCount').textContent = uncategorizedClips;
  }

  // Auto-Delete Functions
  async cleanupOldClips() {
    if (this.autoDeletePeriod === 'never') return;

    const cutoffTime = this.getCutoffTime(this.autoDeletePeriod);
    const toDelete = (Array.isArray(this.clips) ? this.clips : [])
      .filter(clip => clip?.category === 'Uncategorized' && clip.timestamp < cutoffTime)
      .map(clip => this._clipIdKey(clip?.id))
      .filter(Boolean);

    if (toDelete.length > 0) {
      await this.deleteClipsByIdKeys(toDelete, {
        includeArchived: false,
        reason: 'auto-delete:uncategorized',
        clearSelection: false,
        rerender: true
      });
      console.log(`🗑️ Auto-deleted ${toDelete.length} old uncategorized clips`);
    }
  }

  getCutoffTime(period) {
    const now = Date.now();
    const periods = {
      '1day': 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1month': 30 * 24 * 60 * 60 * 1000,
      '3months': 90 * 24 * 60 * 60 * 1000,
      '6months': 180 * 24 * 60 * 60 * 1000,
      '1year': 365 * 24 * 60 * 60 * 1000
    };
    
    return now - (periods[period] || 0);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    if (clips.length === 0) {
      return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
    }

    return clips.map(clip => {
      const truncatedText = clip.text.length > 60 ? clip.text.substring(0, 60) + '...' : clip.text;
      const timeAgo = this.getTimeAgo(clip.timestamp);
      const isSelected = this.selectedCategoryClips.has(this._clipIdKey(clip.id));
      const cMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
      const cBadge = (typeof PCMarkup !== 'undefined') ? PCMarkup.getMarkupBadgeForClip(clip.text, cMeta) : '';
      const cPreview = (typeof PCMarkup !== 'undefined') ? PCMarkup.renderMarkupPreview(clip.text, cMeta, 120) : '';
      const catTextContent = cPreview
        ? `<div class="pc-cat-preview">${cPreview}</div>`
        : this.escapeHtml(truncatedText);
      
      const html = `
        <div class="category-clip ${isSelected ? 'selected' : ''}" data-clip-id="${clip.id}">
          <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''}>
          <div class="category-clip-content">
            <div class="category-clip-text">${cBadge}${catTextContent}</div>
            <div class="category-clip-time">${timeAgo}</div>
          </div>
          <div class="category-clip-actions">
            <button class="category-clip-breakdown-btn" data-clip-id="${clip.id}" title="AI Breakdown">🧠</button>
            <button class="category-clip-open-btn" data-clip-id="${clip.id}" title="Open">🔎</button>
            <button class="category-clip-share-btn" data-clip-id="${clip.id}" title="Share">🔗</button>
            <button class="category-clip-summary-btn" data-clip-id="${clip.id}" title="AI Summary">📝</button>
            <button class="category-clip-notes-btn" data-clip-id="${clip.id}" title="Send to Notes">
              <img src="assets/note-icons/sendcreate Album.svg" alt="" class="pc-icon pc-icon-16">
            </button>
            <button class="category-clip-copy-btn" data-clip-id="${clip.id}" title="Copy">📋</button>
          </div>
        </div>
      `;
      console.log(`🏗️ Creating category clip with ID: ${clip.id} (type: ${typeof clip.id})`);
      return html;
    }).join('');
  }

  toggleCategoryDropdown(categoryItem, category) {
    const dropdown = categoryItem.querySelector('.category-dropdown');
    const isExpanded = categoryItem.classList.contains('expanded');
    
    // Close all other dropdowns
    document.querySelectorAll('.category-item.expanded').forEach(item => {
      if (item !== categoryItem) {
        item.classList.remove('expanded');
        item.querySelector('.category-dropdown').classList.remove('expanded');
      }
    });
    
    if (isExpanded) {
      // Collapse this dropdown
      categoryItem.classList.remove('expanded');
      dropdown.classList.remove('expanded');
    } else {
      // Expand this dropdown
      categoryItem.classList.add('expanded');
      dropdown.classList.add('expanded');
      
      // Add click handlers to clips in dropdown
      this.attachClipHandlers(dropdown, category);
    }
  }

  attachClipHandlers(dropdown, category) {
    const clips = dropdown.querySelectorAll('.category-clip');
    clips.forEach(clipElement => {
      const clipId = this._clipIdKey(clipElement.dataset.clipId);
      
      // Handle checkbox
      const checkbox = clipElement.querySelector('.category-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCategoryClip(clipId, clipElement);
        });
      }
      
      // Handle breakdown button
      const breakdownBtn = clipElement.querySelector('.category-clip-breakdown-btn');
      if (breakdownBtn) {
        breakdownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip) {
            const textToSend = this.getSelectedOrCurrentText(clip.text, 'categories');
            this.showBreakdownModal(textToSend);
          }
        });
      }

      // Handle open/view button
      const openBtn = clipElement.querySelector('.category-clip-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip && typeof this.openClipViewer === 'function') {
            this.openClipViewer(clip);
          }
        });
      }

      // Handle share button
      const shareBtn = clipElement.querySelector('.category-clip-share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip) {
            this.showShareMenuForClip(clip);
          }
        });
      }
      
      // Handle summary button
      const summaryBtn = clipElement.querySelector('.category-clip-summary-btn');
      if (summaryBtn) {
        summaryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip) {
            const textToSend = this.getSelectedOrCurrentText(clip.text, 'categories');
            this.showSummaryModal(textToSend);
          }
        });
      }

      // Handle send to notes button
      const notesBtn = clipElement.querySelector('.category-clip-notes-btn');
      if (notesBtn) {
        notesBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip) {
            // Load notes and show album picker
            await this.loadNotes();
            this.showAlbumPicker();
            // Store the clip to be added
            this.pendingClipForNotes = clip;
          }
        });
      }

      // Handle copy button
      const copyBtn = clipElement.querySelector('.category-clip-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => this._clipIdKey(c?.id) === clipId);
          if (clip) {
            this.copyClipToClipboard(clip.text);
          }
        });
      }

      // Handle clip selection (clicking on clip itself, not buttons or checkbox)
      clipElement.addEventListener('click', (e) => {
        // Only toggle selection if not clicking on buttons or checkbox
        if (!e.target.closest('.category-clip-actions') && !e.target.classList.contains('category-checkbox')) {
          e.stopPropagation();
          this.toggleCategoryClip(clipId, clipElement);
        }
      });
    });
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

  updatePreviewFromSelection() {
    console.log('🔄 Updating preview from selection:', this.selectedCategoryClips?.size || 0, 'clips selected');
    
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) {
      // Don't wipe user edits when nothing is selected
      if (!this.previewIsManual && this.previewLastAutoValue) {
        document.getElementById('previewArea').value = '';
        this.previewLastAutoValue = '';
      }
      console.log('📄 Preview cleared - no clips selected');
      this.updateCategoryBulkActions();
      return;
    }

    // Get selected clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    console.log('🔍 All clips available:', allClips.map(c => ({id: c.id, text: c.text.substring(0, 20)})));
    console.log('🎯 Selected clip IDs:', Array.from(this.selectedCategoryClips));

    // Preserve CURRENT UI ORDER (DOM order in expanded category dropdowns)
    const orderedSelectedIds = this.getSelectedCategoryClipIdsInUiOrder();
    const selectedClips = orderedSelectedIds
      .map((clipId) => {
        const found = allClips.find(clip => clip.id === clipId);
        console.log(`🔎 Looking for clip ${clipId} (${typeof clipId}), found:`, found ? found.text.substring(0, 20) : 'NOT FOUND');
        return found;
      })
      .filter(Boolean);

    console.log('📋 Found selected clips:', selectedClips.length);

    // Apply formatting
    let processedTexts = selectedClips.map(clip => clip.text);
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
      console.log('🔄 Applied deduplication');
    }
    
    if (this.options.sort) {
      processedTexts.sort();
      console.log('⬆️ Applied sorting');
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(text => text.toUpperCase());
      console.log('🔤 Applied uppercase');
    }

    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const delimiter = delimiters[this.delimiter] || delimiters.comma;
    const formattedText = processedTexts.join(delimiter);
    
    document.getElementById('previewArea').value = formattedText;
    this.previewIsManual = false;
    this.previewLastAutoValue = formattedText;
    console.log('✅ Preview updated with formatted text:', formattedText.substring(0, 50) + '...');
    this.updateCategoryBulkActions();
  }

  getSelectedCategoryClipIdsInUiOrder() {
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) return [];

    const selected = this.selectedCategoryClips;
    const ordered = [];

    // Prefer DOM order of expanded dropdowns (true UI order)
    const domClips = document.querySelectorAll('.category-item.expanded .category-clip');
    if (domClips && domClips.length > 0) {
      domClips.forEach(el => {
        const id = this._clipIdKey(el.dataset.clipId);
        if (selected.has(id)) ordered.push(id);
      });
    }

    // Fallback: stable data order from storage if DOM not available
    if (ordered.length === 0) {
      const allClips = [...this.clips, ...this.searchOnlyClips];
      allClips.forEach(c => {
        const id = this._clipIdKey(c?.id);
        if (selected.has(id)) ordered.push(id);
      });
    }

    return ordered;
  }

  updateCategoryBulkActions() {
    const bar = document.getElementById('categoryBulkActions');
    const countEl = document.getElementById('categoryBulkCount');
    if (!bar || !countEl) return;

    const count = this.selectedCategoryClips ? this.selectedCategoryClips.size : 0;

    if (this.currentTab === 'categories' && count > 0) {
      bar.style.display = 'flex';
      countEl.textContent = `${count} selected`;
    } else {
      bar.style.display = 'none';
      countEl.textContent = '';
      const copyBtn = document.getElementById('categoryBulkCopyBtn');
      if (copyBtn) copyBtn.classList.remove('success');
    }
  }

  async handleCategoryBulkCopy() {
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) return;

    // Ensure preview matches selection + UI order + delimiter/options
    this.updatePreviewFromSelection();
    const previewArea = document.getElementById('previewArea');
    const textToCopy = previewArea ? previewArea.value : '';
    if (!textToCopy) return;

    const copyBtn = document.getElementById('categoryBulkCopyBtn');
    const originalText = copyBtn ? copyBtn.textContent : 'copy';

    try {
      await this.copyToClipboardFallback(textToCopy);
      if (copyBtn) {
        copyBtn.textContent = 'copied ✓';
        copyBtn.classList.add('success');
      }
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('success');
        }
      }, 1400);
    } catch (error) {
      console.error('❌ Category bulk copy failed:', error);
      if (copyBtn) {
        copyBtn.textContent = 'failed';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1400);
      }
    }
  }

  async handleCategoryBulkDelete() {
    const count = this.selectedCategoryClips ? this.selectedCategoryClips.size : 0;
    if (count === 0) return;

    if (!confirm(`Delete ${count} selected clip${count === 1 ? '' : 's'}?`)) return;

    const ids = Array.from(this.selectedCategoryClips || []).map(id => this._clipIdKey(id));
    const result = await this.deleteClipsByIdKeys(ids, {
      includeArchived: true,
      reason: 'delete:handleCategoryBulkDelete',
      closeCategoryModal: false,
      clearSelection: true,
      rerender: true
    });

    const previewArea = document.getElementById('previewArea');
    if (previewArea) previewArea.value = '';
    this.previewIsManual = false;
    this.previewLastAutoValue = '';

    this.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
  }

  getSelectedSearchClipIdsInUiOrder() {
    if (!this.selectedSearchClips || this.selectedSearchClips.size === 0) return [];

    const selected = this.selectedSearchClips;
    const ordered = [];

    // UI order = DOM order of current search results
    const domItems = document.querySelectorAll('#searchResults .search-result-item');
    if (domItems && domItems.length > 0) {
      domItems.forEach(el => {
        const id = this._clipIdKey(el.dataset.clipId);
        if (selected.has(id)) ordered.push(id);
      });
    }

    // Fallback: storage order
    if (ordered.length === 0) {
      const allClips = [...this.clips, ...this.searchOnlyClips];
      allClips.forEach(c => {
        const id = this._clipIdKey(c?.id);
        if (selected.has(id)) ordered.push(id);
      });
    }

    return ordered;
  }

  updatePreviewFromSearchSelection() {
    if (!this.selectedSearchClips || this.selectedSearchClips.size === 0) return;

    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;

    const allClips = [...this.clips, ...this.searchOnlyClips];
    const orderedIds = this.getSelectedSearchClipIdsInUiOrder();
    const selectedClips = orderedIds.map(id => allClips.find(c => this._clipIdKey(c?.id) === this._clipIdKey(id))).filter(Boolean);

    if (selectedClips.length === 0) return;

    let processedTexts = selectedClips.map(c => c.text);

    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    if (this.options.sort) {
      processedTexts.sort();
    }
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }

    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    const delimiter = delimiters[this.delimiter] || delimiters.comma;
    const formattedText = processedTexts.join(delimiter);

    previewArea.value = formattedText;
    this.previewIsManual = false;
    this.previewLastAutoValue = formattedText;
  }

  updateSearchBulkActions() {
    const bar = document.getElementById('searchBulkActions');
    const countEl = document.getElementById('searchBulkCount');
    if (!bar || !countEl) return;

    const visibleSelectedCount = this.getSelectedSearchClipIdsInUiOrder().length;

    if (this.currentTab === 'search' && visibleSelectedCount > 1) {
      bar.style.display = 'flex';
      countEl.textContent = `${visibleSelectedCount} selected`;
    } else {
      bar.style.display = 'none';
      countEl.textContent = '';
      const copyBtn = document.getElementById('searchBulkCopyBtn');
      if (copyBtn) copyBtn.classList.remove('success');
    }
  }

  async handleSearchBulkCopy() {
    const orderedIds = this.getSelectedSearchClipIdsInUiOrder();
    if (orderedIds.length <= 1) return; // only show/copy for 2+

    // Ensure preview matches current selection + options + delimiter
    this.updatePreviewFromSearchSelection();
    const previewArea = document.getElementById('previewArea');
    const textToCopy = previewArea ? previewArea.value : '';
    if (!textToCopy) return;

    const copyBtn = document.getElementById('searchBulkCopyBtn');
    const originalText = copyBtn ? copyBtn.textContent : 'copy';

    try {
      await this.copyToClipboardFallback(textToCopy);
      if (copyBtn) {
        copyBtn.textContent = 'copied ✓';
        copyBtn.classList.add('success');
      }
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('success');
        }
      }, 1400);
    } catch (error) {
      console.error('❌ Search bulk copy failed:', error);
      if (copyBtn) {
        copyBtn.textContent = 'failed';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1400);
      }
    }
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
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('req-length', hasLength);
    this.updateRequirement('req-number', hasNumber);
    this.updateRequirement('req-special', hasSpecial);
    
    // Calculate strength
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    
    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (hasNumber) strength += 12.5;
    if (hasSpecial) strength += 12.5;
    
    strengthBar.style.width = `${strength}%`;
    
    // Color based on strength
    if (strength < 40) {
      strengthBar.style.background = '#EF4444'; // Red
    } else if (strength < 70) {
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

  // Validate password meets all requirements
  validatePassword(password) {
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return hasLength && hasNumber && hasSpecial;
  }

  // Update password strength for new password form
  updateNewPasswordStrength(password) {
    const strengthBar = document.querySelector('#newPasswordStrength .strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('new-req-length', hasLength);
    this.updateRequirement('new-req-number', hasNumber);
    this.updateRequirement('new-req-special', hasSpecial);
    
    // Calculate strength
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (hasNumber) strength += 12.5;
    if (hasSpecial) strength += 12.5;
    
    strengthBar.style.width = `${strength}%`;
    
    if (strength < 40) {
      strengthBar.style.background = '#EF4444';
    } else if (strength < 70) {
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
          <div class="ai-empty-icon">🎨</div>
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
      return `
      <div class="ai-gallery-item ${isCurrentProfile ? 'is-profile' : ''}" data-index="${actualIndex}">
        <img src="${item.url}" alt="AI Generated ${actualIndex + 1}" />
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
      // Show FULL text, not truncated - let CSS handle scrolling
      breakdownOriginalText.textContent = text;
      
      if (breakdownTextLength) {
        const wordCount = text.trim().split(/\s+/).length;
        breakdownTextLength.textContent = `${wordCount} words`;
      }
      
      // Store the full text for analysis
      this.currentBreakdownText = text;
      
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

    // Detect markup type
    const markupType = (typeof PCMarkup !== 'undefined') ? PCMarkup.detectMarkupType(text, meta) : 'text';

    titleEl.textContent = meta && meta.kind === 'image'
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
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom: 12px;">
          <div style="font-weight:700; color:#111827;">Link</div>
          <a data-pc-open-url="1" href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
        </div>
      `);
    }

    // Image section
    const isRenderableImageSrc = imgSrc && (
      imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'));

    if (imgSrc && !isRenderableImageSrc) {
      headerParts.push(`<div style="margin-bottom:10px; color:#6b7280; font-size:12px;">Image preview unavailable (non-renderable source).</div>`);
    } else if (imgSrc && isRenderableImageSrc) {
      headerParts.push(`<img src="${this.escapeHtml(imgSrc)}" alt="Clip image" />`);
      if (meta && meta.image && meta.image.tooLarge) {
        headerParts.push(`<div style="margin-top:10px; color:#6b7280; font-size:12px;">Image payload too large to embed; showing what's available.</div>`);
      }
      if (meta && meta.image && meta.image.exportFailed) {
        headerParts.push(`<div style="margin-top:10px; color:#6b7280; font-size:12px;">Image export blocked by the page (canvas/security restrictions).</div>`);
      }
    }

    // Render markup content
    const hasMarkup = markupType !== 'text' && typeof PCMarkup !== 'undefined';

    if (renderedEl) {
      if (hasMarkup) {
        const rendered = PCMarkup.renderMarkup(text, meta, { type: markupType });
        if (rendered && typeof rendered.then === 'function') {
          renderedEl.innerHTML = headerParts.join('') + '<div style="color:#9ca3af;font-size:12px;">Rendering diagram...</div>';
          rendered.then(rHtml => { renderedEl.innerHTML = headerParts.join('') + rHtml; })
            .catch(() => { renderedEl.innerHTML = headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`; });
        } else {
          renderedEl.innerHTML = headerParts.join('') + rendered;
        }
        renderedEl.style.display = 'block';
      } else {
        renderedEl.innerHTML = headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`;
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
    // Show the breakdown modal with pre-selected level
    this.showBreakdownModal(text);
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
            await this.loadNotes();
            this.renderNotes();
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

  /** Load AI history entries from chrome.storage.local */
  async loadAiHistory() {
    try {
      const { pc_aiHistory_v1 = [] } = await chrome.storage.local.get(['pc_aiHistory_v1']);
      this.aiHistoryEntries = pc_aiHistory_v1;
      return pc_aiHistory_v1;
    } catch (_) {
      this.aiHistoryEntries = [];
      return [];
    }
  }

  /** Persist AI history entries to chrome.storage.local */
  async _persistAiHistory() {
    try {
      // Keep max 50 entries
      if (this.aiHistoryEntries.length > 50) {
        this.aiHistoryEntries.splice(50);
      }
      await chrome.storage.local.set({ pc_aiHistory_v1: this.aiHistoryEntries });
    } catch (_) {}
  }

  /**
   * Save or update an AI conversation in history.
   * Creates new entry on first call, updates existing on follow-ups.
   */
  async saveAiHistory(type, originalText, threads) {
    try {
      if (!threads || threads.length === 0) {
        console.warn('saveAiHistory: no threads to save');
        return;
      }

      await this.loadAiHistory();

      // Use separate active IDs for breakdown vs summary
      const activeId = type === 'breakdown' ? this._activeBreakdownHistoryId : this._activeSummaryHistoryId;

      // Check if we should update an existing entry (active conversation)
      if (activeId) {
        const idx = this.aiHistoryEntries.findIndex(e => e.id === activeId);
        if (idx !== -1) {
          // Update existing entry with latest threads
          this.aiHistoryEntries[idx].threads = threads.map(t => ({
            question: t.question || '',
            answer: t.answer || '',
            level: t.level || null,
            timestamp: t.timestamp || Date.now()
          }));
          this.aiHistoryEntries[idx].updatedAt = Date.now();
          await this._persistAiHistory();
          console.log('📜 AI History updated:', activeId, 'threads:', threads.length);
          return this.aiHistoryEntries[idx];
        }
      }

      // Create new entry with placeholder title
      const placeholderTitle = (originalText || '').substring(0, 40).replace(/\n/g, ' ').trim() || 'Untitled';
      const entry = {
        id: Date.now(),
        type,
        title: placeholderTitle + '...',
        originalText: (originalText || '').substring(0, 2000),
        threads: threads.map(t => ({
          question: t.question || '',
          answer: t.answer || '',
          level: t.level || null,
          timestamp: t.timestamp || Date.now()
        })),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Add to front of list
      this.aiHistoryEntries.unshift(entry);

      // Track active conversation per type
      if (type === 'breakdown') {
        this._activeBreakdownHistoryId = entry.id;
      } else {
        this._activeSummaryHistoryId = entry.id;
      }

      await this._persistAiHistory();
      console.log('📜 AI History saved new entry:', entry.id, type, 'threads:', threads.length);

      // Fire async AI title generation (non-blocking)
      this._generateAiHistoryTitle(entry.id, originalText);

      return entry;
    } catch (err) {
      console.error('saveAiHistory failed:', err);
    }
  }

  /** Async: generate an AI title for a history entry */
  async _generateAiHistoryTitle(entryId, originalText) {
    try {
      const snippet = (originalText || '').substring(0, 300);
      const title = await pasteCraftSupabase.generateSummary(
        snippet,
        'Generate a concise 3-5 word title for this text. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.'
      );
      if (title && typeof title === 'string' && title.trim()) {
        const cleanTitle = title.trim().replace(/^["']|["']$/g, '').substring(0, 60);
        // Update the entry in the array
        const idx = this.aiHistoryEntries.findIndex(e => e.id === entryId);
        if (idx !== -1) {
          this.aiHistoryEntries[idx].title = cleanTitle;
          await this._persistAiHistory();
          // Re-render list if the AI History tab is active
          if (this.currentTab === 'aiHistory') {
            this.renderAiHistoryList();
          }
        }
      }
    } catch (err) {
      console.warn('AI history title generation failed:', err);
    }
  }

  /** Render the AI History list in the tab */
  renderAiHistoryList() {
    const container = document.getElementById('aiHistoryList');
    if (!container) return;

    let entries = this.aiHistoryEntries || [];

    // Apply type filter
    const filterType = this._aiHistoryFilterType || 'all';
    if (filterType !== 'all') {
      entries = entries.filter(e => e.type === filterType);
    }

    // Apply search query
    const query = (this._aiHistorySearchQuery || '').toLowerCase();
    if (query) {
      entries = entries.filter(e => {
        const title = (e.title || '').toLowerCase();
        const text = (e.originalText || '').toLowerCase();
        const answers = (e.threads || []).map(t => (t.answer || '').toLowerCase()).join(' ');
        return title.includes(query) || text.includes(query) || answers.includes(query);
      });
    }

    if (!entries || entries.length === 0) {
      const msg = query ? 'No results match your search' : 'Your AI Summary and Breakdown conversations will appear here';
      const heading = query ? 'No matches' : 'No history yet';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📜</div>
          <h3>${heading}</h3>
          <p>${msg}</p>
        </div>`;
      return;
    }

    container.innerHTML = entries.map(entry => {
      const icon = entry.type === 'breakdown' ? '🧠' : '📝';
      const badgeClass = entry.type === 'breakdown' ? 'breakdown' : 'summary';
      const badgeLabel = entry.type === 'breakdown' ? 'Breakdown' : 'Summary';
      const threadCount = (entry.threads || []).length;
      const timeStr = this.getTimeAgo ? this.getTimeAgo(entry.createdAt) : new Date(entry.createdAt).toLocaleDateString();

      return `
        <div class="ai-history-entry" data-history-id="${entry.id}">
          <span class="ai-history-entry-icon">${icon}</span>
          <div class="ai-history-entry-info">
            <div class="ai-history-entry-title">${this.escapeHtml ? this.escapeHtml(entry.title || 'Untitled') : (entry.title || 'Untitled')}</div>
            <div class="ai-history-entry-meta">${timeStr} &middot; ${threadCount} response${threadCount !== 1 ? 's' : ''}</div>
          </div>
          <span class="ai-history-entry-badge ${badgeClass}">${badgeLabel}</span>
          <button class="ai-history-entry-delete" data-delete-id="${entry.id}" title="Delete">🗑️</button>
        </div>`;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.ai-history-entry').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't open modal if delete button clicked
        if (e.target.closest('.ai-history-entry-delete')) return;
        const id = parseInt(el.dataset.historyId);
        const entry = this.aiHistoryEntries.find(e => e.id === id);
        if (entry) this.openAiHistoryModal(entry);
      });
    });

    // Attach delete handlers
    container.querySelectorAll('.ai-history-entry-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.deleteId);
        this.aiHistoryEntries = this.aiHistoryEntries.filter(e => e.id !== id);
        await this._persistAiHistory();
        this.renderAiHistoryList();
        this.showToast('History entry deleted');
      });
    });
  }

  /** Open the AI History viewer modal for a specific entry */
  async openAiHistoryModal(entry) {
    if (!entry) return;
    this.currentHistoryEntry = entry;
    this.currentHistoryThreadIndex = 0;

    const modal = document.getElementById('aiHistoryModal');
    const titleEl = document.getElementById('aiHistoryModalTitle');
    const subtitleEl = document.getElementById('aiHistoryModalSubtitle');
    const resultEl = document.getElementById('aiHistoryResultContent');
    const paginationEl = document.getElementById('aiHistoryThreadPagination');

    if (!modal) return;

    // Reset edit title state
    this._cancelEditHistoryTitle();

    // Set title and subtitle
    const typeIcon = entry.type === 'breakdown' ? '🧠' : '📝';
    const typeLabel = entry.type === 'breakdown' ? 'Breakdown' : 'Summary';
    if (titleEl) titleEl.textContent = `${typeIcon} ${entry.title || 'Untitled'}`;
    if (subtitleEl) subtitleEl.textContent = `${typeLabel} — ${(entry.threads || []).length} response(s)`;

    // Show modal
    modal.style.display = 'flex';

    // Render first thread
    if (entry.threads && entry.threads.length > 0) {
      if (resultEl) {
        resultEl.innerHTML = await this._renderAiResponse(entry.threads[0].answer);
      }
    } else {
      if (resultEl) resultEl.innerHTML = '<p style="color:#94a3b8;">No content</p>';
    }

    // Render pagination
    this._renderHistoryPagination();
  }

  /** Render pagination boxes for the AI History viewer modal */
  _renderHistoryPagination() {
    const entry = this.currentHistoryEntry;
    const paginationEl = document.getElementById('aiHistoryThreadPagination');
    if (!paginationEl || !entry) return;

    const threads = entry.threads || [];
    if (threads.length < 2) {
      paginationEl.style.display = 'none';
      return;
    }

    paginationEl.style.display = 'flex';
    paginationEl.style.gap = '8px';
    paginationEl.innerHTML = '';

    threads.forEach((thread, index) => {
      const box = document.createElement('div');
      box.className = `thread-box ${index === this.currentHistoryThreadIndex ? 'active' : ''}`;
      box.textContent = index + 1;
      box.style.cssText = `
        width: 32px; height: 32px; border-radius: 6px;
        background: ${index === this.currentHistoryThreadIndex ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
        border: 2px solid ${index === this.currentHistoryThreadIndex ? '#2563eb' : '#cbd5e1'};
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700;
        color: ${index === this.currentHistoryThreadIndex ? 'white' : '#64748b'};
        transition: all 0.25s ease;
      `;

      const question = thread.question || 'Response';
      const tipText = question.length > 30 ? question.substring(0, 30) + '...' : question;
      box.title = `${index + 1}. ${tipText}`;

      box.addEventListener('click', () => this.navigateHistoryThread(index));
      paginationEl.appendChild(box);
    });
  }

  /** Navigate to a specific thread in the history viewer */
  async navigateHistoryThread(index) {
    const entry = this.currentHistoryEntry;
    if (!entry || !entry.threads || index < 0 || index >= entry.threads.length) return;

    this.currentHistoryThreadIndex = index;
    const resultEl = document.getElementById('aiHistoryResultContent');
    if (resultEl) {
      resultEl.innerHTML = await this._renderAiResponse(entry.threads[index].answer);
    }
    this._renderHistoryPagination();
  }

  /** Copy the current thread's answer from the history viewer */
  copyHistoryContent() {
    const entry = this.currentHistoryEntry;
    if (!entry || !entry.threads) return;
    const thread = entry.threads[this.currentHistoryThreadIndex];
    if (thread && thread.answer) {
      navigator.clipboard.writeText(thread.answer);
      this.showToast('Copied to clipboard!');
    }
  }

  /** Start editing the AI history entry title */
  _startEditHistoryTitle() {
    const entry = this.currentHistoryEntry;
    if (!entry) return;
    const titleEl = document.getElementById('aiHistoryModalTitle');
    const editContainer = document.getElementById('aiHistoryTitleEditContainer');
    const titleInput = document.getElementById('aiHistoryTitleInput');
    const editBtn = document.getElementById('editAiHistoryTitleBtn');
    if (!titleEl || !editContainer || !titleInput) return;
    // Hide display title, show edit input
    titleEl.style.display = 'none';
    editContainer.style.display = 'flex';
    if (editBtn) editBtn.style.display = 'none';
    // Pre-fill with current title (strip icon prefix)
    const rawTitle = entry.title || 'Untitled';
    titleInput.value = rawTitle;
    titleInput.focus();
    titleInput.select();
  }

  /** Save the edited AI history entry title */
  async _saveEditHistoryTitle() {
    const entry = this.currentHistoryEntry;
    const titleInput = document.getElementById('aiHistoryTitleInput');
    if (!entry || !titleInput) return;
    const newTitle = titleInput.value.trim().substring(0, 60);
    if (!newTitle) {
      this.showToast('Title cannot be empty');
      return;
    }
    // Update entry in memory and persist
    entry.title = newTitle;
    const idx = this.aiHistoryEntries.findIndex(e => e.id === entry.id);
    if (idx !== -1) this.aiHistoryEntries[idx].title = newTitle;
    await this._persistAiHistory();
    // Update displayed title
    const typeIcon = entry.type === 'breakdown' ? '🧠' : '📝';
    const titleEl = document.getElementById('aiHistoryModalTitle');
    if (titleEl) titleEl.textContent = `${typeIcon} ${newTitle}`;
    this._cancelEditHistoryTitle();
    this.renderAiHistoryList();
    this.showToast('Title updated');
  }

  /** Cancel editing the AI history entry title */
  _cancelEditHistoryTitle() {
    const titleEl = document.getElementById('aiHistoryModalTitle');
    const editContainer = document.getElementById('aiHistoryTitleEditContainer');
    const editBtn = document.getElementById('editAiHistoryTitleBtn');
    if (titleEl) titleEl.style.display = '';
    if (editContainer) editContainer.style.display = 'none';
    if (editBtn) editBtn.style.display = '';
  }

  /** Continue a conversation from AI history — restores state and navigates to AI Lab */
  async continueHistoryConversation() {
    const entry = this.currentHistoryEntry;
    if (!entry || !entry.threads || entry.threads.length === 0) {
      this.showToast('No conversation to continue');
      return;
    }

    // Close the history modal
    const modal = document.getElementById('aiHistoryModal');
    if (modal) modal.style.display = 'none';

    if (entry.type === 'summary') {
      // Restore summary state
      this.currentSummaryText = entry.originalText || '';
      this.summaryThreads = entry.threads.map(t => ({
        question: t.question || '',
        answer: t.answer || '',
        timestamp: t.timestamp || Date.now()
      }));
      this.currentSummaryThreadIndex = this.summaryThreads.length - 1;
      this._activeSummaryHistoryId = entry.id;

      // Navigate to AI Lab > Summary tab
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const aiTab = document.querySelector('[data-tab="ai"]');
      if (aiTab) aiTab.classList.add('active');
      const aiTabEl = document.getElementById('aiTab');
      if (aiTabEl) aiTabEl.classList.add('active');
      this.currentTab = 'ai';

      document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
      const summarySubTab = document.querySelector('[data-ai-tab="summary"]');
      if (summarySubTab) summarySubTab.classList.add('active');
      const summarySection = document.getElementById('aiSummarySection');
      if (summarySection) summarySection.classList.add('active');
      this._currentAiLabSubTab = 'summary';

      // Show result section with last thread
      this.showSummarySection('result');
      const lastThread = this.summaryThreads[this.currentSummaryThreadIndex];
      const summaryContent = document.getElementById('summaryResultContent');
      if (summaryContent && lastThread) {
        summaryContent.innerHTML = await this._renderAiResponse(lastThread.answer);
      }

      // Show follow-up container
      const followupContainer = document.getElementById('summaryFollowupContainer');
      if (followupContainer) followupContainer.style.display = 'block';

      // Render pagination if multiple threads
      if (this.summaryThreads.length >= 2) {
        this.renderThreadPagination('summary');
      }

      // Persist
      this._currentSummarySection = 'result';
      this._saveSummaryState();
      this._saveActiveTabState();
      this.showToast('Conversation restored — ask a follow-up!');

    } else if (entry.type === 'breakdown') {
      // Restore breakdown state
      this.currentBreakdownText = entry.originalText || '';
      this.breakdownThreads = entry.threads.map(t => ({
        question: t.question || '',
        answer: t.answer || '',
        level: t.level || null,
        timestamp: t.timestamp || Date.now()
      }));
      this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;
      this._activeBreakdownHistoryId = entry.id;
      this.currentBreakdownLevel = entry.threads[0]?.level || null;

      // Navigate to AI Lab > Breakdown tab
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const aiTab = document.querySelector('[data-tab="ai"]');
      if (aiTab) aiTab.classList.add('active');
      const aiTabEl = document.getElementById('aiTab');
      if (aiTabEl) aiTabEl.classList.add('active');
      this.currentTab = 'ai';

      document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
      const breakdownSubTab = document.querySelector('[data-ai-tab="breakdown"]');
      if (breakdownSubTab) breakdownSubTab.classList.add('active');
      const breakdownSection = document.getElementById('aiBreakdownSection');
      if (breakdownSection) breakdownSection.classList.add('active');
      this._currentAiLabSubTab = 'breakdown';

      // Open the breakdown modal with the last thread content
      const breakdownModal = document.getElementById('breakdownModal');
      if (breakdownModal) breakdownModal.style.display = 'flex';

      // Populate the original text box (was missing — caused blank display)
      const breakdownOriginalText = document.getElementById('breakdownOriginalText');
      if (breakdownOriginalText) {
        breakdownOriginalText.textContent = this.currentBreakdownText;
      }
      const breakdownTextLength = document.getElementById('breakdownTextLength');
      if (breakdownTextLength && this.currentBreakdownText) {
        const wordCount = this.currentBreakdownText.trim().split(/\s+/).length;
        breakdownTextLength.textContent = `${wordCount} words`;
      }

      const resultEl = document.getElementById('breakdownResult');
      const lastThread = this.breakdownThreads[this.currentBreakdownThreadIndex];
      if (resultEl && lastThread) {
        resultEl.innerHTML = await this._renderAiResponse(lastThread.answer);
      }

      // Show follow-up container
      const followupContainer = document.getElementById('breakdownFollowupContainer');
      if (followupContainer) followupContainer.style.display = 'block';

      // Render pagination if multiple threads
      if (this.breakdownThreads.length >= 2) {
        this.renderThreadPagination('breakdown');
      }

      // Persist
      this._saveBreakdownModalState();
      this._saveActiveTabState();
      this.showToast('Conversation restored — ask a follow-up!');
    }
  }

  /** Delete all AI history entries */
  async clearAllAiHistory() {
    this.aiHistoryEntries = [];
    this._activeBreakdownHistoryId = null;
    this._activeSummaryHistoryId = null;
    await this._persistAiHistory();
    this.renderAiHistoryList();
    this.showToast('AI history cleared');
  }

  // ==================== NOTES SYSTEM ====================
  
  async loadNotes() {
    let {
      notes = [],
      notesViewMode = 'notes',
      notesPageIndex = 0,
      notesAiEnabled = false
    } = await chrome.storage.local.get(['notes', 'notesViewMode', 'notesPageIndex', 'notesAiEnabled']);

    // ── DEMO SEED: 2 notes + 2 albums (PC 1.0 release) ──
    // Starter examples to showcase Notes & Albums. Users should delete them.
    if (notes.length === 0) {
      const now = Date.now();
      const N1 = now - 400000;
      const N2 = now - 300000;
      const A1 = now - 200000;
      const A2 = now - 100000;

      notes = [
        // ── NOTE 1: Welcome to PasteCraft ──
        {
          id: N1, type: 'note',
          title: 'Welcome to PasteCraft',
          description: 'Getting started guide — delete anytime',
          body: 'PasteCraft auto-detects 20+ markup languages including Markdown, LaTeX, Mermaid diagrams, and code with syntax highlighting. Copy anything and it renders automatically!\n\nTry the preset categories to organize your clips, or create your own.',
          clips: [
            { type: 'clip', id: now - 399000, text: '# Quick Notes\n\n## Today\'s Tasks\n- [ ] Review pull request\n- [x] Update dependencies\n- [ ] Write unit tests\n\n> **Tip:** These are examples — delete them anytime!', addedDate: now - 399000 }
          ],
          images: [],
          urls: [
            { type: 'url', id: now - 398000, url: 'https://pastecraft.com/docs', title: 'PasteCraft Documentation', addedDate: now - 398000 }
          ],
          createdAt: N1, updatedAt: N1
        },
        // ── NOTE 2: Meeting Notes Template ──
        {
          id: N2, type: 'note',
          title: 'Meeting Notes Template',
          description: 'Reusable meeting template — delete anytime',
          body: 'Use this as a starting point for meeting notes. Attach clips, links, and images to keep everything in one place.',
          clips: [
            { type: 'clip', id: now - 299000, text: '# Meeting Notes — [Date]\n\n**Attendees:** [names]\n**Agenda:**\n1. Status updates\n2. Blockers\n3. Action items\n\n## Notes\n- \n\n## Action Items\n- [ ] [Owner] — [Task] — Due: [Date]', addedDate: now - 299000 }
          ],
          images: [],
          urls: [],
          createdAt: N2, updatedAt: N2
        },
        // ── ALBUM 1: Developer Toolkit ──
        {
          id: A1, type: 'album',
          title: 'Developer Toolkit',
          description: 'Code snippets & diagram references — delete anytime',
          body: 'A collection of useful developer clips. Albums group related notes together for quick access.',
          clips: [
            { type: 'clip', id: now - 199000, text: 'async function fetchJSON(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(res.statusText);\n    return await res.json();\n  } catch (err) {\n    console.error("Fetch failed:", err);\n    return null;\n  }\n}', addedDate: now - 199000 },
            { type: 'clip', id: now - 198000, text: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D', addedDate: now - 198000 }
          ],
          images: [],
          urls: [
            { type: 'url', id: now - 197000, url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', title: 'MDN Web Docs', addedDate: now - 197000 }
          ],
          noteRefs: [N1],
          sourceNoteIds: [N1],
          createdAt: A1, updatedAt: A1
        },
        // ── ALBUM 2: Research & References ──
        {
          id: A2, type: 'album',
          title: 'Research & References',
          description: 'Formulas, links & templates — delete anytime',
          body: 'Collect research materials in albums. Group notes, clips, and links for any project or topic.',
          clips: [
            { type: 'clip', id: now - 99000, text: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\n\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', addedDate: now - 99000 }
          ],
          images: [],
          urls: [
            { type: 'url', id: now - 98000, url: 'https://www.overleaf.com/learn/latex/Mathematical_expressions', title: 'Overleaf - LaTeX Math Guide', addedDate: now - 98000 },
            { type: 'url', id: now - 97000, url: 'https://mermaid.js.org/intro/', title: 'Mermaid Docs', addedDate: now - 97000 }
          ],
          noteRefs: [N2],
          sourceNoteIds: [N2],
          createdAt: A2, updatedAt: A2
        }
      ];
      await chrome.storage.local.set({ notes });
      console.log('🧪 Seeded 2 notes + 2 albums (PC 1.0)');
    }
    // ── END DEMO SEED ──

    this.notes = notes;
    this.notesViewMode = notesViewMode;
    this.notesPageIndex = typeof notesPageIndex === 'number' ? notesPageIndex : 0;
    this.notesAiEnabled = !!notesAiEnabled;

    const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
    if (viewAlbumsBtn) viewAlbumsBtn.classList.toggle('active', this.notesViewMode === 'albums');
    const notesAiToggle = document.getElementById('notesAiToggle');
    if (notesAiToggle) notesAiToggle.checked = this.notesAiEnabled;

    console.log(`📝 Loaded ${notes.length} notes`);
    return notes;
  }

  async saveNotes() {
    // Use CRUD utility for reliable notes save with retry and verification
    const snapshot = PasteCraftCRUD.createSnapshot(this.notes);
    
    try {
      // PRACTICE #3: RETRY LOGIC
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({ notes: this.notes });
      });

      // PRACTICE #5: VERIFICATION
      const verification = await chrome.storage.local.get(['notes']);
      const verifiedNotes = Array.isArray(verification.notes) ? verification.notes : [];
      if (verifiedNotes.length !== this.notes.length) {
        throw new Error('Verification failed: notes count mismatch');
      }

      console.log(`💾 Saved ${this.notes.length} notes`);
    } catch (error) {
      // Rollback on failure
      console.error('❌ Notes save failed, rolling back:', error);
      this.notes = snapshot;
      await chrome.storage.local.set({ notes: this.notes });
      throw error;
    }
  }

  async saveNotesPrefs() {
    await chrome.storage.local.set({
      notesViewMode: this.notesViewMode,
      notesPageIndex: this.notesPageIndex,
      notesAiEnabled: this.notesAiEnabled
    });
  }

  renderNotes() {
    const container = document.getElementById('notesContainer');
    const paginationEl = document.getElementById('notesPagination');
    const isListView = !!container?.classList?.contains('list-view');
    
    const allNotes = Array.isArray(this.notes) ? this.notes : [];
    // Filter by search query if present
    const searchInput = document.getElementById('notesSearchInput');
    const searchQuery = (searchInput ? searchInput.value.trim().toLowerCase() : '');
    const filtered = searchQuery
      ? allNotes.filter(n => {
          const title = (n.title || '').toLowerCase();
          const desc = (n.description || '').toLowerCase();
          const type = (n.type || '').toLowerCase();
          return title.includes(searchQuery) || desc.includes(searchQuery) || type.includes(searchQuery);
        })
      : allNotes;

    if (filtered.length === 0) {
      if (searchQuery) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>No results found</h3>
            <p>No notes or albums match "<strong>${this.escapeHtml(searchQuery)}</strong>"</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h3>No notes yet</h3>
            <p>Create a note or album to bundle your clips, images, and URLs</p>
            <div class="demo-hint">
              <span class="demo-step">📝 Take notes</span>
              <span class="demo-step">📚 Create albums</span>
              <span class="demo-step">📤 Export to PDF</span>
            </div>
          </div>
        `;
      }
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    // Pagination: list shows 3; grid shows 6 (2 columns × 3 rows)
    const pageSize = isListView ? 3 : 6;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (this.notesPageIndex < 0) this.notesPageIndex = 0;
    if (this.notesPageIndex > pageCount - 1) this.notesPageIndex = pageCount - 1;
    const start = this.notesPageIndex * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    container.innerHTML = pageItems.map(note => {
      const noteRefCount = note.type === 'album' ? (Array.isArray(note.noteRefs) ? note.noteRefs.length : 0) : 0;
      const clipCount = note.type === 'album' ? 0 : (note.clips?.length || 0);
      const imageCount = note.type === 'album' ? 0 : (note.images?.length || 0);
      const urlCount = note.type === 'album' ? 0 : (note.urls?.length || 0);
      const totalItems = note.type === 'album' ? noteRefCount : (clipCount + imageCount + urlCount);
      const typeIconSrc = note.type === 'album' ? 'assets/note-icons/album-folder.svg' : 'assets/note-icons/notebook.svg';
      const cardClass = note.type === 'album' ? 'note-card album' : 'note-card';
      const date = new Date(note.createdAt).toLocaleDateString();
      const safeTitle = (note.title || '').trim();
      const safeDesc = (note.description || '').trim();
      const displayTitle = safeTitle ? safeTitle : (note.type === 'album' ? 'Untitled Album' : 'Untitled Note');

      const sendToAlbumBtn = note.type !== 'album'
        ? `<button class="note-action-btn send-to-album-btn" data-note-id="${note.id}" title="Send/Create Album"><img src="assets/note-icons/sendcreate Album.svg" alt="" class="pc-icon pc-icon-18"></button>`
        : '';
      
      return `
        <div class="${cardClass}" data-note-id="${note.id}">
          <div class="note-card-header">
            <span class="note-card-type"><img src="${typeIconSrc}" alt="" class="pc-icon pc-icon-18"></span>
            <div class="note-card-actions">
              <button class="note-action-btn edit-note" data-note-id="${note.id}" title="Edit"><img src="assets/note-icons/Edit.svg" alt="" class="pc-icon pc-icon-18"></button>
              ${sendToAlbumBtn}
              <button class="note-action-btn export-note" data-note-id="${note.id}" title="Export"><img src="assets/note-icons/export.svg" alt="" class="pc-icon pc-icon-18"></button>
              <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete"><img src="assets/note-icons/delete.svg" alt="" class="pc-icon pc-icon-18"></button>
            </div>
          </div>
          <h4 class="note-card-title">${this.escapeHtml(displayTitle)}</h4>
          <p class="note-card-description">${this.escapeHtml(safeDesc)}</p>
          <div class="note-card-meta">
            <div class="note-card-count">
              ${note.type === 'album' && noteRefCount > 0 ? `<span>📝 ${noteRefCount}</span>` : ''}
              ${clipCount > 0 ? `<span>📋 ${clipCount}</span>` : ''}
              ${imageCount > 0 ? `<span>🖼️ ${imageCount}</span>` : ''}
              ${urlCount > 0 ? `<span>🔗 ${urlCount}</span>` : ''}
              ${totalItems === 0 ? '<span style="color: #9ca3af;">Empty</span>' : ''}
            </div>
            <span>${date}</span>
          </div>
        </div>
      `;
    }).join('');

    // Render pagination controls (0..N-1)
    if (paginationEl) {
      if (pageCount <= 1) {
        paginationEl.style.display = 'none';
      } else {
        paginationEl.style.display = 'flex';
        paginationEl.innerHTML = Array.from({ length: pageCount }).map((_, idx) => {
          const active = idx === this.notesPageIndex ? 'active' : '';
          return `<button class="notes-page-btn ${active}" data-page="${idx}" title="Page ${idx}">${idx}</button>`;
        }).join('');

        paginationEl.querySelectorAll('.notes-page-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const nextPage = parseInt(btn.dataset.page, 10);
            if (!Number.isNaN(nextPage)) {
              this.notesPageIndex = nextPage;
              await this.saveNotesPrefs();
              this.renderNotes();
            }
          });
        });
      }
    }

    // Add event listeners to note cards
    container.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.note-action-btn')) {
          const noteId = card.dataset.noteId;
          this.openNoteViewer(noteId);
        }
      });
    });

    // Edit buttons
    container.querySelectorAll('.edit-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.openNoteEditor('note', noteId);
      });
    });

    // Export buttons
    container.querySelectorAll('.export-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.exportNoteToPDF(noteId);
      });
    });

    // Delete buttons
    container.querySelectorAll('.delete-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.deleteNote(noteId);
      });
    });

    // Send to Album buttons
    container.querySelectorAll('.send-to-album-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        const note = this.notes.find(n => n.id == noteId);
        if (note) {
          this.pendingNoteForAlbum = note;
          await this.loadNotes();
          this.showAlbumPickerForNote();
        }
      });
    });
  }

  updateNoteAiControls() {
    const aiTitleBtn = document.getElementById('aiTitleBtn');
    const aiDescBtn = document.getElementById('aiDescBtn');
    const bodyInput = document.getElementById('noteBodyInput');

    if (!aiTitleBtn || !aiDescBtn || !bodyInput) return;

    const hasContent = !!bodyInput.value.trim();
    const shouldShow = !!this.notesAiEnabled;

    aiTitleBtn.style.display = shouldShow ? 'inline-flex' : 'none';
    aiDescBtn.style.display = shouldShow ? 'inline-flex' : 'none';

    aiTitleBtn.disabled = !hasContent;
    aiDescBtn.disabled = !hasContent;
  }

  async generateNoteTitleFromContent() {
    const bodyInput = document.getElementById('noteBodyInput');
    const titleInput = document.getElementById('noteTitleInput');
    const aiTitleBtn = document.getElementById('aiTitleBtn');
    if (!bodyInput || !titleInput || !aiTitleBtn) return;

    const content = bodyInput.value.trim();
    if (!content) {
      this.showToast('Add content first');
      this.updateNoteAiControls();
      return;
    }

    // Premium check (reuse Summary gating)
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      aiTitleBtn.disabled = true;
      const question = 'Generate a short note title (max 6 words). Return ONLY the title, no quotes.';
      const result = await pasteCraftSupabase.generateSummary(content.substring(0, 3000), question);
      const cleaned = (result || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
      if (cleaned) titleInput.value = cleaned;
      this.showToast('Title generated');
    } catch (e) {
      console.error('Failed to generate title:', e);
      this.showToast('Failed to generate title');
    } finally {
      aiTitleBtn.disabled = false;
      this.updateNoteAiControls();
    }
  }

  async generateNoteDescriptionFromContent() {
    const bodyInput = document.getElementById('noteBodyInput');
    const descInput = document.getElementById('noteDescriptionInput');
    const aiDescBtn = document.getElementById('aiDescBtn');
    if (!bodyInput || !descInput || !aiDescBtn) return;

    const content = bodyInput.value.trim();
    if (!content) {
      this.showToast('Add content first');
      this.updateNoteAiControls();
      return;
    }

    // Premium check (reuse Summary gating)
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      aiDescBtn.disabled = true;
      const question = 'Generate a one-sentence description for this note (max 140 characters). Return ONLY the description.';
      const result = await pasteCraftSupabase.generateSummary(content.substring(0, 3000), question);
      const cleaned = (result || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
      if (cleaned) descInput.value = cleaned;
      this.showToast('Description generated');
    } catch (e) {
      console.error('Failed to generate description:', e);
      this.showToast('Failed to generate description');
    } finally {
      aiDescBtn.disabled = false;
      this.updateNoteAiControls();
    }
  }

  openNoteEditor(type = 'note', noteId = null, showBack = false) {
    this.currentNoteType = type;
    this.currentNoteId = noteId;
    this.currentNoteAttachments = [];

    const modal = document.getElementById('noteEditorModal');
    const titleInput = document.getElementById('noteTitleInput');
    const descInput = document.getElementById('noteDescriptionInput');
    const bodyInput = document.getElementById('noteBodyInput');
    const attachmentsList = document.getElementById('noteAttachmentsList');
    const attachmentsSection = document.getElementById('noteEditorAttachmentsSection');
    const editorType = document.getElementById('noteEditorType');
    const aiToggle = document.getElementById('notesAiToggle');
    const saveBtn = document.getElementById('saveNote');

    // Show/hide back button
    if (showBack) {
      this.showBackToAlbumPicker();
    } else {
      this.hideBackToAlbumPicker();
    }

    if (noteId) {
      // Edit existing note
      const note = this.notes.find(n => n.id == noteId);
      if (note) {
        this.currentNoteType = note.type;
        titleInput.value = note.title;
        descInput.value = note.description;
        bodyInput.value = note.body;
        this.currentNoteAttachments = note.type === 'album'
          ? []
          : [
              ...(note.clips || []),
              ...(note.images || []),
              ...(note.urls || [])
            ];
        editorType.textContent = note.type === 'album' ? 'Edit Album' : 'Edit Note';
      }
    } else {
      // New note
      titleInput.value = '';
      descInput.value = '';
      bodyInput.value = '';
      this.currentNoteAttachments = [];
      editorType.textContent = type === 'album' ? 'New Album' : 'New Note';
    }

    // Set AI toggle state
    if (aiToggle) aiToggle.checked = this.notesAiEnabled;

    // Albums do not take attachments
    if (attachmentsSection) attachmentsSection.style.display = this.currentNoteType === 'album' ? 'none' : 'block';
    if (saveBtn) saveBtn.textContent = this.currentNoteType === 'album' ? 'Save Album' : 'Save Note';

    if (this.currentNoteType !== 'album') {
      this.renderNoteAttachments();
    } else if (attachmentsList) {
      attachmentsList.innerHTML = '';
    }
    this.updateNoteAiControls();
    modal.style.display = 'flex';
  }

  closeNoteEditor() {
    document.getElementById('noteEditorModal').style.display = 'none';
    this.currentNoteId = null;
    this.currentNoteType = 'note';
    this.currentNoteAttachments = [];
    this.hideBackToAlbumPicker();
  }

  renderNoteAttachments() {
    const attachmentsList = document.getElementById('noteAttachmentsList');
    
    if (this.currentNoteAttachments.length === 0) {
      attachmentsList.innerHTML = '<p style="text-align: center; color: #9ca3af; font-size: 13px;">No attachments yet</p>';
      return;
    }

    attachmentsList.innerHTML = this.currentNoteAttachments.map((att, index) => {
      const icon = att.type === 'clip' ? '📋' : att.type === 'image' ? '🖼️' : '🔗';
      const text = att.type === 'url' ? att.url : att.text?.substring(0, 50) + '...';
      const date = att.addedDate ? new Date(att.addedDate).toLocaleDateString() : '';

      return `
        <div class="attachment-item">
          <div class="attachment-info">
            <span>${icon}</span>
            <span class="attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(text)}</span>
            ${date ? `<span class="attachment-date">${date}</span>` : ''}
          </div>
          <button class="attachment-remove" data-index="${index}">✕</button>
        </div>
      `;
    }).join('');

    // Add remove handlers
    attachmentsList.querySelectorAll('.attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.currentNoteAttachments.splice(index, 1);
        this.renderNoteAttachments();
      });
    });
  }

  async saveNote() {
    const isUpdate = !!this.currentNoteId;
    const title = document.getElementById('noteTitleInput').value.trim();
    const description = document.getElementById('noteDescriptionInput').value.trim();
    const body = document.getElementById('noteBodyInput').value.trim();

    const existing = this.currentNoteId ? this.notes.find(n => n.id == this.currentNoteId) : null;
    const noteData = {
      id: this.currentNoteId || Date.now(),
      type: this.currentNoteType,
      title,
      description,
      body,
      ...(this.currentNoteType === 'album'
        ? { noteRefs: Array.isArray(existing?.noteRefs) ? existing.noteRefs : [] }
        : {
            clips: this.currentNoteAttachments.filter(a => a.type === 'clip'),
            images: this.currentNoteAttachments.filter(a => a.type === 'image'),
            urls: this.currentNoteAttachments.filter(a => a.type === 'url')
          }),
      createdAt: this.currentNoteId ? (this.notes.find(n => n.id == this.currentNoteId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };

    if (this.currentNoteId) {
      // Update existing note
      const index = this.notes.findIndex(n => n.id == this.currentNoteId);
      if (index !== -1) {
        this.notes[index] = noteData;
      }
    } else {
      // Add new note
      this.notes.unshift(noteData);
      // Always jump to first page so the newly created note appears immediately (top-left in grid)
      this.notesPageIndex = 0;
    }

    // If this note is included in any albums, refresh those albums immediately.
    if (noteData.type !== 'album') {
      this.refreshAlbumsForNote(noteData);
    }

    await this.saveNotes();
    await this.saveNotesPrefs();
    this.renderNotes();
    this.closeNoteEditor();

    // If album was created from the picker, re-open picker so user can continue
    if (this.createdFromPicker) {
      this.createdFromPicker = false;
      this.showAlbumPicker();
    }

    this.showToast(isUpdate ? 'Note updated!' : 'Note created!');

    try {
      Promise.resolve()
        .then(() => pasteCraftSupabase.syncWithQueue('syncNotes', this.notes, pasteCraftSupabase.syncNotesToSupabase))
        .catch(() => {});
    } catch (_) {
      // ignore
    }
  }

  refreshAlbumsForNote(sourceNote) {
    if (!sourceNote || sourceNote.type === 'album') return;

    const sourceNoteId = sourceNote.id;
    const safeTitle = (sourceNote.title || '').trim();
    const displayTitle = safeTitle ? safeTitle : 'Untitled Note';
    const bodyPrefix = `[From: ${displayTitle}]`;

    const sourceAttachmentIds = new Set();
    (sourceNote.clips || []).forEach(c => {
      if (c && c.id != null) sourceAttachmentIds.add(c.id);
    });
    (sourceNote.urls || []).forEach(u => {
      if (u && u.id != null) sourceAttachmentIds.add(u.id);
    });
    (sourceNote.images || []).forEach(i => {
      if (i && i.id != null) sourceAttachmentIds.add(i.id);
    });

    const updatedAlbumIds = new Set();

    const containsSourceNoteId = (arr) =>
      Array.isArray(arr) && arr.some(x => x && x.sourceNoteId == sourceNoteId);
    const containsAnySourceAttachmentId = (arr) =>
      Array.isArray(arr) && arr.some(x => x && sourceAttachmentIds.has(x.id));

    for (const album of (this.notes || [])) {
      if (!album || album.type !== 'album') continue;

      const isLinked =
        containsSourceNoteId(album.clips) ||
        containsSourceNoteId(album.urls) ||
        containsSourceNoteId(album.images) ||
        containsAnySourceAttachmentId(album.clips) ||
        containsAnySourceAttachmentId(album.urls) ||
        containsAnySourceAttachmentId(album.images);

      if (!isLinked) continue;

      if (!Array.isArray(album.clips)) album.clips = [];
      if (!Array.isArray(album.urls)) album.urls = [];
      if (!Array.isArray(album.images)) album.images = [];

      // Remove previous synced items for this note (tagged items) and best-effort cleanup for legacy (id match / body prefix).
      album.clips = album.clips.filter(c => {
        if (!c) return false;
        if (c.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(c.id)) return false;
        if (typeof c.text === 'string' && c.text.startsWith(bodyPrefix)) return false;
        return true;
      });
      album.urls = album.urls.filter(u => {
        if (!u) return false;
        if (u.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(u.id)) return false;
        return true;
      });
      album.images = album.images.filter(i => {
        if (!i) return false;
        if (i.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(i.id)) return false;
        return true;
      });

      // Re-copy current note content into album with tagging.
      const now = Date.now();
      if (sourceNote.body && sourceNote.body.trim()) {
        album.clips.push({
          type: 'clip',
          id: now + Math.random(),
          text: `${bodyPrefix}\n\n${sourceNote.body}`,
          addedDate: now,
          sourceNoteId
        });
      }

      if (sourceNote.clips?.length > 0) {
        album.clips.push(...sourceNote.clips.map(c => ({
          ...c,
          addedDate: now,
          sourceNoteId
        })));
      }

      if (sourceNote.urls?.length > 0) {
        album.urls.push(...sourceNote.urls.map(u => ({
          ...u,
          addedDate: now,
          sourceNoteId
        })));
      }

      if (sourceNote.images?.length > 0) {
        album.images.push(...sourceNote.images.map(i => ({
          ...i,
          addedDate: now,
          sourceNoteId
        })));
      }

      album.updatedAt = now;
      if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
      if (!album.sourceNoteIds.includes(sourceNoteId)) album.sourceNoteIds.push(sourceNoteId);

      updatedAlbumIds.add(album.id);
    }

    if (this.currentViewerNoteId && updatedAlbumIds.has(this.currentViewerNoteId)) {
      this.openNoteViewer(this.currentViewerNoteId);
    }
  }

  async deleteNote(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    const confirmed = confirm(`Delete "${note.title}"?`);
    if (!confirmed) return;

    return await PasteCraftCRUD.deleteOperation({
      entityId: noteId,
      entityName: note.title,
      entityType: 'note',
      stateGetter: () => ({ notes: this.notes }),
      stateSetter: async (newState) => {
        this.notes = newState.notes;
      },
      stateKeys: ['notes'],
      validator: (entity, state) => {
        const exists = Array.isArray(state.notes) && state.notes.some(n => n.id == entity.id);
        return { valid: exists, error: exists ? null : 'Note not found' };
      },
      idempotencyCheck: (entityId, state) => {
        return !Array.isArray(state.notes) || !state.notes.some(n => n.id == entityId);
      },
      storageKeys: ['notes'],
      storageWriter: async (data) => {
        await chrome.storage.local.set(data);
      },
      deleteFromArray: (items, entityId) => items.filter(n => n.id != entityId),
      updateRelatedEntities: (state, entity) => {
        // No related entities to update for notes
      },
      verifier: async (entityId) => {
        const verification = await chrome.storage.local.get(['notes']);
        const notes = Array.isArray(verification.notes) ? verification.notes : [];
        return !notes.some(n => n.id == entityId);
      },
      uiUpdater: () => {
        this.renderNotes();
      },
      backgroundSync: async (entity, deletedAt) => {
        await this.appendDeletedItems('pc_deleted_notes', [{
          ...note,
          deletedAt,
          updatedAt: deletedAt
        }]);
        await pasteCraftSupabase.syncWithQueue('syncDeletedNotes', [{
          ...note,
          deletedAt,
          updatedAt: deletedAt
        }], pasteCraftSupabase.syncDeletedNotesToSupabase);
        await pasteCraftSupabase.syncWithQueue('syncNotes', this.notes, pasteCraftSupabase.syncNotesToSupabase);
      },
      successMessage: (entity) => `✅ Note "${entity.name}" deleted`,
      errorMessage: (error) => `❌ Failed to delete note: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => this.showToast(msg, type)
    });
  }

  showClipPickerForNote() {
    if (this.clips.length === 0 && this.searchOnlyClips.length === 0) {
      this.showToast('No clips available. Create some clips first!');
      return;
    }

    this.selectedPickerClips.clear();
    this.updateClipPickerFooter();
    
    const modal = document.getElementById('clipPickerModal');
    if (modal) {
      modal.style.display = 'flex';
      this.switchClipPickerTab('clips');
      this.renderClipPickerRecentClips();
    }
  }

  closeClipPicker() {
    const modal = document.getElementById('clipPickerModal');
    if (modal) {
      modal.style.display = 'none';
      this.selectedPickerClips.clear();
    }
  }

  updateClipPickerFooter() {
    const countEl = document.getElementById('clipPickerSelectionCount');
    const addBtn = document.getElementById('clipPickerAddBtn');
    
    if (countEl) {
      const count = this.selectedPickerClips.size;
      countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
    }
    
    if (addBtn) {
      addBtn.disabled = this.selectedPickerClips.size === 0;
    }
  }

  togglePickerClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.clip-picker-checkbox, .clip-picker-checkbox-sm, .search-checkbox, .category-checkbox');
    
    if (this.selectedPickerClips.has(clipId)) {
      this.selectedPickerClips.delete(clipId);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedPickerClips.add(clipId);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    
    this.updateClipPickerFooter();
  }

  normalizePickerText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  createPickerSearchRowHTML(clip) {
    const category = clip.category || 'Uncategorized';
    const timeAgo = this.getTimeAgo(clip.timestamp);
    const normalized = this.normalizePickerText(clip.text);
    const truncatedText = normalized.length > 110 ? normalized.substring(0, 110) + '...' : normalized;
    const isSelected = this.selectedPickerClips.has(clip.id);
    const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);
    const selectedClass = isSelected ? 'selected' : '';
    const addedClass = alreadyAdded ? 'already-added' : '';

    return `
      <div class="search-result-item ${selectedClass} ${addedClass}" data-clip-id="${clip.id}">
        <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
        <div class="search-result-content">
          <div class="search-result-text">${this.escapeHtml(truncatedText)}</div>
          <div class="search-result-meta">
            <span class="search-result-category">${this.escapeHtml(category)}</span>
            <span>${timeAgo}</span>
            ${alreadyAdded ? '<span class="already-added-badge">✓ Added</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  createPickerChipElement(clip) {
    const chip = document.createElement('div');
    chip.className = 'chip animate-slide-in';
    chip.dataset.clipId = clip.id;

    const timeAgo = this.getTimeAgo(clip.timestamp);
    const normalized = this.normalizePickerText(clip.text);
    const truncatedText = normalized.length > 30 ? normalized.substring(0, 30) + '...' : normalized;

    const isSelected = this.selectedPickerClips.has(clip.id);
    const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);

    const pMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
    const pBadge = (typeof PCMarkup !== 'undefined') ? PCMarkup.getMarkupBadgeForClip(clip.text, pMeta) : '';

    chip.innerHTML = `
      <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
      ${pBadge}
      <span class="chip-text" title="${this.escapeHtml(normalized)}">${this.escapeHtml(truncatedText)}</span>
      <span class="chip-time">${timeAgo}</span>
      ${alreadyAdded ? '<span class="already-added-badge-sm">✓</span>' : ''}
    `;

    if (isSelected) chip.classList.add('selected');
    if (alreadyAdded) chip.classList.add('already-added');

    if (!alreadyAdded) {
      const checkbox = chip.querySelector('.chip-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePickerClip(clip.id, chip);
      });

      chip.addEventListener('click', (e) => {
        if (!e.target.classList.contains('chip-checkbox')) {
          this.togglePickerClip(clip.id, chip);
        }
      });
    }

    return chip;
  }

  attachPickerSearchRowHandlers(container) {
    container.querySelectorAll('.search-result-item').forEach(item => {
      const alreadyAdded = item.classList.contains('already-added');
      if (alreadyAdded) return;

      const checkbox = item.querySelector('.search-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const clipId = item.dataset.clipId;
        this.togglePickerClip(clipId, item);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('search-checkbox')) {
          const clipId = item.dataset.clipId;
          this.togglePickerClip(clipId, item);
        }
      });
    });
  }

  switchClipPickerTab(tabName) {
    const contentIds = ['clipPickerClipsTab','clipPickerSearchTab','clipPickerCategoriesTab'];
    const before = contentIds.map(id => {
      const el = document.getElementById(id);
      return {id,hasEl:!!el,active:!!el?.classList?.contains('active'),display:el?getComputedStyle(el).display:null};
    });

    document.querySelectorAll('.clip-picker-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.pickerTab === tabName);
    });

    document.querySelectorAll('.clip-picker-tab-content').forEach(content => {
      content.classList.remove('active');
      // Force hide to avoid CSS conflicts causing all panes to stay visible
      content.style.display = 'none';
    });

    const targetContent = document.getElementById(`clipPicker${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetContent) {
      targetContent.classList.add('active');
      // Force show target pane
      targetContent.style.display = 'block';
    }

    const after = contentIds.map(id => {
      const el = document.getElementById(id);
      return {id,hasEl:!!el,active:!!el?.classList?.contains('active'),display:el?getComputedStyle(el).display:null};
    });

    if (tabName === 'clips') {
      this.renderClipPickerRecentClips();
    } else if (tabName === 'categories') {
      this.renderClipPickerCategories();
    } else if (tabName === 'search') {
      const searchInput = document.getElementById('clipPickerSearchInput');
      if (searchInput) searchInput.value = '';
      this.renderClipPickerSearchResults([]);
    }
  }

  renderClipPickerRecentClips() {
    const container = document.getElementById('clipPickerRecentList');
    if (!container) return;

    const recentClips = this.clips.slice(0, 20);

    if (recentClips.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">📋</div>
          <p>No recent clips available</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    recentClips.forEach(clip => {
      container.appendChild(this.createPickerChipElement(clip));
    });
  }

  searchClipsInPicker(query) {
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    if (!query.trim()) {
      this.renderClipPickerSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = allClips.filter(clip => 
      (clip.text || '').toLowerCase().includes(lowerQuery) ||
      (clip.category && clip.category.toLowerCase().includes(lowerQuery))
    );

    this.renderClipPickerSearchResults(results.slice(0, 50));
  }

  renderClipPickerSearchResults(results) {
    const container = document.getElementById('clipPickerSearchList');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">🔍</div>
          <p>No clips found matching your search</p>
        </div>
      `;
      return;
    }

    container.innerHTML = results.map(clip => this.createPickerSearchRowHTML(clip)).join('');
    this.attachPickerSearchRowHandlers(container);
  }

  renderClipPickerCategories() {
    const container = document.getElementById('clipPickerCategoriesList');
    if (!container) return;

    const allClips = [...this.clips, ...this.searchOnlyClips];
    const categories = this.categories || [];
    const uncategorizedClips = allClips.filter(c => (c.category || 'Uncategorized') === 'Uncategorized');

    const pickerCategories = [
      { id: 'uncategorized', name: 'Uncategorized', icon: '📁', isVirtual: true, clips: uncategorizedClips },
      ...categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '📁',
        isVirtual: false,
        clips: allClips.filter(cl => cl.category === c.name)
      }))
    ].filter(c => c.clips.length > 0);

    if (pickerCategories.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">📁</div>
          <p>No clips found in categories</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pickerCategories.map(cat => {
      const clipCount = cat.clips.length;
      const dropdownId = `picker-dropdown-${cat.id}`;
      const clipsHtml = cat.clips.slice(0, 25).map(clip => {
        const timeAgo = this.getTimeAgo(clip.timestamp);
        const normalized = this.normalizePickerText(clip.text);
        const truncatedText = normalized.length > 60 ? normalized.substring(0, 60) + '...' : normalized;
        const isSelected = this.selectedPickerClips.has(clip.id);
        const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);

        return `
          <div class="category-clip ${isSelected ? 'selected' : ''} ${alreadyAdded ? 'already-added' : ''}" data-clip-id="${clip.id}">
            <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
            <div class="category-clip-content">
              <div class="category-clip-text">${this.escapeHtml(truncatedText)}</div>
              <div class="category-clip-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="category-item" data-picker-category-id="${cat.id}">
          <div class="category-header">
            <div class="category-info">
              <div class="category-icon">${this.escapeHtml(cat.icon)}</div>
              <div class="category-details">
                <h4>${this.escapeHtml(cat.name)}</h4>
                <p>${clipCount} clips</p>
              </div>
            </div>
            <div class="category-header-actions">
              <span class="category-expand-icon">▶</span>
            </div>
          </div>
          <div class="category-dropdown" id="${dropdownId}">
            ${clipsHtml || '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>'}
          </div>
        </div>
      `;
    }).join('');

    // Toggle expand/collapse (scoped to picker only)
    container.querySelectorAll('.category-item .category-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.category-item');
        const dropdown = item.querySelector('.category-dropdown');
        const isExpanded = item.classList.contains('expanded');

        // close others in picker
        container.querySelectorAll('.category-item.expanded').forEach(other => {
          if (other !== item) {
            other.classList.remove('expanded');
            other.querySelector('.category-dropdown')?.classList.remove('expanded');
          }
        });

        if (isExpanded) {
          item.classList.remove('expanded');
          dropdown.classList.remove('expanded');
        } else {
          item.classList.add('expanded');
          dropdown.classList.add('expanded');
        }
      });
    });

    // Attach selection handlers
    container.querySelectorAll('.category-clip').forEach(row => {
      const alreadyAdded = row.classList.contains('already-added');
      if (alreadyAdded) return;

      const checkbox = row.querySelector('.category-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePickerClip(row.dataset.clipId, row);
      });

      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('category-checkbox')) {
          this.togglePickerClip(row.dataset.clipId, row);
        }
      });
    });
  }

  addSelectedClipsToNote() {
    if (this.selectedPickerClips.size === 0) {
      this.showToast('No clips selected');
      return;
    }

    const allClips = [...this.clips, ...this.searchOnlyClips];
    let addedCount = 0;
    let skippedCount = 0;

    this.selectedPickerClips.forEach(clipId => {
      const clip = allClips.find(c => c.id == clipId);
      
      if (!clip) return;

      const alreadyAdded = this.currentNoteAttachments.some(att => 
        att.type === 'clip' && att.id == clipId
      );

      if (alreadyAdded) {
        skippedCount++;
        return;
      }

      this.currentNoteAttachments.push({
        type: 'clip',
        id: clip.id,
        text: clip.text,
        addedDate: Date.now()
      });
      addedCount++;
    });

    this.renderNoteAttachments();
    this.closeClipPicker();
    
    const parts = [];
    if (addedCount > 0) parts.push(addedCount === 1 ? '✅ 1 clip added' : `✅ ${addedCount} clips added`);
    if (skippedCount > 0) parts.push(skippedCount === 1 ? '(1 already added)' : `(${skippedCount} already added)`);
    this.showToast(parts.join(' '));
  }

  showImagePickerForNote() {
    this.showToast('Image picker coming soon! Use Add URL for now.');
  }

  addURLToNote() {
    const url = prompt('Enter URL:');
    if (url && url.trim()) {
      this.currentNoteAttachments.push({
        type: 'url',
        id: Date.now(),
        url: url.trim(),
        title: url.trim(),
        addedDate: Date.now()
      });
      this.renderNoteAttachments();
      this.showToast('URL added to note');
    }
  }

  exportNoteToPDF(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    // Simple text export (PDF generation would require a library)
    let content = `${note.title}\n\n${note.description}\n\n${note.body}\n\n`;
    
    if (note.clips?.length > 0) {
      content += '\nCLIPS:\n';
      note.clips.forEach((clip, i) => {
        content += `${i + 1}. ${clip.text}\n`;
      });
    }
    
    if (note.urls?.length > 0) {
      content += '\nLINKS:\n';
      note.urls.forEach((url, i) => {
        content += `${i + 1}. ${url.url}\n`;
      });
    }

    // Create a blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('Note exported as text file');
  }

  // =====================================================
  // EXPORT / IMPORT (JSON backup + CSV clips)
  // =====================================================

  _downloadBlob(blob, filename) {
    const safeName = String(filename || 'pastecraft-export').replace(/[^\w\-.]+/g, '_').slice(0, 120);
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = safeName;
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 250);
  }

  async exportBackupToJson() {
    try {
      // PRACTICE #1: VALIDATION - load and normalize local data
      const local = await chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'notesViewMode',
        'notesPageIndex',
        'notesAiEnabled',
        'settings',
        'userProfile',
        'autoDeletePeriod',
        'albumAttachmentOpenMode',
        'quickPasteSettings',
        'theme'
      ]);

      const payload = {
        version: 1,
        exportedAt: Date.now(),
        clips: Array.isArray(local.clips) ? local.clips : [],
        searchOnlyClips: Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : [],
        categories: Array.isArray(local.categories) ? local.categories : [],
        notes: Array.isArray(local.notes) ? local.notes : [],
        notesViewMode: local.notesViewMode || 'notes',
        notesPageIndex: typeof local.notesPageIndex === 'number' ? local.notesPageIndex : 0,
        notesAiEnabled: !!local.notesAiEnabled,
        // Settings snapshot (include theme as global single source of truth)
        settings: local.settings || {},
        userProfile: local.userProfile || null,
        autoDeletePeriod: local.autoDeletePeriod || 'never',
        albumAttachmentOpenMode: local.albumAttachmentOpenMode || 'edgePopup',
        quickPasteSettings: local.quickPasteSettings || {},
        theme: (local.theme === 'dark' ? 'dark' : 'light')
      };

      const day = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      this._downloadBlob(blob, `pastecraft-backup-${day}.json`);
      this.showToast('✅ Exported JSON backup');
    } catch (e) {
      console.error('❌ Export JSON backup failed:', e);
      this.showToast(`❌ Export failed: ${e.message || 'Unknown error'}`, 'error');
    }
  }

  async exportClipsToCsv() {
    try {
      const local = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
      const clips = [
        ...(Array.isArray(local.clips) ? local.clips : []),
        ...(Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : [])
      ];

      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = ['Text,Category,Timestamp,Date,Id'];
      for (const clip of clips) {
        const text = clip && typeof clip === 'object' ? (clip.text ?? '') : String(clip ?? '');
        const category = clip && typeof clip === 'object' ? (clip.category ?? 'Uncategorized') : 'Uncategorized';
        const ts = clip && typeof clip === 'object' && typeof clip.timestamp === 'number' ? clip.timestamp : 0;
        const id = clip && typeof clip === 'object' ? (clip.id ?? '') : '';
        const date = ts ? new Date(ts).toISOString() : '';
        rows.push([esc(text), esc(category), String(ts || ''), esc(date), esc(id)].join(','));
      }

      const day = new Date().toISOString().slice(0, 10);
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      this._downloadBlob(blob, `pastecraft-clips-${day}.csv`);
      this.showToast('✅ Exported Clips CSV');
    } catch (e) {
      console.error('❌ Export CSV failed:', e);
      this.showToast(`❌ Export failed: ${e.message || 'Unknown error'}`, 'error');
    }
  }

  async importBackupFromJsonMerge(file) {
    // MERGE import: keep existing local data, add missing items (best-effort).
    const snapshot = await chrome.storage.local.get(['clips', 'searchOnlyClips', 'categories', 'notes', 'theme', 'quickPasteSettings', 'autoDeletePeriod', 'albumAttachmentOpenMode']);
    const rollback = async () => {
      try {
        await PasteCraftCRUD.retryOperation(async () => {
          await chrome.storage.local.set({
            clips: snapshot.clips || [],
            searchOnlyClips: snapshot.searchOnlyClips || [],
            categories: snapshot.categories || [],
            notes: snapshot.notes || [],
            theme: snapshot.theme || 'light',
            quickPasteSettings: snapshot.quickPasteSettings || {},
            autoDeletePeriod: snapshot.autoDeletePeriod || 'never',
            albumAttachmentOpenMode: snapshot.albumAttachmentOpenMode || 'edgePopup',
            pc_local_updatedAt: Date.now()
          });
        });
      } catch (e) {
        console.error('❌ Import rollback failed:', e);
      }
    };

    try {
      if (!file || !(file instanceof File)) throw new Error('No file selected');
      if (file.size > 10 * 1024 * 1024) throw new Error('File too large (max 10MB)');

      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported || typeof imported !== 'object') throw new Error('Invalid JSON');

      const local = await chrome.storage.local.get(['clips', 'searchOnlyClips', 'categories', 'notes', 'quickPasteSettings', 'autoDeletePeriod', 'albumAttachmentOpenMode', 'theme']);

      const mergeById = (curRaw, incRaw, limit) => {
        const cur = Array.isArray(curRaw) ? curRaw : [];
        const inc = Array.isArray(incRaw) ? incRaw : [];
        const out = cur.slice();
        const seen = new Set(cur.map(x => (x && typeof x === 'object' && x.id != null) ? String(x.id) : ''));
        for (const item of inc) {
          if (!item || typeof item !== 'object') continue;
          if (item.id == null) continue;
          const k = String(item.id);
          if (!k || seen.has(k)) continue;
          out.push(item);
          seen.add(k);
          if (limit && out.length >= limit) break;
        }
        return out;
      };

      const nextClips = mergeById(local.clips, imported.clips, 500);
      const nextArchived = mergeById(local.searchOnlyClips, imported.searchOnlyClips, 1000);
      const nextCategories = mergeById(local.categories, imported.categories, 300);
      const nextNotes = mergeById(local.notes, imported.notes, 300);

      // Settings/theme: keep current unless missing; accept theme if valid
      const nextTheme = (local.theme === 'dark' || local.theme === 'light')
        ? local.theme
        : ((imported.theme === 'dark' || imported.theme === 'light') ? imported.theme : 'light');

      const nextQuickPasteSettings = (local.quickPasteSettings && typeof local.quickPasteSettings === 'object')
        ? local.quickPasteSettings
        : ((imported.quickPasteSettings && typeof imported.quickPasteSettings === 'object') ? imported.quickPasteSettings : {});

      const nextAutoDelete = local.autoDeletePeriod || imported.autoDeletePeriod || 'never';
      const nextAlbumOpenMode = (local.albumAttachmentOpenMode === 'overlay' || local.albumAttachmentOpenMode === 'edgePopup')
        ? local.albumAttachmentOpenMode
        : (imported.albumAttachmentOpenMode === 'overlay' || imported.albumAttachmentOpenMode === 'edgePopup' ? imported.albumAttachmentOpenMode : 'edgePopup');

      const appliedAt = Date.now();
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({
          clips: nextClips,
          searchOnlyClips: nextArchived,
          categories: nextCategories,
          notes: nextNotes,
          theme: nextTheme,
          quickPasteSettings: nextQuickPasteSettings,
          autoDeletePeriod: nextAutoDelete,
          albumAttachmentOpenMode: nextAlbumOpenMode,
          pc_local_updatedAt: appliedAt
        });
      });

      // PRACTICE #5: VERIFICATION
      const verify = await chrome.storage.local.get(['clips', 'searchOnlyClips', 'categories', 'notes']);
      if (!Array.isArray(verify.clips) || !Array.isArray(verify.categories) || !Array.isArray(verify.notes)) {
        throw new Error('Verification failed: import did not persist');
      }

      // Refresh UI + backup to sync (best-effort)
      await this.loadData();
      await this.loadNotes();
      this.renderChips();
      this.renderCategories();
      this.renderNotes();
      try { await this.backupLocalToSync('import:merge'); } catch (_) {}

      this.showToast('✅ Import complete (merged)');
    } catch (e) {
      console.error('❌ Import failed:', e);
      await rollback();
      this.showToast(`❌ Import failed: ${e.message || 'Unknown error'}`, 'error');
    }
  }

  // =====================================================
  // SHARE (Collaboration v1: share-to-media links)
  // =====================================================

  _sanitizeShareText(raw, maxLen = 1800) {
    const s = String(raw ?? '');
    // Strip control chars, normalize whitespace
    const cleaned = s
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
  }

  async _getActiveTabUrlSafe() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs && tabs[0] && typeof tabs[0].url === 'string' ? tabs[0].url : '';
      if (!url) return '';
      // Avoid sharing chrome-extension:// URLs etc
      if (!/^https?:\/\//i.test(url)) return '';
      return url;
    } catch (_) {
      return '';
    }
  }

  _openUrlInNewTab(url) {
    try {
      chrome.tabs.create({ url: String(url) });
    } catch (e) {
      console.error('❌ Failed to open share URL:', e);
    }
  }

  _closeShareMenu() {
    const existing = document.getElementById('pcShareMenuOverlay');
    if (existing) existing.remove();
  }

  async showShareMenuForClip(clip) {
    const clipText = clip && typeof clip === 'object' ? (clip.text ?? '') : String(clip ?? '');
    const text = this._sanitizeShareText(clipText, 2000);
    if (!text) {
      this.showToast('Nothing to share', 'error');
      return;
    }

    // Build a short title for Reddit/email
    const title = this._sanitizeShareText(text.split('\n')[0], 80) || 'PasteCraft Clip';
    const tweetText = this._sanitizeShareText(text, 260);

    const activeUrl = await this._getActiveTabUrlSafe();
    const fbUrl = activeUrl || 'https://pastecraft.com';

    this._closeShareMenu();

    const overlay = document.createElement('div');
    overlay.id = 'pcShareMenuOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: min(520px, 96vw);
      background: #111827;
      color: #e5e7eb;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.4);
    `;

    const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:700;">Share</div>
        <button id="pcShareCloseBtn" class="btn-secondary" type="button" style="padding:6px 10px;">Close</button>
      </div>
      <div style="margin-top:10px; font-size:12px; color:#9ca3af; line-height:1.4; word-break:break-word;">
        ${this.escapeHtml(preview)}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px;">
        <button id="pcShareCopyBtn" class="btn-primary" type="button">Copy</button>
        <button id="pcShareWhatsAppBtn" class="btn-secondary" type="button">WhatsApp</button>
        <button id="pcShareRedditBtn" class="btn-secondary" type="button">Reddit</button>
        <button id="pcShareXBtn" class="btn-secondary" type="button">X</button>
        <button id="pcShareEmailBtn" class="btn-secondary" type="button">Email</button>
        <button id="pcShareSmsBtn" class="btn-secondary" type="button">SMS</button>
        <button id="pcShareFacebookBtn" class="btn-secondary" type="button">Facebook</button>
      </div>
      <div style="margin-top:10px; font-size:11px; color:#9ca3af;">
        Facebook sharing is URL-based; your clip text is best shared via Copy.
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => this._closeShareMenu();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    card.querySelector('#pcShareCloseBtn')?.addEventListener('click', close);

    card.querySelector('#pcShareCopyBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        this.showToast('✅ Copied for sharing');
      } catch (e) {
        console.error('❌ Copy failed:', e);
        this.showToast('❌ Copy failed', 'error');
      }
    });

    card.querySelector('#pcShareWhatsAppBtn')?.addEventListener('click', () => {
      const u = `https://wa.me/?text=${encodeURIComponent(text)}`;
      this._openUrlInNewTab(u);
      close();
    });

    card.querySelector('#pcShareRedditBtn')?.addEventListener('click', () => {
      const u = `https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
      this._openUrlInNewTab(u);
      close();
    });

    card.querySelector('#pcShareXBtn')?.addEventListener('click', () => {
      const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      this._openUrlInNewTab(u);
      close();
    });

    card.querySelector('#pcShareEmailBtn')?.addEventListener('click', () => {
      const u = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
      this._openUrlInNewTab(u);
      close();
    });

    card.querySelector('#pcShareSmsBtn')?.addEventListener('click', () => {
      const u = `sms:?&body=${encodeURIComponent(text)}`;
      this._openUrlInNewTab(u);
      close();
    });

    card.querySelector('#pcShareFacebookBtn')?.addEventListener('click', async () => {
      // Best effort: open URL sharer and also copy text to clipboard
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {}
      const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fbUrl)}`;
      this._openUrlInNewTab(u);
      this.showToast('Copied text. Facebook shares URL.');
      close();
    });
  }

  openNoteViewer(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    this.currentViewerNoteId = noteId;
    const isAlbum = note.type === 'album';
    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const modal = document.getElementById('noteViewerModal');
    const icon = document.getElementById('noteViewerIcon');
    const titleText = document.getElementById('noteViewerTitleText');
    const backBtn = document.getElementById('noteViewerBackBtn');
    const descSection = document.getElementById('noteViewerDescSection');
    const descText = document.getElementById('noteViewerDesc');
    const contentText = document.getElementById('noteViewerContent');
    const attachSection = document.getElementById('noteViewerAttachmentsSection');
    const attachList = document.getElementById('noteViewerAttachments');
    const copyAllBtn = document.getElementById('copyAllAttachments');
    const attachmentsTitle = document.getElementById('noteViewerAttachmentsTitle');

    // Set icon and title
    icon.textContent = note.type === 'album' ? '📚' : '📝';
    const safeTitle = (note.title || '').trim();
    titleText.textContent = safeTitle || (note.type === 'album' ? 'Untitled Album' : 'Untitled Note');
    if (backBtn) backBtn.style.display = this.noteViewerParentAlbumId && !isAlbum ? 'inline-flex' : 'none';
    if (isAlbum) this.noteViewerParentAlbumId = null;

    // Description
    const safeDesc = (note.description || '').trim();
    if (safeDesc) {
      descSection.style.display = 'block';
      descText.textContent = safeDesc;
    } else {
      descSection.style.display = 'none';
    }

    // Content
    contentText.textContent = note.body || 'No content';

    // Album shows Notes list (references). Notes show Attachments list.
    if (isAlbum) {
      if (attachmentsTitle) attachmentsTitle.textContent = 'Notes';
      if (copyAllBtn) copyAllBtn.style.display = 'none';
    }

    if (allAttachments.length > 0) {
      attachSection.style.display = 'block';
      if (copyAllBtn) copyAllBtn.style.display = isAlbum ? 'none' : '';
      attachList.innerHTML = allAttachments.map((att, idx) => {
        const icon = att.type === 'clip' ? '📋' : att.type === 'image' ? '🖼️' : '🔗';
        const text = att.type === 'url' ? att.url : (att.text || '').substring(0, 80);
        const displayText = text.length > 80 ? text + '...' : text;

        if (isAlbum) {
          const sourceNoteId = att.sourceNoteId;
          let sourceNote = sourceNoteId ? this.notes.find(n => n && n.id == sourceNoteId) : null;
          // Legacy fallback: try to infer source note by matching attachment id.
          if (!sourceNote && att && att.id != null) {
            sourceNote = (this.notes || []).find(n => {
              if (!n || n.type === 'album') return false;
              const hasClip = Array.isArray(n.clips) && n.clips.some(c => c && c.id == att.id);
              const hasUrl = Array.isArray(n.urls) && n.urls.some(u => u && u.id == att.id);
              const hasImage = Array.isArray(n.images) && n.images.some(i => i && i.id == att.id);
              return hasClip || hasUrl || hasImage;
            }) || null;
          }
          const fromTitle = sourceNote ? ((sourceNote.title || '').trim() || 'Untitled Note') : 'Album';
          const metaLine = `
            <div style="margin-top:6px; font-size:11px; color:#6b7280; line-height:1.25;">
              <div><strong style="color:#4b5563;">From:</strong> ${this.escapeHtml(fromTitle)}</div>
            </div>
          `;
          return `
            <div class="viewer-attachment-item viewer-attachment-openable" data-index="${idx}" role="button" tabindex="0">
              <div class="viewer-attachment-info">
                <span class="viewer-attachment-icon">${icon}</span>
                <div style="min-width:0;">
                  <div class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(displayText)}</div>
                  ${metaLine}
                </div>
              </div>
              <div class="viewer-attachment-actions">
                <button class="btn-copy-album-attachment" data-index="${idx}" type="button">Copy</button>
                <button class="btn-open-album-attachment" data-index="${idx}" type="button" title="Open attachment" style="border:none; background:transparent; cursor:pointer; color:#9ca3af; font-size:18px; line-height:1; padding:0 2px;">›</button>
              </div>
            </div>
          `;
        }

        return `
          <div class="viewer-attachment-item">
            <div class="viewer-attachment-info">
              <span class="viewer-attachment-icon">${icon}</span>
              <span class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(displayText)}</span>
            </div>
            <div class="viewer-attachment-actions">
              <button class="btn-copy-attachment" data-index="${idx}" type="button">Copy</button>
            </div>
          </div>
        `;
        }).join('');

      if (isAlbum) {
        const openSourceNote = (idx) => {
          const att = allAttachments[idx];
          if (!att) return;
          let sourceNoteId = att.sourceNoteId;
          // Legacy fallback: infer source note by attachment id
          if (sourceNoteId == null && att.id != null) {
            const inferred = (this.notes || []).find(n => {
              if (!n || n.type === 'album') return false;
              const hasClip = Array.isArray(n.clips) && n.clips.some(c => c && c.id == att.id);
              const hasUrl = Array.isArray(n.urls) && n.urls.some(u => u && u.id == att.id);
              const hasImage = Array.isArray(n.images) && n.images.some(i => i && i.id == att.id);
              return hasClip || hasUrl || hasImage;
            });
            if (inferred) sourceNoteId = inferred.id;
          }

          if (sourceNoteId == null) {
            this.showToast('No source note for this item');
            return;
          }
          this.openAlbumSourceNoteOverlay(sourceNoteId, noteId);
        };

        // Copy handlers (albums)
        attachList.querySelectorAll('.btn-copy-album-attachment').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index, 10);
            const att = allAttachments[idx];
            if (!att) return;

            const copyText =
              att.type === 'url'
                ? att.url
                : att.type === 'image'
                  ? (att.url || att.src || att.dataUrl)
                  : att.text;

            if (copyText) {
              navigator.clipboard.writeText(copyText);
              this.showToast('Attachment copied!');
            }
          });
        });

        // Explicit open attachment (secondary action)
        attachList.querySelectorAll('.btn-open-album-attachment').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index, 10);
            if (!Number.isNaN(idx)) this.openAlbumAttachment(noteId, idx);
          });
        });

        attachList.querySelectorAll('.viewer-attachment-openable').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index, 10);
            if (!Number.isNaN(idx)) openSourceNote(idx);
          });
          item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const idx = parseInt(item.dataset.index, 10);
              if (!Number.isNaN(idx)) openSourceNote(idx);
            }
          });
        });
      } else {
        // Add copy handlers (notes only)
        attachList.querySelectorAll('.btn-copy-attachment').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const att = allAttachments[idx];
            if (att) {
              const copyText = att.type === 'url' ? att.url : att.text;
              if (copyText) {
                navigator.clipboard.writeText(copyText);
                this.showToast('Attachment copied!');
              }
            }
          });
        });
      }
    } else {
      attachSection.style.display = 'none';
      if (copyAllBtn) copyAllBtn.style.display = '';
    }

    modal.style.display = 'flex';
  }

  closeNoteViewer() {
    document.getElementById('noteViewerModal').style.display = 'none';
    this.currentViewerNoteId = null;
    this.noteViewerParentAlbumId = null;
  }

  getAlbumAttachmentOpenMode() {
    return this.albumAttachmentOpenMode === 'overlay' || this.albumAttachmentOpenMode === 'edgePopup'
      ? this.albumAttachmentOpenMode
      : 'edgePopup';
  }

  openAlbumAttachment(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    this.currentAlbumAttachmentContext = { noteId, attachmentIndex };

    const mode = this.getAlbumAttachmentOpenMode();
    if (mode === 'overlay') {
      this.openAlbumAttachmentOverlay(note, att);
      return;
    }

    this.openAlbumAttachmentInEdgePopup(noteId, attachmentIndex);
  }

  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const mfName = mf && mf.name ? String(mf.name) : '';
    const mfDesc = mf && mf.description ? String(mf.description) : '';
    const isRepoLoader =
      mfName.includes('Repo Loader') ||
      mfDesc.includes('repo root') ||
      mfDesc.includes('Actual extension lives in /extension');

    if (att.type === 'url' && att.url) {
      try {
        chrome.runtime.sendMessage({
          action: 'pcOpenPopupWindow',
          url: att.url,
          width: 980,
          height: 720
        });
      } catch (e) {
        try {
          chrome.windows.create({
            url: att.url,
            type: 'popup',
            width: 980,
            height: 720,
            focused: true
          });
        } catch (e2) {
          console.error('Failed to open URL in popup:', e2);
          this.showToast('Could not open link');
        }
      }
      return;
    }

    const viewerPath = isRepoLoader ? 'extension/attachment-viewer.html' : 'attachment-viewer.html';
    const viewerUrl =
      chrome.runtime.getURL(viewerPath) +
      `?noteId=${encodeURIComponent(String(noteId))}&index=${encodeURIComponent(String(attachmentIndex))}`;

    try {
      chrome.runtime.sendMessage({
        action: 'pcOpenPopupWindow',
        url: viewerUrl,
        width: 980,
        height: 720
      });
    } catch (e) {
      try {
        chrome.windows.create({
          url: viewerUrl,
          type: 'popup',
          width: 980,
          height: 720,
          focused: true
        });
      } catch (e2) {
        console.error('Failed to open attachment viewer popup:', e2);
        this.showToast('Could not open attachment');
      }
    }
  }

  openAlbumAttachmentOverlay(note, att) {
    const modal = document.getElementById('albumAttachmentViewerModal');
    const titleEl = document.getElementById('albumAttachmentViewerTitle');
    const metaSection = document.getElementById('albumAttachmentViewerNoteMeta');
    const albumTitle = document.getElementById('albumAttachmentViewerAlbumTitle');
    const albumDesc = document.getElementById('albumAttachmentViewerAlbumDesc');
    const body = document.getElementById('albumAttachmentViewerBody');
    const openBtn = document.getElementById('albumAttachmentOpenInPopupBtn');

    if (!modal || !titleEl || !metaSection || !albumTitle || !albumDesc || !body) return;

    // Album meta
    const safeTitle = (note.title || '').trim() || 'Untitled Album';
    const safeDesc = (note.description || '').trim();
    metaSection.style.display = 'block';
    albumTitle.textContent = safeTitle;
    albumDesc.textContent = safeDesc || '';

    // Attachment content
    const typeLabel = att.type === 'clip' ? 'Clip' : att.type === 'image' ? 'Image' : 'Link';
    titleEl.textContent = typeLabel;

    // Always allow open-in-popup as an escape hatch
    if (openBtn) openBtn.style.display = 'inline-flex';

    if (att.type === 'clip') {
      body.textContent = att.text || '';
    } else if (att.type === 'image') {
      const src = att.dataUrl || att.url || att.src || '';
      if (src) {
        body.innerHTML = `<img src="${this.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`;
      } else {
        body.textContent = 'Image attachment is missing a source.';
      }
    } else {
      const url = att.url || '';
      const safeUrl = this.escapeHtml(url);
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:600; color:#111827;">Link</div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
          <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
        </div>
      `;
    }

    modal.style.display = 'flex';
  }

  closeAlbumAttachmentViewer() {
    const modal = document.getElementById('albumAttachmentViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumAttachmentContext = null;
  }

  openAlbumSourceNoteOverlay(sourceNoteId, albumId) {
    const sourceNote = this.notes.find(n => n && n.id == sourceNoteId && n.type !== 'album');
    if (!sourceNote) {
      this.showToast('Source note not found');
      return;
    }

    const modal = document.getElementById('albumSourceNoteModal');
    const titleText = document.getElementById('albumSourceNoteTitleText');
    const descSection = document.getElementById('albumSourceNoteDescSection');
    const descText = document.getElementById('albumSourceNoteDesc');
    const body = document.getElementById('albumSourceNoteBody');
    const clipsSection = document.getElementById('albumSourceNoteClipsSection');
    const clipsList = document.getElementById('albumSourceNoteClips');
    const urlsSection = document.getElementById('albumSourceNoteUrlsSection');
    const urlsList = document.getElementById('albumSourceNoteUrls');
    const imagesSection = document.getElementById('albumSourceNoteImagesSection');
    const imagesList = document.getElementById('albumSourceNoteImages');

    if (!modal || !titleText || !descSection || !descText || !body || !clipsSection || !clipsList || !urlsSection || !urlsList || !imagesSection || !imagesList) {
      return;
    }

    this.currentAlbumSourceNoteContext = { sourceNoteId, albumId };

    const safeTitle = (sourceNote.title || '').trim();
    titleText.textContent = safeTitle || 'Untitled Note';

    const safeDesc = (sourceNote.description || '').trim();
    if (safeDesc) {
      descSection.style.display = 'block';
      descText.textContent = safeDesc;
    } else {
      descSection.style.display = 'none';
    }

    body.textContent = (sourceNote.body || '').trim() || 'No content';

    // Render sections
    const clips = Array.isArray(sourceNote.clips) ? sourceNote.clips : [];
    const urls = Array.isArray(sourceNote.urls) ? sourceNote.urls : [];
    const images = Array.isArray(sourceNote.images) ? sourceNote.images : [];

    clipsSection.style.display = clips.length > 0 ? 'block' : 'none';
    urlsSection.style.display = urls.length > 0 ? 'block' : 'none';
    imagesSection.style.display = images.length > 0 ? 'block' : 'none';

    clipsList.innerHTML = clips.map((c, idx) => {
      const text = (c && c.text) ? String(c.text) : '';
      const display = text.length > 120 ? text.substring(0, 120) + '...' : text;
      return `
        <div class="viewer-attachment-item" data-type="clip" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">📋</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="clip" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    urlsList.innerHTML = urls.map((u, idx) => {
      const url = (u && u.url) ? String(u.url) : '';
      const display = url.length > 120 ? url.substring(0, 120) + '...' : url;
      return `
        <div class="viewer-attachment-item" data-type="url" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">🔗</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(url)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="url" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    imagesList.innerHTML = images.map((i, idx) => {
      const src = (i && (i.url || i.src || i.dataUrl)) ? String(i.url || i.src || i.dataUrl) : '';
      const display = src.length > 120 ? src.substring(0, 120) + '...' : src;
      return `
        <div class="viewer-attachment-item" data-type="image" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">🖼️</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(src)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="image" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    // Per-attachment copy handlers
    modal.querySelectorAll('.btn-copy-source-note-attachment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const idx = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(idx)) return;

        let copyText = '';
        if (type === 'clip') {
          const c = clips[idx];
          copyText = c && c.text ? String(c.text) : '';
        } else if (type === 'url') {
          const u = urls[idx];
          copyText = u && u.url ? String(u.url) : '';
        } else if (type === 'image') {
          const i = images[idx];
          copyText = i ? String(i.url || i.src || i.dataUrl || '') : '';
        }

        if (copyText) {
          navigator.clipboard.writeText(copyText);
          this.showToast('Attachment copied!');
        }
      });
    });

    modal.style.display = 'flex';
  }

  closeAlbumSourceNoteOverlay() {
    const modal = document.getElementById('albumSourceNoteModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumSourceNoteContext = null;
  }

  getAlbumAttachmentOpenMode() {
    return this.albumAttachmentOpenMode === 'overlay' || this.albumAttachmentOpenMode === 'edgePopup'
      ? this.albumAttachmentOpenMode
      : 'edgePopup';
  }

  openAlbumAttachment(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    this.currentAlbumAttachmentContext = { noteId, attachmentIndex };

    const mode = this.getAlbumAttachmentOpenMode();
    if (mode === 'overlay') {
      this.openAlbumAttachmentOverlay(note, att);
      return;
    }

    this.openAlbumAttachmentInEdgePopup(noteId, attachmentIndex);
  }

  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const mfName = mf && mf.name ? String(mf.name) : '';
    const mfDesc = mf && mf.description ? String(mf.description) : '';
    const isRepoLoader =
      mfName.includes('Repo Loader') ||
      mfDesc.includes('repo root') ||
      mfDesc.includes('Actual extension lives in /extension');

    if (att.type === 'url' && att.url) {
      try {
        chrome.runtime.sendMessage({
          action: 'pcOpenPopupWindow',
          url: att.url,
          width: 980,
          height: 720
        });
      } catch (e) {
        try {
          chrome.windows.create({
            url: att.url,
            type: 'popup',
            width: 980,
            height: 720,
            focused: true
          });
        } catch (e2) {
          console.error('Failed to open URL in popup:', e2);
          this.showToast('Could not open link');
        }
      }
      return;
    }

    const viewerPath = isRepoLoader ? 'extension/attachment-viewer.html' : 'attachment-viewer.html';
    const viewerUrl =
      chrome.runtime.getURL(viewerPath) +
      `?noteId=${encodeURIComponent(String(noteId))}&index=${encodeURIComponent(String(attachmentIndex))}`;

    try {
      chrome.runtime.sendMessage({
        action: 'pcOpenPopupWindow',
        url: viewerUrl,
        width: 980,
        height: 720
      });
    } catch (e) {
      try {
        chrome.windows.create({
          url: viewerUrl,
          type: 'popup',
          width: 980,
          height: 720,
          focused: true
        });
      } catch (e2) {
        console.error('Failed to open attachment viewer popup:', e2);
        this.showToast('Could not open attachment');
      }
    }
  }

  openAlbumAttachmentOverlay(note, att) {
    const modal = document.getElementById('albumAttachmentViewerModal');
    const titleEl = document.getElementById('albumAttachmentViewerTitle');
    const metaSection = document.getElementById('albumAttachmentViewerNoteMeta');
    const albumTitle = document.getElementById('albumAttachmentViewerAlbumTitle');
    const albumDesc = document.getElementById('albumAttachmentViewerAlbumDesc');
    const body = document.getElementById('albumAttachmentViewerBody');
    const openBtn = document.getElementById('albumAttachmentOpenInPopupBtn');

    if (!modal || !titleEl || !metaSection || !albumTitle || !albumDesc || !body) return;

    // Album meta
    const safeTitle = (note.title || '').trim() || 'Untitled Album';
    const safeDesc = (note.description || '').trim();
    metaSection.style.display = 'block';
    albumTitle.textContent = safeTitle;
    albumDesc.textContent = safeDesc || '';

    // Attachment content
    const typeLabel = att.type === 'clip' ? 'Clip' : att.type === 'image' ? 'Image' : 'Link';
    titleEl.textContent = typeLabel;

    // Always allow open-in-popup as an escape hatch
    if (openBtn) openBtn.style.display = 'inline-flex';

    if (att.type === 'clip') {
      body.textContent = att.text || '';
    } else if (att.type === 'image') {
      const src = att.dataUrl || att.url || att.src || '';
      if (src) {
        body.innerHTML = `<img src="${this.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`;
      } else {
        body.textContent = 'Image attachment is missing a source.';
      }
    } else {
      const url = att.url || '';
      const safeUrl = this.escapeHtml(url);
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:600; color:#111827;">Link</div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
          <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
        </div>
      `;
    }

    modal.style.display = 'flex';
  }

  closeAlbumAttachmentViewer() {
    const modal = document.getElementById('albumAttachmentViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumAttachmentContext = null;
  }

  copyAllNoteAttachments() {
    const noteId = this.currentViewerNoteId;
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    const allText = [
      ...(note.clips || []).map(c => c.text || ''),
      ...(note.urls || []).map(u => u.url || '')
    ].filter(t => t).join('\n\n');

    if (allText) {
      navigator.clipboard.writeText(allText);
      this.showToast('All attachments copied!');
    } else {
      this.showToast('No attachments to copy');
    }
  }

  showAlbumPicker() {
    const modal = document.getElementById('albumPickerModal');
    this.renderAlbumPicker();
    modal.style.display = 'flex';
  }

  showAlbumPickerForNote() {
    const modal = document.getElementById('albumPickerModal');
    this.renderAlbumPicker();
    modal.style.display = 'flex';
  }

  closeAlbumPicker() {
    document.getElementById('albumPickerModal').style.display = 'none';
    this.pendingNoteForAlbum = null;
  }

  showBackToAlbumPicker() {
    const backBtn = document.getElementById('backToAlbumPicker');
    if (backBtn) {
      backBtn.style.display = 'block';
    }
  }

  hideBackToAlbumPicker() {
    const backBtn = document.getElementById('backToAlbumPicker');
    if (backBtn) {
      backBtn.style.display = 'none';
    }
  }

  renderAlbumPicker(searchTerm = '') {
    const list = document.getElementById('albumPickerList');
    
    // If we have a pending note to send to album, show only albums
    const showOnlyAlbums = !!this.pendingNoteForAlbum;
    let filteredNotes = showOnlyAlbums ? this.notes.filter(n => n.type === 'album') : this.notes;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredNotes = filteredNotes.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.description.toLowerCase().includes(term)
      );
    }

    if (filteredNotes.length === 0) {
      list.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 20px;">No ${showOnlyAlbums ? 'albums' : 'notes'} found</p>`;
      return;
    }

    list.innerHTML = filteredNotes.map(note => {
      const iconSrc = note.type === 'album' ? 'assets/note-icons/album-folder.svg' : 'assets/note-icons/notebook.svg';
      const itemCount =
        note.type === 'album'
          ? (Array.isArray(note.noteRefs) ? note.noteRefs.length : 0)
          : (note.clips?.length || 0) + (note.images?.length || 0) + (note.urls?.length || 0);
      const itemClass = note.type === 'album' ? 'album-picker-item album' : 'album-picker-item';

      return `
        <div class="${itemClass}" data-note-id="${note.id}">
          <div class="album-picker-info">
            <span class="album-picker-icon"><img src="${iconSrc}" alt="" class="pc-icon pc-icon-18"></span>
            <div class="album-picker-details">
              <div class="album-picker-title">${this.escapeHtml(note.title)}</div>
              <div class="album-picker-meta">${itemCount} items</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.album-picker-item').forEach(item => {
      item.addEventListener('click', async () => {
        const noteId = item.dataset.noteId;
        
        // Check if we're adding a note to an album or a clip to a note
        if (this.pendingNoteForAlbum) {
          await this.addNoteToAlbum(noteId);
        } else {
          await this.addCurrentClipToNote(noteId);
        }
      });
    });
  }

  filterAlbumPicker(searchTerm) {
    this.renderAlbumPicker(searchTerm);
  }

  async addCurrentClipToNote(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    // Get the clip to add (pending clip or most recent clip)
    let clipToAdd = this.pendingClipForNotes;
    
    if (!clipToAdd) {
      if (this.clips.length === 0) {
        this.showToast('No clips to add');
        return;
      }
      clipToAdd = this.clips[0];
    }

    if (!note.clips) note.clips = [];
    
    note.clips.push({
      type: 'clip',
      id: clipToAdd.id,
      text: clipToAdd.text,
      addedDate: Date.now()
    });

    note.updatedAt = Date.now();
    this.refreshAlbumsForNote(note);
    await this.saveNotes();
    this.closeAlbumPicker();
    this.pendingClipForNotes = null; // Clear pending clip
    this.showToast(`Clip added to "${note.title}"`);
  }

  async addNoteToAlbum(albumId) {
    const album = this.notes.find(n => n.id == albumId && n.type === 'album');
    const sourceNote = this.pendingNoteForAlbum;
    
    if (!album || !sourceNote) return;

    // Copy content from note to album (keep original note unchanged)
    if (!album.clips) album.clips = [];
    if (!album.urls) album.urls = [];
    if (!album.images) album.images = [];
    if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
    if (!album.sourceNoteIds.includes(sourceNote.id)) album.sourceNoteIds.push(sourceNote.id);

    // Add a special "note content" clip if the note has body content
    if (sourceNote.body && sourceNote.body.trim()) {
      album.clips.push({
        type: 'clip',
        id: Date.now() + Math.random(),
        text: `[From: ${sourceNote.title || 'Untitled Note'}]\n\n${sourceNote.body}`,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      });
    }

    // Copy all attachments from source note
    if (sourceNote.clips?.length > 0) {
      album.clips.push(...sourceNote.clips.map(c => ({
        ...c,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    if (sourceNote.urls?.length > 0) {
      album.urls.push(...sourceNote.urls.map(u => ({
        ...u,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    if (sourceNote.images?.length > 0) {
      album.images.push(...sourceNote.images.map(i => ({
        ...i,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    album.updatedAt = Date.now();
    await this.saveNotes();
    this.closeAlbumPicker();
    this.pendingNoteForAlbum = null;
    this.showToast(`Note added to album "${album.title}"`);
    this.renderNotes(); // Refresh to show updated counts
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup script loaded');
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    // Fallback simple interface
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>📋 PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
  }
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
