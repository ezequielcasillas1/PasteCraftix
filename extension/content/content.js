import { isSiteAllowed } from './safety/site-guard.js';
import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

function ensureDocumentBody() {
  if (document.body) return true;
  try {
    // Sparse PDF viewer shells can lack <body> briefly (or entirely).
    const body = document.createElement('body');
    document.documentElement.appendChild(body);
    return !!document.body;
  } catch (_) {
    return false;
  }
}

function pastecraftInitContent() {
  if (!isSiteAllowed(location.href)) {
    return;
  }

  if (!ensureDocumentBody()) {
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

  import('./merchant/merchant.controller.js')
    .then(({ initMerchantLayer }) => initMerchantLayer())
    .catch((err) => {
      console.warn('[PasteCraft] merchant layer skipped:', err);
    });
}

pastecraftInitContent();
