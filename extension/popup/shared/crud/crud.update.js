/** @forward-slice CRUD update op */
import {
  retryOperation,
  createSnapshot,
  restoreSnapshot,
  runUiUpdater,
} from './crud.core.js';

export async function updateOperation({
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
      snapshot[key] = createSnapshot(currentState[key]);
    }
  });

  const rollback = async () => {
    try {
      restoreSnapshot(currentState, snapshot);
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
      runUiUpdater(uiUpdater, null, iconRoot, 'update');
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
    runUiUpdater(uiUpdater, null, iconRoot, 'update');

    // Step 4: Persist with retry
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
