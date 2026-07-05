// PasteCraft Quick Paste Content Script

const PASTECRAFT_LOGS_ENABLED = (() => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.PASTECRAFT_DEBUG === true) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {
    // Ignore storage access errors.
  }
  return false;
})();

if (!PASTECRAFT_LOGS_ENABLED && typeof console !== 'undefined') {
  const pastecraftNoop = () => {};
  console.log = pastecraftNoop;
  console.debug = pastecraftNoop;
  console.info = pastecraftNoop;
}

async function safeRuntimeSendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

function isExtensionContextValid() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

// Resource URL helper:
// - When loaded via repo root `manifest.json` ("Repo Loader"), assets live under `extension/*`.
// - When loaded via `/extension/manifest.json`, assets live at the extension root.
const __PASTECRAFT_MANIFEST =
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  typeof chrome.runtime.getManifest === 'function'
    ? chrome.runtime.getManifest()
    : null;
const __PASTECRAFT_IS_REPO_LOADER =
  !!__PASTECRAFT_MANIFEST &&
  (String(__PASTECRAFT_MANIFEST.name || '').includes('Repo Loader') ||
    String(__PASTECRAFT_MANIFEST.description || '').includes('repo root') ||
    String(__PASTECRAFT_MANIFEST.description || '').includes('Actual extension lives in /extension'));

function pastecraftGetURL(path) {
  const normalized = String(path || '').replace(/^\/+/, '');
  const finalPath = __PASTECRAFT_IS_REPO_LOADER ? `extension/${normalized}` : normalized;
  return chrome.runtime.getURL(finalPath);
}

const PASTECRAFT_PAGE_ORIGIN = window.location.origin;


export { safeRuntimeSendMessage, isExtensionContextValid, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN };
