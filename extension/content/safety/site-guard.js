/**
 * Runtime site guard — blocks widget/quick-paste on dangerous or sensitive pages.
 * Merges bundled + remote blocklists hydrated from chrome.storage.local.
 */

import {
  BLOCKED_HOSTS,
  isSiteAllowed as coreIsSiteAllowed,
  isUrlSafeToOpen as coreIsUrlSafeToOpen,
  setRuntimeBlockedHosts,
} from '../../shared/url-safety.js';

const STORAGE_BLOCKLIST_KEY = 'siteGuardRemoteBlocklist';

let remoteHosts = null;

export function getMergedBlockedHosts() {
  const merged = new Set(BLOCKED_HOSTS);
  if (remoteHosts) {
    for (const host of remoteHosts) merged.add(host);
  }
  return merged;
}

function applyRemoteHosts(hostList) {
  if (Array.isArray(hostList) && hostList.length) {
    remoteHosts = new Set(hostList.map((h) => String(h).trim().toLowerCase()).filter(Boolean));
    setRuntimeBlockedHosts(remoteHosts);
    return;
  }
  remoteHosts = null;
  setRuntimeBlockedHosts(null);
}

/** Load remote blocklist from chrome.storage into runtime checks. */
export async function hydrateRemoteBlocklist() {
  try {
    const data = await chrome.storage.local.get(STORAGE_BLOCKLIST_KEY);
    const blocklist = data[STORAGE_BLOCKLIST_KEY];
    applyRemoteHosts(blocklist?.hosts);
  } catch (err) {
    console.warn('[PasteCraft] hydrateRemoteBlocklist failed:', err?.message || err);
  }
}

/** Subscribe to background sync updates (content script + service worker). */
export function subscribeRemoteBlocklistChanges(onUpdated) {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_BLOCKLIST_KEY]) return;
    hydrateRemoteBlocklist()
      .then(() => {
        if (typeof onUpdated === 'function') onUpdated();
      })
      .catch(() => {});
  });
}

export function isSiteAllowed(rawUrl = typeof location !== 'undefined' ? location.href : '') {
  return coreIsSiteAllowed(rawUrl);
}

export function isUrlSafeToOpen(rawUrl) {
  const result = coreIsUrlSafeToOpen(rawUrl);
  return {
    allowed: result.allowed,
    reason: result.reason || '',
    host: result.host || result.domain || '',
    code: result.code,
    domain: result.domain || result.host || '',
  };
}
