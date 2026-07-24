/** @forward-slice Capture infra controller — no UI; widget/merchant import submodules directly. */

import { cancelRegionCapture, isRegionCaptureActive } from './capture.region.js';
import { bindCaptureLifecycleEvents } from './capture.events.js';

let _lifecycleBound = false;

function ensureCaptureLifecycle() {
  if (_lifecycleBound) return;
  bindCaptureLifecycleEvents();
  _lifecycleBound = true;
}

/**
 * Initialize shared capture infrastructure (region snip, selection, clip-save helpers).
 * Exposes `window.__pasteCraftCapture` for documented init bridges only.
 */
export async function initCaptureLayer() {
  if (window.__pasteCraftCapture?.isMounted?.()) {
    return window.__pasteCraftCapture;
  }

  ensureCaptureLifecycle();

  window.__pasteCraftCapture = {
    cancelRegionCapture,
    isRegionCaptureActive,
    isMounted() {
      return _lifecycleBound;
    },
  };

  return window.__pasteCraftCapture;
}
