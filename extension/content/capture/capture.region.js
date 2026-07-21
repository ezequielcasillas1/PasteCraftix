/** @forward-slice Snipping-tool region capture overlay. */

import {
  CAPTURE_LAYER_Z,
  CAPTURE_MAX_REGION_PX,
  awaitCapturePaint,
  mountCaptureLayer,
} from './capture.constants.js';

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

function isCaptureResponseOk(response) {
  if (!response || typeof response !== 'object') return false;
  if (response.success === true || response.ok === true) {
    return !!(response.dataUrl || response.storageKey);
  }
  return false;
}

/** Surface real handler errors; distinguish stolen/null replies from capture API failures. */
function describeCaptureFailure(response) {
  if (response == null) {
    return 'No response from pcCaptureRegion (background did not reply).';
  }
  if (typeof response !== 'object') {
    return `Unexpected pcCaptureRegion reply (${String(response)}). Another listener may have stolen the channel.`;
  }
  if (response.__transportError) return String(response.__transportError);
  if (response.error) return String(response.error);
  if (response.success === false || response.ok === false) {
    return 'Screenshot capture failed.';
  }
  if (!response.dataUrl && !response.storageKey) {
    return 'pcCaptureRegion returned no image data.';
  }
  return 'No usable response from pcCaptureRegion.';
}

/** Callback-based sendMessage so chrome.runtime.lastError is never dropped. */
function sendCaptureMessage(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          resolve({
            success: false,
            ok: false,
            error: lastErr.message || 'message_port_error',
            __transportError: lastErr.message || 'message_port_error',
          });
          return;
        }
        resolve(response == null ? null : response);
      });
    } catch (err) {
      resolve({
        success: false,
        ok: false,
        error: err?.message || 'sendMessage_throw',
        __transportError: err?.message || 'sendMessage_throw',
      });
    }
  });
}

async function resolveCaptureDataUrl(response) {
  if (response?.dataUrl) return { dataUrl: response.dataUrl, error: null };
  const key = response?.storageKey;
  if (!key || typeof key !== 'string') {
    return { dataUrl: null, error: null };
  }
  // Large shots are stashed in chrome.storage.local (not sent over the message port).
  if (typeof chrome.storage?.local?.get !== 'function') {
    return { dataUrl: null, error: 'local_storage_unavailable' };
  }
  try {
    const bag = await chrome.storage.local.get(key);
    const dataUrl = bag?.[key];
    try { await chrome.storage.local.remove(key); } catch (_) {}
    if (typeof dataUrl === 'string' && dataUrl) {
      return { dataUrl, error: null };
    }
    return { dataUrl: null, error: 'storage_key_empty' };
  } catch (err) {
    return { dataUrl: null, error: err?.message || 'local_storage_denied' };
  }
}

async function requestCaptureRegionOnce(rect) {
  const response = await sendCaptureMessage({
    action: 'pcCaptureRegion',
    rect: rect || null,
    dpr: window.devicePixelRatio || 1,
  });
  if (!isCaptureResponseOk(response)) {
    return { ok: false, response, error: describeCaptureFailure(response) };
  }
  const resolved = await resolveCaptureDataUrl(response);
  if (!resolved.dataUrl) {
    return {
      ok: false,
      response,
      error: resolved.error || (response.storageKey ? 'storage_key_empty' : describeCaptureFailure(response)),
    };
  }
  return {
    ok: true,
    dataUrl: resolved.dataUrl,
    cropped: response.cropped === true,
    response,
  };
}

async function captureVisibleTabScreenshot(rect) {
  let response = null;
  let lastError = null;
  let attempt = 0;
  // Chrome limits captureVisibleTab to ~2 calls/sec — keep retries sparse.
  for (attempt = 1; attempt <= 2; attempt += 1) {
    const result = await requestCaptureRegionOnce(rect);
    response = result.response;
    if (result.ok) {
      return { dataUrl: result.dataUrl, cropped: result.cropped };
    }
    lastError = result.error;
    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
  }
  const errText = (response && typeof response === 'object' && response.error)
    || lastError
    || 'capture_failed';
  throw new Error(errText);
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
    overlay.style.cssText = `position:fixed;inset:0;z-index:${CAPTURE_LAYER_Z.REGION_OVERLAY};cursor:crosshair;touch-action:none;background:rgba(0,0,0,0.2);`;

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px solid #60a5fa;background:rgba(96,165,250,0.12);pointer-events:none;display:none;';

    const hint = document.createElement('div');
    hint.textContent = 'Drag to select region • Esc to cancel';
    hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 14px;border-radius:8px;background:rgba(15,23,42,0.92);color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none;';

    overlay.appendChild(box);
    overlay.appendChild(hint);
    mountCaptureLayer(overlay, CAPTURE_LAYER_Z.REGION_OVERLAY);

    let startX = 0;
    let startY = 0;
    let dragging = false;
    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const cleanup = () => {
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();
    };

    const finish = async (rect) => {
      overlay.style.background = 'transparent';
      box.style.display = 'none';
      hint.style.display = 'none';
      document.body.style.cursor = prevCursor;
      await awaitCapturePaint();
      cleanup();

      if (!rect || rect.width < 6 || rect.height < 6) {
        settle({ ok: false, error: 'Selection too small.' });
        return;
      }
      try {
        const shot = await captureVisibleTabScreenshot(rect);
        const dataUrl = shot.cropped
          ? shot.dataUrl
          : await cropDataUrl(shot.dataUrl, rect);
        settle({ ok: true, rect, dataUrl });
      } catch (err) {
        settle({ ok: false, error: err?.message || 'Capture failed.' });
      }
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup();
        settle({ ok: false, error: 'Capture cancelled.' });
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
      if (!dragging || event.button !== 0) return;
      dragging = false;
      try { overlay.releasePointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
      event.stopPropagation();
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
