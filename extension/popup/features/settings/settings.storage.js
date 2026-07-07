import {
  SETTINGS_STORAGE_KEYS,
  SETTINGS_SYNC_KEYS,
  SETTINGS_DEFAULTS,
  AUTO_DELETE_PERIODS,
  BROADCAST_CHANNEL_NAME,
} from './settings.constants.js';
import {
  getAutoDeletePeriodEl,
  getActivityOneClickCopyToggleEl,
  getDarkModeToggleEl,
  getQuickPasteAutoHideEl,
  getQuickPasteShowTimestampsEl,
  getQuickPasteMaxClipsEl,
  getAlbumAttachmentModeEl,
} from './settings.selectors.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function _stripThemeKey(obj) {
  if (obj && typeof obj === 'object') delete obj.theme;
}

function _normalizeTheme(raw) {
  return raw === 'dark' ? 'dark' : 'light';
}

function _normalizeAlbumMode(raw) {
  return raw === 'overlay' || raw === 'edgePopup' ? raw : 'overlay';
}

function _buildQuickPasteDefaults(override = {}) {
  return { ...SETTINGS_DEFAULTS.quickPasteSettings, ...override };
}

function _syncOneClickCopyToggle(app) {
  const oneClickCopyEl = getActivityOneClickCopyToggleEl();
  if (oneClickCopyEl) oneClickCopyEl.checked = !!app.quickPasteSettings?.oneClickCopy;
}

// ── Merge: pick freshest source between sync, local, cloud ───────────────────

function _applySource(app, source, fallbackLocal) {
  app.autoDeletePeriod = source.autoDeletePeriod || fallbackLocal.autoDeletePeriod || SETTINGS_DEFAULTS.autoDeletePeriod;
  app.theme = _normalizeTheme(source.theme || source.quickPasteSettings?.theme || fallbackLocal.theme);
  app.quickPasteSettings = _buildQuickPasteDefaults({ ...fallbackLocal.quickPasteSettings, ...source.quickPasteSettings });
  _stripThemeKey(app.quickPasteSettings);
  app.albumAttachmentOpenMode = _normalizeAlbumMode(source.albumAttachmentOpenMode || fallbackLocal.albumAttachmentOpenMode);
  app.settingsUpdatedAt = source.settingsUpdatedAt || fallbackLocal.settingsUpdatedAt || Date.now();
}

// ── loadSettings ─────────────────────────────────────────────────────────────

export async function loadSettings(app) {
  const cloudSettings = await _fetchCloudSettings();
  const { syncData, localData } = await _fetchLocalAndSyncSettings();
  const local = _extractLocalValues(localData);

  _applyBestSource(app, syncData, local, cloudSettings);
  if (app.darkModeComingSoon) app.theme = 'light';

  await _persistMergedSettingsLocal(app);
  syncThemeToggles(app);
  _syncOneClickCopyToggle(app);
}

function _hasPayload(data) {
  return !!(data.autoDeletePeriod || data.quickPasteSettings || data.albumAttachmentOpenMode || data.theme);
}

function _ts(data) {
  return typeof data.settingsUpdatedAt === 'number' ? data.settingsUpdatedAt : 0;
}

function _applyBestSource(app, syncData, local, cloudSettings) {
  const syncTs = _ts(syncData);
  const localTs = _ts(local);
  if (_hasPayload(syncData) && syncTs >= localTs) return _applySource(app, syncData, local);
  if (_hasPayload(local) && localTs > syncTs) return _applySource(app, local, local);
  if (cloudSettings) return _applySource(app, cloudSettings, local);
  return _applySource(app, local, local);
}

async function _fetchCloudSettings() {
  try {
    return await Promise.race([
      pasteCraftSupabase.syncSettingsFromSupabase(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
  } catch (_) {
    return null;
  }
}

async function _fetchLocalAndSyncSettings() {
  let syncData = {};
  try {
    syncData = await PasteCraftAsyncUtils.withTimeout(
      new Promise((resolve) => chrome.storage.sync.get(SETTINGS_SYNC_KEYS, resolve)),
      { ms: 1500, fallback: {} },
    );
  } catch (_) {}
  const localData = await chrome.storage.local.get(SETTINGS_SYNC_KEYS);
  return { syncData, localData };
}

function _extractLocalValues(localData) {
  return {
    autoDeletePeriod: localData.autoDeletePeriod || SETTINGS_DEFAULTS.autoDeletePeriod,
    quickPasteSettings: localData.quickPasteSettings || {},
    albumAttachmentOpenMode: localData.albumAttachmentOpenMode || SETTINGS_DEFAULTS.albumAttachmentOpenMode,
    theme: localData.theme || SETTINGS_DEFAULTS.theme,
    settingsUpdatedAt: typeof localData.settingsUpdatedAt === 'number' ? localData.settingsUpdatedAt : 0,
  };
}

async function _persistMergedSettingsLocal(app) {
  try {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD]: app.autoDeletePeriod,
      [SETTINGS_STORAGE_KEYS.QUICK_PASTE]: app.quickPasteSettings,
      [SETTINGS_STORAGE_KEYS.ALBUM_MODE]: app.albumAttachmentOpenMode,
      [SETTINGS_STORAGE_KEYS.THEME]: app.theme,
      [SETTINGS_STORAGE_KEYS.UPDATED_AT]: app.settingsUpdatedAt || Date.now(),
    });
  } catch (_) {}
}

// ── saveSettings ─────────────────────────────────────────────────────────────

function _buildSettingsState(app) {
  return {
    autoDeletePeriod: app.autoDeletePeriod,
    theme: app.theme,
    quickPasteSettings: JSON.parse(JSON.stringify(app.quickPasteSettings || SETTINGS_DEFAULTS.quickPasteSettings)),
    albumAttachmentOpenMode: app.albumAttachmentOpenMode,
    settingsUpdatedAt: app.settingsUpdatedAt || 0,
  };
}

function _applySettingsStateToApp(app, state) {
  app.autoDeletePeriod = state.autoDeletePeriod;
  app.theme = _normalizeTheme(state.theme);
  app.quickPasteSettings = _buildQuickPasteDefaults(state.quickPasteSettings || {});
  _stripThemeKey(app.quickPasteSettings);
  app.albumAttachmentOpenMode = _normalizeAlbumMode(state.albumAttachmentOpenMode);
  app.settingsUpdatedAt = state.settingsUpdatedAt || Date.now();
}

function _buildSettingsStoragePayload(state) {
  return {
    [SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD]: state.autoDeletePeriod,
    [SETTINGS_STORAGE_KEYS.THEME]: state.theme,
    [SETTINGS_STORAGE_KEYS.QUICK_PASTE]: state.quickPasteSettings,
    [SETTINGS_STORAGE_KEYS.ALBUM_MODE]: state.albumAttachmentOpenMode,
    [SETTINGS_STORAGE_KEYS.UPDATED_AT]: state.settingsUpdatedAt,
  };
}

async function _persistSettingsLocalState(state) {
  await chrome.storage.local.set(_buildSettingsStoragePayload(state));
}

async function _persistSettingsSyncState(state) {
  try {
    await new Promise((resolve) => chrome.storage.sync.set(_buildSettingsStoragePayload(state), resolve));
  } catch (_) {}
}

async function _verifySettingsState(state) {
  const v = await chrome.storage.local.get([
    SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD,
    SETTINGS_STORAGE_KEYS.THEME,
    SETTINGS_STORAGE_KEYS.UPDATED_AT,
  ]);
  return (
    v[SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD] === state.autoDeletePeriod &&
    v[SETTINGS_STORAGE_KEYS.THEME] === state.theme &&
    v[SETTINGS_STORAGE_KEYS.UPDATED_AT] === state.settingsUpdatedAt
  );
}

function _buildSettingsSyncPayload(state) {
  return {
    autoDeletePeriod: state.autoDeletePeriod,
    theme: state.theme,
    quickPasteSettings: state.quickPasteSettings,
    albumAttachmentOpenMode: state.albumAttachmentOpenMode,
  };
}

async function _runSettingsBackgroundSync(app, state, silent, skipAuthPrefs) {
  await _persistSettingsSyncState(state);

  if (!skipAuthPrefs) {
    try { await app.clearLegacyAuthPrefs(); } catch (_) {}
  }

  const settingsData = _buildSettingsSyncPayload(state);
  try {
    await pasteCraftSupabase.syncSettingsToSupabase(settingsData);
  } catch (_) {}

  _trySendBroadcast(app, settingsData);
  _notifyContentScripts(app);
  app.cleanupOldClips().catch(() => {});
  if (!silent) app.showToast('✅ Settings saved!', 'success');
}

export async function saveSettings(app, silent = false, _skipAuthPrefs = false) {
  const validated = _readAndValidateFromUI();

  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => _buildSettingsState(app),
    stateSetter: async (newState) => {
      _applySettingsStateToApp(app, newState);
      syncThemeToggles(app);
    },
    stateKeys: ['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode', 'settingsUpdatedAt'],
    validator: () => ({ valid: true }),
    mutateState: async (state) => {
      state.autoDeletePeriod = validated.autoDeletePeriod;
      state.theme = validated.theme;
      state.quickPasteSettings = _buildQuickPasteDefaults({
        ...state.quickPasteSettings,
        autoHide: validated.autoHide,
        showTimestamps: validated.showTimestamps,
        maxClipsDisplay: validated.maxClipsDisplay,
      });
      _stripThemeKey(state.quickPasteSettings);
      state.albumAttachmentOpenMode = validated.albumAttachmentOpenMode;
      state.settingsUpdatedAt = Date.now();
      return { settingsUpdatedAt: state.settingsUpdatedAt };
    },
    storageKeys: ['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode', 'settingsUpdatedAt'],
    buildStorageData: async (state) => _buildSettingsStoragePayload(state),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async (_meta, state) => _verifySettingsState(state),
    uiUpdater: () => {
      _syncOneClickCopyToggle(app);
      app.renderChips();
      app.updateCategoryFilter();
    },
    backgroundSync: async (_meta, state) => {
      await _runSettingsBackgroundSync(app, state, silent, _skipAuthPrefs);
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to save settings: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (msg) app.showToast(msg, type);
    },
  });

  if (!result.success) {
    if (!silent) app.showToast(`❌ Failed to save settings: ${result.error || 'Unknown error'}`, 'error');
    return false;
  }

  if (!silent) app.hideSettingsModal();
  return true;
}

export async function saveQuickPasteSettingsPatch(app, patch = {}, silent = true, skipAuthPrefs = true) {
  const sanitizedPatch = patch && typeof patch === 'object' ? patch : {};
  const result = await window.PasteCraftCRUD.saveOperation({
    stateGetter: () => _buildSettingsState(app),
    stateSetter: async (newState) => {
      _applySettingsStateToApp(app, newState);
      syncThemeToggles(app);
      _syncOneClickCopyToggle(app);
    },
    stateKeys: ['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode', 'settingsUpdatedAt'],
    validator: () => ({ valid: true }),
    mutateState: async (state) => {
      state.quickPasteSettings = _buildQuickPasteDefaults({
        ...state.quickPasteSettings,
        ...sanitizedPatch,
      });
      _stripThemeKey(state.quickPasteSettings);
      state.settingsUpdatedAt = Date.now();
      return { settingsUpdatedAt: state.settingsUpdatedAt };
    },
    storageKeys: ['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode', 'settingsUpdatedAt'],
    buildStorageData: async (state) => _buildSettingsStoragePayload(state),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async (_meta, state) => _verifySettingsState(state),
    uiUpdater: () => {
      _syncOneClickCopyToggle(app);
      app.renderChips();
      app.updateCategoryFilter();
    },
    backgroundSync: async (_meta, state) => {
      await _runSettingsBackgroundSync(app, state, silent, skipAuthPrefs);
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to save quick paste settings: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (msg && !silent) app.showToast(msg, type);
    },
  });

  if (!result.success) {
    if (!silent) app.showToast(`❌ Failed to save quick paste settings: ${result.error || 'Unknown error'}`, 'error');
    return false;
  }

  return true;
}

function _getRequiredEls() {
  const darkModeEl = getDarkModeToggleEl();
  const autoHideEl = getQuickPasteAutoHideEl();
  const showTimestampsEl = getQuickPasteShowTimestampsEl();
  const maxClipsEl = getQuickPasteMaxClipsEl();
  if (!darkModeEl || !autoHideEl || !showTimestampsEl || !maxClipsEl) {
    throw new Error('Settings UI elements not found');
  }
  return { darkModeEl, autoHideEl, showTimestampsEl, maxClipsEl };
}

function _resolveAlbumMode() {
  const el = getAlbumAttachmentModeEl();
  return (el && (el.value === 'overlay' || el.value === 'edgePopup')) ? el.value : 'edgePopup';
}

function _readAndValidateFromUI() {
  const autoDeletePeriod = getAutoDeletePeriodEl()?.value;
  if (!autoDeletePeriod) throw new Error('Invalid auto-delete period');

  const { darkModeEl, autoHideEl, showTimestampsEl, maxClipsEl } = _getRequiredEls();

  return {
    autoDeletePeriod,
    theme: darkModeEl.checked ? 'dark' : 'light',
    autoHide: autoHideEl.checked,
    showTimestamps: showTimestampsEl.checked,
    maxClipsDisplay: parseInt(maxClipsEl.value) || 20,
    albumAttachmentOpenMode: _resolveAlbumMode(),
  };
}

function _applyValidatedToApp(app, validated) {
  app.autoDeletePeriod = validated.autoDeletePeriod;
  app.theme = validated.theme;
  app.quickPasteSettings.autoHide = validated.autoHide;
  app.quickPasteSettings.showTimestamps = validated.showTimestamps;
  app.quickPasteSettings.maxClipsDisplay = validated.maxClipsDisplay;
  _stripThemeKey(app.quickPasteSettings);
  app.albumAttachmentOpenMode = validated.albumAttachmentOpenMode;
}

async function _persistSaveLocal(app, settingsUpdatedAt) {
  await chrome.storage.local.set({
    [SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD]: app.autoDeletePeriod,
    [SETTINGS_STORAGE_KEYS.THEME]: app.theme,
    [SETTINGS_STORAGE_KEYS.QUICK_PASTE]: app.quickPasteSettings,
    [SETTINGS_STORAGE_KEYS.ALBUM_MODE]: app.albumAttachmentOpenMode,
    [SETTINGS_STORAGE_KEYS.UPDATED_AT]: settingsUpdatedAt,
  });
}

async function _persistSaveSync(app, settingsUpdatedAt) {
  try {
    await new Promise((resolve) => chrome.storage.sync.set({
      [SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD]: app.autoDeletePeriod,
      [SETTINGS_STORAGE_KEYS.THEME]: app.theme,
      [SETTINGS_STORAGE_KEYS.QUICK_PASTE]: app.quickPasteSettings,
      [SETTINGS_STORAGE_KEYS.ALBUM_MODE]: app.albumAttachmentOpenMode,
      [SETTINGS_STORAGE_KEYS.UPDATED_AT]: settingsUpdatedAt,
    }, resolve));
  } catch (_) {}
}

async function _verifySave(app) {
  const v = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD, SETTINGS_STORAGE_KEYS.THEME]);
  if (v[SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD] !== app.autoDeletePeriod || v[SETTINGS_STORAGE_KEYS.THEME] !== app.theme) {
    throw new Error('Verification failed: settings not persisted correctly');
  }
}

function _broadcastAndCloudSync(app, silent) {
  const settingsData = {
    autoDeletePeriod: app.autoDeletePeriod,
    theme: app.theme,
    quickPasteSettings: app.quickPasteSettings,
    albumAttachmentOpenMode: app.albumAttachmentOpenMode,
  };

  pasteCraftSupabase.syncSettingsToSupabase(settingsData)
    .then(() => {
      _trySendBroadcast(app, settingsData);
      if (!silent) app.showToast('✅ Settings saved and synced!');
    })
    .catch(() => {
      _trySendBroadcast(app, settingsData);
      if (!silent) app.showToast('✅ Settings saved locally');
    });
}

function _trySendBroadcast(app, settingsData) {
  try {
    app._broadcastChannel?.postMessage({ type: 'settingsUpdated', settings: settingsData, timestamp: Date.now() });
  } catch (_) {}
}

function _notifyContentScripts(app) {
  try {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: { ...app.quickPasteSettings, theme: app.theme },
        }).catch(() => {});
      });
    });
  } catch (_) {}
}

// ── syncThemeToggles ──────────────────────────────────────────────────────────

export function syncThemeToggles(app) {
  app._themeSyncing = true;
  try {
    const isDark = app.theme === 'dark';
    const settingsToggle = getDarkModeToggleEl();
    const profileToggle = document.getElementById('profileDarkModeToggle');
    if (settingsToggle) settingsToggle.checked = isDark;
    if (profileToggle) profileToggle.checked = isDark;
  } finally {
    app._themeSyncing = false;
  }
}

// ── saveThemeOnly ─────────────────────────────────────────────────────────────

export async function saveThemeOnly(app, nextTheme, silent = false) {
  const normalized = _normalizeTheme(nextTheme);
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => _buildSettingsState(app),
    stateSetter: async (newState) => {
      _applySettingsStateToApp(app, newState);
      syncThemeToggles(app);
    },
    stateKeys: ['autoDeletePeriod', 'theme', 'quickPasteSettings', 'albumAttachmentOpenMode', 'settingsUpdatedAt'],
    validator: () => ({ valid: true }),
    mutateState: async (state) => {
      state.theme = normalized;
      state.settingsUpdatedAt = Date.now();
    },
    storageKeys: ['theme', 'settingsUpdatedAt'],
    buildStorageData: async (state) => ({
      [SETTINGS_STORAGE_KEYS.THEME]: state.theme,
      [SETTINGS_STORAGE_KEYS.UPDATED_AT]: state.settingsUpdatedAt,
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async (_meta, state) => {
      const v = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.THEME, SETTINGS_STORAGE_KEYS.UPDATED_AT]);
      return (
        v[SETTINGS_STORAGE_KEYS.THEME] === state.theme &&
        v[SETTINGS_STORAGE_KEYS.UPDATED_AT] === state.settingsUpdatedAt
      );
    },
    backgroundSync: async (_meta, state) => {
      await _persistSettingsSyncState(state);
      try { await pasteCraftSupabase.syncSettingsToSupabase(_buildSettingsSyncPayload(state)); } catch (_) {}
      _trySendBroadcast(app, _buildSettingsSyncPayload(state));
      _notifyContentScripts(app);
    },
    successMessage: () => '',
    errorMessage: (error) => `Theme update failed: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (msg) app.showToast(msg, type);
    },
  });

  if (!result.success) {
    if (!silent) app.showToast(`❌ Theme update failed: ${result.error || 'Unknown error'}`, 'error');
    return false;
  }

  if (!silent) app.showToast('✅ Theme updated!', 'success');
  return true;
}

// ── saveWidgetIconUseProfileImage ─────────────────────────────────────────────

export async function saveWidgetIconUseProfileImage(app, enabled, silent = false) {
  const snapshot = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.WIDGET]);
  const prev = (snapshot?.widgetSettings && typeof snapshot.widgetSettings === 'object') ? snapshot.widgetSettings : {};
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      widgetSettings: JSON.parse(JSON.stringify(prev)),
    }),
    stateSetter: async () => {},
    stateKeys: ['widgetSettings'],
    validator: () => ({ valid: true }),
    mutateState: async (state) => {
      state.widgetSettings = {
        ...state.widgetSettings,
        widgetIconUseProfileImage: !!enabled,
      };
    },
    storageKeys: ['widgetSettings'],
    buildStorageData: async (state) => ({
      [SETTINGS_STORAGE_KEYS.WIDGET]: state.widgetSettings,
      pc_local_updatedAt: Date.now(),
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async (_meta, state) => {
      const v = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.WIDGET]);
      return !!v.widgetSettings && v.widgetSettings.widgetIconUseProfileImage === state.widgetSettings.widgetIconUseProfileImage;
    },
    backgroundSync: async (_meta, state) => {
      try { await new Promise((resolve) => chrome.storage.sync.set({ [SETTINGS_STORAGE_KEYS.WIDGET]: state.widgetSettings }, resolve)); } catch (_) {}
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'widgetSettingsUpdated',
              widgetSettings: { widgetIconUseProfileImage: !!state.widgetSettings.widgetIconUseProfileImage },
            }).catch(() => {});
          });
        });
      } catch (_) {}
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to save: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (msg) app.showToast(msg, type);
    },
  });

  if (!result.success) {
    if (!silent) app.showToast(`❌ Failed to save: ${result.error || 'Unknown error'}`, 'error');
    return false;
  }

  if (!silent) app.showToast('✅ Widget icon preference saved');
  return true;
}

// ── cleanupOldClips / getCutoffTime ──────────────────────────────────────────

export function getCutoffTime(period) {
  const ms = AUTO_DELETE_PERIODS[period] || 0;
  return Date.now() - ms;
}

export async function cleanupOldClips(app) {
  if (app.autoDeletePeriod === 'never') return;
  const cutoff = getCutoffTime(app.autoDeletePeriod);
  const toDelete = (Array.isArray(app.clips) ? app.clips : [])
    .filter((clip) => clip?.category === 'Uncategorized' && clip.timestamp < cutoff)
    .map((clip) => app._clipIdKey(clip?.id))
    .filter(Boolean);

  if (toDelete.length > 0) {
    await app.deleteClipsByIdKeys(toDelete, { includeArchived: false, reason: 'auto-delete:uncategorized', clearSelection: false, rerender: true });
  }
}

// ── getCurrentProfileImageForWidget ──────────────────────────────────────────

async function _ensureUserProfile(app) {
  if (!app.userProfile) {
    try {
      const res = await chrome.storage.local.get(['userProfile']);
      app.userProfile = res?.userProfile ?? null;
    } catch (_) {}
  }
}

function _resolveProfileImageUrl(profile) {
  const url = typeof profile?.profileImageUrl === 'string' ? profile.profileImageUrl : '';
  if (url) return url;
  const b64 = typeof profile?.profileImageBase64 === 'string' ? profile.profileImageBase64 : '';
  return (b64 && b64.startsWith('data:image/') && b64.length <= 250000) ? b64 : '';
}

export async function getCurrentProfileImageForWidget(app) {
  await _ensureUserProfile(app);
  return _resolveProfileImageUrl(app.userProfile);
}

// ── BroadcastChannel init ─────────────────────────────────────────────────────

export function initSettingsBroadcastChannel(app) {
  try {
    app._broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    app._broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'settingsUpdated') {
        loadSettings(app).then(async () => {
          const modal = document.getElementById('settingsModal');
          if (modal && modal.style.display === 'flex') await app.showSettingsModal();
        }).catch(() => {});
      }
    };
  } catch (error) {
    console.warn('⚠️ BroadcastChannel not available:', error);
    app._broadcastChannel = null;
  }
}
