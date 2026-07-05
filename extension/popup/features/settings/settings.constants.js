export const SETTINGS_STORAGE_KEYS = {
  AUTO_DELETE_PERIOD: 'autoDeletePeriod',
  QUICK_PASTE: 'quickPasteSettings',
  ALBUM_MODE: 'albumAttachmentOpenMode',
  THEME: 'theme',
  UPDATED_AT: 'settingsUpdatedAt',
  WIDGET: 'widgetSettings',
};

export const SETTINGS_SYNC_KEYS = [
  'autoDeletePeriod',
  'quickPasteSettings',
  'albumAttachmentOpenMode',
  'theme',
  'settingsUpdatedAt',
];

export const SETTINGS_DEFAULTS = {
  autoDeletePeriod: 'never',
  theme: 'light',
  albumAttachmentOpenMode: 'overlay',
  quickPasteSettings: {
    autoHide: true,
    showTimestamps: true,
    maxClipsDisplay: 20,
    oneClickCopy: false,
  },
};

export const SETTINGS_ELEMENT_IDS = {
  MODAL: 'settingsModal',
  BTN: 'settingsBtn',
  CLOSE: 'closeSettingsModal',
  AUTO_DELETE: 'autoDeletePeriod',
  DARK_MODE: 'darkModeToggle',
  PROFILE_DARK_MODE: 'profileDarkModeToggle',
  WIDGET_ICON_PROFILE: 'widgetIconUseProfileToggle',
  QUICK_PASTE_AUTO_HIDE: 'quickPasteAutoHidePopup',
  QUICK_PASTE_TIMESTAMPS: 'quickPasteShowTimestampsPopup',
  QUICK_PASTE_MAX_CLIPS: 'quickPasteMaxClipsPopup',
  ACTIVITY_ONE_CLICK_COPY: 'activityOneClickCopyToggle',
  ALBUM_MODE: 'albumAttachmentOpenMode',
  HELP_MODAL: 'helpModal',
  CLOSE_HELP: 'closeHelpModal',
  BACK_BTN: 'backBtn',
  BACK_TO_SETTINGS: 'backToSettingsFromHelp',
  RESTORE_WINDOW: 'restoreWindowSelect',
  PREVIEW_RESTORE_BTN: 'previewRestoreBtn',
  RESTORE_NOW_BTN: 'restoreNowBtn',
  SYNC_RESTORED_BTN: 'syncRestoredToCloudBtn',
  RESTORE_PREVIEW_TEXT: 'restorePreviewText',
  EXPORT_JSON_BTN: 'exportBackupJsonBtn',
  EXPORT_CSV_BTN: 'exportClipsCsvBtn',
  IMPORT_JSON_BTN: 'importBackupJsonBtn',
  IMPORT_JSON_FILE: 'importBackupJsonFile',
  TOTAL_CLIPS: 'totalClipsCount',
  CATEGORIZED_CLIPS: 'categorizedClipsCount',
  UNCATEGORIZED_CLIPS: 'uncategorizedClipsCount',
};

export const SETTINGS_COUPON_ELEMENT_IDS = {
  SECTION: 'settingsCouponSection',
  GUEST_NOTE: 'settingsCouponGuestNote',
  FORM: 'settingsCouponForm',
  INPUT: 'settingsCouponInput',
  REDEEM_BTN: 'settingsCouponRedeemBtn',
  STATUS: 'settingsCouponStatus',
  CODE_BADGE: 'settingsCouponCodeBadge',
};

export const BROADCAST_CHANNEL_NAME = 'pastecraft-settings-sync';

export const RESTORE_STORAGE_KEYS = Object.freeze({
  POINTS: 'pc_restore_points_v1',
  LAST_AT: 'pc_last_restore_at',
  LAST_POINT_ID: 'pc_last_restore_point_id',
});

export const RESTORE_LIMITS = Object.freeze({
  MAX_ACTIVE_CLIPS: 500,
  MAX_ARCHIVED_CLIPS: 1000,
  MAX_CATEGORIES: 300,
  MAX_NOTES: 300,
  MAX_DAILY_POINTS: 28,
  MAX_MANUAL_POINTS: 5,
});

export const RESTORE_WINDOW_MS = Object.freeze({
  '1day': 24 * 60 * 60 * 1000,
  '1week': 7 * 24 * 60 * 60 * 1000,
  '2weeks': 14 * 24 * 60 * 60 * 1000,
  '4weeks': 28 * 24 * 60 * 60 * 1000,
});

export const AUTO_DELETE_PERIODS = {
  '1day':    24 * 60 * 60 * 1000,
  '1week':   7 * 24 * 60 * 60 * 1000,
  '1month':  30 * 24 * 60 * 60 * 1000,
  '3months': 90 * 24 * 60 * 60 * 1000,
  '6months': 180 * 24 * 60 * 60 * 1000,
  '1year':   365 * 24 * 60 * 60 * 1000,
};
