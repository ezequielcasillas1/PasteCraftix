/**
 * @forward-slice ACL — tiered storage for popup/content slices.
 * Thin facade over tieredStorageManager; does not absorb business rules.
 */

function resolveTieredStorageManager() {
  return globalThis.tieredStorageManager
    ?? globalThis.window?.tieredStorageManager
    ?? null;
}

function resolveStorageMeter() {
  return globalThis.StorageMeter
    ?? globalThis.window?.StorageMeter
    ?? null;
}

export function isTieredStorageAvailable() {
  return !!resolveStorageMeter() && !!resolveTieredStorageManager();
}

export function getTieredStorageManager() {
  return resolveTieredStorageManager();
}

export function getTieredStore(entityType, options = {}) {
  const manager = resolveTieredStorageManager();
  if (!manager?.getStore) {
    throw new Error('tieredStorageManager not loaded');
  }
  return manager.getStore(entityType, options);
}

export function clearTieredCaches() {
  const manager = resolveTieredStorageManager();
  if (!manager?.clearAllCaches) return;
  manager.clearAllCaches();
}

export function getTieredStatus() {
  const manager = resolveTieredStorageManager();
  if (!manager?.getStatus) return {};
  return manager.getStatus();
}
