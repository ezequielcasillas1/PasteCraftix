import {
  clearSiteAccessNeeded,
  detectBrowserBrand,
  hasOptionalHostAccess,
  notifyTabsOptionalHostGranted,
  originPatternFromUrl,
  requestHostAccessFromUserGesture,
} from './shared/optional-permissions.js';

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
  try {
    await notifyTab(sourceTabId());
  } catch (_) {}
  await notifyTabsOptionalHostGranted();
  await clearSiteAccessNeeded();
  window.close();
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
    if (result.ok) {
      await finishGranted();
      return;
    }
    status.textContent = grantClickFailureText(brand);
  } catch (err) {
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
