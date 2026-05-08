import {
  SETTINGS_STORAGE_KEYS,
  SETTINGS_SYNC_KEYS,
  SETTINGS_DEFAULTS,
  AUTO_DELETE_PERIODS,
  BROADCAST_CHANNEL_NAME,
} from './settings.constants.js';
import {
  getAutoDeletePeriodEl,
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
    syncData = await new Promise((resolve) => chrome.storage.sync.get(SETTINGS_SYNC_KEYS, resolve));
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

export async function saveSettings(app, silent = false, _skipAuthPrefs = false) {
  const snapshot = _snapshotSettings(app);
  const rollback = () => _rollbackSettings(app, snapshot);

  try {
    const validated = _readAndValidateFromUI();
    _applyValidatedToApp(app, validated);

    const settingsUpdatedAt = Date.now();
    app.settingsUpdatedAt = settingsUpdatedAt;

    await _persistSaveLocal(app, settingsUpdatedAt);
    await _persistSaveSync(app, settingsUpdatedAt);
    await _verifySave(app);
    _broadcastAndCloudSync(app, silent);

    if (!_skipAuthPrefs) {
      try { await app.clearLegacyAuthPrefs(); } catch (_) {}
    }

    if (!silent) {
      app.showToast('✅ Settings saved!');
      app.hideSettingsModal();
    }

    app.renderChips();
    app.updateCategoryFilter();
    app.cleanupOldClips().catch(() => {});
    _notifyContentScripts(app);
  } catch (error) {
    console.error('❌ Settings save failed, rolling back:', error);
    await rollback();
    if (!silent) app.showToast(`❌ Failed to save settings: ${error.message || 'Unknown error'}`, 'error');
  }
}

function _snapshotSettings(app) {
  return {
    autoDeletePeriod: app.autoDeletePeriod,
    theme: app.theme,
    quickPasteSettings: JSON.parse(JSON.stringify(app.quickPasteSettings)),
    albumAttachmentOpenMode: app.albumAttachmentOpenMode,
  };
}

async function _rollbackSettings(app, snapshot) {
  try {
    app.autoDeletePeriod = snapshot.autoDeletePeriod;
    app.theme = snapshot.theme;
    app.quickPasteSettings = snapshot.quickPasteSettings;
    app.albumAttachmentOpenMode = snapshot.albumAttachmentOpenMode;
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEYS.AUTO_DELETE_PERIOD]: app.autoDeletePeriod,
      [SETTINGS_STORAGE_KEYS.THEME]: app.theme,
      [SETTINGS_STORAGE_KEYS.QUICK_PASTE]: app.quickPasteSettings,
      [SETTINGS_STORAGE_KEYS.ALBUM_MODE]: app.albumAttachmentOpenMode,
    });
  } catch (e) {
    console.error('❌ Settings rollback failed:', e);
  }
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
  const prev = app.theme;
  app.theme = normalized;
  syncThemeToggles(app);

  try {
    const settingsUpdatedAt = Date.now();
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEYS.THEME]: app.theme, [SETTINGS_STORAGE_KEYS.UPDATED_AT]: settingsUpdatedAt });
    try {
      await new Promise((resolve) => chrome.storage.sync.set({ [SETTINGS_STORAGE_KEYS.THEME]: app.theme, [SETTINGS_STORAGE_KEYS.UPDATED_AT]: settingsUpdatedAt }, resolve));
    } catch (_) {}

    const v = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.THEME]);
    if (v[SETTINGS_STORAGE_KEYS.THEME] !== app.theme) throw new Error('Verification failed: theme not persisted correctly');

    const settingsData = {
      autoDeletePeriod: app.autoDeletePeriod,
      theme: app.theme,
      quickPasteSettings: app.quickPasteSettings,
      albumAttachmentOpenMode: app.albumAttachmentOpenMode,
    };
    pasteCraftSupabase.syncSettingsToSupabase(settingsData).catch(() => {});
    _notifyContentScripts(app);

    if (!silent) app.showToast('✅ Theme updated!', 'success');
    return true;
  } catch (e) {
    app.theme = prev;
    syncThemeToggles(app);
    if (!silent) app.showToast(`❌ Theme update failed: ${e.message}`, 'error');
    return false;
  }
}

// ── saveWidgetIconUseProfileImage ─────────────────────────────────────────────

export async function saveWidgetIconUseProfileImage(app, enabled, silent = false) {
  const snapshot = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.WIDGET]);
  const prev = (snapshot?.widgetSettings && typeof snapshot.widgetSettings === 'object') ? snapshot.widgetSettings : {};

  try {
    const nextEnabled = !!enabled;
    const next = { ...prev, widgetIconUseProfileImage: nextEnabled };

    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEYS.WIDGET]: next, pc_local_updatedAt: Date.now() });
    try { await new Promise((resolve) => chrome.storage.sync.set({ [SETTINGS_STORAGE_KEYS.WIDGET]: next }, resolve)); } catch (_) {}

    const v = await chrome.storage.local.get([SETTINGS_STORAGE_KEYS.WIDGET]);
    if (!v.widgetSettings || v.widgetSettings.widgetIconUseProfileImage !== nextEnabled) {
      throw new Error('Verification failed: widget icon preference not persisted');
    }

    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'widgetSettingsUpdated',
            widgetSettings: { widgetIconUseProfileImage: nextEnabled },
          }).catch(() => {});
        });
      });
    } catch (_) {}

    if (!silent) app.showToast('✅ Widget icon preference saved');
    return true;
  } catch (e) {
    console.error('❌ Failed to save widget icon preference:', e);
    try { await chrome.storage.local.set({ [SETTINGS_STORAGE_KEYS.WIDGET]: prev }); } catch (_) {}
    if (!silent) app.showToast(`❌ Failed to save: ${e.message || 'Unknown error'}`, 'error');
    return false;
  }
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
