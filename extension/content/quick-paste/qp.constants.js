/** @forward-slice — Quick Paste storage keys, DOM ids/classes, defaults (no behavior). */

export const QP_STORAGE_KEYS = Object.freeze({
  CLIPS: 'clips',
  ARCHIVED: 'searchOnlyClips',
  UPDATED_AT: 'pc_local_updatedAt',
  SETTINGS: 'quickPasteSettings',
  POSITION: 'quickPastePosition',
  THEME: 'theme',
});

/** Keys loaded together in loadSettings(). */
export const QP_SETTINGS_LOAD_KEYS = Object.freeze([
  QP_STORAGE_KEYS.SETTINGS,
  QP_STORAGE_KEYS.POSITION,
  QP_STORAGE_KEYS.THEME,
]);

export const QP_DEFAULT_SETTINGS = Object.freeze({
  theme: 'light',
  autoHide: true,
  showTimestamps: true,
  maxClipsDisplay: 20,
  delimiter: 'comma',
  customDelimiter: ', ',
  persistOpen: true,
  options: Object.freeze({
    deduplicate: false,
    sort: false,
    uppercase: false,
  }),
});

export const QP_DEFAULT_POSITION = Object.freeze({
  x: 0,
  y: null,
});

export const QP_HOST = Object.freeze({
  SHADOW_HOST_ID: 'pc-quick-paste-host',
  ROOT_CLASS: 'pastecraft-quick-paste',
  ROOT_FIELD: 'pastecraft-quick-paste',
  STYLE_FIELD: 'pastecraft-quick-paste-styles',
  INTERFACE_CLASS: 'pastecraft-interface',
});

export const QP_CLASSES = Object.freeze({
  HEADER: 'pastecraft-header',
  LOGO: 'pastecraft-logo',
  CONTROLS: 'pastecraft-controls',
  BTN: 'pastecraft-btn',
  SETTINGS: 'pastecraft-settings',
  CLOSE: 'pastecraft-close',
  CONTENT: 'pastecraft-content',
  CLIPS_CONTAINER: 'pastecraft-clips-container',
  FOOTER: 'pastecraft-footer',
  REFRESH: 'pastecraft-refresh',
  COUNT: 'pastecraft-count',
  COPY_MULTIPLE: 'pastecraft-copy-multiple',
  EMPTY: 'pastecraft-empty',
  EMPTY_ICON: 'pastecraft-empty-icon',
  CLIP: 'pastecraft-clip',
  CLIP_CONTENT: 'pastecraft-clip-content',
  CLIP_TEXT: 'pastecraft-clip-text',
  CLIP_META: 'pastecraft-clip-meta',
  CATEGORY: 'pastecraft-category',
  TIME: 'pastecraft-time',
  CLIP_ACTIONS: 'pastecraft-clip-actions',
  PASTE: 'pastecraft-paste',
  DELETE: 'pastecraft-delete',
  SELECTED: 'selected',
  TOAST: 'pastecraft-toast',
  SETTINGS_MODAL: 'pastecraft-settings-modal',
  HELP_MODAL: 'pastecraft-help-modal',
  CONFIRM_MODAL: 'pastecraft-confirm-modal',
  MODAL_CLOSE: 'pastecraft-modal-close',
  MODAL_BACKDROP: 'pastecraft-modal-backdrop',
  MODAL_CONTENT: 'pastecraft-modal-content',
  MODAL_BODY: 'pastecraft-modal-body',
  MODAL_ACTIONS: 'pastecraft-modal-actions',
  SETTING: 'pastecraft-setting',
  SETTING_GROUP: 'pastecraft-setting-group',
  SETTING_LABEL: 'pastecraft-setting-label',
  SEGMENTED_CONTROL: 'pastecraft-segmented-control',
  SEGMENT_BTN: 'pastecraft-segment-btn',
  TOGGLE: 'pastecraft-toggle',
  TOGGLE_SWITCH: 'pastecraft-toggle-switch',
  BTN_SECONDARY: 'pastecraft-btn-secondary',
  BTN_PRIMARY: 'pastecraft-btn-primary',
  HELP_BTN: 'pastecraft-help-btn',
  BACK_BTN: 'pastecraft-back-btn',
  ACTIVE: 'active',
});

export const QP_ELEMENT_IDS = Object.freeze({
  COPY_MULTIPLE: 'pastecraft-copy-multiple',
  AUTO_HIDE: 'quickPasteAutoHide',
  SHOW_TIMESTAMPS: 'quickPasteShowTimestamps',
  MAX_CLIPS: 'quickPasteMaxClips',
  DELIMITER_CONTROL: 'quickPasteDelimiterControl',
  CUSTOM_DELIMITER: 'quickPasteCustomDelimiter',
  DEDUPLICATE: 'quickPasteDeduplicate',
  SORT: 'quickPasteSort',
  UPPERCASE: 'quickPasteUppercase',
  CANCEL_SETTINGS: 'cancelQuickSettings',
  SAVE_SETTINGS: 'saveQuickSettings',
  BACK_TO_SETTINGS: 'backToSettings',
  CANCEL_CLEAR_ALL: 'cancelClearAll',
  CONFIRM_CLEAR_ALL: 'confirmClearAll',
});

export const QP_LIMITS = Object.freeze({
  PREVIEW_TEXT_CHARS: 50,
  MAX_CLIPS_MIN: 5,
  MAX_CLIPS_MAX: 50,
  TOAST_DURATION_MS: 3000,
  TOAST_DEDUPE_MS: 1200,
  TOAST_FADE_MS: 300,
});

export const QP_DEFAULTS = Object.freeze({
  CATEGORY: 'Uncategorized',
  THEME_LIGHT: 'light',
  THEME_DARK: 'dark',
  THEME_BLUE: 'blue',
});

/** Resolve global theme for Quick Paste (gray dark → blue dark mode). */
export function resolveQuickPasteTheme(raw) {
  if (raw === QP_DEFAULTS.THEME_BLUE || raw === QP_DEFAULTS.THEME_DARK) {
    return QP_DEFAULTS.THEME_BLUE;
  }
  return QP_DEFAULTS.THEME_LIGHT;
}

export const QP_DELIMITER = Object.freeze({
  COMMA: 'comma',
  NEWLINE: 'newline',
  SPACE: 'space',
  CUSTOM: 'custom',
  VALUES: Object.freeze({
    comma: ', ',
    newline: '\n',
    space: ' ',
  }),
  FALLBACK_JOIN: '\n\n',
});
