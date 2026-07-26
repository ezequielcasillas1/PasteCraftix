/**
 * @forward-slice ACL Facade — hard account isolation for local workspace.
 * Public API: clearWorkspaceForAccountSwitch / ensureWorkspaceOwner / bindWorkspaceToUser.
 */
import {
  WORKSPACE_IDB_STORES,
  WORKSPACE_LIBRARY_KEYS,
  WORKSPACE_OWNER_KEY,
  WORKSPACE_OWNERSHIP_ACTIONS,
} from './workspace.constants.js';
import {
  canMergeOrUploadForOwner,
  resolveOwnershipDecision,
} from './workspace-ownership.strategy.js';
import {
  clearOneIdbStore,
  localGet,
  localRemove,
  localSet,
  resolveIndexedDb,
  syncGet,
} from './workspace.storage.js';

async function clearIndexedDbLibrary() {
  const idb = resolveIndexedDb();
  if (!idb) return;
  for (const storeName of WORKSPACE_IDB_STORES) {
    try {
      await clearOneIdbStore(idb, storeName);
    } catch (error) {
      console.warn('[workspace] IDB clear failed:', storeName, error?.message || error);
    }
  }
}

async function clearInMemorySyncQueue() {
  try {
    const sb = globalThis.pasteCraftSupabase;
    if (sb && Array.isArray(sb.syncQueue)) sb.syncQueue = [];
  } catch (_) {}
}

/**
 * Read durable workspace owner stamp from chrome.storage.local.
 * @returns {Promise<string|null>}
 */
export async function getWorkspaceOwnerUserId() {
  try {
    const res = await localGet([WORKSPACE_OWNER_KEY]);
    const value = res?.[WORKSPACE_OWNER_KEY];
    return value ? String(value) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Stamp local workspace as owned by session user (accountability).
 * @param {string} userId
 */
export async function bindWorkspaceToUser(userId) {
  if (!userId) return { ok: false, reason: 'no-user' };
  await localSet({ [WORKSPACE_OWNER_KEY]: String(userId) });
  return { ok: true, owner: String(userId) };
}

/**
 * Clear user library keys + IDB mirrors. Does not remove global prefs (theme, etc.).
 * Removes the owner stamp unless `keepStamp` is set.
 */
export async function clearWorkspaceLibrary({ keepStamp = false } = {}) {
  const keys = keepStamp
    ? [...WORKSPACE_LIBRARY_KEYS]
    : [...WORKSPACE_LIBRARY_KEYS, WORKSPACE_OWNER_KEY];
  await localRemove(keys);
  await clearIndexedDbLibrary();
  await clearInMemorySyncQueue();
  return { ok: true, clearedKeys: keys.length };
}

/**
 * Explicit sign-out: wipe library so the next account/guest cannot inherit it.
 */
export async function clearWorkspaceForAccountSwitch() {
  await clearWorkspaceLibrary({ keepStamp: false });
  console.info('[workspace] Cleared local library for account switch');
  return { ok: true, action: WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_UNBIND };
}

async function readLegacyAccountUserId() {
  try {
    const syncRes = await syncGet(['accountUserId']);
    return syncRes?.accountUserId || null;
  } catch (_) {
    return null;
  }
}

/**
 * Before load/sync: bind workspace to session user; clear on mismatch / unknown stamp.
 * @param {string} sessionUserId
 */
export async function ensureWorkspaceOwner(sessionUserId) {
  if (!sessionUserId) {
    return { ok: false, action: WORKSPACE_OWNERSHIP_ACTIONS.NONE, reason: 'no-session' };
  }

  const decision = resolveOwnershipDecision({
    stamp: await getWorkspaceOwnerUserId(),
    sessionUserId,
    legacyAccountUserId: await readLegacyAccountUserId(),
  });

  if (decision.action === WORKSPACE_OWNERSHIP_ACTIONS.OK) {
    return {
      ok: true,
      action: decision.action,
      reason: decision.reason,
      owner: String(sessionUserId),
    };
  }

  if (decision.action === WORKSPACE_OWNERSHIP_ACTIONS.BIND_ONLY) {
    await bindWorkspaceToUser(sessionUserId);
    console.info('[workspace] Bound existing library to user (legacy stamp migrate)');
    return {
      ok: true,
      action: decision.action,
      reason: decision.reason,
      owner: String(sessionUserId),
    };
  }

  if (decision.action === WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_AND_BIND) {
    await clearWorkspaceLibrary({ keepStamp: false });
    await bindWorkspaceToUser(sessionUserId);
    console.info('[workspace] Cleared foreign/guest library and bound to session user', {
      reason: decision.reason,
    });
    return {
      ok: true,
      action: decision.action,
      reason: decision.reason,
      owner: String(sessionUserId),
      cleared: true,
    };
  }

  return { ok: false, action: decision.action, reason: decision.reason };
}

/**
 * Gate merge/upload paths — refuse when local owner ≠ session user.
 * When refused due to mismatch, clears and rebinds (safe empty hydrate).
 * @param {string} sessionUserId
 */
export async function assertWorkspaceOwnerForSync(sessionUserId) {
  if (!sessionUserId) {
    return { ok: false, reason: 'no-session' };
  }

  const stamp = await getWorkspaceOwnerUserId();
  if (canMergeOrUploadForOwner(stamp, sessionUserId)) {
    return { ok: true, owner: String(sessionUserId) };
  }

  const ensured = await ensureWorkspaceOwner(sessionUserId);
  if (!ensured.ok) {
    return { ok: false, reason: ensured.reason || 'owner-gate-failed' };
  }

  return {
    ok: true,
    owner: String(sessionUserId),
    cleared: !!ensured.cleared,
    reason: ensured.reason,
  };
}

export {
  WORKSPACE_OWNER_KEY,
  WORKSPACE_LIBRARY_KEYS,
  WORKSPACE_OWNERSHIP_ACTIONS,
  canMergeOrUploadForOwner,
  resolveOwnershipDecision,
};
