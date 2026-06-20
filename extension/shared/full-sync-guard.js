/** Guards full-sync merge writes against stale local snapshots and in-flight edits. */

export function readStorageKeys(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => {
      resolve(items || {});
    });
  });
}

/**
 * Re-read local storage and merge with remote immediately before writing.
 * Skips when local edits landed after the full-sync snapshot timestamp.
 */
export async function mergeFreshLocalForFullSync({
  storageKey,
  fallbackLocal,
  remoteData,
  mergeFn,
  hasNewerLocalWrites,
}) {
  if (remoteData == null) {
    return { skipped: true, reason: 'no-remote' };
  }

  if (await hasNewerLocalWrites()) {
    return { skipped: true, reason: 'newer-local-before-merge' };
  }

  let freshLocal = fallbackLocal;
  try {
    const latest = await readStorageKeys([storageKey]);
    if (latest[storageKey] !== undefined) {
      freshLocal = latest[storageKey];
    }
  } catch (_) {}

  const merged = await mergeFn(freshLocal, remoteData);

  if (await hasNewerLocalWrites()) {
    return { skipped: true, reason: 'newer-local-after-merge', merged };
  }

  return {
    skipped: false,
    payload: { [storageKey]: merged },
    merged,
  };
}
