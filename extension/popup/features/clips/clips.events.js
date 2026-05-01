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
    ['.category-clip-title-btn', () => app.promptEditClipTitle(clipIdKey)],
    ['.category-clip-breakdown-btn', () => clip && app.showBreakdownModal(app.getSelectedOrCurrentText(clip.text, 'categories'))],
    ['.category-clip-open-btn', () => clip && typeof app.openClipViewer === 'function' && app.openClipViewer(clip)],
    ['.category-clip-share-btn', () => clip && app.showShareMenuForClip(clip)],
    ['.category-clip-summary-btn', () => clip && app.showSummaryModal(app.getSelectedOrCurrentText(clip.text, 'categories'))],
    ['.category-clip-notes-btn', async () => {
      if (!clip) return;
      await app.loadNotes();
      app.showAlbumPicker();
      app.pendingClipForNotes = clip;
    }],
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
    await action[1]();
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
