/**
 * Capture Tools (Image Picker + Spot) eligibility.
 * APIs: optional <all_urls>, permissions.request (user gesture),
 * tabs.captureVisibleTab, scripting.executeScript, Shadow DOM overlay.
 *
 * Matrix (Capture Tools only: Image Picker + Spot — not a full-app lab):
 *   Chrome, Edge — eligible (production stores).
 *   Comet (Perplexity) — eligible (user-confirmed 2026-08-14). UA often
 *     Chrome-identical; if detected, still eligible. Not Opera/Arc.
 *   Brave, Vivaldi, Chromium — eligible (no grant-page blocker evidence).
 *   Opera / Opera GX — not eligible (2026-08-14 FAILURE: ERR_BLOCKED_BY_CLIENT
 *     on grant-site-access.html; popup grant also failed).
 *   Arc — not eligible when detected (UA often Chrome-identical; CSS palette
 *     cluster / Arc brand only — never treat plain Chrome UA as Arc).
 *   Firefox, Safari — not eligible (not this MV3 chrome.* build).
 *   Unproven here: Atlas, Dia, Sidekick, SigmaOS, mobile Chromium.
 */

export const CAPTURE_BROWSER_BRANDS = Object.freeze({
  CHROME: 'chrome',
  EDGE: 'edge',
  BRAVE: 'brave',
  VIVALDI: 'vivaldi',
  CHROMIUM: 'chromium',
  COMET: 'comet',
  OPERA: 'opera',
  ARC: 'arc',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
  OTHER: 'other',
});

const UNSUPPORTED_BRANDS = new Set([
  CAPTURE_BROWSER_BRANDS.OPERA,
  CAPTURE_BROWSER_BRANDS.ARC,
  CAPTURE_BROWSER_BRANDS.FIREFOX,
  CAPTURE_BROWSER_BRANDS.SAFARI,
]);

const ARC_PALETTE_VARS = Object.freeze([
  '--arc-palette-title',
  '--arc-palette-background',
  '--arc-palette-foreground',
  '--arc-palette-focus',
  '--arc-palette-maxContrastColor',
  '--arc-palette-minContrastColor',
]);

export const CAPTURE_TOOLS_COPY = Object.freeze({
  MENU:
    'Image Picker and Spot don’t work in this browser. We’re trying our best. Auto-Copy and click-and-drag still work — click-and-drag is the only capture tool here.',
  TOAST:
    'Image Picker and Spot don’t work in this browser. Auto-Copy and click-and-drag still work.',
  POPUP:
    'Image Picker and Spot don’t work in this browser. Auto-Copy and click-and-drag still work — click-and-drag is the only capture tool here.',
});

function readUserAgent(input) {
  if (input && typeof input.userAgent === 'string') return input.userAgent;
  try {
    return typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  } catch (_) {
    return '';
  }
}

function readUaBrands(input) {
  if (Array.isArray(input?.brands)) return input.brands;
  try {
    const list = navigator?.userAgentData?.brands;
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function brandNames(brands) {
  return brands
    .map((entry) => String(entry?.brand || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasOprGlobal(input) {
  if (typeof input?.hasOprGlobal === 'boolean') return input.hasOprGlobal;
  try {
    return typeof window !== 'undefined' && !!(window.opr || window.opera);
  } catch (_) {
    return false;
  }
}

function paletteHitCount(styles) {
  return ARC_PALETTE_VARS.filter((name) => String(styles.getPropertyValue(name) || '').trim()).length;
}

export function countArcPaletteVars(doc) {
  try {
    const root = doc?.documentElement || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!root || typeof getComputedStyle !== 'function') return 0;
    return paletteHitCount(getComputedStyle(root));
  } catch (_) {
    return 0;
  }
}

function hasArcSignal(input, brands) {
  if (brands.some((name) => name === 'arc')) return true;
  const hits = Number.isFinite(input?.arcPaletteHits)
    ? input.arcPaletteHits
    : countArcPaletteVars(input?.document);
  return hits >= 2;
}

function hasBraveSignal(input, brands) {
  if (brands.some((name) => name.includes('brave'))) return true;
  if (typeof input?.isBrave === 'boolean') return input.isBrave;
  try {
    return typeof navigator !== 'undefined' && !!navigator.brave;
  } catch (_) {
    return false;
  }
}

function brandResult(id, label) {
  return { id, label };
}

function isFirefoxUa(ua) {
  return /\bFirefox\b/i.test(ua) && !/\bChrome\b/i.test(ua);
}

function isSafariUa(ua) {
  return /\bSafari\b/i.test(ua) && !/\bChrome\b/i.test(ua) && !/\bChromium\b/i.test(ua);
}

function isOperaBrand(ctx) {
  return hasOprGlobal(ctx.input)
    || /\bOPR\/|\bOpera\b/i.test(ctx.ua)
    || ctx.brands.some((name) => name.includes('opera'));
}

function isEdgeBrand(ctx) {
  return /\bEdg(?:e|A|iOS)?\//i.test(ctx.ua)
    || ctx.brands.some((name) => name.includes('microsoft edge') || name === 'edge');
}

function isChromeBrand(ctx) {
  return ctx.brands.some((name) => name === 'google chrome')
    || (/\bChrome\//i.test(ctx.ua) && !/\bChromium\b/i.test(ctx.ua));
}

function hasCometSignal(ctx) {
  return /\bComet\b/i.test(ctx.ua) || ctx.brands.some((name) => name.includes('comet'));
}

const BRAND_MATCHERS = [
  (ctx) => (isFirefoxUa(ctx.ua) ? brandResult(CAPTURE_BROWSER_BRANDS.FIREFOX, 'Firefox') : null),
  (ctx) => (isSafariUa(ctx.ua) ? brandResult(CAPTURE_BROWSER_BRANDS.SAFARI, 'Safari') : null),
  (ctx) => (hasCometSignal(ctx) ? brandResult(CAPTURE_BROWSER_BRANDS.COMET, 'Comet') : null),
  (ctx) => (isOperaBrand(ctx) ? brandResult(CAPTURE_BROWSER_BRANDS.OPERA, 'Opera') : null),
  (ctx) => (isEdgeBrand(ctx) ? brandResult(CAPTURE_BROWSER_BRANDS.EDGE, 'Edge') : null),
  (ctx) => (hasArcSignal(ctx.input, ctx.brands) ? brandResult(CAPTURE_BROWSER_BRANDS.ARC, 'Arc') : null),
  (ctx) => (
    /\bVivaldi\//i.test(ctx.ua) || ctx.brands.some((name) => name.includes('vivaldi'))
      ? brandResult(CAPTURE_BROWSER_BRANDS.VIVALDI, 'Vivaldi')
      : null
  ),
  (ctx) => (hasBraveSignal(ctx.input, ctx.brands) ? brandResult(CAPTURE_BROWSER_BRANDS.BRAVE, 'Brave') : null),
  (ctx) => (isChromeBrand(ctx) ? brandResult(CAPTURE_BROWSER_BRANDS.CHROME, 'Chrome') : null),
  (ctx) => (
    /\bChromium\b/i.test(ctx.ua) || ctx.brands.some((name) => name === 'chromium')
      ? brandResult(CAPTURE_BROWSER_BRANDS.CHROMIUM, 'Chromium')
      : null
  ),
];

/**
 * @param {{ userAgent?: string, brands?: Array<{brand?: string}>, hasOprGlobal?: boolean, arcPaletteHits?: number, isBrave?: boolean, document?: Document }} [input]
 */
export function detectCaptureBrowserBrand(input = {}) {
  const ctx = {
    input,
    ua: readUserAgent(input),
    brands: brandNames(readUaBrands(input)),
  };
  for (const match of BRAND_MATCHERS) {
    const hit = match(ctx);
    if (hit) return hit;
  }
  return brandResult(CAPTURE_BROWSER_BRANDS.OTHER, 'Other');
}

export function isCaptureToolsSupported(input) {
  return !UNSUPPORTED_BRANDS.has(detectCaptureBrowserBrand(input).id);
}

export function getCaptureToolsBlockReason(input) {
  const brand = detectCaptureBrowserBrand(input);
  if (!UNSUPPORTED_BRANDS.has(brand.id)) return null;
  if (brand.id === CAPTURE_BROWSER_BRANDS.OPERA) {
    return 'opera_optional_host_grant';
  }
  if (brand.id === CAPTURE_BROWSER_BRANDS.ARC) {
    return 'arc_capture_tools_unsupported';
  }
  return 'browser_not_supported';
}

export function getCaptureToolsUnsupportedCopy(kind = 'menu') {
  if (kind === 'toast') return CAPTURE_TOOLS_COPY.TOAST;
  if (kind === 'popup') return CAPTURE_TOOLS_COPY.POPUP;
  return CAPTURE_TOOLS_COPY.MENU;
}

export function getCaptureBrowserBrand(input) {
  return detectCaptureBrowserBrand(input);
}
