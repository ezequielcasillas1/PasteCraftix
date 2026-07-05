import { SETTINGS_COUPON_ELEMENT_IDS } from './settings.constants.js';

function _readConfig() {
  const cfg = PASTECRAFT_CONFIG?.supabase || {};
  return { supabaseUrl: String(cfg.url || ''), anonKey: String(cfg.anonKey || '') };
}

async function _getAccessToken() {
  const result = await pasteCraftSupabase?.client?.auth?.getSession?.();
  const token = result?.data?.session?.access_token;
  return token ? String(token) : '';
}

export function describeCouponAccess(sub) {
  if (!sub) return null;

  if (sub.has_unlimited_ai === true) {
    return { kind: 'unlimited', label: 'Unlimited AI access is active on your account.' };
  }

  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
    const dateStr = new Date(expiresAtMs).toLocaleDateString();
    return { kind: 'timed', label: `Promotional AI access is active until ${dateStr}.` };
  }

  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  if (tier === 'basic' && (status === 'active' || status === 'past_due')) {
    return { kind: 'basic', label: 'Basic plan is active (cloud sync, no AI).' };
  }

  return null;
}

async function _fetchLatestRedeemedCode(userId) {
  if (!pasteCraftSupabase?.client || !userId) return null;

  try {
    const { data, error } = await pasteCraftSupabase.client
      .from('coupon_redemptions')
      .select('coupon_codes ( code )')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data?.coupon_codes?.code || null;
  } catch (_) {
    return null;
  }
}

export async function refreshCouponSettingsUI(app) {
  const guestNote = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.GUEST_NOTE);
  const form = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.FORM);
  const statusEl = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.STATUS);
  const codeBadge = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.CODE_BADGE);
  const input = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.INPUT);

  if (!form) return;

  const isGuest = !app.currentUser;
  if (guestNote) guestNote.style.display = isGuest ? 'block' : 'none';
  form.style.display = isGuest ? 'none' : 'flex';

  if (isGuest) return;

  const access = describeCouponAccess(app.userSubscription);
  const codeName = await _fetchLatestRedeemedCode(app.currentUser.id);

  if (statusEl) {
    const statusText = statusEl.querySelector('span:last-child') || statusEl;
    statusText.textContent = access?.label || '';
    statusEl.style.display = access ? 'flex' : 'none';
  }

  if (codeBadge) {
    codeBadge.textContent = codeName || '';
    codeBadge.style.display = codeName ? 'inline-block' : 'none';
  }

  if (input && !input.matches(':focus')) {
    input.value = '';
  }
}

export async function redeemCouponCode(app, rawCode) {
  const code = String(rawCode || '').trim();
  if (!code) {
    app.showToast?.('Enter a coupon code', 'info');
    return { ok: false };
  }

  if (!app.currentUser) {
    app.showToast?.('Sign in to redeem a coupon code', 'info');
    return { ok: false };
  }

  const accessToken = await _getAccessToken();
  const { supabaseUrl, anonKey } = _readConfig();
  if (!supabaseUrl || !anonKey || !accessToken) {
    app.showToast?.('Sign in again to redeem a coupon', 'error');
    return { ok: false };
  }

  const redeemBtn = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.REDEEM_BTN);
  const input = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.INPUT);
  if (redeemBtn) redeemBtn.disabled = true;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/redeem-coupon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ couponCode: code }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      const message = payload.error || `Redemption failed (${response.status})`;
      app.showToast?.(message, 'error');
      return { ok: false, error: message };
    }

    const userId = app.currentUser.id;
    if (payload.subscription && userId) {
      app.userSubscription = payload.subscription;
      await pasteCraftSupabase.setCachedSubscription(userId, payload.subscription);
    } else if (userId) {
      app.userSubscription = await pasteCraftSupabase.getUserSubscription(userId);
    }

    app.applyAuthPrefsToUi?.();
    app.updateUpgradeUI?.();
    app.updateAiCreditsPill?.('coupon-redeem');

    const codeBadge = document.getElementById(SETTINGS_COUPON_ELEMENT_IDS.CODE_BADGE);
    if (codeBadge && payload.coupon?.code) {
      codeBadge.textContent = payload.coupon.code;
      codeBadge.style.display = 'inline-block';
    }

    await refreshCouponSettingsUI(app);

    if (input) input.value = '';
    app.showToast?.(payload.message || 'Coupon redeemed!', 'success');
    return { ok: true, data: payload };
  } catch (error) {
    console.error('[Settings] coupon redeem failed:', error);
    app.showToast?.('Could not redeem coupon. Check your connection.', 'error');
    return { ok: false };
  } finally {
    if (redeemBtn) redeemBtn.disabled = false;
  }
}
