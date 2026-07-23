/** @forward-slice CRUD create op */
import {
  retryOperation,
  createSnapshot,
  restoreSnapshot,
  runUiUpdater,
} from './crud.core.js';

export async function createOperation({
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
      runUiUpdater(uiUpdater, null, iconRoot, 'create');
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
    runUiUpdater(uiUpdater, null, iconRoot, 'create');

    // Step 4: Persist with retry (still awaited so rollback fires on real failure)
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
