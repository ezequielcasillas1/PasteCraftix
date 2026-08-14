/**
 * Optional MV3 permissions — request at use-time (not install-time).
 * Background uses ensure*; content/popup use request* via messaging.
 */

export const OPTIONAL_PERM_KINDS = Object.freeze({
  PDF_CLIPBOARD: 'pdfClipboard',
  ALL_URLS: 'allUrls',
});

export const OPTIONAL_PERM_DESCS = Object.freeze({
  [OPTIONAL_PERM_KINDS.PDF_CLIPBOARD]: {
    // offscreen is required (image copy + PDF); only clipboardRead is optional.
    permissions: ['clipboardRead'],
  },
  [OPTIONAL_PERM_KINDS.ALL_URLS]: {
    origins: ['<all_urls>'],
  },
});

export const OPTIONAL_PERM_MESSAGES = Object.freeze({
  [OPTIONAL_PERM_KINDS.PDF_CLIPBOARD]:
    'PasteCraft needs clipboard permission for PDF capture',
  [OPTIONAL_PERM_KINDS.ALL_URLS]:
    'PasteCraft needs site access for Capture Tools on this page',
});

function denyPayload(kind, error) {
  return {
    ok: false,
    granted: false,
    error: error || 'permission_denied',
    message: OPTIONAL_PERM_MESSAGES[kind] || 'Permission denied',
  };
}

async function alreadyGranted(desc) {
  try {
    return await chrome.permissions.contains(desc);
  } catch (_) {
    return false;
  }
}

export function detectBrowserBrand(userAgent) {
  const ua = String(
    userAgent
      || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
      || '',
  );
  const isOpera = /\bOPR\/|\bOpera\b/i.test(ua);
  const isEdge = /\bEdg(?:e|A|iOS)?\//i.test(ua);
  let uaBrand = 'other';
  if (isOpera) uaBrand = 'opera';
  else if (isEdge) uaBrand = 'edge';
  else if (/\bChrome\//i.test(ua)) uaBrand = 'chrome';
  return { isOpera, isEdge, uaBrand };
}

export function originPatternFromUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch (_) {
    return '';
  }
}

export async function hasOptionalHostAccess(originPattern) {
  const allDesc = OPTIONAL_PERM_DESCS[OPTIONAL_PERM_KINDS.ALL_URLS];
  if (await alreadyGranted(allDesc)) {
    return { ok: true, granted: true, already: true, scope: 'all_urls' };
  }
  if (originPattern && await alreadyGranted({ origins: [originPattern] })) {
    return { ok: true, granted: true, already: true, scope: 'origin' };
  }
  return denyPayload(OPTIONAL_PERM_KINDS.ALL_URLS, 'permission_needed');
}

async function requestOrigins(origins) {
  try {
    const granted = await chrome.permissions.request({ origins });
    return { granted: !!granted, error: null };
  } catch (err) {
    return { granted: false, error: String(err?.message || err || 'permission_request_failed') };
  }
}

/** Popup / grant page only — must run from a user click. */
export async function requestHostAccessFromUserGesture(originPattern) {
  const existing = await hasOptionalHostAccess(originPattern);
  if (existing.ok) return existing;

  const allResult = await requestOrigins(['<all_urls>']);
  if (allResult.granted) return { ok: true, granted: true, scope: 'all_urls' };

  if (originPattern) {
    const originResult = await requestOrigins([originPattern]);
    if (originResult.granted) return { ok: true, granted: true, scope: 'origin' };
    return {
      ...denyPayload(OPTIONAL_PERM_KINDS.ALL_URLS, originResult.error || allResult.error || 'permission_denied'),
      allUrlsError: allResult.error,
      originError: originResult.error,
    };
  }

  return {
    ...denyPayload(OPTIONAL_PERM_KINDS.ALL_URLS, allResult.error || 'permission_denied'),
    allUrlsError: allResult.error,
  };
}

export async function notifyTabsOptionalHostGranted() {
  let tabCount = 0;
  let sent = 0;
  let failed = 0;
  try {
    const tabs = await chrome.tabs.query({});
    tabCount = tabs.length;
    await Promise.all(tabs.map(async (tab) => {
      if (!Number.isFinite(tab?.id)) return;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'pcOptionalPermissionGranted',
          kind: OPTIONAL_PERM_KINDS.ALL_URLS,
        });
        sent += 1;
      } catch (_) {
        failed += 1;
      }
    }));
  } catch (_) {}
  return { tabCount, sent, failed };
}

export async function tryOpenToolbarPopup() {
  if (typeof chrome?.action?.openPopup !== 'function') {
    return { ok: false, error: 'openPopup_unavailable' };
  }
  try {
    await chrome.action.openPopup();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err || 'openPopup_failed') };
  }
}

export async function markSiteAccessNeeded() {
  try {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    await chrome.action.setTitle({ title: 'PasteCraft — Allow site access' });
  } catch (_) {}
}

export async function clearSiteAccessNeeded() {
  try {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'PasteCraft' });
  } catch (_) {}
}

async function requestDesc(desc, kind) {
  try {
    const granted = await chrome.permissions.request(desc);
    return granted ? { ok: true, granted: true } : denyPayload(kind, 'permission_denied');
  } catch (err) {
    return denyPayload(kind, String(err?.message || err || 'permission_request_failed'));
  }
}

async function ensureAllUrlsAccess(options) {
  const host = await hasOptionalHostAccess(options.originPattern);
  if (host.ok) return host;
  if (options.checkOnly === true) return denyPayload(OPTIONAL_PERM_KINDS.ALL_URLS, 'permission_needed');
  return requestDesc(OPTIONAL_PERM_DESCS[OPTIONAL_PERM_KINDS.ALL_URLS], OPTIONAL_PERM_KINDS.ALL_URLS);
}

/** Service worker / extension pages only (chrome.permissions API). */
export async function ensureOptionalPermissions(kind, options = {}) {
  const desc = OPTIONAL_PERM_DESCS[kind];
  if (!desc) return denyPayload(kind, 'unknown_kind');
  if (kind === OPTIONAL_PERM_KINDS.ALL_URLS) return ensureAllUrlsAccess(options);
  if (await alreadyGranted(desc)) return { ok: true, granted: true, already: true };
  if (options.checkOnly === true) return denyPayload(kind, 'permission_needed');
  return requestDesc(desc, kind);
}

function resolveOriginPattern(kind, originPattern) {
  if (originPattern) return originPattern;
  if (kind !== OPTIONAL_PERM_KINDS.ALL_URLS) return '';
  return originPatternFromUrl(globalThis.location?.href);
}

function mapPermissionResponse(kind, response) {
  if (response?.ok) return response;
  return denyPayload(kind, response?.error || 'permission_denied');
}

/** Content scripts / any context — routes to background. */
export async function requestOptionalPermissions(kind, options = {}) {
  const originPattern = resolveOriginPattern(kind, options.originPattern);
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pcEnsureOptionalPermissions',
      kind,
      checkOnly: options.checkOnly === true,
      originPattern: originPattern || undefined,
    });
    return mapPermissionResponse(kind, response);
  } catch (err) {
    return denyPayload(kind, String(err?.message || err || 'permission_request_failed'));
  }
}

function mapOpenGrantResponse(response) {
  if (response?.ok) return response;
  return { ok: false, error: response?.error || 'open_failed' };
}

/** Packed installs: SW opens grant UI (Opera skips blocked grant tab). */
export async function openSiteAccessGrantPage() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pcOpenSiteAccessGrant',
    });
    return mapOpenGrantResponse(response);
  } catch (err) {
    return { ok: false, error: String(err?.message || err || 'open_failed') };
  }
}
