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

export function setupCategoryClipDelegation(app) {
  if (app._categoryClipDelegationAttached) return;
  const container = document.getElementById('categoriesList');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const row = e.target.closest('.category-clip');
    if (!row || !container.contains(row)) return;

    const clipIdKey = app._clipIdKey(row.dataset.clipId);
    if (!clipIdKey) return;

    const allClips = [...app.clips, ...app.searchOnlyClips];
    const clip = allClips.find((c) => app._clipIdKey(c?.id) === clipIdKey);

    const breakdownBtn = e.target.closest('.category-clip-breakdown-btn');
    const openBtn = e.target.closest('.category-clip-open-btn');
    const shareBtn = e.target.closest('.category-clip-share-btn');
    const summaryBtn = e.target.closest('.category-clip-summary-btn');
    const notesBtn = e.target.closest('.category-clip-notes-btn');
    const copyBtn = e.target.closest('.category-clip-copy-btn');
    const titleBtn = e.target.closest('.category-clip-title-btn');
    const checkbox = e.target.classList && e.target.classList.contains('category-checkbox')
      ? e.target
      : null;

    if (titleBtn) {
      e.stopPropagation();
      app.promptEditClipTitle(clipIdKey);
      return;
    }
    if (breakdownBtn) {
      e.stopPropagation();
      if (!clip) return;
      app.showBreakdownModal(app.getSelectedOrCurrentText(clip.text, 'categories'));
      return;
    }
    if (openBtn) {
      e.stopPropagation();
      if (clip && typeof app.openClipViewer === 'function') app.openClipViewer(clip);
      return;
    }
    if (shareBtn) {
      e.stopPropagation();
      if (clip) app.showShareMenuForClip(clip);
      return;
    }
    if (summaryBtn) {
      e.stopPropagation();
      if (!clip) return;
      app.showSummaryModal(app.getSelectedOrCurrentText(clip.text, 'categories'));
      return;
    }
    if (notesBtn) {
      e.stopPropagation();
      if (!clip) return;
      await app.loadNotes();
      app.showAlbumPicker();
      app.pendingClipForNotes = clip;
      return;
    }
    if (copyBtn) {
      e.stopPropagation();
      if (clip) app.copyClipToClipboard(clip.text);
      return;
    }
    if (checkbox) {
      e.stopPropagation();
      app.toggleCategoryClip(clipIdKey, row);
      return;
    }

    if (!e.target.closest('.category-clip-actions')) {
      e.stopPropagation();
      app.toggleCategoryClip(clipIdKey, row);
    }
  });

  app._categoryClipDelegationAttached = true;
}
