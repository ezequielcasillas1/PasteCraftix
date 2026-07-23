/** @forward-slice AI premium / credit access checks for popup shell. */

export function hasAiAccess(subscription) {
  const sub = subscription;
  if (!sub) return false;
  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  const hasCouponAi = !!(sub.has_unlimited_ai === true || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()));
  const isPaidPremium = tier === 'premium' && (status === 'active' || status === 'past_due');
  const purchasedBalance = Number.isFinite(Number(sub.ai_purchased_credits_balance))
    ? Math.max(0, Number(sub.ai_purchased_credits_balance))
    : 0;
  return isPaidPremium || hasCouponAi || purchasedBalance > 0;
}

export function formatShortDate(isoOrDate) {
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return null;
  }
}
