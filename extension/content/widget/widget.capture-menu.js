/** Scholar Capture Tools — hexagon bundle menu between Settings and Auto-Copy. */

import { CAPTURE_COLORS } from '../capture/capture.constants.js';
import {
  armWidgetSpot,
  disarmWidgetSpot,
  isWidgetSpotArmed,
  resetWidgetSpot,
  setWidgetSpotModeChangeHandler,
  setWidgetSpotToastHandler,
  setWidgetSpotSavedHandler,
} from './widget.spot.js';
import {
  runWidgetImagePickerAction,
  cancelWidgetImagePreview,
  setWidgetImageModeChangeHandler,
  setWidgetImageSavedHandler,
} from './widget.image-to-text.js';
import { loadWidgetCaptureToolsStats } from './widget.capture-stats.js';

export const WIDGET_CAPTURE_ACTIONS = Object.freeze({
  TOGGLE_MENU: 'widget-capture-toggle',
  SPOT: 'widget-capture-spot',
  IMAGE_PICKER: 'widget-capture-image-picker',
});

const HEX_SVG = `
  <svg class="capture-hex-svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <polygon
      class="capture-hex-shape"
      points="16,3 28,10 28,22 16,29 4,22 4,10"
      fill="transparent"
      stroke="rgba(255,255,255,0.95)"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
`;

let _menuOpen = false;
let _widgetRef = null;
let _wrapEl = null;
let _hexShape = null;
let _activeMode = 'idle';

function setHexMode(mode) {
  _activeMode = mode;
  if (!_hexShape) return;

  const fill =
    mode === 'spot' ? CAPTURE_COLORS.SPOT
      : mode === 'image' ? CAPTURE_COLORS.IMAGE
        : 'transparent';

  _hexShape.setAttribute('fill', fill);
  _hexShape.setAttribute('stroke', mode === 'idle' ? 'rgba(255,255,255,0.95)' : fill);

  _wrapEl?.classList.toggle('is-spot-active', mode === 'spot');
  _wrapEl?.classList.toggle('is-image-active', mode === 'image');
}

function setMenuOpen(open) {
  _menuOpen = open;
  const btn = _wrapEl?.querySelector(`[data-action="${WIDGET_CAPTURE_ACTIONS.TOGGLE_MENU}"]`);
  const menu = _wrapEl?.querySelector('[data-field="pc-widget-capture-menu"]');
  btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (menu) menu.hidden = !open;
  _wrapEl?.classList.toggle('is-open', open);
}

function closeCaptureMenu() {
  setMenuOpen(false);
}

function handleSpotClick() {
  closeCaptureMenu();
  cancelWidgetImagePreview();
  const result = armWidgetSpot();
  _widgetRef?.showWidgetToast?.(result.message);
}

async function handleImagePickerClick() {
  closeCaptureMenu();
  disarmWidgetSpot();
  setHexMode('image');
  await runWidgetImagePickerAction((msg) => _widgetRef?.showWidgetToast?.(msg));
}

function bindCaptureMenuEvents() {
  if (!_wrapEl || _wrapEl.dataset.pcCaptureBound === '1') return;
  _wrapEl.dataset.pcCaptureBound = '1';

  _wrapEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !_wrapEl.contains(btn)) return;
    event.stopPropagation();

    const action = btn.getAttribute('data-action');
    if (action === WIDGET_CAPTURE_ACTIONS.TOGGLE_MENU) {
      event.preventDefault();
      setMenuOpen(!_menuOpen);
      return;
    }
    if (action === WIDGET_CAPTURE_ACTIONS.SPOT) {
      event.preventDefault();
      handleSpotClick();
      return;
    }
    if (action === WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER) {
      event.preventDefault();
      handleImagePickerClick().catch(() => {});
    }
  });

  document.addEventListener('click', (event) => {
    if (!_menuOpen) return;
    if (_wrapEl?.contains(event.target)) return;
    closeCaptureMenu();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (_menuOpen) closeCaptureMenu();
      if (isWidgetSpotArmed()) {
        disarmWidgetSpot();
        _widgetRef?.showWidgetToast?.('Spot disarmed.');
      }
    }
  }, true);
}

export function mountWidgetCaptureMenu(widget) {
  _widgetRef = widget;
  const inner = widget.widget?.querySelector('.pastecraft-widget-inner');
  const autoCopy = inner?.querySelector('.auto-copy-section');
  if (!inner || !autoCopy) return;

  const wrap = document.createElement('div');
  wrap.className = 'widget-component capture-tools-wrap';
  wrap.setAttribute('data-field', 'pc-widget-capture-wrap');
  wrap.setAttribute('data-tooltip', 'Capture Tools');

  wrap.innerHTML = `
    <button
      type="button"
      class="capture-tools-btn"
      data-action="${WIDGET_CAPTURE_ACTIONS.TOGGLE_MENU}"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-label="Capture Tools"
    >
      ${HEX_SVG}
    </button>
    <div class="capture-tools-counter" data-field="pc-capture-tools-counter" aria-live="polite">0 clips</div>
    <div class="capture-tools-menu" data-field="pc-widget-capture-menu" role="menu" hidden>
      <button type="button" class="capture-tools-menu-item" data-action="${WIDGET_CAPTURE_ACTIONS.SPOT}" role="menuitem">
        <span class="capture-tools-menu-dot spot" aria-hidden="true"></span>
        <span>Spot</span>
      </button>
      <button type="button" class="capture-tools-menu-item" data-action="${WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER}" role="menuitem">
        <span class="capture-tools-menu-dot image" aria-hidden="true"></span>
        <span>Image Picker</span>
      </button>
    </div>
  `;

  inner.insertBefore(wrap, autoCopy);
  _wrapEl = wrap;
  _hexShape = wrap.querySelector('.capture-hex-shape');

  setWidgetSpotModeChangeHandler((mode) => setHexMode(mode === 'spot' ? 'spot' : 'idle'));
  setWidgetImageModeChangeHandler((mode) => setHexMode(mode === 'image' ? 'image' : 'idle'));
  setWidgetSpotToastHandler((msg) => _widgetRef?.showWidgetToast?.(msg));
  setWidgetSpotSavedHandler(() => {
    loadWidgetCaptureToolsStats(_widgetRef).catch(() => {});
  });
  setWidgetImageSavedHandler(() => {
    loadWidgetCaptureToolsStats(_widgetRef).catch(() => {});
  });

  bindCaptureMenuEvents();
  setHexMode('idle');
  loadWidgetCaptureToolsStats(widget).catch(() => {});
}

export function resetWidgetCaptureState() {
  closeCaptureMenu();
  resetWidgetSpot();
  cancelWidgetImagePreview();
  setHexMode('idle');
}

export function initWidgetCaptureMenu(widget) {
  mountWidgetCaptureMenu(widget);
}
