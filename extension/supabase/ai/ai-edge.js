/** Shared Edge Function invoke helpers for AI slices (anon/url only — no secret keys). */

export const aiEdgeMixin = {
  async _getAiAccessToken() {
    try {
      const s = await this.client?.auth?.getSession?.();
      return s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
    } catch (_) {
      return '';
    }
  },

  _aiEdgeAuthHeader(accessToken, { allowAnon = true } = {}) {
    if (accessToken) return `Bearer ${accessToken}`;
    if (allowAnon) return `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`;
    return '';
  },

  /**
   * POST to a Supabase Edge Function. Tries candidate paths until a non-404 (or last).
   * @returns {Promise<Response>}
   */
  async _invokeAiEdge(candidates, body, {
    timeoutMs = 30000,
    timeoutMessage = 'AI request timed out',
    allowAnon = true,
    requireAuth = false,
    tryNextStatuses = null,
  } = {}) {
    const paths = Array.isArray(candidates) ? candidates : [candidates];
    const accessToken = await this._getAiAccessToken();
    if (requireAuth && !accessToken) {
      throw new Error('Please sign in to use this AI feature.');
    }
    const authHeader = this._aiEdgeAuthHeader(accessToken, { allowAnon: allowAnon && !requireAuth });
    const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
    const urls = paths.map((p) => (String(p).startsWith('http') ? p : `${baseUrl}/${String(p).replace(/^\//, '')}`));
    const retryStatuses = tryNextStatuses || new Set([404]);

    let response = null;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (typeof this._fetchWithTimeout === 'function') {
        response = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify(body),
        }, timeoutMs, timeoutMessage);
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify(body),
        });
      }
      const isLast = i === urls.length - 1;
      if (!isLast && retryStatuses.has(response.status)) continue;
      break;
    }
    return response;
  },
};
