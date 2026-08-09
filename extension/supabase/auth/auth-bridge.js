/** Vertical slice: auth-bridge.js */
export const authBridgeMixin = {
// AUTH SESSION BRIDGE (extension page -> content script)
// =====================================================

_applyCurrentSession(session) {
  this._currentSession = session?.access_token ? session : null;
},

async _readBridgeSessionTokens() {
  const bridgeKey = this._sessionBridgeKey || 'pc_supabase_session_v1';
  const res = await chrome.storage.local.get([bridgeKey]);
  const bridge = res?.[bridgeKey] || null;
  const access_token = bridge?.access_token ? String(bridge.access_token) : '';
  const refresh_token = bridge?.refresh_token ? String(bridge.refresh_token) : '';
  if (!access_token || !refresh_token) return null;
  return {
    access_token,
    refresh_token,
    expires_at: bridge?.expires_at || null,
    user_id: bridge?.user_id || null,
    email: bridge?.email || null,
  };
},

_sessionFromBridgeTokens(tokens) {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    user: tokens.user_id ? { id: tokens.user_id, email: tokens.email || null } : null,
  };
},

_isTransientAuthNetworkError(err) {
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError') return true;
  const msg = String(err.message || err || '');
  return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network error');
},

_softApplyBridgeSession(tokens) {
  if (!tokens?.access_token) return false;
  this._applyCurrentSession(this._sessionFromBridgeTokens(tokens));
  return true;
},

/**
 * Short Auth API probe before setSession (which always network-calls _getUser).
 * Public url/anonKey only — never logs tokens.
 */
async _isAuthApiReachable(timeoutMs = 1500) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const cfg = (typeof PASTECRAFT_CONFIG !== 'undefined' && PASTECRAFT_CONFIG?.supabase) || null;
    const baseUrl = cfg?.url ? String(cfg.url).replace(/\/$/, '') : '';
    const anonKey = cfg?.anonKey ? String(cfg.anonKey) : '';
    if (!baseUrl || !anonKey) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/auth/v1/health`, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: controller.signal,
      });
      return !!(res && res.ok);
    } finally {
      clearTimeout(timer);
    }
  } catch (_) {
    return false;
  }
},

async _setSessionFromBridgeTokens(tokens) {
  try {
    return await this.client.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  } catch (err) {
    return { data: { session: null, user: null }, error: err };
  }
},

setupAuthSessionBridge() {
  if (!this.client || !this.client.auth) return;
  if (this._authBridgeSetup) return;
  this._authBridgeSetup = true;

  const writeSession = async (session, options = {}) => {
    // Keep sync isAuthenticated() cache in lockstep with live auth events.
    if (session?.access_token) {
      this._applyCurrentSession(session);
    } else if (options.clearMissing === true) {
      this._applyCurrentSession(null);
    }

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
    .then(({ data }) => {
      const session = data?.session || null;
      if (session?.access_token) this._applyCurrentSession(session);
      return writeSession(session, { clearMissing: false });
    })
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
    let tokens = null;
    try {
      const { data: { session } } = await this.client.auth.getSession();
      if (session?.access_token) {
        this._applyCurrentSession(session);
        return true;
      }

      tokens = await this._readBridgeSessionTokens();
      if (!tokens) return false;

      // setSession always network-calls getUser; skip when offline or Auth
      // preflight fails so supabase-js does not console.error(TypeError Failed to fetch).
      if (!(await this._isAuthApiReachable())) {
        return this._softApplyBridgeSession(tokens);
      }

      let { data, error } = await this._setSessionFromBridgeTokens(tokens);
      // Transient network blips → one retry, then soft-keep bridge tokens.
      if (error && this._isTransientAuthNetworkError(error)) {
        ({ data, error } = await this._setSessionFromBridgeTokens(tokens));
      }

      if (error) {
        if (this._isTransientAuthNetworkError(error)) {
          return this._softApplyBridgeSession(tokens);
        }
        console.warn('[hydrateClientSessionFromBridge]', error.message || error);
        return false;
      }

      this._applyCurrentSession(data?.session || this._sessionFromBridgeTokens(tokens));
      return true;
    } catch (err) {
      if (tokens && this._isTransientAuthNetworkError(err)) {
        return this._softApplyBridgeSession(tokens);
      }
      return false;
    }
  })().finally(() => {
    this._hydrateBridgePromise = null;
  });

  return this._hydrateBridgePromise;
}

// =====================================================
};
