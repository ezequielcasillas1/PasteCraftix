import { CLIPS_SELECTORS } from './clips.constants.js';

export function byId(id) {
  return document.getElementById(id);
}

export function getClipElements() {
  return {
    chipContainer: byId(CLIPS_SELECTORS.CHIP_CONTAINER),
    paginationControls: byId(CLIPS_SELECTORS.PAGINATION_CONTROLS),
    quickCopyBtn: byId(CLIPS_SELECTORS.QUICK_COPY_BUTTON),
    quickDeleteBtn: byId(CLIPS_SELECTORS.QUICK_DELETE_BUTTON),
    bulkAiActions: byId(CLIPS_SELECTORS.BULK_AI_ACTIONS),
    previewArea: byId(CLIPS_SELECTORS.PREVIEW_AREA),
    searchResults: byId(CLIPS_SELECTORS.SEARCH_RESULTS),
    lastCapture: byId(CLIPS_SELECTORS.LAST_CAPTURE),
    headerClipCount: byId(CLIPS_SELECTORS.HEADER_CLIP_COUNT),
  };
}

export function getClipSearchControls() {
  return {
    searchInput: byId(CLIPS_SELECTORS.SEARCH_INPUT),
    clearSearch: byId(CLIPS_SELECTORS.CLEAR_SEARCH),
    categoryFilter: byId(CLIPS_SELECTORS.CATEGORY_FILTER),
    dateFilter: byId(CLIPS_SELECTORS.DATE_FILTER),
  };
}

export function getClipBulkActionControls() {
  return {
    categoryBulkCopyBtn: byId(CLIPS_SELECTORS.CATEGORY_BULK_COPY_BUTTON),
    categoryBulkDeleteBtn: byId(CLIPS_SELECTORS.CATEGORY_BULK_DELETE_BUTTON),
    searchBulkCopyBtn: byId(CLIPS_SELECTORS.SEARCH_BULK_COPY_BUTTON),
  };
}
