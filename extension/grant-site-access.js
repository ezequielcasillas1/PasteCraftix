import {
  clearSiteAccessNeeded,
  detectBrowserBrand,
  hasOptionalHostAccess,
  notifyTabsOptionalHostGranted,
  originPatternFromUrl,
  pcDebugOperaAf03f9,
  requestHostAccessFromUserGesture,
} from './shared/optional-permissions.js';

const DESC = { origins: ['<all_urls>'] };

function pcDebug(hypothesisId, location, message, data) {
  const payload = {
    sessionId: 'af03f9',
    runId: 'perm-pre',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify(payload));
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function sourceTabId() {
  try {
    const n = Number(new URLSearchParams(location.search).get('srcTab'));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (_) {
    return null;
  }
}

function sourceOriginPattern() {
  try {
    const raw = new URLSearchParams(location.search).get('srcOrigin') || '';
    return originPatternFromUrl(raw.replace(/\/\*$/, '/')) || raw || '';
  } catch (_) {
    return '';
  }
}

async function notifyTab(tabId) {
  if (!Number.isFinite(tabId)) return false;
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'pcOptionalPermissionGranted',
      kind: 'allUrls',
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function finishGranted() {
  const srcTab = sourceTabId();
  let srcSent = false;
  try {
    srcSent = await notifyTab(srcTab);
  } catch (_) {}
  const broadcast = await notifyTabsOptionalHostGranted();
  await clearSiteAccessNeeded();
  // #region agent log
  pcDebug('H4', 'grant-site-access.js:finishGranted', 'broadcast to tabs', {
    tabCount: broadcast.tabCount,
    sent: broadcast.sent,
    srcTab,
    srcSent,
  });
  // #endregion
  window.close();
}

function logGrantClick(result, originPattern) {
  // #region agent log
  pcDebug('H3', 'grant-site-access.js:click', 'permissions.request result', {
    granted: !!result.ok,
  });
  pcDebugOperaAf03f9('H-O1', 'grant-site-access.js:click', 'permissions.request result', {
    ok: !!result.ok,
    scope: result.scope || null,
    error: result.error || null,
    allUrlsError: result.allUrlsError || null,
    originError: result.originError || null,
  });
  pcDebugOperaAf03f9('H-O5', 'grant-site-access.js:click', 'origin fallback', {
    ok: !!result.ok,
    scope: result.scope || null,
    hasOriginPattern: !!originPattern,
  });
  // #endregion
}

function grantClickFailureText(brand) {
  if (brand.isOpera) {
    return 'Permission was not granted. Use opera://extensions → PasteCraft → Details → Site access if no prompt appeared.';
  }
  return 'Permission was not granted.';
}

async function onGrantClick(btn, status, originPattern, brand) {
  btn.disabled = true;
  status.textContent = '';
  try {
    const result = await requestHostAccessFromUserGesture(originPattern);
    logGrantClick(result, originPattern);
    if (result.ok) {
      await finishGranted();
      return;
    }
    status.textContent = grantClickFailureText(brand);
  } catch (err) {
    // #region agent log
    pcDebug('H3', 'grant-site-access.js:click', 'permissions.request threw', {
      error: String(err?.message || err),
    });
    pcDebugOperaAf03f9('H-O1', 'grant-site-access.js:click', 'permissions.request threw', {
      error: String(err?.message || err),
    });
    // #endregion
    status.textContent = String(err?.message || err || 'Request failed');
  }
  btn.disabled = false;
}

async function init() {
  const status = document.getElementById('status');
  const btn = document.getElementById('grantBtn');
  const originPattern = sourceOriginPattern();
  const brand = detectBrowserBrand();
  const grantedAlready = await hasOptionalHostAccess(originPattern);
  let containsAll = false;
  try {
    containsAll = await chrome.permissions.contains(DESC);
  } catch (_) {}
  // #region agent log
  pcDebug('H3', 'grant-site-access.js:init', 'grant page opened', {
    grantedAlready: !!grantedAlready.ok,
  });
  pcDebugOperaAf03f9('H-O1', 'grant-site-access.js:init', 'grant page opened', {
    grantedAlready: !!grantedAlready.ok,
    scope: grantedAlready.scope || null,
    containsAll,
    hasOriginPattern: !!originPattern,
  });
  // #endregion
  if (grantedAlready.ok) {
    await finishGranted();
    return;
  }
  const hint = document.getElementById('operaHint');
  if (hint) hint.hidden = !brand.isOpera;
  btn.addEventListener('click', () => {
    onGrantClick(btn, status, originPattern, brand).catch(() => {
      btn.disabled = false;
    });
  });
}

init();
