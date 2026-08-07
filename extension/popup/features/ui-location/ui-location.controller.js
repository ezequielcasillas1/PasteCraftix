/** @forward-slice Public API for popup location persistence. */

import {
  clearUiLocation,
  flushUiLocation,
  schedulePersistUiLocation,
} from './ui-location.service.js';
import { restoreUiLocation } from './ui-location.restore.js';

function _wireLifecycle(app) {
  if (app._uiLocationLifecycleWired) return;
  app._uiLocationLifecycleWired = true;

  const flush = () => {
    try {
      flushUiLocation(app);
    } catch (_) {}
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

function _wireDraftInputs(app) {
  if (app._uiLocationDraftWired) return;
  app._uiLocationDraftWired = true;

  const save = () => schedulePersistUiLocation(app);

  [
    'clipViewerEditTextarea',
    'noteTitleInput',
    'noteDescriptionInput',
    'noteBodyInput',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', save);
  });
}

export function initUiLocationFeature(app) {
  _wireLifecycle(app);
  // Draft fields may not exist until first paint; retry lightly after events wire.
  queueMicrotask(() => _wireDraftInputs(app));
  setTimeout(() => _wireDraftInputs(app), 0);

  return {
    save: (immediate = false) => schedulePersistUiLocation(app, immediate),
    flush: () => flushUiLocation(app),
    clear: () => clearUiLocation(),
    restore: () => restoreUiLocation(app),
    wireDraftInputs: () => _wireDraftInputs(app),
  };
}
