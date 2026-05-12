import { CATEGORIES_SELECTORS } from './categories.constants.js';

export function byId(id) {
  return document.getElementById(id);
}

export function getCategoryListElements() {
  return {
    categoriesList: byId(CATEGORIES_SELECTORS.CATEGORIES_LIST),
    categoryFilter: byId(CATEGORIES_SELECTORS.CATEGORY_FILTER),
  };
}

export function getCategoryDropdownElements() {
  return {
    manualInputCategory: byId(CATEGORIES_SELECTORS.MANUAL_INPUT_CATEGORY),
    pdfExtractCategory: byId(CATEGORIES_SELECTORS.PDF_EXTRACT_CATEGORY),
    categoryOptions: byId(CATEGORIES_SELECTORS.CATEGORY_OPTIONS),
  };
}
