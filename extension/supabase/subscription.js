/** Vertical slice: subscription.js */
export const subscriptionMixin = {
// SUBSCRIPTION CACHE (helps avoid slow/failing fetches)
// =====================================================

async getCachedSubscription(userId) {
  try {
    if (!userId) return null;
    const res = await chrome.storage.local.get([this._subscriptionCacheKey]);
    const payload = res?.[this._subscriptionCacheKey] || null;
    if (!payload || payload.userId !== userId) return null;
    const cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : 0;
    const subscription = payload.subscription || null;
    // Cache TTL: 6 hours (enough to survive transient network issues)
    if (!cachedAt || (Date.now() - cachedAt) > (6 * 60 * 60 * 1000)) return null;
    return subscription;
  } catch (_) {
    return null;
  }
},

async setCachedSubscription(userId, subscription) {
  try {
    if (!userId || !subscription) return;
    await chrome.storage.local.set({
      [this._subscriptionCacheKey]: {
        userId,
        subscription,
        cachedAt: Date.now()
      }
    });
  } catch (_) {
    // ignore
  }
},

async init() {
  try {
    if (typeof PASTECRAFT_CONFIG === 'undefined') {
      console.error('❌ Config not loaded. Make sure config.js is included before supabase-client.js');
      return;
    }
    
    // Check for placeholder API keys
    if (PASTECRAFT_CONFIG.supabase.anonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
      console.warn('⚠️ Supabase key not configured - using placeholder');
      this.initialized = true; // Still mark as initialized for OpenAI-only features
      return;
    }
    
    // Check if Supabase is loaded from CDN
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.warn('⚠️ Supabase library not loaded from CDN - Supabase features disabled, but OpenAI features will work');
      this.initialized = true; // Still mark as initialized for OpenAI-only features
      return;
    }
    
    // Initialize Supabase client
    this.client = supabase.createClient(
      PASTECRAFT_CONFIG.supabase.url,
      PASTECRAFT_CONFIG.supabase.anonKey
    );
    
    this.initialized = true;
    console.log('✅ Supabase client initialized');

    // Persist auth session into chrome.storage so content-script can use it for
    // authenticated Edge Function calls (e.g., premium AI tips in-page).
    this.setupAuthSessionBridge();
    
    // Setup realtime subscriptions after initialization
    await this.setupRealtimeSubscriptions();
    
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    this.initialized = true; // Still allow OpenAI features to work
  }
}

// =====================================================
};
