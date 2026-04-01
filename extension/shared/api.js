// PasteCraft Supabase API Client
// Single source of truth for Supabase client instance

import { STORAGE_KEYS, SUPABASE_TABLES } from './constants.js';
import { chromeStorageAdapter, getStorageItems, setStorageItems } from './storage-adapter.js';

let supabaseClient = null;
let isInitialized = false;

/**
 * Get Supabase configuration from PASTECRAFT_CONFIG
 * @returns {{ url: string, anonKey: string } | null}
 */
function getConfig() {
  if (typeof PASTECRAFT_CONFIG === 'undefined') {
    console.error('[API] PASTECRAFT_CONFIG not loaded');
    return null;
  }
  
  const url = PASTECRAFT_CONFIG?.supabase?.url;
  const anonKey = PASTECRAFT_CONFIG?.supabase?.anonKey;
  
  if (!url || !anonKey || anonKey.includes('YOUR_SUPABASE')) {
    console.warn('[API] Supabase not configured');
    return null;
  }
  
  return { url, anonKey };
}

/**
 * Initialize Supabase client
 * @returns {Object|null} Supabase client or null if unavailable
 */
export function initSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const config = getConfig();
  if (!config) {
    isInitialized = true;
    return null;
  }
  
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('[API] Supabase library not loaded');
    isInitialized = true;
    return null;
  }
  
  try {
    supabaseClient = supabase.createClient(config.url, config.anonKey, {
      auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
    
    isInitialized = true;
    console.log('[API] Supabase client initialized');
    return supabaseClient;
  } catch (err) {
    console.error('[API] Failed to initialize Supabase:', err);
    isInitialized = true;
    return null;
  }
}

/**
 * Get the Supabase client (initializes if needed)
 * @returns {Object|null}
 */
export function getSupabase() {
  if (!isInitialized) {
    return initSupabase();
  }
  return supabaseClient;
}

/**
 * Check if Supabase is available
 * @returns {boolean}
 */
export function isSupabaseAvailable() {
  return supabaseClient !== null;
}

/**
 * Get current auth session
 * @returns {Promise<{ session: Object|null, error: Error|null }>}
 */
export async function getSession() {
  const client = getSupabase();
  if (!client) {
    return { session: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.getSession();
    return { session: data?.session || null, error };
  } catch (err) {
    return { session: null, error: err };
  }
}

/**
 * Get current user ID from session
 * @returns {Promise<string|null>}
 */
export async function getUserId() {
  const { session } = await getSession();
  return session?.user?.id || null;
}

/**
 * Get access token for API calls
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const { session } = await getSession();
  return session?.access_token || '';
}

/**
 * Get Supabase URL for edge function calls
 * @returns {string}
 */
export function getSupabaseUrl() {
  const config = getConfig();
  return config?.url || '';
}

/**
 * Call a Supabase Edge Function
 * @param {string} functionName - Edge function name
 * @param {Object} body - Request body
 * @param {Object} options - Additional options
 * @returns {Promise<{ data: any, error: Error|null }>}
 */
export async function callEdgeFunction(functionName, body = {}, options = {}) {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.functions.invoke(functionName, {
      body,
      ...options
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Fetch with timeout helper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Subscription cache helpers
 */
export const subscriptionCache = {
  async get(userId) {
    if (!userId) return null;
    try {
      const result = await getStorageItems([STORAGE_KEYS.SUBSCRIPTION_CACHE]);
      const payload = result[STORAGE_KEYS.SUBSCRIPTION_CACHE];
      if (!payload || payload.userId !== userId) return null;
      
      const cachedAt = payload.cachedAt || 0;
      const TTL = 6 * 60 * 60 * 1000; // 6 hours
      if (Date.now() - cachedAt > TTL) return null;
      
      return payload.subscription || null;
    } catch (_) {
      return null;
    }
  },
  
  async set(userId, subscription) {
    if (!userId || !subscription) return;
    try {
      await setStorageItems({
        [STORAGE_KEYS.SUBSCRIPTION_CACHE]: {
          userId,
          subscription,
          cachedAt: Date.now()
        }
      });
    } catch (_) {}
  }
};

// Re-export table names for convenience
export { SUPABASE_TABLES };
