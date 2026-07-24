/**
 * @legacy-cutoff Thin root facade for legacy <script src="tiered-storage.js">.
 * Canonical: extension/shared/storage/tiered-storage.js
 * Slice ACL: extension/bridges/storage/tiered-storage.facade.js
 */
(function loadPasteCraftTieredStorageRootFacade() {
  if (globalThis.tieredStorageManager) return;
  if (typeof document === 'undefined' || typeof document.write !== 'function') {
    console.error('[PasteCraft] tiered-storage root facade requires DOM script load of shared/storage/tiered-storage.js');
    return;
  }
  document.write('<script src="shared/storage/tiered-storage.js"><\/script>');
})();
