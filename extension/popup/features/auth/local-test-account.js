import { AUTH_STORAGE_KEYS } from './auth.constants.js';
import { getDemoCategories, getDemoClips } from '../sync/sync.constants.js';
import { hideAuthModal } from './auth.events.js';

export const LOCAL_TEST_USER_ID = 'local-test-account-v1';

const BACKUP_KEYS = Object.freeze([
  'clips',
  'categories',
  'searchOnlyClips',
  'notes',
  'userProfile',
  'settings',
  AUTH_STORAGE_KEYS.SUPABASE_SESSION,
  'pc_subscription_cache_v1',
]);

const LOCAL_FREE_SUBSCRIPTION = Object.freeze({
  subscription_tier: 'free',
  subscription_status: 'active',
  has_unlimited_ai: false,
  ai_text_credits_limit: 100,
  ai_text_credits_used: 92,
  ai_image_credits_limit: 20,
  ai_image_credits_used: 18,
  ai_purchased_credits_balance: 0,
});

export async function isLocalTestAccountActive() {
  try {
    const res = await chrome.storage.local.get([
      AUTH_STORAGE_KEYS.LOCAL_TEST_ACCOUNT,
      AUTH_STORAGE_KEYS.FREEMIUM_TEST_SANDBOX,
    ]);
    return res?.[AUTH_STORAGE_KEYS.LOCAL_TEST_ACCOUNT] === true
      || res?.[AUTH_STORAGE_KEYS.FREEMIUM_TEST_SANDBOX] === true;
  } catch (_) {
    return false;
  }
}

async function _readBackupPayload() {
  const res = await chrome.storage.local.get([AUTH_STORAGE_KEYS.SANDBOX_BACKUP]);
  return res?.[AUTH_STORAGE_KEYS.SANDBOX_BACKUP] || null;
}

async function _backupCurrentLocalState() {
  const snapshot = await chrome.storage.local.get(BACKUP_KEYS);
  await chrome.storage.local.set({
    [AUTH_STORAGE_KEYS.SANDBOX_BACKUP]: {
      savedAt: Date.now(),
      data: snapshot,
    },
  });
}

async function _clearIndexedDbIfReady(app) {
  if (!app?.idb?.syncEntityFromLocalStorage) return;
  try {
    await app.idb.syncEntityFromLocalStorage('clips', []);
    await app.idb.syncEntityFromLocalStorage('categories', []);
    await app.idb.syncEntityFromLocalStorage('notes', []);
  } catch (_) {}
}

async function _writeDemoSeed() {
  const now = Date.now();
  const categories = getDemoCategories(now);
  const clips = getDemoClips(now);
  await chrome.storage.local.set({
    clips,
    categories,
    searchOnlyClips: [],
    notes: [],
  });
  return { clips, categories };
}

async function _signOutLocal() {
  try { await chrome.storage.local.remove([AUTH_STORAGE_KEYS.SUPABASE_SESSION]); } catch (_) {}
  try { pasteCraftSupabase?.signOutFast?.().catch(() => {}); } catch (_) {}
}

async function _seedLocalTestIdentity() {
  await chrome.storage.local.set({
    userProfile: {
      userName: 'Local Test',
      aiGeneratedName: 'CuriousQuokka',
    },
    [AUTH_STORAGE_KEYS.LOCAL_TEST_ACCOUNT]: true,
  });
  try {
    await pasteCraftSupabase?.setCachedSubscription?.(LOCAL_TEST_USER_ID, { ...LOCAL_FREE_SUBSCRIPTION });
  } catch (_) {}
}

/** One-click local freemium account: demo clips, free-tier credits, no cloud. */
export async function enterLocalTestAccount(app) {
  await _backupCurrentLocalState();
  await _signOutLocal();

  const { clips, categories } = await _writeDemoSeed();
  await _clearIndexedDbIfReady(app);

  if (app?._idbReady && app?.idb?.syncEntityFromLocalStorage) {
    try {
      await app.idb.syncEntityFromLocalStorage('clips', clips);
      await app.idb.syncEntityFromLocalStorage('categories', categories);
      await app.idb.syncEntityFromLocalStorage('notes', []);
    } catch (_) {}
  }

  await chrome.storage.local.remove([AUTH_STORAGE_KEYS.FREEMIUM_TEST_SANDBOX]);
  await _seedLocalTestIdentity();
  window.location.reload();
}

export async function exitLocalTestAccount() {
  const backup = await _readBackupPayload();
  const restore = backup?.data && typeof backup.data === 'object' ? backup.data : null;

  await chrome.storage.local.remove([
    AUTH_STORAGE_KEYS.FREEMIUM_GUEST,
    AUTH_STORAGE_KEYS.LOCAL_TEST_ACCOUNT,
    AUTH_STORAGE_KEYS.FREEMIUM_TEST_SANDBOX,
    AUTH_STORAGE_KEYS.SANDBOX_BACKUP,
  ]);

  if (restore) {
    await chrome.storage.local.set(restore);
  } else {
    await chrome.storage.local.remove(BACKUP_KEYS);
  }

  window.location.reload();
}

export function bindLocalTestAccountUi(app) {
  const enterBtn = document.getElementById('enterLocalTestAccountBtn');
  if (enterBtn && enterBtn.dataset.bound !== '1') {
    enterBtn.dataset.bound = '1';
    enterBtn.addEventListener('click', async () => {
      const ok = confirm(
        'Use local test account?\n\n'
        + '• Backs up and hides your real clips\n'
        + '• Loads demo clips + free-tier UI\n'
        + '• No sign-in, no Stripe, no cloud sync',
      );
      if (!ok) return;
      await enterLocalTestAccount(app);
    });
  }

  const exitBtn = document.getElementById('exitLocalTestAccountBtn');
  if (exitBtn && exitBtn.dataset.bound !== '1') {
    exitBtn.dataset.bound = '1';
    exitBtn.addEventListener('click', async () => {
      const ok = confirm('Exit local test account and restore your backed-up clips?');
      if (!ok) return;
      await exitLocalTestAccount();
    });
  }
}

export function applyLocalTestAccountBanner() {
  const banner = document.getElementById('localTestAccountBanner');
  if (!banner) return;
  isLocalTestAccountActive().then((active) => {
    banner.hidden = !active;
  }).catch(() => {
    banner.hidden = true;
  });
}

export async function initLocalTestAccountPopup(app) {
  try { pasteCraftSupabase._pauseSync = true; } catch (_) {}
  app._isLocalTestAccount = true;
  app.currentUser = { id: LOCAL_TEST_USER_ID, email: 'local@test.pastecraft' };

  try {
    app.userSubscription = await pasteCraftSupabase.getCachedSubscription(LOCAL_TEST_USER_ID);
  } catch (_) {
    app.userSubscription = { ...LOCAL_FREE_SUBSCRIPTION };
  }
  if (!app.userSubscription) {
    app.userSubscription = { ...LOCAL_FREE_SUBSCRIPTION };
  }

  app.updateAiCreditsPills('cached');
  app.updateUpgradeUI();

  document.getElementById('topBar').style.display = 'flex';
  await Promise.all([app.loadData(), app.loadSettings()]);
  app.updateTopBarIdentity();
  await app.setupEventListeners();
  bindLocalTestAccountUi(app);
  app.renderChips();
  app.updateLastCapture();
  app.updatePreview();
  app.renderCategories();
  app.updateCategoryFilter();
  app.hideLoadingOverlay();
  hideAuthModal(app);
  app.setupVisibilityListener();
  applyLocalTestAccountBanner();
  Promise.resolve().then(() => app.cleanupOldClips()).catch(() => {});
}
