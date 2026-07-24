/**
 * @forward-slice Background runtime helpers (Command/Mediator support).
 * Shared by menus, window, and clips handlers — not a feature monolith.
 */

export function isRepoLoaderBuild() {
  try {
    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const name = mf && mf.name ? String(mf.name) : '';
    const desc = mf && mf.description ? String(mf.description) : '';
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

export function getExtensionPageUrl(pagePath) {
  const raw = String(pagePath || '').trim();
  const path = raw.startsWith('extension/') || !isRepoLoaderBuild() ? raw : `extension/${raw}`;
  return chrome.runtime.getURL(path);
}

export function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export async function safeTabsSendMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (_) {
    return false;
  }
}

export async function getAppOpenMode() {
  try {
    const { widgetSettings = {} } = await chrome.storage.local.get(['widgetSettings']);
    const v = widgetSettings && typeof widgetSettings.appOpenMode === 'string' ? widgetSettings.appOpenMode : 'inPage';
    return v === 'edgePopup' ? 'edgePopup' : 'inPage';
  } catch (_) {
    return 'inPage';
  }
}

export async function openAppPopupWindow() {
  const url = getExtensionPageUrl('popup.html');
  return chrome.windows.create({
    url,
    type: 'popup',
    width: 520,
    height: 760,
    focused: true
  });
}
