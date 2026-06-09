/**
 * Decide whether chrome.storage.local should win over IndexedDB on popup load.
 * chrome.storage is written on every CRUD path (with pc_local_updatedAt); IDB is
 * a secondary mirror. Preferring stale IDB after a delete resurrects removed clips.
 */
export function shouldPreferChromeStorageForEntityLoad(clips, categories, pcLocalUpdatedAt) {
  if (Number.isFinite(pcLocalUpdatedAt) && pcLocalUpdatedAt > 0) return true;
  const hasChromeClips = Array.isArray(clips) && clips.length > 0;
  const hasChromeCategories = Array.isArray(categories) && categories.length > 0;
  return hasChromeClips || hasChromeCategories;
}

export function resolveEntityLoadFromStores({
  clips = [],
  categories = [],
  idbClips = [],
  idbCategories = [],
  pcLocalUpdatedAt = null,
} = {}) {
  const preferChrome = shouldPreferChromeStorageForEntityLoad(clips, categories, pcLocalUpdatedAt);
  if (preferChrome) {
    return {
      clips: Array.isArray(clips) ? clips : [],
      categories: Array.isArray(categories) ? categories : [],
    };
  }

  return {
    clips: Array.isArray(idbClips) && idbClips.length > 0 ? idbClips : (Array.isArray(clips) ? clips : []),
    categories: Array.isArray(idbCategories) && idbCategories.length > 0 ? idbCategories : (Array.isArray(categories) ? categories : []),
  };
}
