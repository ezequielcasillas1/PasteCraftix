import { getClipBulkActionControls, getClipSearchControls } from './clips.selectors.js';

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
