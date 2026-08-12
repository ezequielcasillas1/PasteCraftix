import {
  CLIP_AI_BUNDLE_SELECTOR,
  CLIP_GOOGLE_SEARCH_SELECTOR,
  CLIP_ORG_BUNDLE_SELECTOR,
  openAiBundleMenu,
  openGoogleSearchMenu,
  openOrgBundleMenu,
} from './clips.action-menu.js';
import { getClipBulkActionControls, getClipSearchControls } from './clips.selectors.js';
import { persistSearchIncludeTitles } from './clips.search-prefs.js';

const SEARCH_INPUT_DEBOUNCE_MS = 80;

function getAllClipCandidates(app) {
  return [...app.clips, ...app.searchOnlyClips];
}

function findCategoryClip(app, clipIdKey) {
  return getAllClipCandidates(app).find((c) => app._clipIdKey(c?.id) === clipIdKey);
}

function isCategoryCheckbox(event) {
  return event.target.classList?.contains('category-checkbox');
}

function isCategoryActionArea(event) {
  return Boolean(event.target.closest('.category-clip-actions'));
}

function clearPendingSearchRender(app) {
  if (!app._searchRenderTimerId) return;
  clearTimeout(app._searchRenderTimerId);
  app._searchRenderTimerId = null;
}

function renderSearchNow(app) {
  clearPendingSearchRender(app);
  app.renderSearchResults();
  app.updateSearchBulkActions();
}

function scheduleSearchRender(app) {
  clearPendingSearchRender(app);
  app._searchRenderTimerId = setTimeout(() => {
    app._searchRenderTimerId = null;
    app.renderSearchResults();
    app.updateSearchBulkActions();
  }, SEARCH_INPUT_DEBOUNCE_MS);
}

function toggleCategoryRow(app, clipIdKey, row, event) {
  event.stopPropagation();
  app.toggleCategoryClip(clipIdKey, row);
}

function getCategoryClipActionHandlers(app, clip, clipIdKey) {
  return [
    ['.category-clip-title-btn', () => app.promptEditClipTitle(clipIdKey)],
    [CLIP_ORG_BUNDLE_SELECTOR, (anchor) => clip && openOrgBundleMenu(app, { anchor, clip, clipIdKey, context: 'categories' })],
    [CLIP_GOOGLE_SEARCH_SELECTOR, (anchor) => clip && openGoogleSearchMenu(app, { anchor, clip, context: 'categories' })],
    ['.category-clip-open-btn', () => clip && typeof app.openClipViewer === 'function' && app.openClipViewer(clip, 'categories')],
    ['.category-clip-share-btn', () => clip && typeof app.showShareMenuForClip === 'function' && app.showShareMenuForClip(clip)],
    [CLIP_AI_BUNDLE_SELECTOR, (anchor) => clip && openAiBundleMenu(app, { anchor, clip, context: 'categories' })],
    ['.category-clip-copy-btn', () => clip && app.copyClipToClipboard(clip)],
  ];
}

async function handleCategoryClipClick(app, container, event) {
  const addSepBtn = event.target.closest('.category-clip-add-separator-btn');
  if (addSepBtn) {
    event.preventDefault();
    event.stopPropagation();
    const item = addSepBtn.closest('.category-item');
    const categoryId = item?.dataset?.categoryId;
    const category = (app.categories || []).find((c) => (
      String(c?.id) === String(categoryId)
      || String(app._categoryIdKey?.(c) || '') === String(categoryId)
    ));
    if (category) {
      await app.createCategorySeparator?.(category, { afterClipId: addSepBtn.dataset.clipId });
    }
    return;
  }

  if (
    event.target.closest('.category-separator')
    || event.target.closest('.add-category-separator')
  ) {
    return;
  }

  const row = event.target.closest('.category-clip');
  if (!row || !container.contains(row)) return;

  const clipIdKey = app._clipIdKey(row.dataset.clipId);
  if (!clipIdKey) return;

  const clip = findCategoryClip(app, clipIdKey);
  const action = getCategoryClipActionHandlers(app, clip, clipIdKey)
    .find(([selector]) => event.target.closest(selector));

  if (action) {
    event.stopPropagation();
    const anchor = event.target.closest(action[0]);
    await action[1](anchor);
    return;
  }

  if (isCategoryCheckbox(event) || !isCategoryActionArea(event)) toggleCategoryRow(app, clipIdKey, row, event);
}

export function registerClipSearchEvents(app) {
  const { searchInput, clearSearch, categoryFilter, dateFilter, searchIncludeTitles } = getClipSearchControls();

  if (searchIncludeTitles) {
    searchIncludeTitles.checked = app.searchIncludeTitles !== false;
  }

  searchIncludeTitles?.addEventListener('change', async (e) => {
    app.searchIncludeTitles = e.target.checked;
    await persistSearchIncludeTitles(app);
    renderSearchNow(app);
  });

  searchInput?.addEventListener('input', (e) => {
    app.searchQuery = e.target.value;
    if (!app.searchQuery) renderSearchNow(app);
    else scheduleSearchRender(app);
  });

  clearSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    app.searchQuery = '';
    renderSearchNow(app);
  });

  categoryFilter?.addEventListener('change', (e) => {
    app.selectedCategory = e.target.value;
    renderSearchNow(app);
  });

  dateFilter?.addEventListener('change', (e) => {
    app.selectedDateFilter = e.target.value;
    renderSearchNow(app);
  });
}

export function registerClipBulkActionEvents(app) {
  const { categoryBulkCopyBtn, categoryBulkDeleteBtn, searchBulkCopyBtn } = getClipBulkActionControls();

  categoryBulkCopyBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await app.handleCategoryBulkCopy();
  });

  categoryBulkDeleteBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await app.handleCategoryBulkDelete();
  });

  searchBulkCopyBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await app.handleSearchBulkCopy();
  });
}

export function registerClipEvents(app) {
  registerClipSearchEvents(app);
  registerClipBulkActionEvents(app);
}

export function setupCategoryClipDelegation(app) {
  if (app._categoryClipDelegationAttached) return;
  const container = document.getElementById('categoriesList');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    await handleCategoryClipClick(app, container, e);
  });

  app._categoryClipDelegationAttached = true;
}
