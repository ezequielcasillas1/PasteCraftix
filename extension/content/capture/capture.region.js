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
  document.body.style.cursor = _activeSession?.prevCursor || '';
  _activeSession = null;
}

function cropDataUrl(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
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
  let response = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await chrome.runtime.sendMessage({ action: 'pcCaptureRegion' });
      if (response != null) break;
      lastError = 'No response from pcCaptureRegion.';
    } catch (err) {
      lastError = err?.message || 'Screenshot capture failed.';
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
  }
  const errText = response?.error || lastError || 'capture_failed';
  if (!response?.success || !response?.dataUrl) {
    throw new Error(errText);
  }
  return response.dataUrl;
}

export function isRegionCaptureActive() {
  return !!_activeSession;
}

export function cancelRegionCapture() {
  removeOverlay();
}

export function capturePageRegion() {
  if (_activeSession) {
    return Promise.resolve({ ok: false, error: 'Capture already in progress.' });
  }

  return new Promise((resolve) => {
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    const overlay = document.createElement('div');
    overlay.setAttribute('data-field', 'pc-capture-region-overlay');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;touch-action:none;background:rgba(0,0,0,0.2);';

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px solid #60a5fa;background:rgba(96,165,250,0.12);pointer-events:none;display:none;';

    const hint = document.createElement('div');
    hint.textContent = 'Drag to select region • Esc to cancel';
    hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 14px;border-radius:8px;background:rgba(15,23,42,0.92);color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none;';

    overlay.appendChild(box);
    overlay.appendChild(hint);
    document.documentElement.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const cleanup = () => {
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();
    };

    const finish = async (rect) => {
      cleanup();
      if (!rect || rect.width < 6 || rect.height < 6) {
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
        cleanup();
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
      box.style.width = '0';
      box.style.height = '0';
      try { overlay.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
      event.stopPropagation();
    };

    const onMove = (event) => {
      if (!dragging) return;
      const x = Math.min(startX, event.clientX);
      const y = Math.min(startY, event.clientY);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${Math.abs(event.clientX - startX)}px`;
      box.style.height = `${Math.abs(event.clientY - startY)}px`;
    };

    const onUp = (event) => {
      if (!dragging) return;
      dragging = false;
      finish(clampRect({
        x: Math.min(startX, event.clientX),
        y: Math.min(startY, event.clientY),
        width: Math.abs(event.clientX - startX),
        height: Math.abs(event.clientY - startY),
      }));
    };

    _activeSession = { overlay, prevCursor };
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey, true);
  });
}
