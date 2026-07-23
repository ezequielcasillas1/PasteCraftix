/** @forward-slice Shared CRUD core — retry, snapshot, UI paint helpers. */

export async function retryOperation(operation, maxRetries = 3, baseDelay = 100) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function createSnapshot(data) {
  return JSON.parse(JSON.stringify(data));
}

export function restoreSnapshot(target, snapshot) {
  Object.keys(snapshot).forEach((key) => {
    target[key] = snapshot[key];
  });
}

/** Paint Lucide placeholders immediately after CRUD-driven DOM updates. */
export function renderLucideIconsAfterUi(meta, iconRoot, _crudOp) {
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

export function runUiUpdater(uiUpdater, meta, iconRoot, crudOp) {
  try {
    uiUpdater?.(meta);
  } catch (uiErr) {
    console.error('?? uiUpdater threw:', uiErr);
  }
  renderLucideIconsAfterUi(meta, iconRoot, crudOp);
}

export function snapshotStateKeys(currentState, stateKeys) {
  const snapshot = {};
  stateKeys.forEach((key) => {
    if (currentState[key] !== undefined) {
      snapshot[key] = createSnapshot(currentState[key]);
    }
  });
  return snapshot;
}

export function buildStoragePayload(currentState, storageKeys, { stampLocalUpdatedAt = true } = {}) {
  const storageData = {};
  storageKeys.forEach((key) => {
    if (currentState[key] !== undefined) {
      storageData[key] = currentState[key];
    }
  });
  if (stampLocalUpdatedAt) storageData.pc_local_updatedAt = Date.now();
  return storageData;
}
