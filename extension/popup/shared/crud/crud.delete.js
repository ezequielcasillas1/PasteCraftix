/** @forward-slice CRUD delete / deleteMany ops */
import {
  retryOperation,
  createSnapshot,
  restoreSnapshot,
  runUiUpdater,
} from './crud.core.js';
import {
  hardDeleteFromIndexedDb,
  appendLocalTombstone,
  appendLocalTombstones,
} from './crud.local.js';

export async function deleteOperation({
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
      snapshot[key] = createSnapshot(currentState[key]);
    }
  });

  const rollback = async () => {
    try {
      restoreSnapshot(currentState, snapshot);
      await stateSetter(currentState);
      if (storageWriter) {
        await retryOperation(async () => {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          await storageWriter(storageData);
        });
      }
      runUiUpdater(uiUpdater, null, iconRoot, entityType);
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
    runUiUpdater(uiUpdater, null, iconRoot, entityType);

    // Step 4: Persist to storage with retry
    if (storageWriter) {
      await retryOperation(async () => {
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
    await hardDeleteFromIndexedDb({
      idbStoreName,
      ids: [String(entityId), ...(Array.isArray(idbExtraIds) ? idbExtraIds.map(String) : [])],
      currentState,
    });

    // Step 4c: RECORD LOCAL TOMBSTONE BEFORE BACKGROUND SYNC
    if (tombstoneStorageKey) {
      await appendLocalTombstone({
        tombstoneStorageKey,
        entityId,
        entityName,
        deletedAt,
      });
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

export async function deleteManyOperation({
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
    ? Array.from(new Set(entityIds.filter((id) => id != null && id !== '').map((id) => String(id))))
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
      snapshot[key] = createSnapshot(currentState[key]);
    }
  });

  const rollback = async () => {
    try {
      restoreSnapshot(currentState, snapshot);
      await stateSetter(currentState);
      if (storageWriter) {
        await retryOperation(async () => {
          const storageData = {};
          storageKeys.forEach(key => {
            if (currentState[key] !== undefined) {
              storageData[key] = currentState[key];
            }
          });
          await storageWriter(storageData);
        });
      }
      runUiUpdater(uiUpdater, null, iconRoot, entityType);
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

    runUiUpdater(uiUpdater, null, iconRoot, entityType);

    if (storageWriter) {
      await retryOperation(async () => {
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

    if (idbStoreName) {
      const resolvedIds = typeof idbIdsResolver === 'function'
        ? idbIdsResolver(entities, normalizedIds)
        : normalizedIds;
      await hardDeleteFromIndexedDb({
        idbStoreName,
        ids: resolvedIds,
        currentState,
      });
    }

    if (typeof writeTombstones === 'function') {
      try {
        await writeTombstones(entities, deletedAt);
      } catch (tombErr) {
        console.warn(`?? Custom tombstone write failed for ${entityType}:`, tombErr?.message || tombErr);
      }
    } else if (tombstoneStorageKey) {
      await appendLocalTombstones({
        tombstoneStorageKey,
        entities,
        deletedAt,
      });
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
