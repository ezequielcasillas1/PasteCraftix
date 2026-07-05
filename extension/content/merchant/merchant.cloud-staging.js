import { MERCHANT_SUPABASE_STAGING_SHAPE } from './merchant.constants.js';
import { toSupabaseStagingRow } from './merchant.dock-storage.js';

const SESSION_BRIDGE_KEY = 'pc_supabase_session_v1';

async function readSessionUserId() {
  try {
    const stored = await chrome.storage.local.get([SESSION_BRIDGE_KEY]);
    return stored?.[SESSION_BRIDGE_KEY]?.user_id || null;
  } catch (_) {
    return null;
  }
}

/** Build Supabase row shape from dock payload (local prep — no network write). */
export async function buildCloudStagingPayload(dockPayload) {
  const userId = await readSessionUserId();
  return toSupabaseStagingRow(dockPayload, userId);
}

/**
 * Phase 6 cloud staging hook — deferred until Merchant billing + syncQueue wiring.
 * @returns {Promise<{ ok: boolean, deferred?: boolean, table?: string }>}
 */
export async function queueCloudStagingSync(dockPayload) {
  if (!dockPayload) return { ok: false, deferred: true };
  await buildCloudStagingPayload(dockPayload);
  return {
    ok: false,
    deferred: true,
    table: MERCHANT_SUPABASE_STAGING_SHAPE.table,
  };
}
