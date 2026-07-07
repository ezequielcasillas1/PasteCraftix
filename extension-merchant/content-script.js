(function bootstrapPasteCraftMerchantContent() {
  const manifest = chrome.runtime.getManifest?.() || {};
  const name = String(manifest.name || '');
  const desc = String(manifest.description || '');
  const isRepoLoader =
    name.includes('Repo Loader') ||
    desc.includes('repo root') ||
    desc.includes('extension-merchant');
  const modulePath = isRepoLoader
    ? 'extension-merchant/content/content.js'
    : 'content/content.js';
  const url = chrome.runtime.getURL(modulePath);

  import(url).catch((err) => {
    try {
      console.error('[PasteCraft Merchant] content bootstrap failed:', err);
    } catch (_) {}
  });
})();
