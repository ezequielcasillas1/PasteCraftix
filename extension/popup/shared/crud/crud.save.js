/** @forward-slice CRUD save/mutate op */
import {
  retryOperation,
  createSnapshot,
  restoreSnapshot,
  runUiUpdater,
} from './crud.core.js';

export async function saveOperation({
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
      snapshot[key] = createSnapshot(currentState[key]);
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
      restoreSnapshot(currentState, snapshot);
      await stateSetter(currentState);
      if (storageWriter) {
        await retryOperation(async () => {
          const storageData = await buildData(currentState, { rollback: true });
          await storageWriter(storageData, currentState, { rollback: true });
        });
      }
      runUiUpdater(uiUpdater, { rollback: true }, iconRoot, 'save-rollback');
    } catch (rollbackError) {
      console.error('? Rollback failed:', rollbackError);
    }
  };

  try {
    const meta = await (mutateState?.(currentState) || {});
    await stateSetter(currentState, meta);

    runUiUpdater(uiUpdater, meta, iconRoot, 'save');

    if (storageWriter) {
      await retryOperation(async () => {
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
