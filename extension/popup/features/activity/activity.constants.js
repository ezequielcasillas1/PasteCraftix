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

/** Filter-specific empty-state copy (title + body). */
export const ACTIVITY_EMPTY_COPY = Object.freeze({
  [ACTIVITY_FILTERS.ALL]: {
    title: 'No cloud activity yet',
    body: 'Activity appears here after clips sync to the cloud.<br>Try clicking Refresh after making changes.',
  },
  [ACTIVITY_FILTERS.INSERT]: {
    title: 'No created activity',
    body: 'No create events in this range.<br>Try a wider date range or click Refresh.',
  },
  [ACTIVITY_FILTERS.UPDATE]: {
    title: 'No updated activity',
    body: 'No update events in this range.<br>Try a wider date range or click Refresh.',
  },
  [ACTIVITY_FILTERS.DELETE]: {
    title: 'No deleted activity in this range',
    body: 'Deleted clips appear here after they sync to the cloud.<br>Try clicking Refresh after deleting clips.',
  },
});
