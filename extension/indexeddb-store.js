/**
 * @legacy-cutoff Thin root facade for legacy <script src="indexeddb-store.js">.
 * Canonical: extension/shared/storage/indexeddb-store.js
 * Slice ACL: extension/bridges/storage/indexeddb.facade.js
 */
(function loadPasteCraftIndexedDbRootFacade() {
  if (globalThis.pasteCraftIndexedDB) return;
  if (typeof document === 'undefined' || typeof document.write !== 'function') {
    console.error('[PasteCraft] indexeddb-store root facade requires DOM script load of shared/storage/indexeddb-store.js');
    return;
  }
  document.write('<script src="shared/storage/indexeddb-store.js"><\/script>');
})();
