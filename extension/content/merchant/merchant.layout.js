import { MERCHANT_STRIP_HEIGHT_PX, MERCHANT_LAYOUT_HTML_CLASS } from './merchant.constants.js';
import {
  injectMerchantLayoutStyles,
  removeMerchantLayoutStyles,
} from './merchant.mount.js';

/** @type {LayoutSnapshot | null} */
let _activeSnapshot = null;
function isMerchantHost(el) {
  const field = el?.getAttribute?.('data-field');
  return field === 'pc-merchant-strip-host' || field === 'pc-merchant-dock-host';
}

function parsePx(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function isPinnedToTop(el) {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
  return parsePx(cs.top) <= 1;
}

function usesFullViewportHeight(el) {
  const cs = getComputedStyle(el);
  const vh = window.innerHeight;
  if (cs.height === '100vh' || cs.minHeight === '100vh' || cs.maxHeight === '100vh') {
    return true;
  }
  const h = parsePx(cs.height);
  const maxH = parsePx(cs.maxHeight);
  const minH = parsePx(cs.minHeight);
  return (
    Math.abs(h - vh) <= 2
    || Math.abs(maxH - vh) <= 2
    || Math.abs(minH - vh) <= 2
  );
}

/** Fixed/sticky shells at viewport top — direct body children + one nested level (SPA sidebars). */
function collectPinnedTopTargets() {
  const targets = new Set();
  for (const child of document.body.children) {
    if (isMerchantHost(child)) continue;
    if (isPinnedToTop(child)) {
      targets.add(child);
      continue;
    }
    for (const nested of child.children) {
      if (isMerchantHost(nested)) continue;
      if (isPinnedToTop(nested)) targets.add(nested);
    }
  }
  return [...targets];
}

function applyPaddingCompensation(html, body, height, snapshot) {
  snapshot.htmlPaddingTop = html.style.paddingTop;
  snapshot.bodyPaddingTop = body.style.paddingTop;
  snapshot.bodyMarginTop = body.style.marginTop;

  const htmlBase = snapshot.htmlPaddingTop
    ? parsePx(snapshot.htmlPaddingTop)
    : parsePx(getComputedStyle(html).paddingTop);
  const bodyBase = snapshot.bodyPaddingTop
    ? parsePx(snapshot.bodyPaddingTop)
    : parsePx(getComputedStyle(body).paddingTop);

  html.style.paddingTop = `${htmlBase + height}px`;
  body.style.paddingTop = `${bodyBase + height}px`;
}

function applyFixedShellOffsets(targets, height) {
  const adjustments = [];
  for (const el of targets) {
    const cs = getComputedStyle(el);
    adjustments.push({
      el,
      top: el.style.top,
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      minHeight: el.style.minHeight,
    });
    el.style.top = `${parsePx(cs.top) + height}px`;
    if (usesFullViewportHeight(el)) {
      el.style.height = `calc(100vh - ${height}px)`;
      el.style.maxHeight = `calc(100vh - ${height}px)`;
      if (cs.minHeight === '100vh' || parsePx(cs.minHeight) >= window.innerHeight - 2) {
        el.style.minHeight = `calc(100vh - ${height}px)`;
      }
    }
  }
  return adjustments;
}

function restoreFixedShellOffsets(adjustments) {
  for (const adj of adjustments || []) {
    if (!adj.el?.isConnected) continue;
    adj.el.style.top = adj.top;
    adj.el.style.height = adj.height;
    adj.el.style.maxHeight = adj.maxHeight;
    adj.el.style.minHeight = adj.minHeight;
  }
}

export function applyMerchantLayoutCompensation(heightPx = MERCHANT_STRIP_HEIGHT_PX) {
  if (_activeSnapshot) return _activeSnapshot;

  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) return null;

  const pinnedTargets = collectPinnedTopTargets();
  const snapshot = {
    htmlPaddingTop: html.style.paddingTop,
    bodyPaddingTop: body.style.paddingTop,
    bodyMarginTop: body.style.marginTop,
    mode: pinnedTargets.length > 0 ? 'hybrid' : 'padding',
    fixedAdjustments: [],
  };

  html.classList.add(MERCHANT_LAYOUT_HTML_CLASS);
  html.style.setProperty('--pc-merchant-strip-height', `${heightPx}px`);
  injectMerchantLayoutStyles();

  // Always reserve viewport space; also nudge fixed/sticky shells (Etsy sidebars).
  applyPaddingCompensation(html, body, heightPx, snapshot);
  if (pinnedTargets.length > 0) {
    snapshot.mode = 'hybrid';
    snapshot.fixedAdjustments = applyFixedShellOffsets(pinnedTargets, heightPx);
  }

  _activeSnapshot = snapshot;
  return snapshot;
}

export function removeMerchantLayoutCompensation() {
  if (!_activeSnapshot) return;

  const html = document.documentElement;
  const body = document.body;
  const snapshot = _activeSnapshot;

  html.classList.remove(MERCHANT_LAYOUT_HTML_CLASS);
  html.style.removeProperty('--pc-merchant-strip-height');
  removeMerchantLayoutStyles();

  if (snapshot.fixedAdjustments?.length) {
    restoreFixedShellOffsets(snapshot.fixedAdjustments);
  }
  if (html && body) {
    html.style.paddingTop = snapshot.htmlPaddingTop;
    body.style.paddingTop = snapshot.bodyPaddingTop;
    body.style.marginTop = snapshot.bodyMarginTop;
  }

  _activeSnapshot = null;
}

export function isMerchantLayoutCompensationActive() {
  return _activeSnapshot !== null;
}
