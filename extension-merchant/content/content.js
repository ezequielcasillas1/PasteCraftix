import { isSiteAllowed } from './safety/site-guard.js';
import { initMerchantLayer } from './merchant/merchant.controller.js';

function pastecraftMerchantInitContent() {
  if (!isSiteAllowed(location.href)) {
    return;
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pastecraftMerchantInitContent, { once: true });
    } else {
      requestAnimationFrame(pastecraftMerchantInitContent);
    }
    return;
  }

  if (window.__pasteCraftMerchant?.isMounted?.()) return;

  initMerchantLayer().catch((err) => {
    console.warn('[PasteCraft Merchant] init failed:', err);
  });
}

pastecraftMerchantInitContent();
