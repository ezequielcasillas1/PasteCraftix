import { MERCHANT_GATING, MERCHANT_STORAGE_KEYS } from './merchant.constants.js';

const SUBSCRIPTION_CACHE_KEY = 'pc_subscription_cache_v1';
const SESSION_BRIDGE_KEY = 'pc_supabase_session_v1';

export function isMerchantTestLabPage(href = location.href) {
  try {
    const url = new URL(href);
    if (url.pathname.includes('/merchant-test/')) return true;
    if (url.pathname.includes('merchant-test-lab')) return true;
    if (url.hostname === 'localhost' && /\/(etsy|printify|redbubble|teepublic|generic|amazon|ebay|shopify|woocommerce|social-promo)\.html$/i.test(url.pathname)) {
      return true;
    }
    if (url.protocol === 'file:' && /merchant-test-lab/i.test(url.pathname)) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function subscriptionHasMerchant(sub) {
  if (!sub || typeof sub !== 'object') return null;
  if (sub.has_merchant === true) return true;
  if (sub.has_merchant === false) return false;

  const tier = String(sub.merchant_tier || sub.product_line || '').toLowerCase();
  if (tier === 'merchant' || tier === 'bundle') return true;

  const status = String(sub.merchant_subscription_status || '').toLowerCase();
  if (status === 'active' || status === 'past_due') return true;

  return null;
}

async function readGateOverride() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.GATE_OVERRIDE]);
    const value = stored[MERCHANT_STORAGE_KEYS.GATE_OVERRIDE];
    if (value === 'force_on' || value === true) return true;
    if (value === 'force_off' || value === false) return false;
    return null;
  } catch (_) {
    return null;
  }
}

async function readSessionUserId() {
  try {
    const stored = await chrome.storage.local.get([SESSION_BRIDGE_KEY]);
    return stored?.[SESSION_BRIDGE_KEY]?.user_id || null;
  } catch (_) {
    return null;
  }
}

async function readCachedMerchantAccess(userId) {
  if (!userId) return null;
  try {
    const stored = await chrome.storage.local.get([SUBSCRIPTION_CACHE_KEY]);
    const payload = stored?.[SUBSCRIPTION_CACHE_KEY];
    if (!payload || payload.userId !== userId) return null;
    return subscriptionHasMerchant(payload.subscription);
  } catch (_) {
    return null;
  }
}

/**
 * Resolve whether Merchant strip/dock may mount on this page.
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function resolveMerchantAccess() {
  if (MERCHANT_GATING.TEST_LAB_BYPASS && isMerchantTestLabPage()) {
    return { allowed: true, reason: 'test_lab' };
  }

  const override = await readGateOverride();
  if (override === true) return { allowed: true, reason: 'override_on' };
  if (override === false) return { allowed: false, reason: 'override_off' };

  if (!MERCHANT_GATING.ENFORCE_SUBSCRIPTION) {
    return { allowed: true, reason: 'gating_open' };
  }

  const userId = await readSessionUserId();
  if (!userId) return { allowed: false, reason: 'signed_out' };

  const cached = await readCachedMerchantAccess(userId);
  if (cached === true) return { allowed: true, reason: 'subscription' };
  if (cached === false) return { allowed: false, reason: 'no_merchant_tier' };

  return { allowed: false, reason: 'subscription_unknown' };
}

export async function hasMerchantAccess() {
  const result = await resolveMerchantAccess();
  return !!result.allowed;
}

export function merchantAccessDeniedMessage(reason) {
  switch (reason) {
    case 'signed_out':
      return 'Sign in to PasteCraft to use Merchant.';
    case 'no_merchant_tier':
    case 'subscription_unknown':
      return 'Merchant requires an active Merchant subscription.';
    case 'override_off':
      return 'Merchant is disabled for this profile.';
    default:
      return 'Merchant access is not available.';
  }
}
