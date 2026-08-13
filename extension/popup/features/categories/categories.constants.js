export const CATEGORIES_STORAGE_KEYS = Object.freeze({
  CATEGORIES: 'categories',
  UPDATED_AT: 'pc_local_updatedAt',
});

export const CATEGORIES_SYNC_QUEUE_KEYS = Object.freeze({
  CATEGORIES: 'syncCategories',
});

export const CATEGORIES_DEFAULTS = Object.freeze({
  ICON: '📁',
  UNCATEGORIZED: 'Uncategorized',
  UNCATEGORIZED_ICON: '📄',
  MAX_CLIPS_PER_CATEGORY: 150,
});

export const CATEGORIES_SELECTORS = Object.freeze({
  CATEGORIES_LIST: 'categoriesList',
  CATEGORY_FILTER: 'categoryFilter',
  MANUAL_INPUT_CATEGORY: 'manualInputCategory',
  PDF_EXTRACT_CATEGORY: 'pdfExtractCategory',
  CATEGORY_OPTIONS: 'categoryOptions',
  CREATE_CATEGORY_BTN: 'createCategoryBtn',
  SEND_NOTES_BTN: 'send-category-notes',
});
