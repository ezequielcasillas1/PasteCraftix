/** @forward-slice Persist popup navigation / overlay stack across reopen. */

export const UI_LOCATION_STORAGE_KEY = 'pc_uiLocation_v1';

export const UI_LOCATION_VERSION = 1;

export const UI_LOCATION_DEBOUNCE_MS = 150;

export const UI_LOCATION_DRAFT_MAX_CHARS = 100_000;

export const UI_LOCATION_KINDS = Object.freeze({
  NOTE_VIEWER: 'noteViewer',
  NOTE_EDITOR: 'noteEditor',
  ALBUM_ATTACHMENT: 'albumAttachment',
  CLIP_VIEWER: 'clipViewer',
  SETTINGS: 'settings',
});
