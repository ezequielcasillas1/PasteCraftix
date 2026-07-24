/** Vertical slice: subscription.js — cache + access gates (query by user_id / RPC). */
import { isOfflineSupabaseError } from './offline-error.js';

export const subscriptionMixin = {
  async getCachedSubscription(userId) {
    try {
      if (!userId) return null;
      const res = await chrome.storage.local.get([this._subscriptionCacheKey]);
      const payload = res?.[this._subscriptionCacheKey] || null;
      if (!payload || payload.userId !== userId) return null;
      const cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : 0;
      const subscription = payload.subscription || null;
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

  async getUserSubscription(userId) {
    if (!this.client) return null;

    try {
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
        if (error.message === 'getUserSubscription timeout') {
          return await this._getUserSubscriptionDirect(userId);
        }
        throw error;
      }

      this.setCachedSubscription(userId, data);
      return data;
    } catch (error) {
      if (isOfflineSupabaseError(error)) {
        console.warn('⚠️ Subscription cloud fetch unavailable; using cached access if available.');
      } else {
        console.error('❌ Failed to get subscription:', error);
      }
      return null;
    }
  },

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
      if (isOfflineSupabaseError(error)) {
        console.warn('⚠️ Direct subscription fetch unavailable (offline or blocked).');
      } else {
        console.error('❌ Direct subscription fetch failed:', error);
      }
      return null;
    }
  },

  async isPremiumUser(userId) {
    const effectiveAccess = await this.getEffectiveAccessState(userId);
    if (effectiveAccess && typeof effectiveAccess.is_premium === 'boolean') {
      return !!effectiveAccess.is_premium;
    }

    const cached = await this.getCachedSubscription(userId);
    if (cached) {
      const cachedExpiresAtMs = cached?.ai_access_expires_at ? Date.parse(cached.ai_access_expires_at) : NaN;
      const cachedIsPaidPremium = !!(cached &&
        (cached.subscription_tier === 'premium') &&
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
      (subscription.subscription_tier === 'premium') &&
      subscription.subscription_status === 'active'
    );

    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponAiAccess = !!(subscription && (
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ));

    return isPaidPremium || hasCouponAiAccess;
  },

  async hasCloudSyncAccess(userId) {
    const effectiveAccess = await this.getEffectiveAccessState(userId);
    if (effectiveAccess && typeof effectiveAccess.has_cloud_sync === 'boolean') {
      return !!effectiveAccess.has_cloud_sync;
    }

    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      return false;
    }

    const tier = subscription.subscription_tier?.toLowerCase();
    const status = subscription.subscription_status?.toLowerCase();
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponCloudAccess = !!(
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    );

    const allowedTiers = ['basic', 'premium'];
    const allowedStatuses = ['active', 'past_due'];
    const hasPaidTierAccess = allowedTiers.includes(tier) && allowedStatuses.includes(status);
    return hasPaidTierAccess || hasCouponCloudAccess;
  },

  async getEffectiveAccessState(userId) {
    if (!userId || !this.client) return null;
    try {
      const { data, error } = await this.client.rpc('get_effective_access_state', {
        p_user_id: userId,
      });
      if (error) {
        const msg = String(error.message || error);
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          console.warn('get_effective_access_state: offline — using cached subscription fallback');
        } else {
          console.warn('get_effective_access_state:', msg);
        }
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return row && typeof row === 'object' ? row : null;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        console.warn('get_effective_access_state: offline — using cached subscription fallback');
      } else {
        console.warn('get_effective_access_state failed:', msg);
      }
      return null;
    }
  },

  async checkCloudSyncAccess(userId) {
    const hasAccess = await this.hasCloudSyncAccess(userId);

    if (!hasAccess) {
      alert('Cloud sync requires a Basic or Enhanced subscription.\n\nOpen PasteCraft from your browser toolbar and click "Upgrade Subscription" to subscribe.');
      return false;
    }

    return true;
  },

  async checkPremiumAccess(userId, featureName = 'feature') {
    const isPremium = await this.isPremiumUser(userId);

    if (!isPremium) {
      alert(`This feature requires a Premium subscription.\n\nOpen PasteCraft from your browser toolbar and click "Upgrade Subscription" to unlock ${featureName}.`);
      return false;
    }

    return true;
  },
};
