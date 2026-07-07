import {
  SPOT_DEFAULT_MATCHER_PREFS,
  SPOT_STORAGE_KEYS,
} from './spot.constants.js';
import { DEFAULT_SPOT_PRESETS } from '../../../content/capture/capture.constants.js';

function normalizeCategory(entry, index) {
  const id = String(entry?.id || `category-${index}`).trim();
  const label = String(entry?.label || `Category ${index + 1}`).trim();
  const items = Array.isArray(entry?.items)
    ? entry.items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return { id, label, items };
}

export async function readSpotPresets() {
  try {
    const stored = await chrome.storage.local.get([SPOT_STORAGE_KEYS.SPOT_PRESETS]);
    const raw = stored[SPOT_STORAGE_KEYS.SPOT_PRESETS];
    if (raw?.categories?.length) {
      return {
        categories: raw.categories.map(normalizeCategory).filter((c) => c.label),
        updatedAt: raw.updatedAt || null,
      };
    }
  } catch (err) {
    console.error('[spot.service:readSpotPresets]', err);
  }

  return {
    categories: DEFAULT_SPOT_PRESETS.map((c, i) => normalizeCategory(c, i)),
    updatedAt: null,
  };
}

export async function saveSpotPresets(categories) {
  const next = {
    categories: (categories || []).map(normalizeCategory).filter((c) => c.label),
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [SPOT_STORAGE_KEYS.SPOT_PRESETS]: next });
  return next;
}

export async function readSpotMatcherPrefs() {
  try {
    const stored = await chrome.storage.local.get([SPOT_STORAGE_KEYS.SPOT_MATCHER_PREFS]);
    return { ...SPOT_DEFAULT_MATCHER_PREFS, ...(stored[SPOT_STORAGE_KEYS.SPOT_MATCHER_PREFS] || {}) };
  } catch (err) {
    console.error('[spot.service:readSpotMatcherPrefs]', err);
    return { ...SPOT_DEFAULT_MATCHER_PREFS };
  }
}

export async function saveSpotMatcherPrefs(prefs) {
  const next = { ...SPOT_DEFAULT_MATCHER_PREFS, ...(prefs || {}) };
  await chrome.storage.local.set({ [SPOT_STORAGE_KEYS.SPOT_MATCHER_PREFS]: next });
  return next;
}

export async function ensureSpotDefaults() {
  const current = await readSpotPresets();
  if (!current.updatedAt) {
    await saveSpotPresets(current.categories);
  }
  return current;
}
