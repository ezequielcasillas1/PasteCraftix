import { MERCHANT_STORAGE_KEYS } from './merchant.constants.js';

/**
 * Merchant strip on/off persistence principles:
 * 1. Single source of truth — chrome.storage.local key STRIP_ENABLED only.
 * 2. Explicit booleans — always persist true/false; never infer from UI state.
 * 3. Read before mount — every page load reads storage before showing strip or toggle.
 * 4. Write before apply — persist preference first, then mount/unmount layer.
 * 5. Cross-tab sync — storage.onChanged reapplies layer + toggle on every tab.
 * 6. Fail closed on read error — reuse last known value; only default ON when never set.
 */

export const DEFAULT_MERCHANT_STRIP_ENABLED = true;

let cachedEnabled = null;
const subscribers = new Set();
let storageSyncBound = false;

function normalizeStoredValue(raw) {
  if (raw === undefined) return DEFAULT_MERCHANT_STRIP_ENABLED;
  return raw !== false;
}

export async function getMerchantStripEnabled() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.STRIP_ENABLED]);
    const enabled = normalizeStoredValue(stored[MERCHANT_STORAGE_KEYS.STRIP_ENABLED]);
    cachedEnabled = enabled;
    return enabled;
  } catch (_) {
    if (cachedEnabled !== null) return cachedEnabled;
    return DEFAULT_MERCHANT_STRIP_ENABLED;
  }
}

export async function persistMerchantStripEnabled(enabled) {
  const value = !!enabled;
  await chrome.storage.local.set({
    [MERCHANT_STORAGE_KEYS.STRIP_ENABLED]: value,
  });
  cachedEnabled = value;
  return value;
}

export function subscribeMerchantStripEnabled(onChange) {
  if (typeof onChange !== 'function') return () => {};
  subscribers.add(onChange);
  return () => subscribers.delete(onChange);
}

function notifySubscribers(enabled) {
  subscribers.forEach((fn) => {
    try {
      fn(enabled);
    } catch (_) {}
  });
}

export function bindMerchantStripPreferenceStorageSync() {
  if (storageSyncBound || window.__pasteCraftMerchantStripPrefBound) return;
  storageSyncBound = true;
  window.__pasteCraftMerchantStripPrefBound = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[MERCHANT_STORAGE_KEYS.STRIP_ENABLED];
    if (!change) return;

    const enabled = normalizeStoredValue(change.newValue);
    cachedEnabled = enabled;
    notifySubscribers(enabled);
  });
}
