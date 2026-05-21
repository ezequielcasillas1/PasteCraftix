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
}

async getStoredAccessToken() {
  try {
    const res = await chrome.storage.local.get([this._sessionBridgeKey]);
    const payload = res?.[this._sessionBridgeKey] || null;
    const tok = payload?.access_token ? String(payload.access_token) : '';
    return tok || '';
  } catch (_) {
    return '';
  }
}

// =====================================================
};
