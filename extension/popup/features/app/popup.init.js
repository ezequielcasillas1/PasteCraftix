/** Popup startup: freemium gate, auth path, feature init orchestration. */

import { initializeAllPopupFeatures } from './popup.features.js';
import { initUrlSafetyForPopup } from '../../../shared/safe-open-url.js';
import { enforceLocalDataOwnerOnBoot, clearLocalUserData } from '../sync/sync.loader.js';

async function purgeExpiredClipsOnStartup(app) {
  try {
    // Don't block popup init on a slow service worker round-trip.
    // SW also runs runClipExpiryCycle() on startup + alarms, so this is best-effort.
    const resp = await Promise.race([
      chrome.runtime.sendMessage({ action: 'pcPurgeExpiredClips' }),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (resp?.purged > 0) {
      await app.loadData();
    }
  } catch (_) {}
}

export async function runPopupInit(app) {
  console.log('🚀 Initializing PasteCraft popup...');
  initUrlSafetyForPopup();
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
    await purgeExpiredClipsOnStartup(app);
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

  // #region agent log
  try {
    const _idCheck = await chrome.storage.local.get(['chromeUserId', 'pc_supabase_session_v1', 'pc_local_data_owner']);
    const _bridge = _idCheck?.pc_supabase_session_v1 || null;
    // Decode the real supabase-js session token email (independent of the bridge fast-path).
    let _sbEmail = null, _sbUserId = null;
    try {
      const _sbKey = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
      if (_sbKey) {
        const _raw = JSON.parse(localStorage.getItem(_sbKey) || 'null');
        const _at = _raw?.access_token || _raw?.currentSession?.access_token || null;
        if (_at) { const _pl = JSON.parse(atob(_at.split('.')[1])); _sbEmail = _pl?.email || null; _sbUserId = _pl?.sub || null; }
      }
    } catch (_) {}
    const _p={sessionId:'1e733c',hypothesisId:'D,E',location:'popup.init.js:93',message:'currentUser resolved at boot',data:{resolvedUserId:currentUser?.id||null,resolvedEmail:currentUser?.email||null,bridgeUserId:_bridge?.user_id||null,bridgeEmail:_bridge?.email||null,sbTokenUserId:_sbUserId,sbTokenEmail:_sbEmail,localDataOwner:_idCheck?.pc_local_data_owner||null},timestamp:Date.now()};
    console.warn('[PC-DEBUG-1e733c]',JSON.stringify(_p));
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e733c'},body:JSON.stringify(_p)}).catch(()=>{});
  } catch (_) {}
  // #endregion

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

  // Account isolation: if local caches belong to a different signed-in user,
  // archive theirs and restore this account's data before loading.
  await enforceLocalDataOwnerOnBoot(app, currentUser.id);

  // #region agent log
  // TEMP one-time remediation (debug-only): this install cross-contaminated
  // before the isolation system existed, so the current account "adopted"
  // another account's clips. Discard the mislabeled local copy once (the
  // original account re-hydrates from its cloud on next sign-in).
  try {
    const _remKey = 'pc_isolation_remediation_v1';
    const _rem = await chrome.storage.local.get([_remKey]);
    if (!_rem?.[_remKey]) {
      const _all = await chrome.storage.local.get(null);
      const _backupKeys = Object.keys(_all).filter((k) => k.startsWith('pc_account_cache__'));
      if (_backupKeys.length) { try { await chrome.storage.local.remove(_backupKeys); } catch (_) {} }
      await clearLocalUserData(app);
      await chrome.storage.local.set({ [_remKey]: true });
      const _p={sessionId:'1e733c',hypothesisId:'A,B',location:'popup.init.js:remediation',message:'one-time remediation cleared mislabeled local data',data:{clearedBackups:_backupKeys.length,owner:currentUser.id},timestamp:Date.now()};
      console.warn('[PC-DEBUG-1e733c]',JSON.stringify(_p));
      fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e733c'},body:JSON.stringify(_p)}).catch(()=>{});
    }
  } catch (_) {}
  // #endregion

  await Promise.all([
    app.loadData(),
    app.loadSettings(),
    app.loadAiWorkflow(),
    app.loadUserProfile(),
    app.loadAnalysisHistory(),
    app.loadAiHistory(),
  ]);

  await purgeExpiredClipsOnStartup(app);

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
