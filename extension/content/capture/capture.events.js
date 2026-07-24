/** @forward-slice Capture lifecycle — cancel in-flight region snips on navigation/hide. */

import { cancelRegionCapture, isRegionCaptureActive } from './capture.region.js';

let _bound = false;

export function bindCaptureLifecycleEvents() {
  if (_bound) return;
  _bound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isRegionCaptureActive()) {
      cancelRegionCapture();
    }
  }, { passive: true });

  window.addEventListener('pagehide', () => {
    if (isRegionCaptureActive()) {
      cancelRegionCapture();
    }
  }, { passive: true });
}
