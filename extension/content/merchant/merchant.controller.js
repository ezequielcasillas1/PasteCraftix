import { MERCHANT_STORAGE_KEYS } from './merchant.constants.js';
import { MerchantTopStrip } from './merchant.top-strip.js';
import { MerchantListingDock } from './merchant.listing-dock.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import { initMerchantTagQueue, refreshTagQueueTags } from './merchant.tag-queue.js';

async function isStripEnabled() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.STRIP_ENABLED]);
    if (stored[MERCHANT_STORAGE_KEYS.STRIP_ENABLED] === undefined) {
      return true;
    }
    return stored[MERCHANT_STORAGE_KEYS.STRIP_ENABLED] !== false;
  } catch (_) {
    return true;
  }
}

function bindStoragePulseRefresh(stripEl) {
  if (window.__pasteCraftMerchantStorageBound) return;
  window.__pasteCraftMerchantStorageBound = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[MERCHANT_STORAGE_KEYS.DOCK_STAGING]) return;
    refreshMerchantPulse(stripEl).catch(() => {});
    const dock = window.__pasteCraftMerchant?.dock;
    if (dock?.isOpen?.()) {
      dock.hydrateFromStorage().catch(() => {});
    }
    refreshTagQueueTags().catch(() => {});
  });
}

/**
 * Initialize Merchant content layer (Phase 2 — listing dock + pulse).
 * Billing/gating deferred; strip defaults to enabled for user testing.
 */
function clearStaleMerchantLayer() {
  const layer = window.__pasteCraftMerchant;
  if (!layer?.strip?.isMounted?.()) return;
  if (layer.strip.host?.isConnected) return;
  layer.dock?.unmount?.();
  layer.strip?.unmount?.();
  window.__pasteCraftMerchant = null;
}

export async function initMerchantLayer() {
  clearStaleMerchantLayer();
  if (window.__pasteCraftMerchant?.strip?.isMounted?.()) {
    return window.__pasteCraftMerchant;
  }

  const enabled = await isStripEnabled();
  if (!enabled) return null;

  const strip = new MerchantTopStrip();
  strip.mount();

  const dock = new MerchantListingDock({ stripEl: strip.stripEl });
  dock.setStripEl(strip.stripEl);
  dock.mount();

  window.__pasteCraftMerchant = {
    strip,
    dock,
    tagQueue: null,
    isMounted() {
      return strip.isMounted();
    },
    refreshPulse() {
      return refreshMerchantPulse(strip.stripEl);
    },
  };

  bindStoragePulseRefresh(strip.stripEl);
  await refreshMerchantPulse(strip.stripEl);

  window.__pasteCraftMerchant.tagQueue = await initMerchantTagQueue({
    stripEl: strip.stripEl,
    getToastRoot: () => strip.root,
  });

  return window.__pasteCraftMerchant;
}

export async function setMerchantStripEnabled(enabled) {
  await chrome.storage.local.set({
    [MERCHANT_STORAGE_KEYS.STRIP_ENABLED]: !!enabled,
  });
  if (!enabled && window.__pasteCraftMerchant) {
    window.__pasteCraftMerchant.dock?.unmount();
    window.__pasteCraftMerchant.strip?.unmount();
    window.__pasteCraftMerchant = null;
    return;
  }
  if (enabled && !window.__pasteCraftMerchant?.strip?.isMounted?.()) {
    await initMerchantLayer();
  }
}
