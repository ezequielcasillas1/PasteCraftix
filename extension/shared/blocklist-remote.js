/**
 * Popup/extension-page hydration for remote blocklist stored by background sync.
 */

import { hydrateRemoteBlocklist } from '../content/safety/site-guard.js';
import {
  STORAGE_BLOCKLIST_KEY,
  STORAGE_FETCHED_AT_KEY,
  syncRemoteBlocklist,
} from '../background/blocklist-sync.js';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function primeBlocklistFromCache() {
  await hydrateRemoteBlocklist();
}

export async function refreshRemoteBlocklist({ force = false } = {}) {
  await hydrateRemoteBlocklist();

  try {
    const data = await chrome.storage.local.get([STORAGE_FETCHED_AT_KEY, STORAGE_BLOCKLIST_KEY]);
    const fetchedAt = typeof data[STORAGE_FETCHED_AT_KEY] === 'number' ? data[STORAGE_FETCHED_AT_KEY] : 0;
    const stale = !fetchedAt || Date.now() - fetchedAt >= TTL_MS;

    if (force || stale) {
      try {
        await chrome.runtime.sendMessage({ action: 'syncSiteGuardBlocklist', force: !!force });
      } catch (_) {
        await syncRemoteBlocklist({ force: !!force });
      }
    }
  } catch (_) {
    // Non-fatal — bundled list still applies
  }

  await hydrateRemoteBlocklist();

  try {
    const data = await chrome.storage.local.get(STORAGE_BLOCKLIST_KEY);
    const hosts = data[STORAGE_BLOCKLIST_KEY]?.hosts;
    return { source: 'storage', hosts: Array.isArray(hosts) ? hosts : [] };
  } catch (_) {
    return { source: 'bundled', hosts: [] };
  }
}
