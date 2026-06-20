/** Popup startup: freemium gate, auth path, feature init orchestration. */

import { initializeAllPopupFeatures } from './popup.features.js';
import { markAllTabsDirty, clearTabRenderDirty } from './tab-nav.helpers.js';
import { rememberVerifiedEmailsFromSession } from '../auth/auth.email-cache.js';

let popupRevealScheduled = false;

function revealPopupWithIcons(context = 'unknown') {
  if (typeof window.finishBootLucideIcons === 'function') {
    window.finishBootLucideIcons(context);
    return;
  }
  window.__pcPopupLucideBooting = false;
  window.renderLucideIconsSync?.() || window.renderLucideIcons?.();
}

async function finishPopupReveal(app, context = 'popup-ready') {
  if (popupRevealScheduled) return;
  popupRevealScheduled = true;
  revealPopupWithIcons(context);
  app.hideLoadingOverlay();
}

export async function runPopupInit(app) {
  window.__pcPopupLucideBooting = true;
  popupRevealScheduled = false;
  markAllTabsDirty(app);

  await initializeAllPopupFeatures(app);

  app.setupAuthModalEvents();
  app._setupSupportFormEvents();

  let isLocalGuest = false;
  try {
    const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
    isLocalGuest = !!pc_freemium_guest;
  } catch (_) {}

  if (isLocalGuest) {
    try { await chrome.storage.local.remove(['pc_supabase_session_v1', 'oauth_callback', 'password_reset_callback']); } catch (_) {}
    try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}
    app._isFreemiumGuest = true;
    app.currentUser = null;
    app.userSubscription = null;
    document.getElementById('topBar').style.display = 'flex';
    await Promise.all([app.loadData(), app.loadSettings()]);
    app.updateTopBarIdentity();
    await app.setupEventListeners();
    app.renderChips();
    app.updateLastCapture();
    app.updatePreview();
    // Defer non-visible tab renders until after first paint
    requestAnimationFrame(() => {
      app.renderCategories();
      app.updateCategoryFilter();
    });
    await finishPopupReveal(app, 'guest-init');
    clearTabRenderDirty(app, 'clips');
    app.setupVisibilityListener();
    Promise.resolve().then(() => app.cleanupOldClips()).catch(() => {});
    return;
  }

  const resetCallback = await app.checkPasswordResetCallback();
  if (resetCallback) {
    window.__pcPopupLucideBooting = false;
    revealPopupWithIcons('password-reset-callback');
    app.hideLoadingOverlay();
    document.getElementById('newPasswordModal').style.display = 'flex';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery' || hashParams.get('reset')) {
    const accessToken = hashParams.get('access_token') || hashParams.get('reset');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken) {
      await app.setPasswordResetSession(accessToken, refreshToken);
    }
    window.__pcPopupLucideBooting = false;
    revealPopupWithIcons('password-reset-hash');
    app.hideLoadingOverlay();
    document.getElementById('newPasswordModal').style.display = 'flex';
    return;
  }

  await app.checkOAuthCallback();

  try {
    await app.clearLegacyAuthPrefs();
    await app.restoreSupabaseSessionFromBridge('startup');
  } catch (_) {}

  const currentUser = await pasteCraftSupabase.getCurrentUser();

  if (!currentUser) {
    window.__pcPopupLucideBooting = false;
    app.showAuthModal();
    return;
  }

  app.currentUser = currentUser;
  rememberVerifiedEmailsFromSession(currentUser.email ? [currentUser.email] : []).catch(() => {});

  try {
    app.userSubscription = await pasteCraftSupabase.getCachedSubscription(currentUser.id);
  } catch (_) {
    app.userSubscription = null;
  }
  app.updateAiCreditsPills('cached');
  app.updateUpgradeUI();

  pasteCraftSupabase.getUserSubscription(currentUser.id).then((sub) => {
    app.userSubscription = sub;
    app.updateAiCreditsPills('fresh');
    app.updateUpgradeUI();
  }).catch(() => {});

  document.getElementById('topBar').style.display = 'flex';

  app.setupLocalStorageListener();
  await app._ensureIndexedDbReadyAndMigrate();

  const coreBatch = Promise.all([
    app.loadData(),
    app.loadSettings(),
    app.loadAiWorkflow(),
  ]);
  const profileBatch = Promise.all([
    app.loadUserProfile(),
    app.loadAnalysisHistory(),
    app.loadAiHistory(),
  ]);
  await Promise.all([coreBatch, profileBatch]);

  if (!app.userProfile?.userName && !app.userProfile?.aiGeneratedName && !app.userProfile?.profileImageUrl) {
    try {
      const remoteProfile = await Promise.race([
        pasteCraftSupabase.syncUserProfileFromSupabase(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (remoteProfile) {
        app.userProfile = { ...(app.userProfile || {}), ...remoteProfile };
        await chrome.storage.local.set({ userProfile: app.userProfile });
      }
    } catch (_) {}
  }

  app.updateTopBarIdentity();

  if (app.userProfile?.profileImageUrl) {
    app.displayImageTopLeft(app.userProfile.profileImageUrl);
  }

  await app.setupEventListeners();
  app.renderChips();
  app.updateLastCapture();
  app.updatePreview();
  requestAnimationFrame(() => {
    app.renderCategories();
    app.updateCategoryFilter();
  });

  try {
    await app._restoreSessionState();
  } catch (e) {
    console.warn('Session restore failed:', e);
  }

  await finishPopupReveal(app, 'popup-ready');
  clearTabRenderDirty(app, app.currentTab || 'clips');

  Promise.resolve()
    .then(() => app.maybeCreateDailyRestorePoint('startup'))
    .catch(() => {});

  Promise.resolve()
    .then(() => app.cleanupOldClips())
    .catch(() => {});

  app.performBackgroundSync();

  Promise.resolve()
    .then(() => app._maybeMigrateTieredStorage())
    .catch((e) => console.warn('Tiered storage migration skipped:', e));

  app.setupVisibilityListener();
  app.setupRealtimeListeners();
  app.setupSyncStatusListeners();
}
