// Backward-compat content script entry (classic content script safe).
// Dynamic import requires content modules to be listed in web_accessible_resources.
(function bootstrapPasteCraftContent() {
  const manifest = chrome.runtime.getManifest?.() || {};
  const name = String(manifest.name || '');
  const desc = String(manifest.description || '');
  const isRepoLoader =
    name.includes('Repo Loader') ||
    desc.includes('repo root') ||
    desc.includes('Actual extension lives in /extension');
  const modulePath = isRepoLoader
    ? 'extension/content/content.js'
    : 'content/content.js';
  const url = chrome.runtime.getURL(modulePath);

  import(url).catch((err) => {
    try {
      console.error('[PasteCraft] content bootstrap failed:', err);
    } catch (_) {}
  });
})();
