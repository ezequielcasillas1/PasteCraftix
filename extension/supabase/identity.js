/** Vertical slice: identity.js */
export const identityMixin = {
// REAL-TIME DATA SYNC METHODS
// =====================================================

/**
 * Get Chrome user ID for syncing
 */
async getChromeUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chromeUserId'], (result) => {
      if (result.chromeUserId) {
        resolve(result.chromeUserId);
      } else {
        // Generate new user ID
        const newUserId = `chrome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        chrome.storage.local.set({ chromeUserId: newUserId }, () => {
          resolve(newUserId);
        });
      }
    });
  });
},

/**
 * Get a stable user id for cloud sync.
 * - Prefer a stored cross-device id in chrome.storage.sync (if browser sync is enabled)
 * - Otherwise fall back to existing chrome.storage.local chromeUserId (legacy behavior)
 * - If neither exists: generate a new id (if authed, derive from auth UUID; else random chrome_*)
 *
 * This preserves legacy cloud data (keyed by chromeUserId) while allowing new devices
 * to recover the same id via chrome.storage.sync once at least one device writes it.
 */
async hasActiveAuthSession() {
  if (!this.client) return false;
  try {
    const { data: { session } } = await this.client.auth.getSession();
    return !!(session?.access_token && session?.user?.id);
  } catch (_) {
    return false;
  }
},

async getSyncUserId() {
  // If authenticated, always use auth user UUID as the stable cross-device sync key.
  // If this device has legacy data keyed by chromeUserId, we can migrate it to auth id here.
  let authUserId = null;
  if (this.client) {
    try {
      let { data: { session } } = await this.client.auth.getSession();
      if (!session?.access_token && typeof this.hydrateClientSessionFromBridge === 'function') {
        await this.hydrateClientSessionFromBridge();
        ({ data: { session } } = await this.client.auth.getSession());
      }
      authUserId = session?.user?.id || null;
    } catch (_) {}
  }

  if (authUserId) {
    // If the user previously synced using a different (legacy) id on this same device,
    // migrate its remote data to the auth id once.
    let localChromeUserId = null;
    try {
      const localResult = await new Promise((resolve) => chrome.storage.local.get(['chromeUserId'], resolve));
      localChromeUserId = localResult?.chromeUserId || null;
    } catch (_) {}

    // Persist the stable id for other devices (browser sync)
    try { await new Promise((resolve) => chrome.storage.sync.set({ accountUserId: authUserId }, resolve)); } catch (_) {}
    try { await new Promise((resolve) => chrome.storage.local.set({ chromeUserId: authUserId }, resolve)); } catch (_) {}

    // Migrate legacy remote clips if we have a different legacy id available
    if (localChromeUserId && localChromeUserId !== authUserId) {
      try {
        const legacyRemote = await this.syncClipsFromSupabase(localChromeUserId);
        if (legacyRemote && legacyRemote.length > 0) {
          await this.syncClipsToSupabaseForUser(legacyRemote, authUserId);
        }
      } catch (_) {
        // Best-effort migration only
      }
    }

    await this.ensureUserProfileRow(authUserId);
    return authUserId;
  }

  // Not authenticated: fall back to stored ids for local/legacy keys only.
  // Never upsert user_profiles without a JWT — RLS rejects it (42501 / 401).
  let syncStoredId = null;
  try {
    const syncResult = await new Promise((resolve) => chrome.storage.sync.get(['accountUserId'], resolve));
    syncStoredId = syncResult?.accountUserId || null;
  } catch (_) {}

  if (syncStoredId) {
    return syncStoredId;
  }

  return this.getChromeUserId();
},

async ensureUserProfileRow(userId) {
  if (!this.client) return;
  if (this._profileRowEnsured && this._profileRowEnsuredUserId === userId) {
    return;
  }
  try {
    await this.setUserContext(userId);
    let { data: { session } } = await this.client.auth.getSession();
    if (!session?.access_token && typeof this.hydrateClientSessionFromBridge === 'function') {
      await this.hydrateClientSessionFromBridge();
      ({ data: { session } } = await this.client.auth.getSession());
    }
    // Never upsert without a JWT — RLS rejects anonymous user_profiles writes.
    if (!session?.access_token) return;
    const { error } = await this.client
      .from('user_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) throw error;
    this._profileRowEnsured = true;
    this._profileRowEnsuredUserId = userId;
  } catch (_) {
    // Don't block sync if profile row can't be ensured
  }
},

/**
 * Set RLS context for user
 */
async setUserContext(userId) {
  if (!this.client) return;
  if (!userId) return;
},

/**
 * Fetch the set of entity ids that are already tombstoned (soft-deleted) on Supabase
 * for the current user. Used to prevent stale devices from resurrecting
 * deleted rows via an UP-sync that would otherwise set deleted_at back to null.
 *
 * @param {string} tableName    - e.g. 'categories', 'clips', 'archived_clips', 'notes'
 * @param {string} idColumn     - the per-row id column, e.g. 'category_id', 'clip_id', 'note_id'
 * @returns {Promise<Set<string>>} stringified ids that are soft-deleted on the server
 */
async _fetchTombstonedIds(tableName, idColumn) {
  const empty = new Set();
  if (!this.client) return empty;
  try {
    const userId = await this.getSyncUserId();
    if (!userId) return empty;
    const { data, error } = await this.client
      .from(tableName)
      .select(idColumn + ',deleted_at')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);
    if (error) throw error;
    const set = new Set();
    (Array.isArray(data) ? data : []).forEach((row) => {
      const id = row && row[idColumn] != null ? String(row[idColumn]) : '';
      if (id) set.add(id);
    });
    return set;
  } catch (err) {
    console.warn(`⚠️ Failed to fetch tombstoned ids from ${tableName}:`, err?.message || err);
    // On failure, return an empty set. We'd rather allow the upsert than block sync entirely.
    return empty;
  }
},

/**
 * Persist discovered remote tombstones into the local pc_deleted_<entity> list
 * so subsequent full syncs + loadData on this device prune them.
 * Non-fatal on error.
 */
async _mergeTombstonesIntoLocal(storageKey, tombstonedIds) {
  try {
    if (!storageKey || !(tombstonedIds instanceof Set) || tombstonedIds.size === 0) return;
    const current = await new Promise((resolve) => {
      chrome.storage.local.get([storageKey], (res) => resolve(res || {}));
    });
    const existing = Array.isArray(current[storageKey]) ? current[storageKey] : [];
    const byId = new Map();
    existing.forEach((item) => {
      const id = item && item.id != null ? String(item.id) : '';
      if (id) byId.set(id, item);
    });
    const nowMs = Date.now();
    let added = 0;
    tombstonedIds.forEach((id) => {
      if (!byId.has(id)) {
        byId.set(id, { id, deletedAt: nowMs, updatedAt: nowMs });
        added++;
      }
    });
    if (added > 0) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ [storageKey]: Array.from(byId.values()) }, resolve);
      });
    }
  } catch (_) {
    // Non-fatal.
  }
}

// =====================================================
};
