import {
  isSiteAllowed,
  hydrateRemoteBlocklist,
  subscribeRemoteBlocklistChanges,
} from './safety/site-guard.js';
import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

function mountPasteCraftUi() {
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountPasteCraftUi, { once: true });
    } else {
      requestAnimationFrame(mountPasteCraftUi);
    }
    return;
  }
  if (window.pasteCraftFloatingWidget) return;

  window.pasteCraftQuickPaste = new QuickPasteInterface();
  window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
}

async function pastecraftInitContent() {
  try {
    await hydrateRemoteBlocklist();
  } catch (err) {
    console.warn('[PasteCraft] blocklist hydrate failed (continuing with bundled list):', err);
  }

  try {
    subscribeRemoteBlocklistChanges(() => {
      if (!isSiteAllowed(location.href) && window.pasteCraftFloatingWidget) {
        try { window.pasteCraftFloatingWidget.destroy?.(); } catch (_) {}
        try { window.pasteCraftQuickPaste?.hide?.(); } catch (_) {}
        window.pasteCraftFloatingWidget = null;
      } else if (isSiteAllowed(location.href) && !window.pasteCraftFloatingWidget) {
        mountPasteCraftUi();
      }
    });
  } catch (err) {
    console.warn('[PasteCraft] blocklist subscribe failed:', err);
  }

  if (!isSiteAllowed(location.href)) {
    console.debug('[PasteCraft] site blocked by safety guard:', location.hostname);
    return;
  }

  mountPasteCraftUi();
}

pastecraftInitContent().catch((err) => {
  console.error('[PasteCraft] content init failed:', err);
});
