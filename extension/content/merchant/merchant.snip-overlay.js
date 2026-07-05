/**
 * Snipping overlay for Image → Text region capture.
 */

import { MERCHANT_STRIP_HEIGHT_PX } from './merchant.constants.js';
import { isMerchantHostElement } from './merchant.mount.js';

const OVERLAY_FIELD = 'pc-merchant-snip-overlay';
const STYLE_ID = 'pc-merchant-snip-styles';

let _active = false;
let _host = null;
let _onComplete = null;
let _onCancel = null;
let _startX = 0;
let _startY = 0;
let _rectEl = null;
let _dragging = false;

function injectSnipStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-field="${OVERLAY_FIELD}"] {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: var(--pc-merchant-strip-height, ${MERCHANT_STRIP_HEIGHT_PX}px);
      z-index: 2147483646;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
    }
    [data-field="${OVERLAY_FIELD}"] .pc-merchant-snip-shade {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.28);
      pointer-events: none;
    }
    [data-field="${OVERLAY_FIELD}"] .pc-merchant-snip-rect {
      position: absolute;
      border: 2px solid #22c55e;
      background: rgba(34, 197, 94, 0.12);
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.28);
      pointer-events: none;
      display: none;
    }
    [data-field="${OVERLAY_FIELD}"] .pc-merchant-snip-hint {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 12px;
      border-radius: 8px;
      background: #111827;
      color: #f9fafb;
      font: 500 12px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      white-space: nowrap;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function isMerchantUiTarget(target) {
  let node = target;
  while (node) {
    if (isMerchantHostElement(node)) return true;
    node = node.parentNode;
  }
  return false;
}

function clampRect(x1, y1, x2, y2) {
  const top = MERCHANT_STRIP_HEIGHT_PX;
  const left = Math.min(x1, x2);
  const rawTop = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  return {
    x: left,
    y: Math.max(top, rawTop),
    width,
    height: Math.max(0, height - Math.max(0, top - rawTop)),
  };
}

function updateRectPreview(x1, y1, x2, y2) {
  if (!_rectEl) return;
  const rect = clampRect(x1, y1, x2, y2);
  if (rect.width < 4 || rect.height < 4) {
    _rectEl.style.display = 'none';
    return;
  }
  _rectEl.style.display = 'block';
  _rectEl.style.left = `${rect.x}px`;
  _rectEl.style.top = `${rect.y - MERCHANT_STRIP_HEIGHT_PX}px`;
  _rectEl.style.width = `${rect.width}px`;
  _rectEl.style.height = `${rect.height}px`;
}

function finishCapture(x1, y1, x2, y2) {
  const rect = clampRect(x1, y1, x2, y2);
  if (rect.width < 8 || rect.height < 8) {
    cancelRegionCapture();
    return;
  }
  const complete = _onComplete;
  teardownRegionCapture();
  complete?.(rect);
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelRegionCapture();
  }
}

function onPointerDown(event) {
  if (!_host || isMerchantUiTarget(event.target)) return;
  event.preventDefault();
  _dragging = true;
  _startX = event.clientX;
  _startY = event.clientY;
  _host.setPointerCapture?.(event.pointerId);
  updateRectPreview(_startX, _startY, _startX, _startY);
}

function onPointerMove(event) {
  if (!_dragging) return;
  event.preventDefault();
  updateRectPreview(_startX, _startY, event.clientX, event.clientY);
}

function onPointerUp(event) {
  if (!_dragging) return;
  event.preventDefault();
  _dragging = false;
  finishCapture(_startX, _startY, event.clientX, event.clientY);
}

function teardownRegionCapture() {
  _active = false;
  _dragging = false;
  _onComplete = null;
  _onCancel = null;
  _rectEl = null;
  document.removeEventListener('keydown', onKeyDown, true);
  _host?.remove();
  _host = null;
}

export function isRegionCaptureActive() {
  return _active;
}

export function cancelRegionCapture() {
  if (!_active) return;
  const cancel = _onCancel;
  teardownRegionCapture();
  cancel?.();
}

export function startRegionCapture({ onComplete, onCancel } = {}) {
  if (_active) cancelRegionCapture();

  injectSnipStyles();
  _active = true;
  _onComplete = typeof onComplete === 'function' ? onComplete : null;
  _onCancel = typeof onCancel === 'function' ? onCancel : null;

  _host = document.createElement('div');
  _host.setAttribute('data-field', OVERLAY_FIELD);
  _host.innerHTML = `
    <div class="pc-merchant-snip-shade" aria-hidden="true"></div>
    <div class="pc-merchant-snip-rect" aria-hidden="true"></div>
    <p class="pc-merchant-snip-hint">Drag to capture · Esc to cancel</p>
  `;
  _rectEl = _host.querySelector('.pc-merchant-snip-rect');

  _host.addEventListener('pointerdown', onPointerDown);
  _host.addEventListener('pointermove', onPointerMove);
  _host.addEventListener('pointerup', onPointerUp);
  _host.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('keydown', onKeyDown, true);

  document.body.appendChild(_host);
}
