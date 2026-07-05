import { MerchantTopStrip } from './merchant.top-strip.js';
import { MerchantListingDock } from './merchant.listing-dock.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import { initMerchantSnippets } from './merchant.snippets.js';
import { initMerchantTagQueue } from './merchant.tag-queue.js';
import { initMerchantMaterialQueue } from './merchant.material-queue.js';
import { initMerchantTitleQueue } from './merchant.title-queue.js';
import { initMerchantDescriptionQueue } from './merchant.description-queue.js';
import { initMerchantKeywordQueue } from './merchant.keyword-queue.js';
import { initMerchantBulletQueue } from './merchant.bullet-queue.js';
import { initMerchantHashtagQueue } from './merchant.hashtag-queue.js';
import { refreshAllMerchantQueues } from './merchant.queue-all.js';
import { initMerchantVisibilityToggle } from './merchant.visibility-toggle.js';
import { MERCHANT_STORAGE_KEYS } from './merchant.constants.js';
import {
  bindMerchantStripPreferenceStorageSync,
  getMerchantStripEnabled,
  persistMerchantStripEnabled,
  subscribeMerchantStripEnabled,
} from './merchant.strip-preference.js';
import { resolveMerchantAccess } from './merchant.gating.js';

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
    refreshAllMerchantQueues().catch(() => {});
  });
}

function clearStaleMerchantLayer() {
  const layer = window.__pasteCraftMerchant;
  if (!layer?.strip?.isMounted?.()) return;
  if (layer.strip.host?.isConnected) return;
  layer.dock?.unmount?.();
  layer.strip?.unmount?.();
  window.__pasteCraftMerchant = null;
}

async function mountMerchantLayer() {
  clearStaleMerchantLayer();

  if (window.__pasteCraftMerchant?.strip?.isMounted?.()) {
    return window.__pasteCraftMerchant;
  }

  const strip = new MerchantTopStrip();
  strip.mount();

  const dock = new MerchantListingDock({ stripEl: strip.stripEl });
  dock.setStripEl(strip.stripEl);
  dock.mount();

  const queueInitArgs = {
    stripEl: strip.stripEl,
    getToastRoot: () => strip.root,
  };

  window.__pasteCraftMerchant = {
    strip,
    dock,
    tagQueue: null,
    materialQueue: null,
    titleQueue: null,
    descriptionQueue: null,
    keywordQueue: null,
    bulletQueue: null,
    hashtagQueue: null,
    snippets: null,
    isMounted() {
      return strip.isMounted();
    },
    refreshPulse() {
      return refreshMerchantPulse(strip.stripEl);
    },
  };

  bindStoragePulseRefresh(strip.stripEl);
  await refreshMerchantPulse(strip.stripEl);

  window.__pasteCraftMerchant.tagQueue = await initMerchantTagQueue(queueInitArgs);
  window.__pasteCraftMerchant.materialQueue = await initMerchantMaterialQueue(queueInitArgs);
  window.__pasteCraftMerchant.titleQueue = await initMerchantTitleQueue(queueInitArgs);
  window.__pasteCraftMerchant.descriptionQueue = await initMerchantDescriptionQueue(queueInitArgs);
  window.__pasteCraftMerchant.keywordQueue = await initMerchantKeywordQueue(queueInitArgs);
  window.__pasteCraftMerchant.bulletQueue = await initMerchantBulletQueue(queueInitArgs);
  window.__pasteCraftMerchant.hashtagQueue = await initMerchantHashtagQueue(queueInitArgs);
  window.__pasteCraftMerchant.snippets = await initMerchantSnippets({
    stripEl: strip.stripEl,
    root: strip.root,
  });

  return window.__pasteCraftMerchant;
}

function unmountMerchantLayer() {
  if (!window.__pasteCraftMerchant) return;
  window.__pasteCraftMerchant.dock?.unmount();
  window.__pasteCraftMerchant.strip?.unmount();
  window.__pasteCraftMerchant = null;
}

async function applyMerchantStripLayer(enabled) {
  if (!enabled) {
    unmountMerchantLayer();
    return null;
  }
  return mountMerchantLayer();
}

let preferenceSyncBound = false;

function bindMerchantStripLayerPreferenceSync() {
  if (preferenceSyncBound) return;
  preferenceSyncBound = true;
  bindMerchantStripPreferenceStorageSync();
  subscribeMerchantStripEnabled((enabled) => {
    applyMerchantStripLayer(enabled).catch(() => {});
  });
}

/**
 * Initialize Merchant content layer (Phase 2 — listing dock + pulse).
 * Respects persisted strip preference — does not mount when user turned merchant off.
 */
export async function initMerchantLayer() {
  const enabled = await getMerchantStripEnabled();
  if (!enabled) return null;
  return mountMerchantLayer();
}

/**
 * Mount right-side visibility toggle (always) and merchant strip/dock when enabled.
 */
export async function initMerchantChrome() {
  bindMerchantStripLayerPreferenceSync();
  const access = await resolveMerchantAccess();
  await initMerchantVisibilityToggle({ merchantAccess: access });
  if (!access.allowed) {
    return null;
  }
  const enabled = await getMerchantStripEnabled();
  return applyMerchantStripLayer(enabled);
}

export async function setMerchantStripEnabled(enabled) {
  await persistMerchantStripEnabled(enabled);
  await applyMerchantStripLayer(!!enabled);
}
