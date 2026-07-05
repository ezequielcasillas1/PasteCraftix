import {
  CLIP_AI_BUNDLE_SELECTOR,
  CLIP_GOOGLE_SEARCH_SELECTOR,
  CLIP_ORG_BUNDLE_SELECTOR,
  CLIP_TITLE_BUNDLE_SELECTOR,
  openAiBundleMenu,
  openGoogleSearchMenu,
  openOrgBundleMenu,
  openTitleBundleMenu,
} from './clips.action-menu.js';
import { getClipBulkActionControls, getClipSearchControls } from './clips.selectors.js';

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

function toggleCategoryRow(app, clipIdKey, row, event) {
  event.stopPropagation();
  app.toggleCategoryClip(clipIdKey, row);
}

function getCategoryClipActionHandlers(app, clip, clipIdKey) {
  return [
    [CLIP_TITLE_BUNDLE_SELECTOR, (anchor) => openTitleBundleMenu(app, { anchor, clipIdKey })],
    [CLIP_ORG_BUNDLE_SELECTOR, (anchor) => clip && openOrgBundleMenu(app, { anchor, clip, clipIdKey, context: 'categories' })],
    [CLIP_GOOGLE_SEARCH_SELECTOR, (anchor) => clip && openGoogleSearchMenu(app, { anchor, clip, context: 'categories' })],
    ['.category-clip-open-btn', () => clip && typeof app.openClipViewer === 'function' && app.openClipViewer(clip, 'categories')],
    ['.category-clip-share-btn', () => clip && typeof app.showShareMenuForClip === 'function' && app.showShareMenuForClip(clip)],
    [CLIP_AI_BUNDLE_SELECTOR, (anchor) => clip && openAiBundleMenu(app, { anchor, clip, context: 'categories' })],
    ['.category-clip-copy-btn', () => clip && app.copyClipToClipboard(clip.text)],
  ];
}

async function handleCategoryClipClick(app, container, event) {
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
  const { searchInput, clearSearch, categoryFilter, dateFilter } = getClipSearchControls();

  searchInput?.addEventListener('input', (e) => {
    app.searchQuery = e.target.value;
    app.renderSearchResults();
    app.updateSearchBulkActions();
  });

  clearSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    app.searchQuery = '';
    app.renderSearchResults();
    app.updateSearchBulkActions();
  });

  categoryFilter?.addEventListener('change', (e) => {
    app.selectedCategory = e.target.value;
    app.renderSearchResults();
    app.updateSearchBulkActions();
  });

  dateFilter?.addEventListener('change', (e) => {
    app.selectedDateFilter = e.target.value;
    app.renderSearchResults();
    app.updateSearchBulkActions();
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
