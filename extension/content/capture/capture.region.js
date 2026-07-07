/** @forward-slice Snipping-tool region capture overlay. */

import { CAPTURE_MAX_REGION_PX } from './capture.constants.js';

let _activeSession = null;

function clampRect(rect) {
  const x = Math.max(0, Math.min(rect.x, window.innerWidth));
  const y = Math.max(0, Math.min(rect.y, window.innerHeight));
  const w = Math.max(1, Math.min(rect.width, CAPTURE_MAX_REGION_PX, window.innerWidth - x));
  const h = Math.max(1, Math.min(rect.height, CAPTURE_MAX_REGION_PX, window.innerHeight - y));
  return { x, y, width: w, height: h };
}

function removeOverlay() {
  if (_activeSession?.overlay?.parentNode) {
    _activeSession.overlay.parentNode.removeChild(_activeSession.overlay);
  }
  _activeSession = null;
}

function cropDataUrl(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        ctx.drawImage(
          img,
          Math.round(rect.x * dpr),
          Math.round(rect.y * dpr),
          Math.round(rect.width * dpr),
          Math.round(rect.height * dpr),
          0,
          0,
          canvas.width,
          canvas.height,
        );
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load screenshot.'));
    img.src = dataUrl;
  });
}

async function captureVisibleTabScreenshot() {
  const response = await chrome.runtime.sendMessage({ action: 'pcCaptureRegion' });
  if (!response?.success || !response?.dataUrl) {
    throw new Error(response?.error || 'Screenshot capture failed.');
  }
  return response.dataUrl;
}

/**
 * Prompt user to drag a rectangle on the page.
 * @returns {Promise<{ ok: boolean, rect?: object, dataUrl?: string, error?: string }>}
 */
export function capturePageRegion() {
  if (_activeSession) {
    return Promise.resolve({ ok: false, error: 'Capture already in progress.' });
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-field', 'pc-capture-region-overlay');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483646',
      'cursor:crosshair',
      'background:rgba(0,0,0,0.25)',
      'touch-action:none',
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'position:fixed',
      'border:2px solid #60a5fa',
      'background:rgba(96,165,250,0.15)',
      'pointer-events:none',
      'display:none',
      'box-shadow:0 0 0 9999px rgba(0,0,0,0.35)',
    ].join(';');
    overlay.appendChild(box);

    const hint = document.createElement('div');
    hint.textContent = 'Drag to select • Esc to cancel';
    hint.style.cssText = [
      'position:fixed',
      'top:12px',
      'left:50%',
      'transform:translateX(-50%)',
      'padding:8px 14px',
      'border-radius:8px',
      'background:rgba(15,23,42,0.92)',
      'color:#fff',
      'font:600 13px system-ui,sans-serif',
      'pointer-events:none',
      'z-index:1',
    ].join(';');
    overlay.appendChild(hint);

    document.documentElement.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const finish = async (rect) => {
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();

      if (!rect || rect.width < 4 || rect.height < 4) {
        resolve({ ok: false, error: 'Selection too small.' });
        return;
      }

      try {
        const fullShot = await captureVisibleTabScreenshot();
        const dataUrl = await cropDataUrl(fullShot, rect);
        resolve({ ok: true, rect, dataUrl });
      } catch (err) {
        resolve({ ok: false, error: err?.message || 'Capture failed.' });
      }
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        removeOverlay();
        resolve({ ok: false, error: 'Capture cancelled.' });
      }
    };

    const onDown = (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      box.style.display = 'block';
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      try { overlay.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    };

    const onMove = (event) => {
      if (!dragging) return;
      const x = Math.min(startX, event.clientX);
      const y = Math.min(startY, event.clientY);
      const width = Math.abs(event.clientX - startX);
      const height = Math.abs(event.clientY - startY);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    };

    const onUp = (event) => {
      if (!dragging) return;
      dragging = false;
      const rect = clampRect({
        x: Math.min(startX, event.clientX),
        y: Math.min(startY, event.clientY),
        width: Math.abs(event.clientX - startX),
        height: Math.abs(event.clientY - startY),
      });
      finish(rect);
    };

    _activeSession = { overlay };
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey, true);
  });
}

export function isRegionCaptureActive() {
  return !!_activeSession;
}

export function cancelRegionCapture() {
  removeOverlay();
}
