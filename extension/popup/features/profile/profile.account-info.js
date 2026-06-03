import { AUTH_ELEMENT_IDS } from '../auth/auth.constants.js';
import { getPasswordResetModal } from '../auth/auth.selectors.js';

const MANAGE_ACCOUNT_URL = 'https://pastecraft.com/account';
const RESET_PASSWORD_URL = 'https://pastecraft.com/reset-password';

function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function _getExtensionVersion() {
  try {
    return chrome.runtime.getManifest()?.version || '—';
  } catch (_) {
    return '—';
  }
}

function _resolveDisplayName(app) {
  const userName = typeof app.userProfile?.userName === 'string' ? app.userProfile.userName.trim() : '';
  const funkyName = typeof app.userProfile?.aiGeneratedName === 'string' ? app.userProfile.aiGeneratedName.trim() : '';
  if (funkyName) return funkyName;
  if (userName) return userName;
  const email = typeof app.currentUser?.email === 'string' ? app.currentUser.email : '';
  if (email) return email.split('@')[0];
  return app._isFreemiumGuest ? 'Guest (local mode)' : '—';
}

function _resolveSignInMethod(user) {
  if (!user) return '—';
  const provider = String(
    user.app_metadata?.provider
    || user.identities?.[0]?.provider
    || 'email',
  ).toLowerCase();
  if (provider === 'google') return 'Google';
  if (provider === 'email') return 'Email & password';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function _resolvePlanLabel(app) {
  if (app._isFreemiumGuest) return 'Freemium (local only — no account)';
  const sub = app.userSubscription;
  if (!sub) return 'Free';
  const tier = String(sub.subscription_tier || 'free').toLowerCase();
  const status = String(sub.subscription_status || 'active').toLowerCase();
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  if (status === 'past_due') return `${tierLabel} (payment issue)`;
  if (status !== 'active') return `${tierLabel} (${status})`;
  return tierLabel;
}

function _isEmailPasswordAccount(user) {
  if (!user) return false;
  const provider = String(
    user.app_metadata?.provider
    || user.identities?.[0]?.provider
    || 'email',
  ).toLowerCase();
  return provider === 'email';
}

function _toggleGuestVsSignedIn(isGuest) {
  const guestNotice = document.getElementById('accountInfoGuestNotice');
  const signedInCard = document.getElementById('accountInfoSignedIn');
  const signedInActions = document.getElementById('accountInfoSignedInActions');
  const guestActions = document.getElementById('accountInfoGuestActions');

  if (guestNotice) guestNotice.style.display = isGuest ? 'block' : 'none';
  if (signedInCard) signedInCard.style.display = isGuest ? 'none' : 'block';
  if (signedInActions) signedInActions.style.display = isGuest ? 'none' : 'flex';
  if (guestActions) guestActions.style.display = isGuest ? 'flex' : 'none';
}

function _configurePasswordReset(app, user) {
  const resetBtn = document.getElementById('profileResetPasswordBtn');
  const resetNote = document.getElementById('profilePasswordResetNote');
  const canReset = !!(user?.email && _isEmailPasswordAccount(user));

  if (resetBtn) {
    resetBtn.style.display = canReset ? 'inline-flex' : 'none';
    resetBtn.disabled = !canReset;
  }

  if (resetNote) {
    if (!user?.email) {
      resetNote.textContent = 'Sign in with an email account to reset your password here.';
    } else if (!_isEmailPasswordAccount(user)) {
      resetNote.textContent = 'Your password is managed by Google. Use your Google account settings to change it.';
    } else {
      resetNote.textContent = 'We will email a secure link to pastecraft.com where you can set a new password, then sign in again in the extension.';
    }
  }
}

function _configureManageAccountLink() {
  const link = document.getElementById('profileManageAccountLink');
  if (link) {
    link.href = MANAGE_ACCOUNT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  const resetSiteLink = document.getElementById('profileResetPasswordSiteLink');
  if (resetSiteLink) {
    resetSiteLink.href = RESET_PASSWORD_URL;
    resetSiteLink.target = '_blank';
    resetSiteLink.rel = 'noopener noreferrer';
  }
}

export function updateAccountInfoSection(app) {
  const isGuest = !!(app._isFreemiumGuest && !app.currentUser);
  _toggleGuestVsSignedIn(isGuest);
  _setText('accountInfoVersion', `v${_getExtensionVersion()}`);

  if (isGuest) return;

  const user = app.currentUser;
  const email = typeof user?.email === 'string' ? user.email.trim() : '';

  _setText('accountInfoDisplayName', _resolveDisplayName(app));
  _setText('accountInfoEmail', email || 'Not available');
  _setText('accountInfoSignInMethod', _resolveSignInMethod(user));
  _setText('accountInfoPlan', _resolvePlanLabel(app));

  const verifiedEl = document.getElementById('accountInfoEmailVerified');
  if (verifiedEl) {
    const confirmedAt = user?.email_confirmed_at || user?.confirmed_at;
    verifiedEl.textContent = confirmedAt ? 'Verified' : 'Not verified — check your inbox';
    verifiedEl.classList.toggle('is-verified', !!confirmedAt);
    verifiedEl.classList.toggle('is-pending', !confirmedAt);
  }

  _configurePasswordReset(app, user);
  _configureManageAccountLink();
}

export function openPasswordResetFromProfile(app) {
  const email = typeof app.currentUser?.email === 'string' ? app.currentUser.email.trim() : '';
  if (!email || !_isEmailPasswordAccount(app.currentUser)) {
    app.showToast('Password reset is only available for email sign-in accounts.', 'info');
    return;
  }

  app._passwordResetReturnTo = 'profile';
  app.hideProfileModal();

  const resetModal = getPasswordResetModal();
  if (resetModal) resetModal.style.display = 'flex';

  const resetEmail = document.getElementById(AUTH_ELEMENT_IDS.RESET_EMAIL);
  if (resetEmail) resetEmail.value = email;

  const cancelBtn = document.getElementById(AUTH_ELEMENT_IDS.CANCEL_RESET_BTN);
  if (cancelBtn) cancelBtn.textContent = '← Back to Profile';
}

export function applyAuthPrefsToUi(app) {
  updateAccountInfoSection(app);
}
