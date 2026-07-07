import { MERCHANT_STRIP_HEIGHT_PX, MERCHANT_LAYOUT_HTML_CLASS } from './merchant.constants.js';
import {
  injectMerchantLayoutStyles,
  removeMerchantLayoutStyles,
} from './merchant.mount.js';

/** @type {LayoutSnapshot | null} */
let _activeSnapshot = null;
/** @type {MutationObserver | null} */
let _layoutObserver = null;
let _layoutObserverTimer = null;
/** @type {((event: Event) => void) | null} */
let _layoutResizeHandler = null;

const PINNED_SCAN_MAX_DEPTH = 6;
const PINNED_SCAN_MAX_TARGETS = 24;

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

function shouldCompensatePinnedElement(el) {
  if (!el?.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.width >= vw * 0.45) return true;
  if (rect.height >= vh * 0.45) return true;
  if (usesFullViewportHeight(el)) return true;

  const tag = el.tagName;
  if (tag === 'HEADER' || tag === 'NAV') return true;

  const role = el.getAttribute('role');
  if (role === 'banner' || role === 'navigation') return true;

  return false;
}

/** Fixed/sticky shells at viewport top — BFS from body (SPAs nest headers deeper than Etsy). */
function collectPinnedTopTargets() {
  const targets = new Set();
  const queue = [];

  for (const child of document.body.children) {
    if (isMerchantHost(child)) continue;
    queue.push({ el: child, depth: 0 });
  }

  while (queue.length > 0 && targets.size < PINNED_SCAN_MAX_TARGETS) {
    const { el, depth } = queue.shift();
    if (!el || isMerchantHost(el)) continue;

    if (isPinnedToTop(el) && shouldCompensatePinnedElement(el)) {
      targets.add(el);
    }

    if (depth >= PINNED_SCAN_MAX_DEPTH) continue;
    for (const child of el.children) {
      if (isMerchantHost(child)) continue;
      queue.push({ el: child, depth: depth + 1 });
    }
  }

  return [...targets];
}

function captureStyleProp(el, prop) {
  return {
    value: el.style.getPropertyValue(prop),
    priority: el.style.getPropertyPriority(prop),
  };
}

function restoreStyleProp(el, prop, captured) {
  if (!captured?.value && !captured?.priority) {
    el.style.removeProperty(prop);
    return;
  }
  el.style.setProperty(prop, captured.value, captured.priority);
}

function applyPaddingCompensation(html, body, height, snapshot) {
  snapshot.htmlPaddingTop = captureStyleProp(html, 'padding-top');
  snapshot.bodyPaddingTop = captureStyleProp(body, 'padding-top');
  snapshot.bodyMarginTop = captureStyleProp(body, 'margin-top');

  const htmlBase = snapshot.htmlPaddingTop.value
    ? parsePx(snapshot.htmlPaddingTop.value)
    : parsePx(getComputedStyle(html).paddingTop);

  // !important beats site resets; html-only avoids stacking html + body flow offset.
  html.style.setProperty('padding-top', `${htmlBase + height}px`, 'important');
}

function applyFixedShellOffsets(targets, height) {
  const adjustments = [];
  for (const el of targets) {
    const cs = getComputedStyle(el);
    adjustments.push({
      el,
      top: captureStyleProp(el, 'top'),
      height: captureStyleProp(el, 'height'),
      maxHeight: captureStyleProp(el, 'max-height'),
      minHeight: captureStyleProp(el, 'min-height'),
    });
    el.style.setProperty('top', `${parsePx(cs.top) + height}px`, 'important');
    if (usesFullViewportHeight(el)) {
      el.style.setProperty('height', `calc(100vh - ${height}px)`, 'important');
      el.style.setProperty('max-height', `calc(100vh - ${height}px)`, 'important');
      if (cs.minHeight === '100vh' || parsePx(cs.minHeight) >= window.innerHeight - 2) {
        el.style.setProperty('min-height', `calc(100vh - ${height}px)`, 'important');
      }
    }
  }
  return adjustments;
}

function restoreFixedShellOffsets(adjustments) {
  for (const adj of adjustments || []) {
    if (!adj.el?.isConnected) continue;
    restoreStyleProp(adj.el, 'top', adj.top);
    restoreStyleProp(adj.el, 'height', adj.height);
    restoreStyleProp(adj.el, 'max-height', adj.maxHeight);
    restoreStyleProp(adj.el, 'min-height', adj.minHeight);
  }
}

function mergeFixedShellOffsets(snapshot, heightPx) {
  const seen = new Set((snapshot.fixedAdjustments || []).map((adj) => adj.el));
  const candidates = collectPinnedTopTargets().filter((el) => !seen.has(el));
  if (candidates.length === 0) return;
  snapshot.fixedAdjustments.push(...applyFixedShellOffsets(candidates, heightPx));
  snapshot.mode = 'hybrid';
}

function stopLayoutObserver() {
  if (_layoutObserverTimer) {
    clearTimeout(_layoutObserverTimer);
    _layoutObserverTimer = null;
  }
  _layoutObserver?.disconnect();
  _layoutObserver = null;
  if (_layoutResizeHandler) {
    window.removeEventListener('resize', _layoutResizeHandler);
    _layoutResizeHandler = null;
  }
}

function startLayoutObserver(heightPx) {
  stopLayoutObserver();
  if (!document.body) return;

  const rescan = () => {
    if (!_activeSnapshot) return;
    mergeFixedShellOffsets(_activeSnapshot, heightPx);
  };

  _layoutObserver = new MutationObserver(() => {
    if (!_activeSnapshot) return;
    clearTimeout(_layoutObserverTimer);
    _layoutObserverTimer = setTimeout(rescan, 250);
  });

  _layoutObserver.observe(document.body, { childList: true, subtree: true });

  _layoutResizeHandler = () => {
    clearTimeout(_layoutObserverTimer);
    _layoutObserverTimer = setTimeout(rescan, 150);
  };
  window.addEventListener('resize', _layoutResizeHandler, { passive: true });
}

export function applyMerchantLayoutCompensation(heightPx = MERCHANT_STRIP_HEIGHT_PX) {
  if (_activeSnapshot) return _activeSnapshot;

  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) return null;

  const pinnedTargets = collectPinnedTopTargets();
  const snapshot = {
    heightPx,
    htmlPaddingTop: captureStyleProp(html, 'padding-top'),
    bodyPaddingTop: captureStyleProp(body, 'padding-top'),
    bodyMarginTop: captureStyleProp(body, 'margin-top'),
    mode: pinnedTargets.length > 0 ? 'hybrid' : 'padding',
    fixedAdjustments: [],
  };

  html.classList.add(MERCHANT_LAYOUT_HTML_CLASS);
  html.style.setProperty('--pc-merchant-strip-height', `${heightPx}px`);
  injectMerchantLayoutStyles();

  // Flow sites: html padding with !important; fixed/sticky shells nudged down (SPAs, Etsy, etc.).
  applyPaddingCompensation(html, body, heightPx, snapshot);
  if (pinnedTargets.length > 0) {
    snapshot.mode = 'hybrid';
    snapshot.fixedAdjustments = applyFixedShellOffsets(pinnedTargets, heightPx);
  }

  startLayoutObserver(heightPx);
  _activeSnapshot = snapshot;
  return snapshot;
}

export function removeMerchantLayoutCompensation() {
  if (!_activeSnapshot) return;

  const html = document.documentElement;
  const body = document.body;
  const snapshot = _activeSnapshot;

  stopLayoutObserver();
  html.classList.remove(MERCHANT_LAYOUT_HTML_CLASS);
  html.style.removeProperty('--pc-merchant-strip-height');
  removeMerchantLayoutStyles();

  if (snapshot.fixedAdjustments?.length) {
    restoreFixedShellOffsets(snapshot.fixedAdjustments);
  }
  if (html && body) {
    restoreStyleProp(html, 'padding-top', snapshot.htmlPaddingTop);
    restoreStyleProp(body, 'padding-top', snapshot.bodyPaddingTop);
    restoreStyleProp(body, 'margin-top', snapshot.bodyMarginTop);
  }

  _activeSnapshot = null;
}

export function isMerchantLayoutCompensationActive() {
  return _activeSnapshot !== null;
}
