/**
 * @forward-slice Strategy — decide workspace clear/bind without chrome I/O.
 */
import { WORKSPACE_OWNERSHIP_ACTIONS } from './workspace.constants.js';

function asId(value) {
  return value ? String(value) : null;
}

function decision(action, reason) {
  return { action, reason };
}

function isLegacySameOwner(stamp, sessionUserId, legacyAccountUserId) {
  return !stamp && !!legacyAccountUserId && legacyAccountUserId === sessionUserId;
}

/**
 * @param {{ stamp?: string|null, sessionUserId?: string|null, legacyAccountUserId?: string|null }} input
 * @returns {{ action: string, reason: string }}
 */
export function resolveOwnershipDecision(input = {}) {
  const stamp = asId(input.stamp);
  const sessionUserId = asId(input.sessionUserId);
  const legacyAccountUserId = asId(input.legacyAccountUserId);

  if (!sessionUserId) {
    return decision(WORKSPACE_OWNERSHIP_ACTIONS.NONE, 'no-session');
  }
  if (stamp === sessionUserId) {
    return decision(WORKSPACE_OWNERSHIP_ACTIONS.OK, 'owner-match');
  }
  if (isLegacySameOwner(stamp, sessionUserId, legacyAccountUserId)) {
    return decision(WORKSPACE_OWNERSHIP_ACTIONS.BIND_ONLY, 'legacy-account-match');
  }
  if (stamp) {
    return decision(WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_AND_BIND, 'owner-mismatch');
  }
  // Missing stamp (guest leftovers / unknown) → hard isolate, no auto-import.
  return decision(WORKSPACE_OWNERSHIP_ACTIONS.CLEAR_AND_BIND, 'stamp-missing');
}

/**
 * Pure gate for sync/upload: local owner must equal session user.
 * @param {string|null|undefined} stamp
 * @param {string|null|undefined} sessionUserId
 */
export function canMergeOrUploadForOwner(stamp, sessionUserId) {
  if (!sessionUserId || !stamp) return false;
  return String(stamp) === String(sessionUserId);
}
