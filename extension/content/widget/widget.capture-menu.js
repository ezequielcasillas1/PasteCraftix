/**
 * Scholar Capture Tools — bundled widget menu (Spot + Image Picker).
 * @forward-slice Placed between Settings and Auto-Copy in the floating widget.
 */

import {
  WIDGET_CAPTURE_ACTIONS,
  WIDGET_CAPTURE_LABELS,
} from './widget.capture-menu.constants.js';
import { runWidgetSpotAction, deactivateWidgetSpot } from './widget.spot.js';
import { runWidgetImagePickerAction, cancelWidgetImagePreview } from './widget.image-to-text.js';

let _menuOpen = false;
let _widgetRef = null;
let _wrapEl = null;

function getRoot() {
  return _widgetRef?.shadowMount?.root || null;
}

function setMenuOpen(open) {
  _menuOpen = open;
  const btn = _wrapEl?.querySelector(`[data-action="${WIDGET_CAPTURE_ACTIONS.TOGGLE_MENU}"]`);
  const menu = _wrapEl?.querySelector('[data-field="pc-widget-capture-menu"]');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (menu) menu.hidden = !open;
  if (_wrapEl) {
    _wrapEl.classList.toggle('is-open', open);
  }
}

function closeCaptureMenu() {
  setMenuOpen(false);
}

async function handleSpotClick() {
  closeCaptureMenu();
  const result = await runWidgetSpotAction();
  _widgetRef?.showWidgetToast?.(result.message);
}

async function handleImagePickerClick() {
  closeCaptureMenu();
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
      handleSpotClick().catch(() => {});
      return;
    }
    if (action === WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER) {
      event.preventDefault();
      handleImagePickerClick().catch(() => {});
    }
  });

  _wrapEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const btn = event.target.closest('[data-action]');
    if (!btn || !_wrapEl.contains(btn)) return;
    event.preventDefault();
    btn.click();
  });

  document.addEventListener('click', (event) => {
    if (!_menuOpen) return;
    if (_wrapEl?.contains(event.target)) return;
    closeCaptureMenu();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && _menuOpen) {
      closeCaptureMenu();
    }
  }, true);
}

export function mountWidgetCaptureMenu(widget) {
  _widgetRef = widget;
  const inner = widget.widget?.querySelector('.pastecraft-widget-inner');
  if (!inner) return;

  const autoCopy = inner.querySelector('.auto-copy-section');
  if (!autoCopy) return;

  const wrap = document.createElement('div');
  wrap.className = 'widget-component capture-tools-wrap';
  wrap.setAttribute('data-field', 'pc-widget-capture-wrap');
  wrap.setAttribute('data-tooltip', WIDGET_CAPTURE_LABELS.BUNDLE);

  wrap.innerHTML = `
    <button
      type="button"
      class="capture-tools-btn"
      data-action="${WIDGET_CAPTURE_ACTIONS.TOGGLE_MENU}"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-label="${WIDGET_CAPTURE_LABELS.BUNDLE}"
    >
      <span class="capture-tools-icon" aria-hidden="true">⎔</span>
    </button>
    <div
      class="capture-tools-menu"
      data-field="pc-widget-capture-menu"
      role="menu"
      hidden
    >
      <button
        type="button"
        class="capture-tools-menu-item"
        data-action="${WIDGET_CAPTURE_ACTIONS.SPOT}"
        role="menuitem"
      >
        <span class="capture-tools-menu-icon spot" aria-hidden="true">◎</span>
        <span>${WIDGET_CAPTURE_LABELS.SPOT}</span>
      </button>
      <button
        type="button"
        class="capture-tools-menu-item"
        data-action="${WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER}"
        role="menuitem"
      >
        <span class="capture-tools-menu-icon image" aria-hidden="true">▣</span>
        <span>${WIDGET_CAPTURE_LABELS.IMAGE_PICKER}</span>
      </button>
    </div>
  `;

  inner.insertBefore(wrap, autoCopy);
  _wrapEl = wrap;
  bindCaptureMenuEvents();
}

export function resetWidgetCaptureState() {
  closeCaptureMenu();
  deactivateWidgetSpot();
  cancelWidgetImagePreview();
}

export function initWidgetCaptureMenu(widget) {
  mountWidgetCaptureMenu(widget);
}
