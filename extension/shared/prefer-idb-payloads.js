/**
 * Decide whether IndexedDB payloads should override chrome.storage.local arrays.
 * chrome.storage is updated by content scripts and the service worker; IDB is
 * only mirrored while the popup is open. Prefer IDB only when it is strictly
 * newer than pc_local_updatedAt or chrome.storage is empty (IDB recovery).
 */
export function shouldPreferIndexedDbOverChromeStorage(chromeLocalUpdatedAt, chromePayloads, idbPayloads) {
  const idb = Array.isArray(idbPayloads) ? idbPayloads : [];
  if (idb.length === 0) return false;

  const chrome = Array.isArray(chromePayloads) ? chromePayloads : [];
  if (chrome.length === 0) return true;

  const chromeTs = Number.isFinite(chromeLocalUpdatedAt) ? chromeLocalUpdatedAt : 0;
  if (!chromeTs) return false;

  let idbMax = 0;
  for (const item of idb) {
    const t = Number(item?.updatedAt ?? item?.timestamp ?? 0);
    if (Number.isFinite(t) && t > idbMax) idbMax = t;
  }

  return idbMax > chromeTs;
}
