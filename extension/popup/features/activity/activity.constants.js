export const ACTIVITY_PAGE_SIZE = 20;

export const ACTIVITY_AUTH_TIMEOUT_MS = 1500;

export const ACTIVITY_FILTERS = Object.freeze({
  ALL: 'all',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
});

export const ACTIVITY_OPERATION_ICONS = Object.freeze({
  INSERT: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  DEFAULT: '📝',
});

export const ACTIVITY_TABLE_BADGES = Object.freeze({
  clips: 'Clip',
  categories: 'Category',
  notes: 'Note',
  settings: 'Settings',
  user_profiles: 'Profile',
  archived_clips: 'Archive',
});

export const ACTIVITY_SELECTORS = Object.freeze({
  LIST: 'activityList',
  LOAD_MORE_BTN: 'loadMoreActivityBtn',
  REFRESH_BTN: 'refreshActivityBtn',
  DATE_FROM: 'activityDateFrom',
  DATE_TO: 'activityDateTo',
  FILTER_CHIP: '.activity-filter-chip',
});

export const ACTIVITY_STATUS = Object.freeze({
  READY: 'ready',
  EMPTY: 'empty',
  CLIENT_UNAVAILABLE: 'client_unavailable',
  NOT_SIGNED_IN: 'not_signed_in',
  SESSION_UNAVAILABLE: 'session_unavailable',
  QUERY_ERROR: 'query_error',
});

export const ACTIVITY_STATUS_COPY = Object.freeze({
  [ACTIVITY_STATUS.EMPTY]: {
    icon: 'bar-chart-3',
    title: 'No cloud activity yet',
    message: 'Activity appears here after clips sync to the cloud. Try clicking Refresh after making changes.',
  },
  [ACTIVITY_STATUS.CLIENT_UNAVAILABLE]: {
    icon: 'cloud-off',
    title: 'Activity unavailable',
    message: 'PasteCraft could not connect to the cloud client. Close and reopen the popup, then try Refresh.',
  },
  [ACTIVITY_STATUS.NOT_SIGNED_IN]: {
    icon: 'user-x',
    title: 'Sign in to view activity',
    message: 'Cloud activity is tied to your PasteCraft account. Sign in, then refresh this tab.',
  },
  [ACTIVITY_STATUS.SESSION_UNAVAILABLE]: {
    icon: 'cloud-off',
    title: 'Cloud session needs refresh',
    message: 'PasteCraft sees your account, but the cloud session is not ready for activity history. Reopen the popup or sign in again.',
  },
  [ACTIVITY_STATUS.QUERY_ERROR]: {
    icon: 'alert-triangle',
    title: 'Could not load activity',
    message: 'The cloud activity request failed. Check your connection and try Refresh again.',
  },
});
