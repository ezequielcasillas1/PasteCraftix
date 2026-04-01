// PasteCraft Settings Module
// Handles user preferences and settings

import { STORAGE_KEYS } from '../../shared/constants.js';
import { getStorageItems, setStorageItems } from '../../shared/storage-adapter.js';
import { toast } from '../components/toast.js';

const DEFAULT_SETTINGS = {
  autoDeletePeriod: 'never',
  theme: 'light',
  autoHide: true,
  showTimestamps: true,
  maxClipsDisplay: 20,
  delimiter: 'comma',
  customDelimiter: ', ',
  deduplicate: false,
  sort: false,
  uppercase: false,
  albumAttachmentOpenMode: 'popup'
};

const DEFAULT_WIDGET_SETTINGS = {
  appOpenMode: 'inPage',
  autoCopyEnabled: false,
  showCopyIndicator: true,
  persistOpen: true
};

/**
 * Load settings from storage
 * @returns {Promise<Object>}
 */
export async function loadSettings() {
  const result = await getStorageItems([STORAGE_KEYS.SETTINGS]);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

/**
 * Save settings to storage
 * @param {Object} settings
 */
export async function saveSettings(settings) {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await setStorageItems({ [STORAGE_KEYS.SETTINGS]: merged });
  return merged;
}

/**
 * Load widget settings
 * @returns {Promise<Object>}
 */
export async function loadWidgetSettings() {
  const result = await getStorageItems([STORAGE_KEYS.WIDGET_SETTINGS]);
  return { ...DEFAULT_WIDGET_SETTINGS, ...(result[STORAGE_KEYS.WIDGET_SETTINGS] || {}) };
}

/**
 * Save widget settings
 * @param {Object} settings
 */
export async function saveWidgetSettings(settings) {
  const current = await loadWidgetSettings();
  const merged = { ...current, ...settings };
  await setStorageItems({ [STORAGE_KEYS.WIDGET_SETTINGS]: merged });
  return merged;
}

/**
 * Get current theme
 * @returns {Promise<'light' | 'dark'>}
 */
export async function getTheme() {
  const settings = await loadSettings();
  return settings.theme || 'light';
}

/**
 * Set theme
 * @param {'light' | 'dark'} theme
 */
export async function setTheme(theme) {
  await saveSettings({ theme });
  applyTheme(theme);
}

/**
 * Apply theme to document
 * @param {'light' | 'dark'} theme
 */
export function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('dark-mode', isDark);
}

/**
 * Toggle theme between light and dark
 * @returns {Promise<string>} New theme
 */
export async function toggleTheme() {
  const current = await getTheme();
  const newTheme = current === 'dark' ? 'light' : 'dark';
  await setTheme(newTheme);
  return newTheme;
}

/**
 * Get app open mode preference
 * @returns {Promise<'inPage' | 'edgePopup'>}
 */
export async function getAppOpenMode() {
  const settings = await loadWidgetSettings();
  return settings.appOpenMode === 'edgePopup' ? 'edgePopup' : 'inPage';
}

/**
 * Set app open mode
 * @param {'inPage' | 'edgePopup'} mode
 */
export async function setAppOpenMode(mode) {
  await saveWidgetSettings({ appOpenMode: mode });
}

/**
 * Get auto-copy enabled status
 * @returns {Promise<boolean>}
 */
export async function isAutoCopyEnabled() {
  const settings = await loadWidgetSettings();
  return settings.autoCopyEnabled === true;
}

/**
 * Set auto-copy enabled
 * @param {boolean} enabled
 */
export async function setAutoCopyEnabled(enabled) {
  await saveWidgetSettings({ autoCopyEnabled: enabled });
}

/**
 * Get delimiter settings
 * @returns {Promise<{ type: string, custom: string }>}
 */
export async function getDelimiterSettings() {
  const settings = await loadSettings();
  return {
    type: settings.delimiter || 'comma',
    custom: settings.customDelimiter || ', '
  };
}

/**
 * Get actual delimiter string
 * @returns {Promise<string>}
 */
export async function getDelimiterString() {
  const { type, custom } = await getDelimiterSettings();
  
  switch (type) {
    case 'newline': return '\n';
    case 'tab': return '\t';
    case 'space': return ' ';
    case 'comma': return ', ';
    case 'semicolon': return '; ';
    case 'custom': return custom;
    default: return ', ';
  }
}

/**
 * Apply text processing options
 * @param {string} text - Input text
 * @param {Object} options
 * @param {boolean} options.deduplicate
 * @param {boolean} options.sort
 * @param {boolean} options.uppercase
 * @param {string} options.delimiter
 * @returns {string}
 */
export function processText(text, options = {}) {
  const { deduplicate, sort, uppercase, delimiter = '\n' } = options;
  
  let lines = String(text).split(delimiter);
  
  if (deduplicate) {
    lines = [...new Set(lines)];
  }
  
  if (sort) {
    lines.sort((a, b) => a.localeCompare(b));
  }
  
  if (uppercase) {
    lines = lines.map(l => l.toUpperCase());
  }
  
  return lines.join(delimiter);
}

/**
 * Export settings as JSON
 * @returns {Promise<string>}
 */
export async function exportSettings() {
  const [settings, widgetSettings] = await Promise.all([
    loadSettings(),
    loadWidgetSettings()
  ]);
  
  return JSON.stringify({ settings, widgetSettings }, null, 2);
}

/**
 * Import settings from JSON
 * @param {string} json
 * @returns {Promise<boolean>}
 */
export async function importSettings(json) {
  try {
    const data = JSON.parse(json);
    
    if (data.settings) {
      await saveSettings(data.settings);
    }
    if (data.widgetSettings) {
      await saveWidgetSettings(data.widgetSettings);
    }
    
    toast.success('Settings imported');
    return true;
  } catch (err) {
    toast.error('Invalid settings file');
    return false;
  }
}

/**
 * Reset settings to defaults
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  await setStorageItems({
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.WIDGET_SETTINGS]: DEFAULT_WIDGET_SETTINGS
  });
  applyTheme(DEFAULT_SETTINGS.theme);
  toast.success('Settings reset to defaults');
}

export { DEFAULT_SETTINGS, DEFAULT_WIDGET_SETTINGS };
