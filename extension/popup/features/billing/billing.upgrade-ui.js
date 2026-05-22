export function isFreemiumUser(app) {
  const sub = app.userSubscription;
  if (!sub) return true;
  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  if (tier === 'admin') return false;
  if ((tier === 'premium' || tier === 'basic') && (status === 'active' || status === 'past_due')) return false;
  if (sub.has_unlimited_ai === true) return false;
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) return false;
  return true;
}

export function updateUpgradeUI(app) {
  const isFree = isFreemiumUser(app);
  const banner = document.getElementById('upgradeBanner');
  const profileBtn = document.getElementById('upgradeSubBtn');
  if (banner) banner.style.display = isFree ? 'flex' : 'none';
  if (profileBtn) profileBtn.style.display = isFree ? 'block' : 'none';
}
