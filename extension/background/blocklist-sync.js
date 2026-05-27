/**
 * Background sync for public phishing blocklists (GitHub feeds + pastecraft.com curated JSON).
 * No API keys — free reputation sources only.
 */

import { BLOCKED_HOSTS, SAFE_ALLOWLIST_HOSTS } from '../shared/url-safety.js';
import { hydrateRemoteBlocklist } from '../content/safety/site-guard.js';

/**
 * Reject obviously broken or dangerous-to-block entries from public feeds:
 * - too short (< 4 chars) — likely junk
 * - no dot — bare TLDs or single labels would block everything beneath
 * - in the safety allowlist — never block major sites even if a feed lists them
 * - has no public suffix structure (a.b minimum)
 */
function isSafeRemoteHost(host) {
  if (!host || typeof host !== 'string') return false;
  if (host.length < 4) return false;
  if (!host.includes('.')) return false;
  if (SAFE_ALLOWLIST_HOSTS.has(host)) return false;
  for (const safe of SAFE_ALLOWLIST_HOSTS) {
    if (host === safe || host.endsWith('.' + safe)) return false;
  }
  return true;
}

export const STORAGE_BLOCKLIST_KEY = 'siteGuardRemoteBlocklist';
export const STORAGE_FETCHED_AT_KEY = 'siteGuardRemoteFetchedAt';

const ALARM_NAME = 'siteGuardBlocklistSync';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HOSTS = 50000;

const TEXT_FEEDS = [
  {
    id: 'phishing-database',
    url: 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt',
  },
  {
    id: 'urlhaus-hostfile',
    url: 'https://urlhaus.abuse.ch/downloads/hostfile/',
    format: 'urlhaus',
  },
];

const CURATED_URL = 'https://pastecraft.com/safety/blocklist.json';

function normalizeHostname(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value.includes(' ') || value.includes('/')) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }
  return value.replace(/^\.+/, '').replace(/\.+$/, '');
}

function parseTextFeed(body, { format } = {}) {
  const hosts = new Set();
  const lines = String(body || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (format === 'urlhaus') {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2 && parts[0] === '0.0.0.0') {
        const host = normalizeHostname(parts[1]);
        if (host && host !== '0.0.0.0' && host !== 'localhost' && isSafeRemoteHost(host)) {
          hosts.add(host);
        }
      }
      continue;
    }

    const host = normalizeHostname(trimmed);
    if (host && isSafeRemoteHost(host)) hosts.add(host);
  }
  return hosts;
}

function parseCuratedJson(json) {
  const hosts = new Set();
  const list = json?.hosts || json?.blockedHosts || [];
  if (!Array.isArray(list)) return hosts;
  for (const item of list) {
    const host = normalizeHostname(item);
    if (host && isSafeRemoteHost(host)) hosts.add(host);
  }
  return hosts;
}

function capHostSet(hostSet) {
  if (hostSet.size <= MAX_HOSTS) return hostSet;
  const capped = new Set();
  let count = 0;
  for (const host of hostSet) {
    capped.add(host);
    count += 1;
    if (count >= MAX_HOSTS) break;
  }
  return capped;
}

async function fetchFeedText(feed) {
  const res = await fetch(feed.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${feed.id} HTTP ${res.status}`);
  return res.text();
}

async function fetchCuratedBlocklist() {
  const res = await fetch(CURATED_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`curated HTTP ${res.status}`);
  return res.json();
}

async function readStoredBlocklist() {
  try {
    const data = await chrome.storage.local.get([STORAGE_BLOCKLIST_KEY, STORAGE_FETCHED_AT_KEY]);
    return {
      blocklist: data[STORAGE_BLOCKLIST_KEY] || null,
      fetchedAt: typeof data[STORAGE_FETCHED_AT_KEY] === 'number' ? data[STORAGE_FETCHED_AT_KEY] : 0,
    };
  } catch (_) {
    return { blocklist: null, fetchedAt: 0 };
  }
}

export async function syncRemoteBlocklist({ force = false } = {}) {
  const now = Date.now();
  const stored = await readStoredBlocklist();

  if (!force && stored.fetchedAt && now - stored.fetchedAt < TTL_MS && stored.blocklist?.hosts?.length) {
    await hydrateRemoteBlocklist();
    return { source: 'cache', hostCount: stored.blocklist.hosts.length };
  }

  const merged = new Set();
  for (const h of BLOCKED_HOSTS) merged.add(h);

  const sources = [];
  const failures = [];

  await Promise.all(
    TEXT_FEEDS.map(async (feed) => {
      try {
        const body = await fetchFeedText(feed);
        const hosts = parseTextFeed(body, feed);
        for (const h of hosts) merged.add(h);
        sources.push({ id: feed.id, count: hosts.size });
      } catch (err) {
        failures.push(feed.id);
        console.warn('[PasteCraft] Blocklist feed failed:', feed.id, err?.message || err);
      }
    }),
  );

  try {
    const curated = await fetchCuratedBlocklist();
    const curatedHosts = parseCuratedJson(curated);
    for (const h of curatedHosts) merged.add(h);
    sources.push({ id: 'pastecraft-curated', count: curatedHosts.size, version: curated?.version });
  } catch (err) {
    failures.push('pastecraft-curated');
    console.warn('[PasteCraft] Curated blocklist fetch failed:', err?.message || err);
  }

  if (merged.size <= BLOCKED_HOSTS.size && stored.blocklist?.hosts?.length) {
    await hydrateRemoteBlocklist();
    return { source: 'stale-cache', hostCount: stored.blocklist.hosts.length, failures };
  }

  const capped = capHostSet(merged);
  const payload = {
    hosts: Array.from(capped),
    version: stored.blocklist?.version ? stored.blocklist.version + 1 : 1,
    updated_at: new Date(now).toISOString(),
    sources,
  };

  try {
    await chrome.storage.local.set({
      [STORAGE_BLOCKLIST_KEY]: payload,
      [STORAGE_FETCHED_AT_KEY]: now,
    });
    await hydrateRemoteBlocklist();
  } catch (err) {
    console.warn('[PasteCraft] Blocklist storage write failed:', err?.message || err);
    if (stored.blocklist?.hosts?.length) {
      await hydrateRemoteBlocklist();
      return { source: 'stale-cache', hostCount: stored.blocklist.hosts.length, failures };
    }
  }

  return { source: 'remote', hostCount: payload.hosts.length, failures };
}

export function initBlocklistSync() {
  syncRemoteBlocklist().catch((err) => {
    console.warn('[PasteCraft] Initial blocklist sync failed:', err?.message || err);
  });

  try {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 });
  } catch (err) {
    console.warn('[PasteCraft] Blocklist alarm setup failed:', err?.message || err);
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== ALARM_NAME) return;
    syncRemoteBlocklist().catch(() => {});
  });

  chrome.runtime.onInstalled.addListener(() => {
    syncRemoteBlocklist({ force: true }).catch(() => {});
  });

  chrome.runtime.onStartup.addListener(() => {
    syncRemoteBlocklist().catch(() => {});
  });
}
