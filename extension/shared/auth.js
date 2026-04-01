// PasteCraft Auth Helpers
// Session management and auth utilities

import { STORAGE_KEYS } from './constants.js';
import { getSupabase, getSession, getUserId, getAccessToken } from './api.js';
import { getStorageItems, setStorageItems, removeStorageItems } from './storage-adapter.js';

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const userId = await getUserId();
  return userId !== null;
}

/**
 * Get user profile from session
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile() {
  const { session } = await getSession();
  if (!session?.user) return null;
  
  return {
    id: session.user.id,
    email: session.user.email,
    emailConfirmed: session.user.email_confirmed_at != null,
    createdAt: session.user.created_at,
    lastSignInAt: session.user.last_sign_in_at,
    userMetadata: session.user.user_metadata || {}
  };
}

/**
 * Sign in with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: Object|null, session: Object|null, error: Error|null }>}
 */
export async function signInWithPassword(email, password) {
  const client = getSupabase();
  if (!client) {
    return { user: null, session: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { 
      user: data?.user || null, 
      session: data?.session || null, 
      error 
    };
  } catch (err) {
    return { user: null, session: null, error: err };
  }
}

/**
 * Sign up with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: Object|null, session: Object|null, error: Error|null }>}
 */
export async function signUp(email, password) {
  const client = getSupabase();
  if (!client) {
    return { user: null, session: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.signUp({ email, password });
    return { 
      user: data?.user || null, 
      session: data?.session || null, 
      error 
    };
  } catch (err) {
    return { user: null, session: null, error: err };
  }
}

/**
 * Sign out current user
 * @returns {Promise<{ error: Error|null }>}
 */
export async function signOut() {
  const client = getSupabase();
  if (!client) {
    return { error: new Error('Supabase not available') };
  }
  
  try {
    // Clear local caches
    await removeStorageItems([
      STORAGE_KEYS.SESSION,
      STORAGE_KEYS.SUBSCRIPTION_CACHE
    ]);
    
    const { error } = await client.auth.signOut();
    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Request password reset email
 * @param {string} email
 * @returns {Promise<{ error: Error|null }>}
 */
export async function resetPassword(email) {
  const client = getSupabase();
  if (!client) {
    return { error: new Error('Supabase not available') };
  }
  
  try {
    const { error } = await client.auth.resetPasswordForEmail(email);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Update user password
 * @param {string} newPassword
 * @returns {Promise<{ user: Object|null, error: Error|null }>}
 */
export async function updatePassword(newPassword) {
  const client = getSupabase();
  if (!client) {
    return { user: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    return { user: data?.user || null, error };
  } catch (err) {
    return { user: null, error: err };
  }
}

/**
 * Listen for auth state changes
 * @param {Function} callback - (event, session) => void
 * @returns {Function} Cleanup function
 */
export function onAuthStateChange(callback) {
  const client = getSupabase();
  if (!client) {
    return () => {};
  }
  
  const { data: { subscription } } = client.auth.onAuthStateChange(callback);
  return () => subscription?.unsubscribe?.();
}

/**
 * Refresh session token
 * @returns {Promise<{ session: Object|null, error: Error|null }>}
 */
export async function refreshSession() {
  const client = getSupabase();
  if (!client) {
    return { session: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.refreshSession();
    return { session: data?.session || null, error };
  } catch (err) {
    return { session: null, error: err };
  }
}

/**
 * Set session from tokens (used for auth callbacks)
 * @param {string} accessToken
 * @param {string} refreshToken
 * @returns {Promise<{ session: Object|null, error: Error|null }>}
 */
export async function setSession(accessToken, refreshToken) {
  const client = getSupabase();
  if (!client) {
    return { session: null, error: new Error('Supabase not available') };
  }
  
  try {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    return { session: data?.session || null, error };
  } catch (err) {
    return { session: null, error: err };
  }
}

/**
 * Check if current user is in freemium/local mode
 * @returns {Promise<boolean>}
 */
export async function isFreemiumMode() {
  try {
    const result = await getStorageItems([STORAGE_KEYS.FREEMIUM_GUEST]);
    return result[STORAGE_KEYS.FREEMIUM_GUEST] === true;
  } catch (_) {
    return false;
  }
}

/**
 * Set freemium mode
 * @param {boolean} enabled
 */
export async function setFreemiumMode(enabled) {
  try {
    if (enabled) {
      await setStorageItems({ [STORAGE_KEYS.FREEMIUM_GUEST]: true });
    } else {
      await removeStorageItems([STORAGE_KEYS.FREEMIUM_GUEST]);
    }
  } catch (err) {
    console.error('[Auth] setFreemiumMode error:', err);
  }
}

// Re-export for convenience
export { getUserId, getAccessToken, getSession };
