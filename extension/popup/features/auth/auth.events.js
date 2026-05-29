import { AUTH_ELEMENT_IDS, AUTH_STORAGE_KEYS, AUTH_TAB_SELECTOR } from './auth.constants.js';
import {
  bindLocalTestAccountUi,
  applyLocalTestAccountBanner,
} from './local-test-account.js';
import {
  getAuthModal,
  getSigninForm,
  getSignupForm,
  getPasswordResetModal,
  getNewPasswordModal,
  getSigninEmailValue,
  getSigninPasswordValue,
  getSignupEmailValue,
  getSignupPasswordValue,
  getSignupPasswordConfirmValue,
  isAgreeTermsChecked,
  getResetEmailValue,
  getNewPasswordValue,
  getConfirmNewPasswordValue,
} from './auth.selectors.js';

export function showAuthModal(app) {
  console.log('🔐 Showing auth modal...');
  app.hideLoadingOverlay();
  const modal = getAuthModal();
  if (modal) modal.style.display = 'flex';
}

export function hideAuthModal(app) {
  const modal = getAuthModal();
  if (modal) modal.style.display = 'none';
}

function _bindAuthTabSwitcher(app) {
  document.querySelectorAll(AUTH_TAB_SELECTOR).forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll(AUTH_TAB_SELECTOR).forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');

      const targetTab = e.target.dataset.authTab;
      const signinForm = getSigninForm();
      const signupForm = getSignupForm();
      if (signinForm) signinForm.style.display = targetTab === 'signin' ? 'flex' : 'none';
      if (signupForm) signupForm.style.display = targetTab === 'signup' ? 'flex' : 'none';
    });
  });
}

function _bindPasswordStrengthIndicator(app) {
  const signupPassword = document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_PASSWORD);
  if (!signupPassword) return;
  signupPassword.addEventListener('input', (e) => {
    app.updatePasswordStrength(e.target.value);
  });
}

function _bindResendVerification(app) {
  const link = document.getElementById(AUTH_ELEMENT_IDS.RESEND_VERIFICATION_LINK);
  if (!link) return;
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = getSigninEmailValue();
    if (!email) {
      alert('📧 Please enter your email address in the Sign In form first!');
      return;
    }
    app.showToast('📧 Sending verification email...', 'info');
    const result = await pasteCraftSupabase.resendVerificationEmail(email);
    if (result.success) {
      alert(`✅ Verification Email Sent!\n\nCheck your inbox at: ${email}\n\nThe verification link has been sent. Click it to activate your account.\n\n⚠️ Check your spam folder if you don't see it within a few minutes.`);
      app.showToast('✅ Verification email sent! Check your inbox.', 'success');
    } else {
      app.showToast(`❌ Failed to resend: ${result.error}`, 'error');
    }
  });
}

function _signInErrorMessage(error) {
  const lower = error.toLowerCase();
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    const msg = '📧 Email Not Verified!\n\nYou must verify your email before signing in.\n\nCheck your inbox for the verification email and click the link.\n\nCheck spam if needed.';
    alert(msg);
    return msg;
  }
  if (lower.includes('invalid') || lower.includes('credentials')) {
    return '❌ Invalid email or password.\n\nPlease check your credentials and try again.\n\nIf you just signed up, make sure you verified your email first!';
  }
  return error;
}

async function _performSignIn(app, email, password) {
  const result = await pasteCraftSupabase.signInWithEmail(email, password);
  if (result.success) {
    app._isFreemiumGuest = false;
    chrome.storage.local.remove(AUTH_STORAGE_KEYS.FREEMIUM_GUEST);
    await app.clearLegacyAuthPrefs();
    app.showToast('✅ Welcome back!', 'success');
    app.hideAuthModal();
    window.location.reload();
  } else {
    app.showToast(`❌ ${_signInErrorMessage(result.error)}`, 'error');
  }
}

function _bindSignInHandlers(app) {
  const handleSignIn = async () => {
    console.log('🔐 Sign In triggered');
    const email = getSigninEmailValue();
    const password = getSigninPasswordValue();
    if (!email || !password) {
      app.showToast('⚠️ Please fill in all fields', 'error');
      return;
    }
    await _performSignIn(app, email, password);
  };

  const signinBtn = document.getElementById(AUTH_ELEMENT_IDS.SIGNIN_BTN);
  if (signinBtn) signinBtn.addEventListener('click', handleSignIn);

  ['SIGNIN_EMAIL', 'SIGNIN_PASSWORD'].forEach((key) => {
    const el = document.getElementById(AUTH_ELEMENT_IDS[key]);
    if (!el) return;
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });
  });
}

function _hasAllSignUpFields(form) {
  return !!(form.email && form.password && form.confirmPassword);
}

function _validateSignUpInputs(app, form) {
  if (!_hasAllSignUpFields(form)) {
    app.showToast('⚠️ Please fill in all fields', 'error');
    return false;
  }
  if (form.password !== form.confirmPassword) {
    app.showToast('⚠️ Passwords do not match', 'error');
    return false;
  }
  if (!app.validatePassword(form.password)) {
    app.showToast('⚠️ Password does not meet requirements. Check the red requirements below.', 'error');
    return false;
  }
  if (!form.agreeTerms) {
    app.showToast('⚠️ Please agree to terms and conditions', 'error');
    return false;
  }
  return true;
}

async function _performSignUp(app, email, password) {
  const result = await pasteCraftSupabase.signUpWithEmail(email, password);
  if (result.success) {
    app._isFreemiumGuest = false;
    chrome.storage.local.remove(AUTH_STORAGE_KEYS.FREEMIUM_GUEST);
    alert(`✅ Account Created Successfully!\n\n📧 IMPORTANT: Check your email (${email})\n\n1️⃣ Open the verification email\n2️⃣ Click the verification link\n3️⃣ Come back here and sign in\n\n⚠️ You CANNOT sign in until you verify your email!\n\nCheck your spam folder if you don't see it.`);
    app.showToast('✅ Check your email to verify your account!', 'success');
    document.querySelector('[data-auth-tab="signin"]')?.click();
  } else {
    app.showToast(`❌ ${result.error}`, 'error');
  }
}

function _bindSignUpHandlers(app) {
  const handleSignUp = async () => {
    console.log('📝 Sign Up triggered');
    const form = {
      email: getSignupEmailValue(),
      password: getSignupPasswordValue(),
      confirmPassword: getSignupPasswordConfirmValue(),
      agreeTerms: isAgreeTermsChecked(),
    };
    if (!_validateSignUpInputs(app, form)) return;
    await _performSignUp(app, form.email, form.password);
  };

  const signupBtn = document.getElementById(AUTH_ELEMENT_IDS.SIGNUP_BTN);
  if (signupBtn) signupBtn.addEventListener('click', handleSignUp);

  ['SIGNUP_EMAIL', 'SIGNUP_PASSWORD', 'SIGNUP_PASSWORD_CONFIRM'].forEach((key) => {
    const el = document.getElementById(AUTH_ELEMENT_IDS[key]);
    if (!el) return;
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });
  });
}

async function _handleGoogleAuth(app, label) {
  console.log(`🔵 Google ${label} button clicked`);
  app._isFreemiumGuest = false;
  chrome.storage.local.remove(AUTH_STORAGE_KEYS.FREEMIUM_GUEST);
  app.showToast(`🔵 Opening Google ${label.toLowerCase()}...`, 'info');

  const result = await pasteCraftSupabase.signInWithGoogle();
  if (result.success) {
    await app.clearLegacyAuthPrefs();
    app.showToast('✅ Signed in with Google!', 'success');
    window.location.reload();
  } else {
    app.showToast(`❌ ${result.error}`, 'error');
  }
}

function _bindGoogleAuthHandlers(app) {
  const signinBtn = document.getElementById(AUTH_ELEMENT_IDS.GOOGLE_SIGNIN_BTN);
  if (signinBtn) signinBtn.addEventListener('click', () => _handleGoogleAuth(app, 'Sign In'));

  const signupBtn = document.getElementById(AUTH_ELEMENT_IDS.GOOGLE_SIGNUP_BTN);
  if (signupBtn) signupBtn.addEventListener('click', () => _handleGoogleAuth(app, 'Sign Up'));
}

async function _enterFreemiumGuestMode(app) {
  app._isFreemiumGuest = true;
  await chrome.storage.local.set({ [AUTH_STORAGE_KEYS.FREEMIUM_GUEST]: true });
  try { await chrome.storage.local.remove([AUTH_STORAGE_KEYS.SUPABASE_SESSION]); } catch (_) {}
  try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}
  app.hideAuthModal();
  app.currentUser = null;
  app.userSubscription = null;

  const topBar = document.getElementById(AUTH_ELEMENT_IDS.TOP_BAR);
  if (topBar) topBar.style.display = 'flex';

  await Promise.all([app.loadData(), app.loadSettings()]);
  app.updateTopBarIdentity();
  await app.setupEventListeners();
  app.renderChips();
  app.updateLastCapture();
  app.updatePreview();
  app.renderCategories();
  app.updateCategoryFilter();
  app.hideLoadingOverlay();
  app.showToast('🚀 Welcome to PasteCraft! Using free local mode.', 'success');
}

function _bindFreemiumSkip(app) {
  const skipBtn = document.getElementById(AUTH_ELEMENT_IDS.SKIP_FREEMIUM_BTN);
  if (!skipBtn) return;
  skipBtn.addEventListener('click', async () => {
    console.log('🚀 Skip to PasteCraft (freemium guest) clicked');
    await _enterFreemiumGuestMode(app);
  });
}

function _openForgotPasswordModal() {
  const authModal = getAuthModal();
  const resetModal = getPasswordResetModal();
  if (authModal) authModal.style.display = 'none';
  if (resetModal) resetModal.style.display = 'flex';

  const signinEmail = getSigninEmailValue();
  if (signinEmail) {
    const resetEmail = document.getElementById(AUTH_ELEMENT_IDS.RESET_EMAIL);
    if (resetEmail) resetEmail.value = signinEmail;
  }
}

async function _performPasswordReset(app, email) {
  console.log('📧 Requesting password reset for:', email);
  app.showToast('📧 Sending reset link...', 'info');
  const result = await pasteCraftSupabase.resetPassword(email);
  if (result.success) {
    alert(`✅ Password Reset Email Sent!\n\nCheck your inbox at: ${email}\n\n1️⃣ Click the link in the email\n2️⃣ Set your new password on the PasteCraft website\n3️⃣ Return here and sign in with your new password\n\n⚠️ Check spam if you don't see it within 5 minutes.`);
    app.showToast('✅ Reset email sent! Check your inbox.', 'success');
    const resetModal = getPasswordResetModal();
    const authModal = getAuthModal();
    if (resetModal) resetModal.style.display = 'none';
    if (authModal) authModal.style.display = 'flex';
  } else {
    app.showToast(`❌ Failed: ${result.error}`, 'error');
  }
}

function _bindForgotPasswordFlow(app) {
  const handlePasswordReset = async () => {
    const email = getResetEmailValue();
    if (!email) {
      app.showToast('⚠️ Please enter your email', 'error');
      return;
    }
    await _performPasswordReset(app, email);
  };

  const link = document.getElementById(AUTH_ELEMENT_IDS.FORGOT_PASSWORD_LINK);
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔑 Forgot password link clicked');
      _openForgotPasswordModal();
    });
  }

  const cancelBtn = document.getElementById(AUTH_ELEMENT_IDS.CANCEL_RESET_BTN);
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      console.log('🔙 Cancel reset, back to sign in');
      const resetModal = getPasswordResetModal();
      const authModal = getAuthModal();
      if (resetModal) resetModal.style.display = 'none';
      if (authModal) authModal.style.display = 'flex';
    });
  }

  const form = document.getElementById(AUTH_ELEMENT_IDS.RESET_REQUEST_FORM);
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handlePasswordReset();
    });
  }

  const resetEmail = document.getElementById(AUTH_ELEMENT_IDS.RESET_EMAIL);
  if (resetEmail) {
    resetEmail.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePasswordReset();
      }
    });
  }
}

function _bindNewPasswordStrength(app) {
  const newPasswordInput = document.getElementById(AUTH_ELEMENT_IDS.NEW_PASSWORD);
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', (e) => {
      app.updateNewPasswordStrength(e.target.value);
      app.checkPasswordMatch();
    });
  }
  const confirmInput = document.getElementById(AUTH_ELEMENT_IDS.CONFIRM_NEW_PASSWORD);
  if (confirmInput) {
    confirmInput.addEventListener('input', () => {
      app.checkPasswordMatch();
    });
  }
}

async function _performNewPasswordUpdate(app, newPassword) {
  console.log('🔐 Updating password...');
  app.showToast('🔄 Updating password...', 'info');
  const result = await pasteCraftSupabase.updatePassword(newPassword);
  if (result.success) {
    alert('✅ Password Updated Successfully!\n\nYou can now sign in with your new password.');
    app.showToast('✅ Password updated!', 'success');
    const newPwModal = getNewPasswordModal();
    const authModal = getAuthModal();
    if (newPwModal) newPwModal.style.display = 'none';
    if (authModal) authModal.style.display = 'flex';
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    app.showToast(`❌ Failed: ${result.error}`, 'error');
  }
}

function _bindNewPasswordFlow(app) {
  _bindNewPasswordStrength(app);

  const handleNewPassword = async () => {
    const newPassword = getNewPasswordValue();
    const confirmPassword = getConfirmNewPasswordValue();
    if (!app.validatePassword(newPassword)) {
      app.showToast('⚠️ Password does not meet requirements', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      app.showToast('⚠️ Passwords do not match', 'error');
      return;
    }
    await _performNewPasswordUpdate(app, newPassword);
  };

  const form = document.getElementById(AUTH_ELEMENT_IDS.NEW_PASSWORD_FORM);
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleNewPassword();
    });
  }

  ['NEW_PASSWORD', 'CONFIRM_NEW_PASSWORD'].forEach((key) => {
    const el = document.getElementById(AUTH_ELEMENT_IDS[key]);
    if (!el) return;
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNewPassword();
      }
    });
  });
}

function _bindCloseAppButton(app) {
  const btn = document.getElementById(AUTH_ELEMENT_IDS.CLOSE_APP_BTN);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (window.self !== window.top) {
      const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
      window.parent.postMessage({ type: 'PASTECRAFT_CLOSE_POPUP' }, parentOrigin);
    } else {
      window.close();
    }
  });
}

function _performSignOutCleanup(app) {
  try {
    const topBar = document.getElementById(AUTH_ELEMENT_IDS.TOP_BAR);
    if (topBar) topBar.style.display = 'none';
  } catch (_) {}

  app.currentUser = null;
  app.userSubscription = null;
  app._isFreemiumGuest = false;
  chrome.storage.local.remove([AUTH_STORAGE_KEYS.FREEMIUM_GUEST, AUTH_STORAGE_KEYS.SUPABASE_SESSION]);
  app.showAuthModal();
  app.showToast('Signed out.', 'success');

  pasteCraftSupabase.signOutFast().catch((e) => {
    console.warn('Sign-out cleanup failed:', e?.message || e);
  });
}

function _bindSignOutButton(app) {
  const btn = document.getElementById(AUTH_ELEMENT_IDS.SIGN_OUT_BTN);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      _performSignOutCleanup(app);
    }
  });
}

export function setupAuthModalEvents(app) {
  console.log('🔧 Setting up auth modal event listeners...');
  Promise.resolve().then(() => app.applyAuthPrefsToUi()).catch(() => {});
  applyLocalTestAccountBanner();

  _bindAuthTabSwitcher(app);
  _bindPasswordStrengthIndicator(app);
  _bindResendVerification(app);
  _bindSignInHandlers(app);
  _bindSignUpHandlers(app);
  _bindGoogleAuthHandlers(app);
  _bindFreemiumSkip(app);
  bindLocalTestAccountUi(app);
  _bindForgotPasswordFlow(app);
  _bindNewPasswordFlow(app);
  _bindCloseAppButton(app);
  _bindSignOutButton(app);
}
