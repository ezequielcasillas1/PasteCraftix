/** Vertical slice: auth.js — sign-in/out + session only (access gates → subscription.js) */

/** Website-owned auth redirects (must be allowlisted in Supabase Auth → URL Configuration). */
const AUTH_WEBSITE_REDIRECTS = Object.freeze({
  EMAIL_CONFIRM: 'https://pastecraft.com/account',
  PASSWORD_RESET: 'https://pastecraft.com/reset-password',
});

export const authMixin = {
// AUTHENTICATION METHODS
// =====================================================

/**
 * Sign up with email and password
 */
async signUpWithEmail(email, password) {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('📝 Signing up user:', email);

    const { data, error } = await this.client.auth.signUp({
      email: email,
      password: password,
      options: {
        // Website URL — chrome-extension:// redirects break confirm-email delivery/allowlist
        emailRedirectTo: AUTH_WEBSITE_REDIRECTS.EMAIL_CONFIRM
      }
    });

    if (error) throw error;

    const identitiesCount = Array.isArray(data?.user?.identities) ? data.user.identities.length : -1;
    const hasSession = !!data?.session;

    // Supabase anti-enumeration: existing users return 200 with empty identities and no confirm email.
    if (data.user && identitiesCount === 0) {
      return {
        success: false,
        code: 'already_registered',
        error: 'This email is already registered. Sign in, or use Google if you created the account that way. No new confirmation email is sent for existing accounts.',
      };
    }

    // Subscription insert needs an authenticated session (RLS). Skip until email is confirmed.
    if (data.user && hasSession) {
      await this.createUserSubscription(data.user.id, email, 'free');
    }

    console.log('✅ User signed up successfully');
    return { success: true, user: data.user };
  } catch (error) {
    console.error('❌ Sign up failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Resend verification email
 */
async resendVerificationEmail(email) {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('📧 Resending verification email to:', email);

    const { data, error } = await this.client.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: AUTH_WEBSITE_REDIRECTS.EMAIL_CONFIRM
      }
    });

    if (error) throw error;

    console.log('✅ Verification email resent');
    return { success: true };
  } catch (error) {
    console.error('❌ Resend failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Request password reset email
 */
async resetPassword(email) {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('🔑 Requesting password reset for:', email);

    const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_WEBSITE_REDIRECTS.PASSWORD_RESET
    });

    if (error) throw error;

    console.log('✅ Password reset email sent');
    console.log('💡 User will receive email with link to:', AUTH_WEBSITE_REDIRECTS.PASSWORD_RESET);
    return { success: true };
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Update user password (after reset)
 */
async updatePassword(newPassword) {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('🔑 Updating user password...');
    
    const { data, error } = await this.client.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    console.log('✅ Password updated successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Password update failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Sign in with email and password
 */
async signInWithEmail(email, password) {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('🔐 Signing in user:', email);
    
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    if (data.user) {
      const existing = await this.getUserSubscription(data.user.id);
      if (!existing) {
        await this.createUserSubscription(data.user.id, data.user.email || email, 'free');
      }
    }

    console.log('✅ User signed in successfully');
    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('❌ Sign in failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Sign in with Google OAuth
 */
async signInWithGoogle() {
  if (!this.client) {
    return { success: false, error: 'Supabase not initialized' };
  }

  try {
    console.log('🔐 Initiating Google sign in...');
    
    // Use extension-owned identity callback to avoid website-to-extension relay failures.
    const callbackUrl = chrome.identity.getRedirectURL();
    console.log('🔗 Callback URL:', callbackUrl);
    
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      console.error('❌ Google OAuth error:', error);
      return { success: false, error: error.message };
    }

    if (data?.url) {
      console.log('✅ Opening Google OAuth...');
      try {
        const responseUrl = await new Promise((resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            { url: data.url, interactive: true },
            (finalUrl) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(finalUrl);
              }
            }
          );
        });

        const hashPart = String(responseUrl || '').split('#')[1] || '';
        const params = new URLSearchParams(hashPart);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (!access_token) {
          return { success: false, error: 'No tokens in OAuth response' };
        }

        let userId = null;
        let email = '';
        let expiresAt = null;
        try {
          const payload = JSON.parse(atob(access_token.split('.')[1]));
          userId = payload.sub || null;
          email = payload.email || '';
          expiresAt = payload.exp || null;
        } catch (_) {}

        await chrome.storage.local.set({
          oauth_callback: { access_token, refresh_token: refresh_token || '', timestamp: Date.now() },
          [this._sessionBridgeKey]: {
            access_token,
            refresh_token: refresh_token || '',
            expires_at: expiresAt,
            user_id: userId,
            email: email,
            updated_at: Date.now()
          }
        });
        return { success: true, message: 'Signed in with Google!' };
      } catch (launchError) {
        return { success: false, error: launchError.message };
      }
    }

    return { success: false, error: 'No OAuth URL generated' };
  } catch (error) {
    console.error('❌ Google sign in failed:', error);
    return { success: false, error: error.message };
  }
},

/**
 * Sign out current user
 */
async signOut() {
  if (!this.client) {
    throw new Error('Supabase not initialized');
  }

  try {
    console.log('👋 Signing out user...');
    
    this._profileRowEnsured = false;
    this._profileRowEnsuredUserId = null;
    
    const { error } = await this.client.auth.signOut();

    if (error) throw error;

    console.log('✅ User signed out successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    return { success: false, error: error.message };
  }
},

// =====================================================
// FAST SIGN-OUT (local-first, non-blocking global revoke)
// =====================================================

_getSupabaseAuthStorageKey() {
  try {
    const url = (typeof PASTECRAFT_CONFIG !== 'undefined' && PASTECRAFT_CONFIG?.supabase?.url)
      ? String(PASTECRAFT_CONFIG.supabase.url)
      : '';
    const host = url ? (new URL(url)).hostname : '';
    const projectRef = host ? host.split('.')[0] : '';
    return projectRef ? `sb-${projectRef}-auth-token` : '';
  } catch (_) {
    return '';
  }
},

async _clearCachedAuthState() {
  // Auth-only: clears session caches/ids. Library wipe is owned by
  // bridges/workspace (clearWorkspaceForAccountSwitch / ensureWorkspaceOwner).
  // Do not clear clips here — guest startup also calls signOutFast().
  try {
    await new Promise((resolve) => chrome.storage.local.remove([this._subscriptionCacheKey], resolve));
  } catch (_) {}

  // Browser sync user id is only meaningful for signed-in sync; remove on sign-out.
  try {
    await new Promise((resolve) => chrome.storage.sync.remove(['accountUserId'], resolve));
  } catch (_) {}
},

_clearSupabaseLocalStorage() {
  try {
    const key = this._getSupabaseAuthStorageKey();
    if (key && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (_) {}
},

async signOutFast() {
  if (!this.client) {
    return { success: true, localOnly: true };
  }

  // Stop background work immediately.
  this._pauseSync = true;
  this._profileRowEnsured = false;
  this._profileRowEnsuredUserId = null;
  try { this.unsubscribeAll(); } catch (_) {}
  try { this.updateSyncStatus('offline'); } catch (_) {}

  // Clear local caches/ids and local auth token storage (best-effort).
  await this._clearCachedAuthState();
  this._clearSupabaseLocalStorage();
  this._currentSession = null;
  try {
    await chrome.storage.local.remove([this._sessionBridgeKey]);
  } catch (_) {}

  // Local sign-out should not require network and should be fast.
  try {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (e) {
    // Back-compat: older supabase-js may not support scope option.
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    } catch (_) {
      // If this fails, we already cleared local storage; treat as signed-out locally.
    }
  }

  // Best-effort global sign-out in background (do not block UI).
  try {
    const p = this.client.auth.signOut({ scope: 'global' });
    await Promise.race([
      p,
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
  } catch (_) {
    // ignore
  }

  return { success: true };
},

/**
 * Get current user session
 */
async getCurrentUser() {
  if (!this.client) {
    return null;
  }

  try {
    // Fast path: if we have a recent auth bridge session, treat as signed-in
    // even if supabase-js session resolution is slow/hanging.
    try {
      const res = await chrome.storage.local.get([this._sessionBridgeKey]);
      const payload = res?.[this._sessionBridgeKey] || null;
      const userId = payload?.user_id ? String(payload.user_id) : '';
      const expiresAt = typeof payload?.expires_at === 'number' ? payload.expires_at : null; // seconds since epoch
      const nowSec = Math.floor(Date.now() / 1000);
      const notExpired = !expiresAt || expiresAt > (nowSec + 30);
      if (userId && notExpired) {
        let email = payload?.email ? String(payload.email) : '';
        if (!email && payload?.access_token) {
          try {
            const jwtPart = String(payload.access_token).split('.')[1];
            if (jwtPart) {
              const jwtPayload = JSON.parse(atob(jwtPart));
              email = String(jwtPayload?.email || '').trim().toLowerCase();
            }
          } catch (_) {}
        }
        return { id: userId, email };
      }
    } catch (_) {}

    // Guardrail: auth session resolution can hang (offline / browser issues). Never block popup indefinitely.
    const timeoutMs = 500;
    const sessionPromise = this.client.auth.getSession();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: { session: null }, error: new Error('getSession timeout') }), timeoutMs));
    const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

    if (error) throw error;
    return session?.user || null;
  } catch (error) {
    console.error('❌ Get current user failed:', error);
    return null;
  }
},

/**
 * Check if user is authenticated (has valid session).
 * Uses sync cache set by auth-bridge / hydrate — never assigned before Phase 5
 * regression meant this always returned false for signed-in users.
 * @returns {boolean}
 */
isAuthenticated() {
  return !!(this.client && this._currentSession?.access_token);
}

// =====================================================
};
