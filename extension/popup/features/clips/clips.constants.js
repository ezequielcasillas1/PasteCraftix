export const CLIPS_STORAGE_KEYS = Object.freeze({
  ACTIVE: 'clips',
  ARCHIVED: 'searchOnlyClips',
  UPDATED_AT: 'pc_local_updatedAt',
  DELETED_ACTIVE: 'pc_deleted_clips',
  DELETED_ARCHIVED: 'pc_deleted_archived_clips',
});

export const CLIPS_SYNC_QUEUE_KEYS = Object.freeze({
  ACTIVE: 'syncClips',
  ARCHIVED: 'syncArchivedClips',
});

export const CLIPS_DEFAULTS = Object.freeze({
  CATEGORY: 'Uncategorized',
});

export const CLIPS_LIMITS = Object.freeze({
  CLIPS_PER_PAGE: 10,
  MAX_PAGES: 50,
  CATEGORY_ACTIVE_MAX: 150,
  ARCHIVED_LOCAL_MAX: 1000,
});

export const CLIPS_SELECTORS = Object.freeze({
  CHIP_CONTAINER: 'chipContainer',
  PAGINATION_CONTROLS: 'paginationControls',
  QUICK_COPY_BUTTON: 'quickCopyBtn',
  QUICK_DELETE_BUTTON: 'quickDeleteBtn',
  BULK_AI_ACTIONS: 'clipsBulkAiActions',
  PREVIEW_AREA: 'previewArea',
  SEARCH_RESULTS: 'searchResults',
  SEARCH_INPUT: 'searchInput',
  CLEAR_SEARCH: 'clearSearch',
  CATEGORY_FILTER: 'categoryFilter',
  DATE_FILTER: 'dateFilter',
  CATEGORY_BULK_COPY_BUTTON: 'categoryBulkCopyBtn',
  CATEGORY_BULK_DELETE_BUTTON: 'categoryBulkDeleteBtn',
  SEARCH_BULK_COPY_BUTTON: 'searchBulkCopyBtn',
  LAST_CAPTURE: 'lastCapture',
});
