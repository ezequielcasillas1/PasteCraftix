export const ACTIVITY_PAGE_SIZE = 20;

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
