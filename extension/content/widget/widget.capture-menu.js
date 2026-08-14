/** Scholar Capture Tools — hexagon bundle menu between Settings and Auto-Copy. */

import { CAPTURE_COLORS } from '../capture/capture.constants.js';
import {
  getCaptureToolsUnsupportedCopy,
  isCaptureToolsSupported,
} from '../../shared/capture-browser-support.js';
import {
  OPTIONAL_PERM_KINDS,
  detectBrowserBrand,
  openSiteAccessGrantPage,
  requestOptionalPermissions,
} from '../../shared/optional-permissions.js';
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
import { isPdfViewerPage } from '../pdf/pdf.detect.js';

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

let _pendingCapture = null;
let _hostAccessGranted = false;

async function openChromeGrantWindowFallback() {
  try {
    window.open(
      chrome.runtime.getURL('grant-site-access.html'),
      'pc-grant-site-access',
      'popup,width=440,height=340',
    );
  } catch (_) {}
}

async function openSiteAccessGrantWindow() {
  const sw = await openSiteAccessGrantPage();
  if (detectBrowserBrand().isOpera || sw.skippedGrantTab) {
    return { skippedGrantTab: true, openPopupOk: !!sw.openPopupOk };
  }
  if (!sw.ok) await openChromeGrantWindowFallback();
  return { skippedGrantTab: false };
}

function markHostAccessOk() {
  _hostAccessGranted = true;
  return true;
}

async function ensureCaptureHostAccess() {
  if (_hostAccessGranted) return true;
  const host = await requestOptionalPermissions(OPTIONAL_PERM_KINDS.ALL_URLS, { checkOnly: true });
  if (host.ok || _hostAccessGranted) return markHostAccessOk();
  const opened = await openSiteAccessGrantWindow();
  const operaPath = opened?.skippedGrantTab || detectBrowserBrand().isOpera;
  _widgetRef?.showWidgetToast?.(
    operaPath
      ? 'Click the PasteCraft toolbar icon, then Allow site access.'
      : 'Allow site access in the PasteCraft tab, then Image Picker continues.',
  );
  return false;
}

async function ensurePdfClipboardAccessIfNeeded() {
  if (!isPdfViewerPage()) return true;
  const clip = await requestOptionalPermissions(OPTIONAL_PERM_KINDS.PDF_CLIPBOARD);
  if (!clip.ok) {
    _widgetRef?.showWidgetToast?.(
      clip.message || 'PasteCraft needs clipboard permission for PDF capture',
    );
    return false;
  }
  return true;
}

function captureToolsBlocked() {
  return !isCaptureToolsSupported();
}

function showUnsupportedCaptureToast() {
  _widgetRef?.showWidgetToast?.(getCaptureToolsUnsupportedCopy('toast'));
}

async function handleSpotClick() {
  closeCaptureMenu();
  cancelWidgetImagePreview();
  if (captureToolsBlocked()) {
    _pendingCapture = null;
    showUnsupportedCaptureToast();
    return;
  }
  if (!(await ensureCaptureHostAccess())) return;
  if (!(await ensurePdfClipboardAccessIfNeeded())) return;
  const result = armWidgetSpot();
  _widgetRef?.showWidgetToast?.(result.message);
}

async function handleImagePickerClick() {
  if (_wrapEl?.dataset.pcImagePickerBusy === '1') return;
  _wrapEl.dataset.pcImagePickerBusy = '1';
  try {
    closeCaptureMenu();
    disarmWidgetSpot();
    if (captureToolsBlocked()) {
      _pendingCapture = null;
      showUnsupportedCaptureToast();
      return;
    }
    if (!(await ensureCaptureHostAccess())) return;
    setHexMode('image');
    await runWidgetImagePickerAction((msg) => _widgetRef?.showWidgetToast?.(msg));
  } finally {
    if (_wrapEl) _wrapEl.dataset.pcImagePickerBusy = '0';
  }
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
      _pendingCapture = 'spot';
      handleSpotClick().catch(() => {});
      return;
    }
    if (action === WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER) {
      event.preventDefault();
      _pendingCapture = 'image';
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

function captureMenuItemClass(unsupported) {
  return `capture-tools-menu-item${unsupported ? ' is-unsupported' : ''}`;
}

function buildCaptureMenuMarkup(unsupported) {
  const note = unsupported
    ? `<p class="capture-tools-unsupported" data-field="pc-capture-unsupported">${getCaptureToolsUnsupportedCopy('menu')}</p>`
    : '';
  const itemDisabled = unsupported ? ' aria-disabled="true"' : '';
  const itemClass = captureMenuItemClass(unsupported);
  return `
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
      ${note}
      <button type="button" class="${itemClass}" data-action="${WIDGET_CAPTURE_ACTIONS.SPOT}" role="menuitem"${itemDisabled}>
        <span class="capture-tools-menu-dot spot" aria-hidden="true"></span>
        <span>Spot</span>
      </button>
      <button type="button" class="${itemClass}" data-action="${WIDGET_CAPTURE_ACTIONS.IMAGE_PICKER}" role="menuitem"${itemDisabled}>
        <span class="capture-tools-menu-dot image" aria-hidden="true"></span>
        <span>Image Picker</span>
      </button>
    </div>
  `;
}

function wireCaptureMenuHandlers() {
  setWidgetSpotModeChangeHandler((mode) => setHexMode(mode === 'spot' ? 'spot' : 'idle'));
  setWidgetImageModeChangeHandler((mode) => setHexMode(mode === 'image' ? 'image' : 'idle'));
  setWidgetSpotToastHandler((msg) => _widgetRef?.showWidgetToast?.(msg));
  setWidgetSpotSavedHandler(() => {
    loadWidgetCaptureToolsStats(_widgetRef).catch(() => {});
  });
  setWidgetImageSavedHandler(() => {
    loadWidgetCaptureToolsStats(_widgetRef).catch(() => {});
  });
}

function bindGrantResumeListener() {
  if (!_wrapEl || _wrapEl.dataset.pcGrantListen === '1') return;
  _wrapEl.dataset.pcGrantListen = '1';
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action !== 'pcOptionalPermissionGranted') return;
    if (message.kind !== OPTIONAL_PERM_KINDS.ALL_URLS) return;
    _hostAccessGranted = true;
    const pending = _pendingCapture;
    _pendingCapture = null;
    if (pending === 'image') handleImagePickerClick().catch(() => {});
    if (pending === 'spot') handleSpotClick().catch(() => {});
  });
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

  const unsupported = captureToolsBlocked();
  wrap.innerHTML = buildCaptureMenuMarkup(unsupported);
  if (unsupported) wrap.classList.add('is-unsupported');

  inner.insertBefore(wrap, autoCopy);
  _wrapEl = wrap;
  _hexShape = wrap.querySelector('.capture-hex-shape');

  wireCaptureMenuHandlers();
  bindCaptureMenuEvents();
  setHexMode('idle');
  loadWidgetCaptureToolsStats(widget).catch(() => {});
  if (!unsupported) bindGrantResumeListener();
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
