import { isSiteAllowed } from './safety/site-guard.js';
import { shouldInitMerchantLayer } from './safety/product-line-gate.js';
import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

function pastecraftInitContent() {
  if (!isSiteAllowed(location.href)) {
    return;
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pastecraftInitContent, { once: true });
    } else {
      requestAnimationFrame(pastecraftInitContent);
    }
    return;
  }
  if (window.pasteCraftFloatingWidget) return;

  window.pasteCraftQuickPaste = new QuickPasteInterface();
  try {
    window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
  } catch (err) {
    console.error('[PasteCraft] Widget init failed:', err);
  }

  shouldInitMerchantLayer()
    .then((enabled) => {
      // Tear down stale Merchant if Scholar gate is off (no merchant↔widget import).
      if (!enabled && window.__pasteCraftMerchant) {
        try {
          window.__pasteCraftMerchant.dock?.unmount?.();
          window.__pasteCraftMerchant.strip?.unmount?.();
        } catch (_) {}
        window.__pasteCraftMerchant = null;
      }
      if (!enabled) return null;
      return import('./merchant/merchant.controller.js')
        .then(({ initMerchantLayer }) => initMerchantLayer());
    })
    .catch((err) => {
      console.warn('[PasteCraft] merchant layer skipped:', err);
    });
}

pastecraftInitContent();
