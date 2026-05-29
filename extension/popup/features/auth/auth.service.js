import {
  AUTH_STORAGE_KEYS,
  AUTH_TIMEOUT_MS,
  AUTH_TOKEN_REFRESH_BUFFER_MS,
} from './auth.constants.js';

function _emptyBridge() {
  return { access_token: '', refresh_token: '', expires_at: null, user_id: '' };
}

function _normalizeBridgePayload(p) {
  if (!p) return _emptyBridge();
  return {
    access_token: String(p.access_token || ''),
    refresh_token: String(p.refresh_token || ''),
    expires_at: p.expires_at ?? null,
    user_id: String(p.user_id || ''),
  };
}

export async function _getSessionBridgePayload(app) {
  try {
    const res = await chrome.storage.local.get([AUTH_STORAGE_KEYS.SUPABASE_SESSION]);
    return _normalizeBridgePayload(res ? res[AUTH_STORAGE_KEYS.SUPABASE_SESSION] : null);
  } catch (_) {
    return _emptyBridge();
  }
}

function _readSupabaseConfig() {
  const cfg = PASTECRAFT_CONFIG?.supabase || {};
  return {
    supabaseUrl: String(cfg.url || ''),
    anonKey: String(cfg.anonKey || ''),
  };
}

function _sendRefreshRequest(supabaseUrl, anonKey, refreshToken) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'pcRefreshSupabaseToken',
      supabaseUrl,
      anonKey,
      refreshToken,
    }, (resp) => {
      const lastErr = chrome.runtime.lastError;
      const errMsg = lastErr ? String(lastErr.message || '') : '';
      if (errMsg) return resolve({ success: false, ok: false, status: 0, error: errMsg });
      resolve(resp || null);
    });
  });
}

function _computeExpiresAt(expiresInRaw) {
  const n = Number(expiresInRaw || 0);
  return n ? Math.floor(Date.now() / 1000) + n : null;
}

function _isSuccessfulRefresh(result) {
  return !!(result && result.success === true && result.ok);
}

function _readRefreshedUserId(data) {
  const user = data.user || {};
  return String(user.id || '');
}

function _parseRefreshedTokens(result, refreshToken) {
  if (!_isSuccessfulRefresh(result)) return null;
  const data = result.data || {};
  const nextAccess = String(data.access_token || '');
  if (!nextAccess) return null;

  return {
    access_token: nextAccess,
    refresh_token: String(data.refresh_token || refreshToken),
    expires_at: _computeExpiresAt(data.expires_in),
    user_id: _readRefreshedUserId(data),
  };
}

function _isRefreshRequestReady(supabaseUrl, anonKey, refreshToken) {
  return !!(supabaseUrl && anonKey && refreshToken);
}

export async function _refreshSupabaseTokenViaBackground(app, refreshToken) {
  try {
    const { supabaseUrl, anonKey } = _readSupabaseConfig();
    const rt = String(refreshToken || '');
    if (!_isRefreshRequestReady(supabaseUrl, anonKey, rt)) return null;

    const result = await _sendRefreshRequest(supabaseUrl, anonKey, rt);
    return _parseRefreshedTokens(result, rt);
  } catch (_) {
    return null;
  }
}

function _hasAuthClient() {
  const auth = pasteCraftSupabase && pasteCraftSupabase.client && pasteCraftSupabase.client.auth;
  if (!auth) return false;
  return typeof auth.getSession === 'function' && typeof auth.setSession === 'function';
}

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

async function _readClientSession() {
  try {
    const existing = await _withTimeout(pasteCraftSupabase.client.auth.getSession(), AUTH_TIMEOUT_MS);
    return (existing && existing.data && existing.data.session) || null;
  } catch (_) {
    return null;
  }
}

function _sessionIsUsable(session) {
  if (!session?.access_token || !session?.user?.id) return false;
  const expSec = typeof session.expires_at === 'number' ? session.expires_at : Number(session.expires_at);
  if (!Number.isFinite(expSec)) return false;
  return (expSec * 1000) - Date.now() >= AUTH_TOKEN_REFRESH_BUFFER_MS;
}

function _accessTokenNeedsRefresh(accessToken, expiresAt) {
  if (!accessToken) return true;
  const expSec = (typeof expiresAt === 'number') ? expiresAt : Number(expiresAt);
  if (!Number.isFinite(expSec)) return true;
  return (expSec * 1000) - Date.now() < AUTH_TOKEN_REFRESH_BUFFER_MS;
}

async function _persistRefreshedBridge(refreshed, refreshToken, bridge) {
  try {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEYS.SUPABASE_SESSION]: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || refreshToken,
        expires_at: refreshed.expires_at ?? null,
        user_id: refreshed.user_id || bridge.user_id || null,
        updated_at: Date.now(),
      },
    });
  } catch (_) {}
}

async function _resolveAccessToken(app, bridge, refreshToken) {
  const initialAccess = String(bridge.access_token || '');
  if (!_accessTokenNeedsRefresh(initialAccess, bridge.expires_at)) {
    return initialAccess;
  }
  const refreshed = await _refreshSupabaseTokenViaBackground(app, refreshToken);
  if (!refreshed || !refreshed.access_token) return initialAccess;
  await _persistRefreshedBridge(refreshed, refreshToken, bridge);
  return refreshed.access_token;
}

function _setSession(accessToken, refreshToken) {
  return _withTimeout(
    pasteCraftSupabase.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }),
    AUTH_TIMEOUT_MS,
  );
}

export async function restoreSupabaseSessionFromBridge(app, reason = 'unknown') {
  try {
    if (!_hasAuthClient()) return false;

    const bridge = await _getSessionBridgePayload(app);
    const refreshToken = String(bridge.refresh_token || '');
    if (!refreshToken) return false;

    const currentSession = await _readClientSession();
    const accessToken = await _resolveAccessToken(app, bridge, refreshToken);
    if (!accessToken) return false;

    const sessionUsable = _sessionIsUsable(currentSession);
    const sameAccessToken = sessionUsable
      && String(currentSession.access_token) === String(accessToken);

    if (sameAccessToken) return true;

    const result = await _setSession(accessToken, refreshToken);
    return !(result && result.error);
  } catch (_) {
    return false;
  }
}

export async function clearLegacyAuthPrefs(app) {
  try {
    await chrome.storage.local.remove([app._authPrefsKey]);
  } catch (_) {}
}
