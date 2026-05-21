/** Popup startup: freemium gate, auth path, feature init orchestration. */

import { initializeAllPopupFeatures } from './popup.features.js';

export async function runPopupInit(app) {
  console.log('?? Initializing PasteCraft popup...');
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
    app.renderCategories();
    app.updateCategoryFilter();
    app.hideLoadingOverlay();
    app.setupVisibilityListener();
    Promise.resolve().then(() => app.cleanupOldClips()).catch(() => {});
    return;
  }

  const resetCallback = await app.checkPasswordResetCallback();
  if (resetCallback) {
    console.log('?? Password reset callback detected from storage');
    app.hideLoadingOverlay();
    document.getElementById('newPasswordModal').style.display = 'flex';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  console.log('?? URL check:', {
    search: window.location.search,
    hash: window.location.hash,
    type: hashParams.get('type'),
    accessToken: hashParams.get('access_token') ? 'present' : 'missing',
  });

  if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery' || hashParams.get('reset')) {
    console.log('?? Password reset callback detected from URL');
    const accessToken = hashParams.get('access_token') || hashParams.get('reset');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken) {
      await app.setPasswordResetSession(accessToken, refreshToken);
    }
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
    app.showAuthModal();
    return;
  }

  console.log('? User authenticated:', currentUser.email);
  app.currentUser = currentUser;

  try {
    app.userSubscription = await pasteCraftSupabase.getCachedSubscription(currentUser.id);
  } catch (_) {
    app.userSubscription = null;
  }
  console.log('?? Subscription tier (cached):', app.userSubscription?.subscription_tier);
  app.updateAiCreditsPills('cached');
  app.updateUpgradeUI();

  pasteCraftSupabase.getUserSubscription(currentUser.id).then((sub) => {
    app.userSubscription = sub;
    console.log('?? Subscription tier (fresh):', app.userSubscription?.subscription_tier);
    app.updateAiCreditsPills('fresh');
    app.updateUpgradeUI();
  }).catch(() => {});

  document.getElementById('topBar').style.display = 'flex';

  app.setupLocalStorageListener();
  await app._ensureIndexedDbReadyAndMigrate();

  await Promise.all([
    app.loadData(),
    app.loadSettings(),
    app.loadAiWorkflow(),
    app.loadUserProfile(),
    app.loadAnalysisHistory(),
    app.loadAiHistory(),
  ]);

  if (!app.userProfile?.userName && !app.userProfile?.aiGeneratedName && !app.userProfile?.profileImageUrl) {
    try {
      const remoteProfile = await Promise.race([
        pasteCraftSupabase.syncUserProfileFromSupabase(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (remoteProfile) {
        app.userProfile = { ...(app.userProfile || {}), ...remoteProfile };
        await chrome.storage.local.set({ userProfile: app.userProfile });
        console.log('✅ Profile hydrated from Supabase on fresh device');
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
  app.renderCategories();
  app.updateCategoryFilter();

  app.hideLoadingOverlay();

  app._restoreSessionState().catch((e) => {
    console.warn('Session restore failed:', e);
  });

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

  console.log('? PasteCraft popup initialized successfully');
}
