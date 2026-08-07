/** @forward-slice Persist / clear popup location snapshots. */

import {
  UI_LOCATION_DEBOUNCE_MS,
  UI_LOCATION_STORAGE_KEY,
  UI_LOCATION_VERSION,
} from './ui-location.constants.js';
import { captureUiLocation } from './ui-location.capture.js';

function _getDebounceState(app) {
  if (!app._uiLocationDebounce) {
    app._uiLocationDebounce = { timerId: null, flushPromise: null };
  }
  return app._uiLocationDebounce;
}

export function isRememberUiLocationEnabled(app) {
  return app?.rememberUiLocation !== false;
}

export async function clearUiLocation() {
  try {
    await chrome.storage.local.remove(UI_LOCATION_STORAGE_KEY);
  } catch (_) {}
}

export async function readUiLocation() {
  try {
    const stored = await chrome.storage.local.get(UI_LOCATION_STORAGE_KEY);
    const snapshot = stored?.[UI_LOCATION_STORAGE_KEY];
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (snapshot.v !== UI_LOCATION_VERSION) return null;
    return snapshot;
  } catch (_) {
    return null;
  }
}

export async function writeUiLocation(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  try {
    await chrome.storage.local.set({ [UI_LOCATION_STORAGE_KEY]: snapshot });
  } catch (_) {}
}

export async function persistUiLocationNow(app) {
  if (app?._uiLocationRestoring) return null;
  if (!isRememberUiLocationEnabled(app)) {
    await clearUiLocation();
    return null;
  }
  const snapshot = captureUiLocation(app);
  await writeUiLocation(snapshot);
  return snapshot;
}

export function schedulePersistUiLocation(app, immediate = false) {
  const state = _getDebounceState(app);
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }

  if (immediate) {
    state.flushPromise = persistUiLocationNow(app);
    return state.flushPromise;
  }

  return new Promise((resolve) => {
    state.timerId = setTimeout(() => {
      state.timerId = null;
      state.flushPromise = persistUiLocationNow(app).then(resolve);
    }, UI_LOCATION_DEBOUNCE_MS);
  });
}

export async function flushUiLocation(app) {
  const state = _getDebounceState(app);
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  return persistUiLocationNow(app);
}

/** Safe entry point for other slices (no hard dependency on controller). */
export function notifyUiLocationChanged(app, immediate = false) {
  try {
    if (app?.uiLocationFeature?.save) {
      return app.uiLocationFeature.save(immediate);
    }
    return schedulePersistUiLocation(app, immediate);
  } catch (_) {
    return Promise.resolve(null);
  }
}
