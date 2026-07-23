/** DOM boot, fallback UI, and background message listener. */

async function ensureSupabaseGlobals() {
  if (globalThis.pasteCraftSupabase) return;
  const mod = await import('../../../supabase/index.js');
  globalThis.pasteCraftSupabase = mod.pasteCraftSupabase;
  globalThis.PasteCraftSupabase = mod.PasteCraftSupabase;
}

let popupBootStarted = false;

async function loadPopupAppPeel() {
  const [appState, aiAccess, aiOutput, initGuard] = await Promise.all([
    import('./popup.app-state.js'),
    import('./popup.ai-access.js'),
    import('./popup.ai-output.js'),
    import('./popup.init-guard.js'),
  ]);
  return {
    createPopupInitialState: appState.createPopupInitialState,
    hasAiAccess: aiAccess.hasAiAccess,
    formatShortDate: aiAccess.formatShortDate,
    emitAiTaskOutput: aiOutput.emitAiTaskOutput,
    setAiTaskOutputArtifact: aiOutput.setAiTaskOutputArtifact,
    getAiTaskOutputArtifact: aiOutput.getAiTaskOutputArtifact,
    consumeAiTaskOutputArtifact: aiOutput.consumeAiTaskOutputArtifact,
    clearAiTaskOutputArtifact: aiOutput.clearAiTaskOutputArtifact,
    runPopupInitWithGuard: initGuard.runPopupInitWithGuard,
    showOfflineModeBanner: initGuard.showOfflineModeBanner,
    clearOfflineModeBanner: initGuard.clearOfflineModeBanner,
  };
}

async function ensurePasteCraftCrud() {
  if (globalThis.PasteCraftCRUD) return;
  await import('../../../popup/shared/pastecraft-crud.js');
}

async function startPopup(PasteCraftPopupClass) {
  if (popupBootStarted) return;
  popupBootStarted = true;

  await ensureSupabaseGlobals();
  try {
    await ensurePasteCraftCrud();
    PasteCraftPopupClass._appPeel = await loadPopupAppPeel();
    window.pasteCraftPopup = new PasteCraftPopupClass();
  } catch (error) {
    console.error('? Popup initialization failed:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2><i data-lucide="clipboard"></i> PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
    window.renderLucideIconsSync?.() || window.renderLucideIcons?.();
  }
}

/** Popup-owned runtime actions only — never claim unrelated replies (e.g. pcCaptureRegion). */
const POPUP_RUNTIME_ACTIONS = new Set(['showCategoryModal', 'clipsUpdated', 'clipSaved']);

export function bootPopupPage(PasteCraftPopupClass) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startPopup(PasteCraftPopupClass), { once: true });
  } else {
    startPopup(PasteCraftPopupClass);
  }

  // Never call sendResponse — broadcasts are fire-and-forget. sendResponse(true)
  // races/steals pcCaptureRegion when the warmed popup iframe is alive.
  chrome.runtime.onMessage.addListener((message) => {
    const action = message && typeof message.action === 'string' ? message.action : '';
    if (!POPUP_RUNTIME_ACTIONS.has(action)) return;
    PasteCraftPopupClass.handleMessage(message);
  });
}

async function loadSimpleClips() {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const container = document.getElementById('simpleClips');
  if (!container) return;

  if (clips.length === 0) {
    container.innerHTML = '<p style="color: #999;">No clips yet</p>';
    return;
  }

  clips.forEach((clip) => {
    const div = document.createElement('div');
    div.style.cssText = 'background: #f0f0f0; margin: 8px 0; padding: 8px; border-radius: 4px; cursor: pointer;';
    div.textContent = clip.text.substring(0, 50) + (clip.text.length > 50 ? '...' : '');
    div.addEventListener('click', async () => {
      await navigator.clipboard.writeText(clip.text);
      div.style.background = '#90EE90';
      setTimeout(() => { div.style.background = '#f0f0f0'; }, 500);
    });
    container.appendChild(div);
  });
}
