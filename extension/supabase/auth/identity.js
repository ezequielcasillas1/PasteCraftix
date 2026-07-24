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
    // Fast path: bridge/hydrate already populated sync cache.
    if (this._currentSession?.access_token && this._currentSession?.user?.id) {
      return true;
    }
    // Match getSyncUserId: restore JWT from chrome.storage before declaring logged-out.
    if (typeof this.hydrateClientSessionFromBridge === 'function') {
      await this.hydrateClientSessionFromBridge();
    }
    if (this._currentSession?.access_token && this._currentSession?.user?.id) {
      return true;
    }
    const { data: { session } } = await this.client.auth.getSession();
    if (session?.access_token) {
      if (typeof this._applyCurrentSession === 'function') this._applyCurrentSession(session);
      else this._currentSession = session;
    }
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
      // Soft-hydrate keeps JWT in _currentSession when setSession/getUser is offline.
      authUserId = session?.user?.id || this._currentSession?.user?.id || null;
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
 * Set RLS context for user.
 * Intentionally a no-op: do NOT call set_config / custom RLS plumbing.
 * Auth uses JWT (auth.uid()); queries filter by user_id only.
 */
async setUserContext(userId) {
  if (!this.client) return;
  if (!userId) return;
}

// =====================================================
};
