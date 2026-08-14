/**
 * @forward-slice Apply Chrome/Edge store updates when downloaded.
 * Arkitect: Observer (onUpdateAvailable) so pending packages are not stuck
 * behind an in-use service worker / offscreen clipboard document.
 * Side-effect module: registers lifecycle listeners.
 */

async function closeOffscreenIfOpen() {
  try {
    if (!chrome.offscreen?.hasDocument || !chrome.offscreen.closeDocument) return;
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) await chrome.offscreen.closeDocument();
  } catch (_) {}
}

function reloadExtension() {
  try {
    chrome.runtime.reload();
  } catch (_) {}
}

function applyPendingUpdate() {
  closeOffscreenIfOpen().finally(reloadExtension);
}

function requestStoreUpdateCheck() {
  try {
    if (typeof chrome.runtime.requestUpdateCheck !== 'function') return;
    chrome.runtime.requestUpdateCheck(() => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

if (chrome.runtime?.onUpdateAvailable) {
  chrome.runtime.onUpdateAvailable.addListener(applyPendingUpdate);
}

if (chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(requestStoreUpdateCheck);
}
