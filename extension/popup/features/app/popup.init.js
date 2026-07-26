/** Popup startup: freemium gate, auth path, feature init orchestration. */

import { initializeAllPopupFeatures } from './popup.features.js';
import { hydratePopupTabInBackground } from './popup.tab-lifecycle.js';
import {
  markPopupBootStart,
  markPopupContentReady,
} from './popup.performance.js';
import { ensureWorkspaceOwner } from '../../../bridges/workspace/workspace.facade.js';
import { rememberVerifiedEmailsFromSession } from '../auth/auth.email-cache.js';
import { mergeUserProfileLocalRemote } from '../../../shared/profile-merge.js';

let popupRevealScheduled = false;
const DEFERRED_IDLE_TIMEOUT_MS = 500;

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
  markPopupContentReady();
}

function beginPopupBoot() {
  markPopupBootStart();
  window.__pcPopupLucideBooting = true;
  popupRevealScheduled = false;
}

function setupStartupEvents(app) {
  app.setupAuthModalEvents();
  app._setupSupportFormEvents();
}

async function isLocalGuestMode() {
  try {
    const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
    return !!pc_freemium_guest;
  } catch (_) {
    return false;
  }
}

function showTopBar() {
  const topBar = document.getElementById('topBar');
  if (topBar) topBar.style.display = 'flex';
}

function updateCoreMetadata(app) {
  app.updateLastCapture();
  app.updatePreview();
  app.updateCategoryFilter();
}

function renderGuestActiveTab(app) {
  updateCoreMetadata(app);
  if (app.currentTab === 'categories') app.renderCategories();
  else app.renderChips();
}

function revealPasswordReset(app, context) {
  window.__pcPopupLucideBooting = false;
  revealPopupWithIcons(context);
  app.hideLoadingOverlay();
  document.getElementById('newPasswordModal').style.display = 'flex';
}

function readRecoveryTokens() {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const requested = urlParams.get('reset') === 'true'
    || hashParams.get('type') === 'recovery'
    || !!hashParams.get('reset');
  if (!requested) return null;
  return {
    accessToken: hashParams.get('access_token') || hashParams.get('reset'),
    refreshToken: hashParams.get('refresh_token'),
  };
}

async function handlePasswordRecovery(app) {
  if (await app.checkPasswordResetCallback()) {
    revealPasswordReset(app, 'password-reset-callback');
    return true;
  }

  const recovery = readRecoveryTokens();
  if (!recovery) return false;
  if (recovery.accessToken) {
    await app.setPasswordResetSession(recovery.accessToken, recovery.refreshToken);
  }
  revealPasswordReset(app, 'password-reset-hash');
  return true;
}

async function resolveAuthenticatedUser(app) {
  await app.checkOAuthCallback();
  try {
    await app.clearLegacyAuthPrefs();
    await app.restoreSupabaseSessionFromBridge('startup');
  } catch (_) {}
  return pasteCraftSupabase.getCurrentUser();
}

async function loadCachedSubscription(userId) {
  try {
    return await pasteCraftSupabase.getCachedSubscription(userId);
  } catch (_) {
    return null;
  }
}

function startSafeLocalPreparation(app) {
  const settingsReady = Promise.resolve().then(() => app.loadSettings());
  const storageReady = Promise.resolve().then(() => app._ensureIndexedDbReadyAndMigrate());
  settingsReady.catch(() => {});
  storageReady.catch(() => {});
  return { settingsReady, storageReady };
}

async function loadAuthenticatedCriticalState(app, currentUser, localPreparation) {
  app.setupLocalStorageListener();
  const [, , , , subscription] = await Promise.all([
    app.loadData(),
    localPreparation.settingsReady,
    localPreparation.storageReady,
    app.loadUserProfile(),
    loadCachedSubscription(currentUser.id),
  ]);
  app.userSubscription = subscription;
  app.updateAiCreditsPills('cached');
  app.updateUpgradeUI();
}

async function restoreActiveUiState(app) {
  try {
    await app._restoreSessionState();
  } catch (error) {
    console.warn('Session restore failed:', error);
  }

  if (app.currentTab === 'ai') {
    await Promise.all([app.loadAiWorkflow(), app.loadAnalysisHistory()]);
  }
}

async function paintAuthenticatedPopup(app) {
  showTopBar();
  app.updateTopBarIdentity();
  if (app.userProfile?.profileImageUrl) {
    app.displayImageTopLeft(app.userProfile.profileImageUrl);
  }
  await app.setupEventListeners();
  updateCoreMetadata(app);
  await restoreActiveUiState(app);
  // Safety net: session restore fire-and-forgets tab paint; ensure Clips
  // never stay on the HTML "Loading clips" placeholder after hydration.
  if (!app.currentTab || app.currentTab === 'clips') {
    app.renderChips?.();
  }
}

function isSameAuthenticatedUser(app, currentUser) {
  return !!currentUser?.id && app.currentUser?.id === currentUser.id;
}

function runDeferredTask(app, currentUser, task, label) {
  Promise.resolve()
    .then(() => {
      if (!isSameAuthenticatedUser(app, currentUser)) return undefined;
      return task();
    })
    .catch((error) => console.warn(`${label} skipped:`, error));
}

function hasCachedProfileIdentity(app) {
  const profile = app.userProfile;
  return !!profile?.userName || !!profile?.aiGeneratedName || !!profile?.profileImageUrl;
}

async function refreshRemoteProfile(app, currentUser) {
  if (hasCachedProfileIdentity(app)) return;
  const remoteProfile = await pasteCraftSupabase.syncUserProfileFromSupabase();
  if (!remoteProfile) return;
  if (!isSameAuthenticatedUser(app, currentUser)) return;
  // Never let cloud nulls wipe local names (spread merge used to).
  app.userProfile = mergeUserProfileLocalRemote(app.userProfile, remoteProfile);
  await chrome.storage.local.set({ userProfile: app.userProfile });
}

function scheduleAuthenticatedDeferredWork(app, currentUser, defer) {
  defer(() => {
    if (!isSameAuthenticatedUser(app, currentUser)) return;
    app.setupVisibilityListener();
    app.setupRealtimeListeners();
    app.setupSyncStatusListeners();

    if (app.currentTab !== 'ai') {
      runDeferredTask(app, currentUser, () => app.loadAiWorkflow(), 'AI workflow load');
      runDeferredTask(app, currentUser, () => app.loadAnalysisHistory(), 'Analysis history load');
    }
    runDeferredTask(
      app,
      currentUser,
      () => hydratePopupTabInBackground(app, 'aiHistory'),
      'AI history load',
    );
    runDeferredTask(app, currentUser, async () => {
      await refreshRemoteProfile(app, currentUser);
      app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
    }, 'Remote profile refresh');
    runDeferredTask(app, currentUser, async () => {
      await app.maybeCreateDailyRestorePoint('startup');
      await app.cleanupOldClips();
      await app._initializeTieredStorage();
      await app._maybeMigrateTieredStorage();
      await app.performBackgroundSync();
      try { await app.dataSafetyFeature?.runCheck?.(); } catch (_) {}
    }, 'Deferred storage and sync work');
    runDeferredTask(app, currentUser, async () => {
      const subscription = await pasteCraftSupabase.getUserSubscription(currentUser.id);
      if (!isSameAuthenticatedUser(app, currentUser)) return;
      app.userSubscription = subscription;
      app.updateAiCreditsPills('fresh');
      app.updateUpgradeUI();
      // Upgrade / coupon entitlement may land after checkout — push local library once.
      try {
        await app.syncFeature?.localToCloud?.maybeMigrateLocalToCloud?.(app, {
          reason: 'subscription-refresh',
        });
      } catch (_) {}
    }, 'Subscription refresh');
  });
}

function scheduleGuestDeferredWork(app, defer) {
  defer(() => {
    app.setupVisibilityListener();
    Promise.resolve(app._initializeTieredStorage?.()).catch(() => {});
    Promise.resolve(app.cleanupOldClips()).catch(() => {});
    Promise.resolve(app.maybeCreateDailyRestorePoint?.('guest-startup')).catch(() => {});
    Promise.resolve(app.dataSafetyFeature?.runCheck?.({ forceGuestBanner: true })).catch(() => {});
  });
}

async function runGuestStartup(app, defer) {
  try {
    await chrome.storage.local.remove(['pc_supabase_session_v1', 'oauth_callback', 'password_reset_callback']);
  } catch (_) {}
  try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}

  app._isFreemiumGuest = true;
  app.currentUser = null;
  app.userSubscription = null;
  showTopBar();
  await Promise.all([app.loadData(), app.loadSettings()]);
  app.updateTopBarIdentity();
  await app.setupEventListeners();
  renderGuestActiveTab(app);
  await finishPopupReveal(app, 'guest-init');
  scheduleGuestDeferredWork(app, defer);
}

async function runAuthenticatedStartup(app, currentUser, localPreparation, defer) {
  app.currentUser = currentUser;
  rememberVerifiedEmailsFromSession(currentUser.email ? [currentUser.email] : []).catch(() => {});
  await loadAuthenticatedCriticalState(app, currentUser, localPreparation);
  await paintAuthenticatedPopup(app);
  await finishPopupReveal(app, 'popup-ready');
  scheduleAuthenticatedDeferredWork(app, currentUser, defer);
}

function scheduleAfterAnimationFrame(callback) {
  const scheduleMacrotask = () => setTimeout(callback, 0);
  if (typeof window.requestAnimationFrame !== 'function') {
    scheduleMacrotask();
    return;
  }
  try {
    window.requestAnimationFrame(scheduleMacrotask);
  } catch (_) {
    scheduleMacrotask();
  }
}

function defaultDefer(callback) {
  if (typeof window.requestIdleCallback === 'function') {
    try {
      window.requestIdleCallback(callback, { timeout: DEFERRED_IDLE_TIMEOUT_MS });
      return;
    } catch (_) {}
  }
  scheduleAfterAnimationFrame(callback);
}

export async function runPopupInit(app, dependencies = {}) {
  const initializeFeatures = dependencies.initializeFeatures || initializeAllPopupFeatures;
  const defer = dependencies.defer || defaultDefer;

  beginPopupBoot();
  const featureInitialization = initializeFeatures(app);
  const guestModeCheck = isLocalGuestMode();
  await featureInitialization;
  setupStartupEvents(app);

  if (await guestModeCheck) {
    await runGuestStartup(app, defer);
    return;
  }

  if (await handlePasswordRecovery(app)) return;
  const currentUser = await resolveAuthenticatedUser(app);
  if (!currentUser) {
    window.__pcPopupLucideBooting = false;
    app.showAuthModal();
    return;
  }
  // Bind/clear workspace before IDB migrate or loadData can inherit foreign rows.
  try {
    await ensureWorkspaceOwner(currentUser.id);
  } catch (error) {
    console.warn('Workspace ownership ensure (pre-prep) failed:', error?.message || error);
  }
  const localPreparation = startSafeLocalPreparation(app);
  await runAuthenticatedStartup(app, currentUser, localPreparation, defer);
}
