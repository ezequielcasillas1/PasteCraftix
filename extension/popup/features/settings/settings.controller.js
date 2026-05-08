import {
  loadSettings,
  saveSettings,
  saveThemeOnly,
  saveWidgetIconUseProfileImage,
  syncThemeToggles,
  cleanupOldClips,
  getCutoffTime,
  getCurrentProfileImageForWidget,
  initSettingsBroadcastChannel,
} from './settings.storage.js';
import {
  showSettingsModal,
  hideSettingsModal,
  showHelpModal,
  hideHelpModal,
  updateStorageStats,
} from './settings.render.js';
import { initSettingsEvents } from './settings.events.js';
import {
  exportBackupToJson,
  exportClipsToCsv,
  importBackupFromJsonMerge,
} from './settings.backup.js';

export function initSettingsFeature(app) {
  try {
    initSettingsBroadcastChannel(app);
  } catch (e) {
    console.error('[Settings] BroadcastChannel init failed:', e);
  }

  return {
    storage: {
      loadSettings: () => loadSettings(app),
      saveSettings: (silent, skipAuthPrefs) => saveSettings(app, silent, skipAuthPrefs),
      saveThemeOnly: (theme, silent) => saveThemeOnly(app, theme, silent),
      saveWidgetIconUseProfileImage: (enabled, silent) => saveWidgetIconUseProfileImage(app, enabled, silent),
      syncThemeToggles: () => syncThemeToggles(app),
      cleanupOldClips: () => cleanupOldClips(app),
      getCutoffTime: (period) => getCutoffTime(period),
      getCurrentProfileImageForWidget: () => getCurrentProfileImageForWidget(app),
    },
    render: {
      showSettingsModal: () => showSettingsModal(app),
      hideSettingsModal: () => hideSettingsModal(),
      showHelpModal: () => showHelpModal(),
      hideHelpModal: () => hideHelpModal(),
      updateStorageStats: () => updateStorageStats(app),
    },
    events: {
      initSettingsEvents: () => initSettingsEvents(app),
    },
    backup: {
      exportBackupToJson: () => exportBackupToJson(app),
      exportClipsToCsv: () => exportClipsToCsv(app),
      importBackupFromJsonMerge: (file) => importBackupFromJsonMerge(app, file),
    },
  };
}
