// PasteCraft Proxy Handler
// Handles fetch proxying for content scripts (CORS bypass)

const ALLOWED_EDGE_FUNCTIONS = /^https:\/\/.+\.supabase\.co\/functions\/v1\/(ai-hint|ai-trends)(\b|\/|$)/i;
const SUPABASE_URL_PATTERN = /^https:\/\/.+\.supabase\.co$/i;

/**
 * Proxy fetch to Edge Function
 * Used by content scripts that can't make direct CORS requests
 * @param {Object} message
 * @returns {Promise<Object>}
 */
export async function handleFetchEdgeFunction(message) {
  try {
    const url = String(message.url || '');
    const method = String(message.method || 'POST').toUpperCase();
    const accessToken = String(message.accessToken || '');
    const body = message.body ?? null;

    // Allowlist check
    if (!url || !ALLOWED_EDGE_FUNCTIONS.test(url)) {
      return { success: false, status: 400, error: 'Blocked URL' };
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const status = resp.status;
    const ok = resp.ok;
    const data = await resp.json().catch(() => ({}));

    return { success: true, ok, status, data };
  } catch (error) {
    return { success: false, status: 0, error: error?.message || String(error) };
  }
}

/**
 * Refresh Supabase auth token
 * Used by content scripts to refresh expired tokens
 * @param {Object} message
 * @returns {Promise<Object>}
 */
export async function handleRefreshToken(message) {
  try {
    const supabaseUrl = String(message.supabaseUrl || '');
    const anonKey = String(message.anonKey || '');
    const refreshToken = String(message.refreshToken || '');

    if (!supabaseUrl || !anonKey || !refreshToken) {
      return { success: false, status: 400, error: 'Missing token params' };
    }

    if (!SUPABASE_URL_PATTERN.test(supabaseUrl)) {
      return { success: false, status: 400, error: 'Invalid supabaseUrl' };
    }

    const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    const status = resp.status;
    const ok = resp.ok;
    const data = await resp.json().catch(() => ({}));

    return { success: true, ok, status, data };
  } catch (error) {
    return { success: false, status: 0, error: error?.message || String(error) };
  }
}
