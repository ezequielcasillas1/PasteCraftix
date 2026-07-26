/**
 * Shared fullscreen annotate window launcher (clips + notes).
 * Keeps popup slices free of cross-feature imports for window chrome.
 */

function isRepoLoaderManifest() {
  try {
    const mf = chrome.runtime?.getManifest?.();
    const name = String(mf?.name || '');
    const desc = String(mf?.description || '');
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

/** Resolve an extension HTML page under /extension when using the repo loader. */
export function resolveExtensionPageUrl(pageFile, query = '') {
  const path = isRepoLoaderManifest() ? `extension/${pageFile}` : pageFile;
  const base = chrome.runtime.getURL(path);
  const q = String(query || '').replace(/^\?/, '');
  return q ? `${base}?${q}` : base;
}

export function leftFullscreenBounds() {
  const left = Number.isFinite(window.screen?.availLeft) ? window.screen.availLeft : 0;
  const top = Number.isFinite(window.screen?.availTop) ? window.screen.availTop : 0;
  const width = Math.max(480, Math.round(window.screen?.availWidth || 1280));
  const height = Math.max(480, Math.round(window.screen?.availHeight || 800));
  return { left, top, width, height };
}

function openWindowFallback(url, bounds, app) {
  chrome.windows
    .create({
      url,
      type: 'popup',
      focused: true,
      ...bounds,
    })
    .catch(() => {
      app?.showToast?.('Could not open full screen window', 'error');
    });
}

/** Open annotate as a left-docked fullscreen popup window. */
export function openAnnotateFullscreenWindow(url, app) {
  const bounds = leftFullscreenBounds();
  const payload = { action: 'pcOpenPopupWindow', url, ...bounds };

  try {
    chrome.runtime.sendMessage(payload, (response) => {
      const err = chrome.runtime.lastError;
      if (err || response?.success === false) {
        openWindowFallback(url, bounds, app);
      }
    });
    return { ok: true };
  } catch (_) {
    try {
      chrome.windows.create({ url, type: 'popup', focused: true, ...bounds });
      return { ok: true };
    } catch (err) {
      app?.showToast?.(err?.message || 'Could not open full screen window', 'error');
      return { ok: false };
    }
  }
}
