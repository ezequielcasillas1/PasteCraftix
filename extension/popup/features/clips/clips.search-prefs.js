import { CLIPS_STORAGE_KEYS } from './clips.constants.js';
import { getClipSearchControls } from './clips.selectors.js';

function normalizeSearchIncludeTitles(value) {
  return value !== false;
}

export async function hydrateSearchIncludeTitles(app) {
  try {
    const stored = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.SEARCH_INCLUDE_TITLES]);
    const raw = stored?.[CLIPS_STORAGE_KEYS.SEARCH_INCLUDE_TITLES];
    if (typeof raw === 'boolean') {
      app.searchIncludeTitles = raw;
    }
  } catch (_) {}

  const { searchIncludeTitles } = getClipSearchControls();
  if (searchIncludeTitles) {
    searchIncludeTitles.checked = normalizeSearchIncludeTitles(app.searchIncludeTitles);
  }
}

export async function persistSearchIncludeTitles(app) {
  try {
    await chrome.storage.local.set({
      [CLIPS_STORAGE_KEYS.SEARCH_INCLUDE_TITLES]: normalizeSearchIncludeTitles(app.searchIncludeTitles),
    });
  } catch (_) {}
}
