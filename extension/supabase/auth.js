/** Vertical slice: auth.js */
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
        emailRedirectTo: chrome.runtime.getURL('popup.html')
      }
    });

    if (error) throw error;

    // Create user subscription record (default free tier)
    if (data.user) {
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
        emailRedirectTo: chrome.runtime.getURL('popup.html')
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

    const callbackUrl = 'https://pastecraft.com/reset-password';

    const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl
    });

    if (error) throw error;

    console.log('✅ Password reset email sent');
    console.log('💡 User will receive email with link to:', callbackUrl);
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
  // Best-effort: clear extension-side caches/ids without deleting user data.
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
        return { id: userId, email: payload?.email ? String(payload.email) : '' };
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
 * Create user subscription record
 */
async createUserSubscription(userId, email, tier = 'free') {
  if (!this.client) return false;

  try {
    const { error } = await this.client
      .from('user_subscriptions')
      .insert([{
        user_id: userId,
        email: email,
        subscription_tier: tier,
        subscription_status: 'active'
      }]);

    if (error) throw error;

    console.log('✅ User subscription created');
    return true;
  } catch (error) {
    console.error('❌ Failed to create subscription:', error);
    return false;
  }
},

/**
 * Get user subscription info
 */
async getUserSubscription(userId) {
  if (!this.client) return null;

  try {
    // Guardrail: Supabase auth session can hang (same issue as getCurrentUser).
    // Race the query against a timeout, then fall back to direct REST call.
    const queryPromise = this.client
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    const timeoutMs = 3000;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('getUserSubscription timeout') }), timeoutMs)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      // On timeout, try direct REST fallback bypassing stuck auth client
      if (error.message === 'getUserSubscription timeout') {
        return await this._getUserSubscriptionDirect(userId);
      }
      throw error;
    }

    // Best-effort cache write (avoids slow/failing future fetches)
    this.setCachedSubscription(userId, data);

    return data;
  } catch (error) {
    console.error('❌ Failed to get subscription:', error);
    return null;
  }
},

/**
 * Direct REST fallback for getUserSubscription when Supabase auth client is stuck.
 * Bypasses the Supabase JS client entirely, using the stored access token from chrome.storage.
 */
async _getUserSubscriptionDirect(userId) {
  try {
    const accessToken = await this.getStoredAccessToken();
    const headers = {
      'apikey': PASTECRAFT_CONFIG.supabase.anonKey,
      'Authorization': `Bearer ${accessToken || PASTECRAFT_CONFIG.supabase.anonKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.pgrst.object+json'
    };
    const url = `${PASTECRAFT_CONFIG.supabase.url}/rest/v1/user_subscriptions?user_id=eq.${userId}&select=*`;
    const res = await fetch(url, { headers });

    if (!res.ok) return null;
    const data = await res.json();
    if (data) this.setCachedSubscription(userId, data);
    return data;
  } catch (error) {
    console.error('❌ Direct subscription fetch failed:', error);
    return null;
  }
},

/**
 * Check if user has premium access
 */
async isPremiumUser(userId) {
  const effectiveAccess = await this.getEffectiveAccessState(userId);
  if (effectiveAccess && typeof effectiveAccess.is_premium === 'boolean') {
    return !!effectiveAccess.is_premium;
  }

  // Fast path: cached subscription (avoid blocking UI on slow network)
  const cached = await this.getCachedSubscription(userId);
  if (cached) {
    const cachedExpiresAtMs = cached?.ai_access_expires_at ? Date.parse(cached.ai_access_expires_at) : NaN;
    const cachedIsPaidPremium = !!(cached &&
      (cached.subscription_tier === 'premium' || cached.subscription_tier === 'admin') &&
      cached.subscription_status === 'active'
    );
    const cachedHasCouponAiAccess = !!(cached && (
      cached.has_unlimited_ai === true ||
      (Number.isFinite(cachedExpiresAtMs) && cachedExpiresAtMs > Date.now())
    ));
    const cachedIsPremium = cachedIsPaidPremium || cachedHasCouponAiAccess;
    if (cachedIsPremium) {
      return true;
    }
  }

  const subscription = await this.getUserSubscription(userId);
  const isPaidPremium = !!(subscription &&
    (subscription.subscription_tier === 'premium' || subscription.subscription_tier === 'admin') &&
    subscription.subscription_status === 'active'
  );

  // Coupon-based AI access (DEV4EVER / months_free) should also grant premium AI gating access.
  const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
  const hasCouponAiAccess = !!(subscription && (
    subscription.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  ));

  const isPremium = isPaidPremium || hasCouponAiAccess;
  return isPremium;
},

/**
 * Check if user has cloud sync access (basic or premium tier)
 * FREE tier = local storage only, no cloud sync
 * BASIC/PREMIUM tiers = cloud sync allowed
 */
async hasCloudSyncAccess(userId) {
  const effectiveAccess = await this.getEffectiveAccessState(userId);
  if (effectiveAccess && typeof effectiveAccess.has_cloud_sync === 'boolean') {
    return !!effectiveAccess.has_cloud_sync;
  }

  const subscription = await this.getUserSubscription(userId);
  if (!subscription) {
    return false; // No subscription = free tier = no cloud sync
  }
  
  const tier = subscription.subscription_tier?.toLowerCase();
  const status = subscription.subscription_status?.toLowerCase();
  const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
  const hasCouponCloudAccess = !!(
    subscription.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  );
  
  // Allow cloud sync for basic and premium tiers (active status)
  // Also allow past_due (grace period) for better UX
  const allowedTiers = ['basic', 'premium', 'admin'];
  const allowedStatuses = ['active', 'past_due'];
  const hasPaidTierAccess = allowedTiers.includes(tier) && allowedStatuses.includes(status);
  const hasAccess = hasPaidTierAccess || hasCouponCloudAccess;
  return hasAccess;
},

async getEffectiveAccessState(userId) {
  if (!userId || !this.client) return null;
  try {
    const { data, error } = await this.client.rpc('get_effective_access_state', {
      p_user_id: userId,
    });
    if (error) {
      console.warn('get_effective_access_state:', error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row && typeof row === 'object' ? row : null;
  } catch (err) {
    console.warn('get_effective_access_state failed:', err?.message || err);
    return null;
  }
},

/**
 * Check cloud sync access and show upgrade prompt if not allowed
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if user has cloud sync access
 */
async checkCloudSyncAccess(userId) {
  const hasAccess = await this.hasCloudSyncAccess(userId);
  
  if (!hasAccess) {
    alert('Cloud sync requires a Basic or Enhanced subscription.\n\nOpen PasteCraft from your browser toolbar and click "Upgrade Subscription" to subscribe.');
    return false;
  }
  
  return true;
},

/**
 * Check premium access and redirect to upgrade page if not premium
 * @param {string} userId - User ID to check
 * @param {string} featureName - Feature being accessed (breakdown, summary, image, avatar, cartoon, name)
 * @returns {boolean} - True if user has premium access, false if redirected
 */
async checkPremiumAccess(userId, featureName = 'feature') {
  const isPremium = await this.isPremiumUser(userId);
  
  if (!isPremium) {
    alert(`This feature requires a Premium subscription.\n\nOpen PasteCraft from your browser toolbar and click "Upgrade Subscription" to unlock ${featureName}.`);
    return false;
  }
  
  return true;
},

/**
 * Admin sign in (checks for admin tier)
 */
async signInAsAdmin(email, password) {
  const result = await this.signInWithEmail(email, password);
  
  if (result.success) {
    const subscription = await this.getUserSubscription(result.user.id);
    
    if (subscription && subscription.subscription_tier === 'admin') {
      return { success: true, user: result.user, isAdmin: true };
    } else {
      await this.signOut();
      return { success: false, error: 'Unauthorized: Admin access required' };
    }
  }
  
  return result;
}

// =====================================================
};
