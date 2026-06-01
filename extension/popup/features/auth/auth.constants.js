export const AUTH_STORAGE_KEYS = Object.freeze({
  SUPABASE_SESSION: 'pc_supabase_session_v1',
  FREEMIUM_GUEST: 'pc_freemium_guest',
  AUTH_PREFS: 'pc_auth_prefs_v1',
  VERIFIED_EMAILS: 'pc_verified_emails_v1',
  OAUTH_CALLBACK: 'oauth_callback',
  PASSWORD_RESET_CALLBACK: 'password_reset_callback',
});

export const AUTH_EMAIL_CACHE_MAX = 10;
export const AUTH_EMAIL_SUGGESTION_LIMIT = 6;

export const AUTH_ELEMENT_IDS = Object.freeze({
  AUTH_MODAL: 'authModal',
  SIGNIN_FORM: 'signinForm',
  SIGNUP_FORM: 'signupForm',
  SIGNIN_EMAIL: 'signinEmail',
  SIGNIN_EMAIL_SUGGESTIONS: 'signinEmailSuggestions',
  SIGNIN_PASSWORD: 'signinPassword',
  SIGNIN_BTN: 'signinBtn',
  SIGNUP_EMAIL: 'signupEmail',
  SIGNUP_PASSWORD: 'signupPassword',
  SIGNUP_PASSWORD_CONFIRM: 'signupPasswordConfirm',
  SIGNUP_BTN: 'signupBtn',
  AGREE_TERMS: 'agreeTerms',
  GOOGLE_SIGNIN_BTN: 'googleSigninBtn',
  GOOGLE_SIGNUP_BTN: 'googleSignupBtn',
  SKIP_FREEMIUM_BTN: 'skipToFreemiumBtn',
  RESEND_VERIFICATION_LINK: 'resendVerificationLink',
  FORGOT_PASSWORD_LINK: 'forgotPasswordLink',
  CANCEL_RESET_BTN: 'cancelResetBtn',
  RESET_EMAIL: 'resetEmail',
  RESET_REQUEST_FORM: 'resetRequestForm',
  PASSWORD_RESET_MODAL: 'passwordResetModal',
  NEW_PASSWORD_MODAL: 'newPasswordModal',
  NEW_PASSWORD: 'newPassword',
  CONFIRM_NEW_PASSWORD: 'confirmNewPassword',
  NEW_PASSWORD_FORM: 'newPasswordForm',
  CLOSE_APP_BTN: 'closeAppBtn',
  SIGN_OUT_BTN: 'signOutBtn',
  TOP_BAR: 'topBar',
});

export const AUTH_TAB_SELECTOR = '.auth-tab, .auth-tab-new';

export const AUTH_TIMEOUT_MS = 3000;

export const AUTH_TOKEN_REFRESH_BUFFER_MS = 60000;

export const SESSION_STATE_KEYS = Object.freeze([
  'pc_activeTab_v1',
  'pc_aiLabSubTab_v1',
  'pc_breakdownPageState_v1',
  'pc_breakdownModalState_v1',
  'pc_summaryState_v1',
]);

export const LOCAL_CHANGE_DEBOUNCE_MS = 150;
export const LOCAL_CHANGE_FLUSH_MS = 60;

export const SETTINGS_CHANGE_KEYS = Object.freeze([
  'autoDeletePeriod',
  'quickPasteSettings',
  'albumAttachmentOpenMode',
  'theme',
]);
