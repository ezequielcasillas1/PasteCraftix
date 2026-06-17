(function initPasteCraftCrud(globalScope) {
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

  /** Paint Lucide placeholders immediately after CRUD-driven DOM updates. */
  static renderLucideIconsAfterUi(meta, iconRoot, crudOp) {
    if (typeof window === 'undefined') return;
    if (window.__pcTabIconRendering || window.__pcPopupLucideBooting) return;
    const root = iconRoot instanceof Element
      ? iconRoot
      : meta?.iconRoot instanceof Element
        ? meta.iconRoot
        : meta?.uiRoot instanceof Element
          ? meta.uiRoot
          : document.body;
    if (typeof window.renderLucideIconsSync === 'function') {
      window.renderLucideIconsSync(root);
    } else if (typeof window.renderLucideIcons === 'function') {
      window.renderLucideIcons(root instanceof Element ? root : undefined);
    }
  }

  static runUiUpdater(uiUpdater, meta, iconRoot, crudOp) {
    try {
      uiUpdater?.(meta);
    } catch (uiErr) {
      console.error('?? uiUpdater threw:', uiErr);
    }
    PasteCraftCRUD.renderLucideIconsAfterUi(meta, iconRoot, crudOp);
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
    iconRoot, // optional Element scope for Lucide render after uiUpdater
    
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
        PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, entityType);
      } catch (rollbackError) {
        console.error(`? Rollback failed for ${entityType}:`, rollbackError);
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
          return currentState[key].some((item) => {
            if (entityType === 'note') return item.id == entityId;
            return item.id === entityId;
          });
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
      PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, entityType);

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
          const idbStateKey = { notes: 'notes', categories: 'categories', clips: 'clips' }[idbStoreName];
          if (idbStateKey && Array.isArray(currentState[idbStateKey]) && typeof window.pasteCraftIndexedDB.syncEntityFromLocalStorage === 'function') {
            await window.pasteCraftIndexedDB.syncEntityFromLocalStorage(idbStoreName, currentState[idbStateKey]);
          }
        } catch (idbErr) {
          console.warn(`?? IDB hard-delete failed for ${entityType} (chrome.storage delete succeeded):`, idbErr?.message || idbErr);
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
          console.warn(`?? Tombstone write failed for ${entityType}:`, tombErr?.message || tombErr);
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
            if (!ok) console.warn(`?? Post-write verification still sees ${entityType}:`, entityId);
          })
          .catch((verErr) => console.warn(`?? Verifier threw (${entityType} delete):`, verErr));
      }

      // Background sync (non-blocking)
      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(entity, deletedAt))
          .catch((error) => {
            console.error(`?? Background sync failed for ${entityType} (local deletion succeeded):`, error);
          });
      }

      return { success: true, entity };
    } catch (error) {
      // Rollback on any failure
      console.error(`? ${entityType} deletion failed, rolling back:`, error);
      await rollback();
      const msg = errorMessage?.(error) || `Failed to delete ${entityType}: ${error.message || 'Unknown error'}`;
      showToast?.(msg, 'error');
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generic CRUD DELETE-MANY operation with all 5 best practices
   */
  static async deleteManyOperation({
    entityIds,
    entityType,
    stateGetter,
    stateSetter,
    stateKeys,
    validator,
    idempotencyCheck,
    resolveEntities,
    storageKeys,
    storageWriter,
    deleteFromArray,
    updateRelatedEntities,
    itemIdGetter,
    idbStoreName,
    idbIdsResolver,
    tombstoneStorageKey,
    writeTombstones,
    verifier,
    uiUpdater,
    iconRoot,
    backgroundSync,
    successMessage,
    errorMessage,
    showToast
  }) {
    const normalizedIds = Array.isArray(entityIds)
      ? Array.from(new Set(entityIds.map(id => String(id)).filter(Boolean)))
      : [];

    if (normalizedIds.length === 0) {
      const msg = typeof errorMessage === 'function' ? errorMessage('Invalid entity IDs') : errorMessage;
      showToast?.(msg || 'Invalid entities - cannot delete', 'error');
      return { success: false, error: 'Invalid entity IDs' };
    }

    const currentState = stateGetter();
    if (!currentState || typeof currentState !== 'object') {
      const msg = typeof errorMessage === 'function' ? errorMessage('Invalid state') : errorMessage;
      showToast?.(msg || 'Invalid state - cannot delete', 'error');
      return { success: false, error: 'Invalid state' };
    }

    if (validator) {
      const validation = validator({ ids: normalizedIds }, currentState);
      if (!validation.valid) {
        showToast?.(validation.error || 'Validation failed', 'error');
        return { success: false, error: validation.error || 'Validation failed' };
      }
    }

    if (idempotencyCheck && idempotencyCheck(normalizedIds, currentState)) {
      const msg = typeof successMessage === 'function' ? successMessage([]) : successMessage;
      if (msg) showToast?.(msg, 'success');
      return { success: true, skipped: true, entities: [] };
    }

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
        PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, entityType);
      } catch (rollbackError) {
        console.error(`? Rollback failed for ${entityType} batch delete:`, rollbackError);
      }
    };

    try {
      const deletedAt = Date.now();
      const idSet = new Set(normalizedIds);
      const entities = resolveEntities
        ? (resolveEntities(normalizedIds, currentState, deletedAt) || [])
        : normalizedIds.map(id => ({ id, deletedAt }));

      if (updateRelatedEntities) {
        updateRelatedEntities(currentState, entities);
      }

      if (deleteFromArray) {
        stateKeys.forEach(key => {
          if (Array.isArray(currentState[key])) {
            currentState[key] = deleteFromArray(currentState[key], idSet, entities);
          }
        });
      }

      const getItemId = typeof itemIdGetter === 'function'
        ? itemIdGetter
        : (item) => String(item?.id ?? '');

      const stillExists = stateKeys.some(key => {
        if (!Array.isArray(currentState[key])) return false;
        return currentState[key].some((item) => idSet.has(getItemId(item)));
      });
      if (stillExists) {
        throw new Error(`${entityType} items still exist after deletion operation`);
      }

      await stateSetter(currentState);

      PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, entityType);

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

      if (idbStoreName && typeof window !== 'undefined' && window.pasteCraftIndexedDB) {
        try {
          const resolvedIds = typeof idbIdsResolver === 'function'
            ? idbIdsResolver(entities, normalizedIds)
            : normalizedIds;
          const ids = Array.isArray(resolvedIds)
            ? Array.from(new Set(resolvedIds.map(String).filter(Boolean)))
            : [];
          if (ids.length > 0) {
            await window.pasteCraftIndexedDB.deleteByIds(idbStoreName, ids);
          }
          const idbStateKey = { notes: 'notes', categories: 'categories', clips: 'clips' }[idbStoreName];
          if (idbStateKey && Array.isArray(currentState[idbStateKey]) && typeof window.pasteCraftIndexedDB.syncEntityFromLocalStorage === 'function') {
            await window.pasteCraftIndexedDB.syncEntityFromLocalStorage(idbStoreName, currentState[idbStateKey]);
          }
        } catch (idbErr) {
          console.warn(`?? IDB hard-delete failed for ${entityType} batch delete:`, idbErr?.message || idbErr);
        }
      }

      if (typeof writeTombstones === 'function') {
        try {
          await writeTombstones(entities, deletedAt);
        } catch (tombErr) {
          console.warn(`?? Custom tombstone write failed for ${entityType}:`, tombErr?.message || tombErr);
        }
      } else if (tombstoneStorageKey) {
        try {
          const existing = await new Promise((resolve) => {
            chrome.storage.local.get([tombstoneStorageKey], (res) => resolve(res || {}));
          });
          const prev = Array.isArray(existing[tombstoneStorageKey]) ? existing[tombstoneStorageKey] : [];
          const prevIds = new Set(prev.map((t) => String(t?.id || '')).filter(Boolean));
          const next = entities
            .filter((entity) => !prevIds.has(String(entity?.id || '')))
            .map((entity) => ({
              ...entity,
              deletedAt,
              updatedAt: deletedAt,
            }));
          if (next.length > 0) {
            await new Promise((resolve) => {
              chrome.storage.local.set({ [tombstoneStorageKey]: [...prev, ...next] }, resolve);
            });
          }
        } catch (tombErr) {
          console.warn(`?? Tombstone write failed for ${entityType}:`, tombErr?.message || tombErr);
        }
      }

      const msg = typeof successMessage === 'function' ? successMessage(entities) : successMessage;
      if (msg) showToast?.(msg, 'success');

      if (verifier) {
        Promise.resolve()
          .then(() => verifier(normalizedIds, entities))
          .then((ok) => {
            if (!ok) console.warn(`?? Post-write verification still sees ${entityType} batch delete:`, normalizedIds);
          })
          .catch((verErr) => console.warn(`?? Verifier threw (${entityType} batch delete):`, verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(entities, deletedAt))
          .catch((error) => {
            console.error(`?? Background sync failed for ${entityType} batch delete (local deletion succeeded):`, error);
          });
      }

      return { success: true, entities, deletedAt };
    } catch (error) {
      console.error(`? ${entityType} batch deletion failed, rolling back:`, error);
      await rollback();
      const msg = typeof errorMessage === 'function' ? errorMessage(error) : errorMessage;
      showToast?.(msg || `Failed to delete ${entityType}: ${error.message || 'Unknown error'}`, 'error');
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Generic CRUD SAVE/MUTATE operation with all 5 best practices
   */
  static async saveOperation({
    stateGetter,
    stateSetter,
    stateKeys,
    validator,
    mutateState,
    storageKeys,
    storageWriter,
    buildStorageData,
    verifier,
    uiUpdater,
    iconRoot,
    backgroundSync,
    successMessage,
    errorMessage,
    showToast
  }) {
    const currentState = stateGetter();
    if (!currentState || typeof currentState !== 'object') {
      const msg = typeof errorMessage === 'function' ? errorMessage('Invalid state') : errorMessage;
      showToast?.(msg || 'Invalid state - cannot save', 'error');
      return { success: false, error: 'Invalid state' };
    }

    if (validator) {
      const validation = await validator(currentState);
      if (!validation.valid) {
        showToast?.(validation.error || 'Validation failed', 'error');
        return { success: false, error: validation.error || 'Validation failed' };
      }
    }

    const snapshot = {};
    stateKeys.forEach(key => {
      if (currentState[key] !== undefined) {
        snapshot[key] = PasteCraftCRUD.createSnapshot(currentState[key]);
      }
    });

    const buildData = async (state, meta) => {
      if (typeof buildStorageData === 'function') {
        return await buildStorageData(state, meta);
      }
      const storageData = {};
      storageKeys.forEach(key => {
        if (state[key] !== undefined) {
          storageData[key] = state[key];
        }
      });
      return storageData;
    };

    const rollback = async () => {
      try {
        PasteCraftCRUD.restoreSnapshot(currentState, snapshot);
        await stateSetter(currentState);
        if (storageWriter) {
          await PasteCraftCRUD.retryOperation(async () => {
            const storageData = await buildData(currentState, { rollback: true });
            await storageWriter(storageData, currentState, { rollback: true });
          });
        }
        PasteCraftCRUD.runUiUpdater(uiUpdater, { rollback: true }, iconRoot, 'save-rollback');
      } catch (rollbackError) {
        console.error('? Rollback failed:', rollbackError);
      }
    };

    try {
      const meta = await (mutateState?.(currentState) || {});
      await stateSetter(currentState, meta);

      PasteCraftCRUD.runUiUpdater(uiUpdater, meta, iconRoot, 'save');

      if (storageWriter) {
        await PasteCraftCRUD.retryOperation(async () => {
          const storageData = await buildData(currentState, meta);
          await storageWriter(storageData, currentState, meta);
        });
      }

      const msg = typeof successMessage === 'function' ? successMessage(meta, currentState) : successMessage;
      if (msg) showToast?.(msg, 'success');

      if (verifier) {
        Promise.resolve()
          .then(() => verifier(meta, currentState))
          .then((ok) => {
            if (!ok) console.warn('?? Post-write verification failed (save operation)');
          })
          .catch((verErr) => console.warn('?? Verifier threw (save operation):', verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(meta, currentState))
          .catch((error) => {
            console.error('?? Background sync failed (local save succeeded):', error);
          });
      }

      return { success: true, ...(meta || {}) };
    } catch (error) {
      await rollback();
      const msg = typeof errorMessage === 'function' ? errorMessage(error) : errorMessage;
      showToast?.(msg || `Failed to save: ${error.message || 'Unknown error'}`, 'error');
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
    iconRoot,
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
        PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, 'create');
      } catch (rollbackError) {
        console.error('? Rollback failed:', rollbackError);
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
      PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, 'create');

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
      //   If it fails we just warn � we do NOT rollback a write that Chrome
      //   acknowledged. This removes the biggest source of perceived lag.
      if (verifier) {
        Promise.resolve()
          .then(() => verifier(entity))
          .then((ok) => {
            if (!ok) console.warn('?? Post-write verification missed entity (create):', entity?.id);
          })
          .catch((verErr) => console.warn('?? Verifier threw (create):', verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync(entity))
          .catch((error) => {
            console.error('?? Background sync failed (local creation succeeded):', error);
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
    iconRoot,
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
        PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, 'update');
      } catch (rollbackError) {
        console.error('? Rollback failed:', rollbackError);
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
      PasteCraftCRUD.runUiUpdater(uiUpdater, null, iconRoot, 'update');

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
            if (!ok) console.warn('?? Post-write verification failed (update):', entityId);
          })
          .catch((verErr) => console.warn('?? Verifier threw (update):', verErr));
      }

      if (backgroundSync) {
        Promise.resolve()
          .then(() => backgroundSync({ ...entity, ...updates }))
          .catch((error) => {
            console.error('?? Background sync failed (local update succeeded):', error);
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
  globalScope.PasteCraftCRUD = PasteCraftCRUD;
})(typeof window !== 'undefined' ? window : globalThis);
