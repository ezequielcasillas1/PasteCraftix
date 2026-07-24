/** Vertical slice: core.js — client init + network helpers */

export const coreMixin = {
  async _clearStaleLocalAuthIfBridgePresent() {
    // Prefer chrome.storage bridge over popup localStorage. A stale
    // localStorage refresh_token races _recoverAndRefresh and causes
    // "Invalid Refresh Token: Already Used" (token reuse detection).
    try {
      const bridgeKey = this._sessionBridgeKey || 'pc_supabase_session_v1';
      const res = await chrome.storage.local.get([bridgeKey]);
      const bridge = res?.[bridgeKey] || null;
      if (bridge?.refresh_token && typeof this._clearSupabaseLocalStorage === 'function') {
        this._clearSupabaseLocalStorage();
      }
    } catch (_) {}
  },

  async init() {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined') {
        console.error('❌ Config not loaded. Make sure config.js is included before supabase-client.js');
        return;
      }

      // Check for placeholder API keys (anon only — never ship secret keys)
      if (PASTECRAFT_CONFIG.supabase.anonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
        console.warn('⚠️ Supabase key not configured - using placeholder');
        this.initialized = true;
        return;
      }

      if (typeof supabase === 'undefined' || !supabase.createClient) {
        console.warn('⚠️ Supabase library not loaded from CDN - Supabase features disabled, but OpenAI features will work');
        this.initialized = true;
        return;
      }

      await this._clearStaleLocalAuthIfBridgePresent();

      this.client = supabase.createClient(
        PASTECRAFT_CONFIG.supabase.url,
        PASTECRAFT_CONFIG.supabase.anonKey,
        {
          auth: {
            detectSessionInUrl: false,
            persistSession: true,
            autoRefreshToken: true,
          },
        }
      );

      this.initialized = true;
      console.log('✅ Supabase client initialized');

      // Bridge is durable; localStorage was cleared above. Restore JWT before any
      // sync/profile call so RLS does not see an anonymous upsert.
      if (typeof this.hydrateClientSessionFromBridge === 'function') {
        await this.hydrateClientSessionFromBridge();
      }

      this.setupAuthSessionBridge();
      // Realtime needs a live JWT; skip when hydrate failed (avoids WS close-before-established).
      if (this._currentSession?.access_token || (await this.hasActiveAuthSession?.())) {
        await this.setupRealtimeSubscriptions();
      }
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      this.initialized = true;
    }
  },

  async _fetchWithTimeout(url, options = {}, timeoutMs = 30000, timeoutMessage = 'Request timed out') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error(timeoutMessage);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
