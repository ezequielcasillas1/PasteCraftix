/** @forward-slice Popup init watchdog + offline banner (shell peel). */

export function showOfflineModeBanner() {
  if (document.getElementById('pcOfflineModeBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'pcOfflineModeBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10001;background:#b45309;color:#fff;font-size:12px;padding:6px 10px;text-align:center;cursor:pointer;';
  banner.textContent = 'Loaded in offline mode \u2014 click to retry';
  banner.addEventListener('click', () => { try { window.location.reload(); } catch (_) {} });
  (document.body || document.documentElement).appendChild(banner);
}

export function clearOfflineModeBanner() {
  try {
    document.getElementById('pcOfflineModeBanner')?.remove();
  } catch (_) {}
}

/**
 * Guarantees that the purple loading overlay never gets stuck. Wraps the
 * real init body in try/catch/finally with an absolute 10s watchdog so a
 * throw, hang, or network stall can't freeze the popup in a loading state.
 */
export async function runPopupInitWithGuard(app, runInitImpl) {
  const watchdog = setTimeout(() => {
    try {
      console.warn('[PasteCraft] init() watchdog fired at 10s — force-hiding overlay');
      app.hideLoadingOverlay();
      showOfflineModeBanner();
    } catch (_) {}
  }, 10000);

  try {
    await runInitImpl();
    clearOfflineModeBanner();
  } catch (e) {
    console.error('[PasteCraft] init() failed:', e);
    try { showOfflineModeBanner(); } catch (_) {}
  } finally {
    clearTimeout(watchdog);
    try { app.hideLoadingOverlay(); } catch (_) {}
  }
}
