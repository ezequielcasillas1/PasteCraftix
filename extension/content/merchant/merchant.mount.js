import { MERCHANT_STRIP_HEIGHT_PX, MERCHANT_LAYOUT_HTML_CLASS } from './merchant.constants.js';

const LAYOUT_STYLE_ID = 'pc-merchant-layout-styles';
const STRIP_HOST_FIELD = 'pc-merchant-strip-host';
const DOCK_HOST_FIELD = 'pc-merchant-dock-host';

/** Top-level mount target — outside SPA scroll/transform stacks on body. */
export function getMerchantMountRoot() {
  return document.documentElement || document.body;
}

export function isMerchantHostElement(el) {
  const field = el?.getAttribute?.('data-field');
  return field === STRIP_HOST_FIELD || field === DOCK_HOST_FIELD;
}

export function mountMerchantHost(host) {
  const root = getMerchantMountRoot();
  if (!host || !root) return host;
  if (host.parentNode !== root) {
    root.appendChild(host);
  }
  return host;
}

function buildLayoutStyleText() {
  const h = MERCHANT_STRIP_HEIGHT_PX;
  return `
    html.${MERCHANT_LAYOUT_HTML_CLASS} {
      scroll-padding-top: var(--pc-merchant-strip-height, ${h}px);
    }

    [data-field="${STRIP_HOST_FIELD}"] {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--pc-merchant-strip-height, ${h}px) !important;
      min-height: var(--pc-merchant-strip-height, ${h}px) !important;
      max-height: var(--pc-merchant-strip-height, ${h}px) !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      z-index: 2147483647 !important;
      transform: none !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      contain: layout style;
    }

    [data-field="${DOCK_HOST_FIELD}"] {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 0 !important;
      height: 0 !important;
      z-index: 2147483646 !important;
      transform: none !important;
      pointer-events: none !important;
    }
  `;
}

export function injectMerchantLayoutStyles() {
  if (document.getElementById(LAYOUT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LAYOUT_STYLE_ID;
  style.setAttribute('data-field', LAYOUT_STYLE_ID);
  style.textContent = buildLayoutStyleText();
  (document.head || getMerchantMountRoot()).appendChild(style);
}

export function removeMerchantLayoutStyles() {
  document.getElementById(LAYOUT_STYLE_ID)?.remove();
}

export function applyStripHostFixedStyles(host, heightPx = MERCHANT_STRIP_HEIGHT_PX) {
  if (!host) return;
  host.setAttribute('data-field', STRIP_HOST_FIELD);
  const toKebab = (prop) => prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  const rules = {
    display: 'block',
    width: '100%',
    height: `${heightPx}px`,
    minHeight: `${heightPx}px`,
    maxHeight: `${heightPx}px`,
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
    zIndex: '2147483647',
    transform: 'none',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'auto',
    contain: 'layout style',
  };
  for (const [key, value] of Object.entries(rules)) {
    host.style.setProperty(toKebab(key), value, 'important');
  }
}

let _pinGuardHost = null;
let _pinGuardHandler = null;

/** Keep strip host on documentElement and viewport-pinned during nested scroll. */
export function bindMerchantStripPinGuard(host) {
  if (!host || _pinGuardHost === host) return;
  unbindMerchantStripPinGuard();

  _pinGuardHost = host;
  _pinGuardHandler = () => {
    if (!_pinGuardHost?.isConnected) return;
    mountMerchantHost(_pinGuardHost);
    _pinGuardHost.style.setProperty('top', '0', 'important');
    _pinGuardHost.style.setProperty('position', 'fixed', 'important');
  };

  window.addEventListener('scroll', _pinGuardHandler, { capture: true, passive: true });
  document.addEventListener('scroll', _pinGuardHandler, { capture: true, passive: true });
  window.addEventListener('resize', _pinGuardHandler, { passive: true });
}

export function unbindMerchantStripPinGuard() {
  if (_pinGuardHandler) {
    window.removeEventListener('scroll', _pinGuardHandler, { capture: true });
    document.removeEventListener('scroll', _pinGuardHandler, { capture: true });
    window.removeEventListener('resize', _pinGuardHandler);
  }
  _pinGuardHost = null;
  _pinGuardHandler = null;
}
