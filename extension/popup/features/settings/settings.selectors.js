import { SETTINGS_ELEMENT_IDS } from './settings.constants.js';

export function getSettingsModal() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.MODAL);
}

export function getHelpModal() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.HELP_MODAL);
}

export function getAutoDeletePeriodEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.AUTO_DELETE);
}

export function getDarkModeToggleEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.DARK_MODE);
}

export function getProfileDarkModeToggleEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.PROFILE_DARK_MODE);
}

export function getWidgetIconProfileToggleEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.WIDGET_ICON_PROFILE);
}

export function getQuickPasteAutoHideEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.QUICK_PASTE_AUTO_HIDE);
}

export function getQuickPasteShowTimestampsEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.QUICK_PASTE_TIMESTAMPS);
}

export function getQuickPasteMaxClipsEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.QUICK_PASTE_MAX_CLIPS);
}

export function getActivityOneClickCopyToggleEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.ACTIVITY_ONE_CLICK_COPY);
}

export function getAlbumAttachmentModeEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.ALBUM_MODE);
}

export function getRememberUiLocationToggleEl() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.REMEMBER_UI_LOCATION);
}

export function getRestoreWindowSelect() {
  return document.getElementById(SETTINGS_ELEMENT_IDS.RESTORE_WINDOW);
}
