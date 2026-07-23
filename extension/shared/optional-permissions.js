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
    permissions: ['clipboardRead', 'offscreen'],
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

/** Service worker / extension pages only (chrome.permissions API). */
export async function ensureOptionalPermissions(kind) {
  const desc = OPTIONAL_PERM_DESCS[kind];
  if (!desc) return denyPayload(kind, 'unknown_kind');
  if (await alreadyGranted(desc)) return { ok: true, granted: true, already: true };

  try {
    const granted = await chrome.permissions.request(desc);
    return granted ? { ok: true, granted: true } : denyPayload(kind, 'permission_denied');
  } catch (err) {
    return denyPayload(kind, String(err?.message || err || 'permission_request_failed'));
  }
}

/** Content scripts / any context — routes to background. */
export async function requestOptionalPermissions(kind) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pcEnsureOptionalPermissions',
      kind,
    });
    return response?.ok ? response : denyPayload(kind, response?.error || 'permission_denied');
  } catch (err) {
    return denyPayload(kind, String(err?.message || err || 'permission_request_failed'));
  }
}
