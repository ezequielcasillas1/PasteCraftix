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

async function _hasExistingSession() {
  try {
    const existing = await _withTimeout(pasteCraftSupabase.client.auth.getSession(), AUTH_TIMEOUT_MS);
    const sess = (existing && existing.data && existing.data.session) || null;
    return !!(sess && sess.user && sess.user.id);
  } catch (_) {
    return false;
  }
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

function _pairTokens(accessToken, refreshToken) {
  return {
    access_token: String(accessToken || ''),
    refresh_token: String(refreshToken || ''),
  };
}

function _hasTokenPair(tokens) {
  return !!(tokens && tokens.access_token && tokens.refresh_token);
}

async function _readBridgeTokenPair(app, excludeRefresh = '') {
  const latest = await _getSessionBridgePayload(app);
  const pair = _pairTokens(latest.access_token, latest.refresh_token);
  if (!_hasTokenPair(pair)) return null;
  if (excludeRefresh && pair.refresh_token === String(excludeRefresh || '')) return null;
  return pair;
}

async function _resolveSessionTokens(app, bridge, refreshToken) {
  const initial = _pairTokens(bridge.access_token, refreshToken);
  if (!_accessTokenNeedsRefresh(initial.access_token, bridge.expires_at)) {
    return initial;
  }

  const refreshed = await _refreshSupabaseTokenViaBackground(app, initial.refresh_token);
  if (refreshed && refreshed.access_token) {
    await _persistRefreshedBridge(refreshed, initial.refresh_token, bridge);
    return _pairTokens(refreshed.access_token, refreshed.refresh_token || initial.refresh_token);
  }

  // Another context may have already rotated the refresh token.
  const rotated = await _readBridgeTokenPair(app, initial.refresh_token);
  return rotated || initial;
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

function _isAlreadyUsedRefreshError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('already used') || msg.includes('invalid refresh token');
}

function _isTransientAuthNetworkError(error) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  const msg = String(error.message || error || '');
  return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network error');
}

/** Short Auth API probe before setSession (avoids supabase.js Failed to fetch noise). */
async function _isAuthApiReachable(timeoutMs = 1500) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const { supabaseUrl, anonKey } = _readSupabaseConfig();
    const baseUrl = supabaseUrl ? String(supabaseUrl).replace(/\/$/, '') : '';
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
}

async function _softApplyBridgeTokens(app, tokens) {
  const apply = pasteCraftSupabase?._applyCurrentSession;
  if (typeof apply !== 'function' || !tokens?.access_token) return false;
  let userId = tokens.user_id || '';
  if (!userId && app) {
    try {
      const bridge = await _getSessionBridgePayload(app);
      userId = bridge.user_id || '';
    } catch (_) {}
  }
  apply.call(pasteCraftSupabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user: userId ? { id: userId } : null,
  });
  return true;
}

async function _setSessionOrRecoverRotatedBridge(app, tokens) {
  // CRITICAL: always pass the *current* refresh_token (post-rotation).
  // Using the pre-refresh RT after background rotation causes
  // "Invalid Refresh Token: Already Used" on the next auto-refresh.
  let result;
  try {
    result = await _setSession(tokens.access_token, tokens.refresh_token);
  } catch (err) {
    if (_isTransientAuthNetworkError(err)) {
      return _softApplyBridgeTokens(app, tokens);
    }
    return false;
  }
  if (!(result && result.error)) return true;
  if (_isTransientAuthNetworkError(result.error)) {
    return _softApplyBridgeTokens(app, tokens);
  }
  if (!_isAlreadyUsedRefreshError(result.error)) return false;

  const rotated = await _readBridgeTokenPair(app, tokens.refresh_token);
  if (!rotated) return false;
  try {
    const retry = await _setSession(rotated.access_token, rotated.refresh_token);
    if (!(retry && retry.error)) return true;
    if (_isTransientAuthNetworkError(retry.error)) {
      return _softApplyBridgeTokens(app, rotated);
    }
    return false;
  } catch (err) {
    if (_isTransientAuthNetworkError(err)) {
      return _softApplyBridgeTokens(app, rotated);
    }
    return false;
  }
}

export async function restoreSupabaseSessionFromBridge(app, reason = 'unknown') {
  try {
    if (!_hasAuthClient()) return false;

    const bridge = await _getSessionBridgePayload(app);
    const refreshToken = String(bridge.refresh_token || '');
    if (!refreshToken) return false;

    const needsRefresh = _accessTokenNeedsRefresh(bridge.access_token, bridge.expires_at);
    if (!needsRefresh && (await _hasExistingSession())) return true;

    const tokens = await _resolveSessionTokens(app, bridge, refreshToken);
    if (!_hasTokenPair(tokens)) return false;

    // Skip setSession when Auth is unreachable (navigator offline or health probe fail).
    if (!(await _isAuthApiReachable())) {
      return _softApplyBridgeTokens(app, tokens);
    }

    return _setSessionOrRecoverRotatedBridge(app, tokens);
  } catch (_) {
    return false;
  }
}

export async function clearLegacyAuthPrefs() {
  try {
    await chrome.storage.local.remove([AUTH_STORAGE_KEYS.AUTH_PREFS]);
  } catch (_) {}
}
