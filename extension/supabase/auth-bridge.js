/** Vertical slice: auth-bridge.js */
export const authBridgeMixin = {
// AUTH SESSION BRIDGE (extension page -> content script)
// =====================================================
setupAuthSessionBridge() {
  if (!this.client || !this.client.auth) return;
  if (this._authBridgeSetup) return;
  this._authBridgeSetup = true;

  const writeSession = async (session, options = {}) => {
    try {
      // ─── V2 GUARD: never write bridge if local/freemium mode is active ───
      const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
      if (pc_freemium_guest) return; // local mode owns storage; do not touch

      if (!session || !session.access_token) {
        if (options.clearMissing === true) {
          await chrome.storage.local.remove([this._sessionBridgeKey]);
        }
        return;
      }
      await chrome.storage.local.set({
        [this._sessionBridgeKey]: {
          access_token: session.access_token,
          refresh_token: session.refresh_token || null,
          expires_at: session.expires_at || null,
          user_id: session.user?.id || null,
          email: session.user?.email || null,
          updated_at: Date.now()
        }
      });
    } catch (_) {
      // ignore
    }
  };

  // Initial snapshot. Do not clear the durable bridge for a null startup
  // session; OS/browser restarts may need the stored refresh token first.
  this.client.auth.getSession()
    .then(({ data }) => writeSession(data?.session, { clearMissing: false }))
    .catch(() => {});

  // Live updates
  try {
    this.client.auth.onAuthStateChange((event, session) => {
      writeSession(session, { clearMissing: event === 'SIGNED_OUT' });
    });
  } catch (_) {
    // Back-compat: if onAuthStateChange is not available, we still wrote initial snapshot.
  }
},

async getStoredAccessToken() {
  try {
    const res = await chrome.storage.local.get([this._sessionBridgeKey]);
    const payload = res?.[this._sessionBridgeKey] || null;
    const tok = payload?.access_token ? String(payload.access_token) : '';
    return tok || '';
  } catch (_) {
    return '';
  }
},

/**
 * After init clears stale localStorage, supabase-js has no JWT until popup auth
 * restores. Hydrate from chrome.storage bridge so early sync/profile calls
 * are authenticated (avoids RLS 401 on user_profiles).
 */
async hydrateClientSessionFromBridge() {
  if (!this.client?.auth) return false;
  if (this._hydrateBridgePromise) return this._hydrateBridgePromise;

  this._hydrateBridgePromise = (async () => {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      if (session?.access_token) return true;

      const bridgeKey = this._sessionBridgeKey || 'pc_supabase_session_v1';
      const res = await chrome.storage.local.get([bridgeKey]);
      const bridge = res?.[bridgeKey] || null;
      const access_token = bridge?.access_token ? String(bridge.access_token) : '';
      const refresh_token = bridge?.refresh_token ? String(bridge.refresh_token) : '';
      if (!access_token || !refresh_token) return false;

      let { error } = await this.client.auth.setSession({ access_token, refresh_token });
      // Transient network blips show as Failed to fetch; one retry is enough.
      if (error && String(error.message || error).includes('Failed to fetch')) {
        ({ error } = await this.client.auth.setSession({ access_token, refresh_token }));
      }
      if (error) {
        console.warn('[hydrateClientSessionFromBridge]', error.message || error);
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  })().finally(() => {
    this._hydrateBridgePromise = null;
  });

  return this._hydrateBridgePromise;
}

// =====================================================
};
