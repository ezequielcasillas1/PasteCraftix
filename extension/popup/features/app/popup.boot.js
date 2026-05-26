/** DOM boot, fallback UI, and background message listener. */

export function isWarmShellOnly() {
  try {
    return new URLSearchParams(window.location.search).get('pcWarmShell') === '1';
  } catch (_) {
    return false;
  }
}

async function ensureSupabaseGlobals() {
  if (globalThis.pasteCraftSupabase) return;
  const mod = await import('../../../supabase/index.js');
  globalThis.pasteCraftSupabase = mod.pasteCraftSupabase;
  globalThis.PasteCraftSupabase = mod.PasteCraftSupabase;
}

async function startPopup(PasteCraftPopupClass) {
  await ensureSupabaseGlobals();
  window.renderLucideIcons?.();
  try {
    window.pasteCraftPopup = new PasteCraftPopupClass({ warmShellOnly: isWarmShellOnly() });
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
  }
  window.renderLucideIcons?.();
}

export function bootPopupPage(PasteCraftPopupClass) {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('?? Popup script loaded');
    startPopup(PasteCraftPopupClass);
  });

  if (document.readyState !== 'loading' && !window.pasteCraftPopup) {
    startPopup(PasteCraftPopupClass);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    PasteCraftPopupClass.handleMessage(message);
    sendResponse(true);
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
