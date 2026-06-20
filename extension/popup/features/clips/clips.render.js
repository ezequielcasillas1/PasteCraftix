import { CLIPS_DEFAULTS } from './clips.constants.js';
import {
  CLIP_AI_BUNDLE_SELECTOR,
  CLIP_GOOGLE_SEARCH_SELECTOR,
  CLIP_ORG_BUNDLE_SELECTOR,
  openAiBundleMenu,
  openGoogleSearchMenu,
  openOrgBundleMenu,
} from './clips.action-menu.js';
import { getClipElements } from './clips.selectors.js';
import {
  getClipFallbackTitle,
  getClipIdKey,
  getClipTitle,
  getSelectedSearchClipIdsInUiOrder,
} from './clips.state.js';

function _paintClipLucideIcons(container) {
  if (!container) return;
  window.renderLucideIconsSync?.(container);
}

function _ensurePaginationDelegation(app, paginationContainer) {
  if (!paginationContainer || paginationContainer.dataset.pcPaginationBound === '1') return;
  paginationContainer.dataset.pcPaginationBound = '1';
  paginationContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const page = parseInt(btn.dataset.page, 10);
    if (!Number.isFinite(page)) return;
    const totalClips = Math.max(app.totalClipsCount || 0, app.clips.length);
    const totalPages = Math.min(Math.ceil(totalClips / app.clipsPerPage), app.maxPages);
    if (isValidPage(page, totalPages)) {
      app.currentPage = page;
      app.renderChips();
    }
  });
}

function getPaginationItems(currentPage, totalPages) {
  const items = [];
  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);

  if (currentPage > 2) items.push({ type: 'page', page: 0 });
  if (currentPage > 3) items.push({ type: 'ellipsis' });

  for (let page = startPage; page <= endPage; page++) {
    items.push({ type: 'page', page });
  }

  if (currentPage < totalPages - 4) items.push({ type: 'ellipsis' });
  if (currentPage < totalPages - 3) items.push({ type: 'page', page: totalPages - 1 });

  return items;
}

function renderPaginationItem(item, currentPage) {
  if (item.type === 'ellipsis') return '<span class="pagination-ellipsis">...</span>';
  const isActive = item.page === currentPage ? 'active' : '';
  return `<button class="pagination-number ${isActive}" data-page="${item.page}">${item.page}</button>`;
}

function isNetworkLoadError(error) {
  return error.message?.includes('network') || error.message?.includes('fetch') || !navigator.onLine;
}

function getClipPreviewText(clip) {
  return String(clip?.text || '');
}

function getGoogleSearchButtonHtml(className, extraAttributes = '') {
  return `
    <button
      class="${className}"
      type="button"
      title="Google search"
      aria-label="Google search actions"
      aria-haspopup="menu"
      aria-expanded="false"${extraAttributes}
    >
      <img src="assets/google-logo.svg" alt="" class="pc-google-action-icon">
    </button>
  `;
}

function isRefactoredSiblingClip(clip) {
  return !!(clip?.meta?.craftRefactor || clip?.meta?.craftRefactorSourceId);
}

function matchesQuery(app, clip) {
  const query = app.searchQuery ? app.searchQuery.toLowerCase() : '';
  if (!query) return true;
  const text = String(clip.text || '').toLowerCase();
  const title = getClipTitle(clip).toLowerCase();
  return text.includes(query) || title.includes(query);
}

function matchesCategory(app, clip) {
  return !app.selectedCategory || clip.category === app.selectedCategory;
}

function matchesDateFilter(app, clip) {
  if (!app.selectedDateFilter) return true;

  const clipDate = new Date(clip.timestamp);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  const filters = {
    today: () => clipDate.toDateString() === now.toDateString(),
    week: () => clipDate >= weekAgo,
    month: () => clipDate >= monthAgo,
  };

  return filters[app.selectedDateFilter]?.() ?? true;
}

function shouldShowCloudSearchNotice(app) {
  return app.totalArchivedCount > app.searchOnlyClips.length &&
    app.tieredArchivedStore?.needsLazyLoading() &&
    typeof pasteCraftSupabase !== 'undefined' &&
    pasteCraftSupabase.isAuthenticated?.();
}

function hasSearchFilters(app) {
  return Boolean(app.searchQuery || app.selectedCategory || app.selectedDateFilter);
}

function isValidPage(page, totalPages) {
  return !Number.isNaN(page) && page >= 0 && page < totalPages;
}

function getObjectMeta(value) {
  return value && typeof value === 'object' ? value : null;
}

function getMarkupBadge(text, meta) {
  return window.PCMarkup ? window.PCMarkup.getMarkupBadgeForClip(text, meta) : '';
}

function getMarkupPreview(text, meta, maxLength) {
  return window.PCMarkup ? window.PCMarkup.renderMarkupPreview(text, meta, maxLength) : '';
}

function getRefactorBadgeHtml(clip) {
  if (!isRefactoredSiblingClip(clip)) return '';
  const level = clip.meta?.craftRefactorLevel ? ` (${clip.meta.craftRefactorLevel})` : '';
  return `<span class="pc-refactor-badge" title="AI refactored copy; original clip kept separately">Refactored copy${level}</span>`;
}

function getChipTextContent(app, clip, meta) {
  const previewText = getClipPreviewText(clip);
  const preview = getMarkupPreview(previewText, meta, 80);
  const badge = getRefactorBadgeHtml(clip);
  if (preview) return `${badge}<span class="pc-chip-preview">${preview}</span>`;

  const plainText = previewText.length > 30 ? previewText.substring(0, 30) + '...' : previewText;
  return `${badge}${app.escapeHtml(plainText)}`;
}

function getChipViewModel(app, clip, index) {
  const clipIdKey = getClipIdKey(clip?.id != null ? clip.id : index);
  const clipTitle = getClipTitle(clip);
  const clipMeta = getObjectMeta(clip.meta);

  return {
    clipIdKey,
    clipCategory: clip.category || CLIPS_DEFAULTS.CATEGORY,
    isSelected: app.selectedChips.has(clipIdKey),
    timeAgo: app.getTimeAgo(clip.timestamp),
    displayTitle: clipTitle || getClipFallbackTitle(clip, 42),
    markupBadge: getMarkupBadge(clip.text, clipMeta),
    chipTextContent: getChipTextContent(app, clip, clipMeta),
  };
}

function appendChipCategoryIndicator(chip, category) {
  if (category === CLIPS_DEFAULTS.CATEGORY) return;
  const categoryIndicator = document.createElement('span');
  categoryIndicator.className = 'chip-category-indicator';
  categoryIndicator.style.cssText = `
    font-size: 10px;
    background: rgba(0,0,0,0.1);
    padding: 2px 6px;
    border-radius: 8px;
    margin-left: 4px;
  `;
  categoryIndicator.textContent = category;
  chip.querySelector('.chip-text').appendChild(categoryIndicator);
}

function setBulkSelectionBar({ bar, countEl, copyBtnId, visible, count }) {
  bar.style.display = visible ? 'flex' : 'none';
  countEl.textContent = visible ? `${count} selected` : '';
  if (!visible) document.getElementById(copyBtnId)?.classList.remove('success');
}

function getSearchResultViewModel(app, clip) {
  const truncatedText = clip.text.length > 100 ? clip.text.substring(0, 100) + '...' : clip.text;
  const clipTitle = getClipTitle(clip);
  const sMeta = getObjectMeta(clip.meta);
  const sPreview = getMarkupPreview(clip.text, sMeta, 200);
  const searchTextContent = sPreview
    ? `<div class="pc-search-preview" title="${app.escapeHtml(clip.text)}">${sPreview}</div>`
    : `<div title="${app.escapeHtml(clip.text)}">${app.escapeHtml(truncatedText)}</div>`;

  return {
    isSelected: app.selectedSearchClips.has(getClipIdKey(clip.id)),
    timeAgo: app.getTimeAgo(clip.timestamp),
    displayTitle: clipTitle || getClipFallbackTitle(clip, 64),
    sBadge: getMarkupBadge(clip.text, sMeta),
    searchTextContent,
  };
}

function getCategoryClipViewModel(app, clip) {
  const truncatedText = clip.text.length > 60 ? clip.text.substring(0, 60) + '...' : clip.text;
  const clipTitle = getClipTitle(clip);
  const cMeta = getObjectMeta(clip.meta);
  const cPreview = getMarkupPreview(clip.text, cMeta, 120);
  const catTextContent = cPreview
    ? `<div class="pc-cat-preview" title="${app.escapeHtml(clip.text)}">${cPreview}</div>`
    : `<span title="${app.escapeHtml(clip.text)}">${app.escapeHtml(truncatedText)}</span>`;

  return {
    timeAgo: app.getTimeAgo(clip.timestamp),
    isSelected: app.selectedCategoryClips.has(getClipIdKey(clip.id)),
    displayTitle: clipTitle || getClipFallbackTitle(clip, 46),
    cBadge: getMarkupBadge(clip.text, cMeta),
    catTextContent,
  };
}

async function handleChipAction({ app, clip, clipIdKey, chip, event }) {
  const actionHandlers = [
    ['.chip-remove', () => app.removeChip(clipIdKey)],
    ['.chip-title-btn', () => app.promptEditClipTitle(clipIdKey)],
    [CLIP_ORG_BUNDLE_SELECTOR, (anchor) => openOrgBundleMenu(app, { anchor, clip, clipIdKey, context: 'clips' })],
    [CLIP_GOOGLE_SEARCH_SELECTOR, (anchor) => openGoogleSearchMenu(app, { anchor, clip, context: 'clips' })],
    [CLIP_AI_BUNDLE_SELECTOR, (anchor) => openAiBundleMenu(app, { anchor, clip, context: 'clips' })],
    ['.chip-open-btn', () => typeof app.openClipViewer === 'function' && app.openClipViewer(clip, 'clips')],
    ['.chip-share-btn', () => typeof app.showShareMenuForClip === 'function' && app.showShareMenuForClip(clip)],
  ];

  const action = actionHandlers.find(([selector]) => event.target.closest(selector));
  if (action) {
    event.stopPropagation();
    const anchor = event.target.closest(action[0]);
    await action[1](anchor);
    return;
  }

  if (!event.target.classList.contains('chip-checkbox')) {
    const shouldOneClickCopy = !!app.quickPasteSettings?.oneClickCopy;
    if (shouldOneClickCopy) {
      event.stopPropagation();
      await app.copyClipToClipboard(clip?.text || '');
      return;
    }

    app.toggleChip(clipIdKey, chip);
  }
}

export function renderChips(app) {
  const { chipContainer: container } = getClipElements();
  if (!container) return;

  const totalClips = Math.max(app.totalClipsCount || 0, app.clips.length);

  if (totalClips === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <h3>No clips yet</h3>
        <p>Right-click selected text to save it here</p>
        <div class="demo-hint">
          <span class="demo-step">1️⃣ Select text</span>
          <span class="demo-step">2️⃣ Right-click</span>
          <span class="demo-step">3️⃣ Save to PasteCraft</span>
        </div>
      </div>
    `;
    return;
  }

  const startIndex = app.currentPage * app.clipsPerPage;
  const endIndex = Math.min(startIndex + app.clipsPerPage, totalClips);

  if (startIndex >= app.clips.length && app.tieredClipsStore?.needsLazyLoading()) {
    lazyLoadClipsPage(app, startIndex, app.clipsPerPage, container);
    return;
  }

  const pageClips = app.clips.slice(startIndex, Math.min(endIndex, app.clips.length));

  container.innerHTML = '';
  pageClips.forEach((clip, pageIndex) => {
    const actualIndex = startIndex + pageIndex;
    const chip = createChip(app, clip, actualIndex);
    container.appendChild(chip);
  });

  app.renderPagination();
  app.updateQuickCopyButton();
  _paintClipLucideIcons(container);
}

export async function lazyLoadClipsPage(app, startIndex, pageSize, container) {
  if (!navigator.onLine) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <h3>You're offline</h3>
        <p>Connect to the internet to view older clips</p>
        <button class="btn-secondary" onclick="window.pasteCraftPopup.currentPage = 0; window.pasteCraftPopup.renderChips();">
          Go to first page
        </button>
      </div>
    `;
    app.renderPagination();
    return;
  }

  app._isLazyLoading = true;
  container.innerHTML = `
    <div class="lazy-load-indicator">
      <div class="lazy-load-spinner"></div>
      <p>Loading clips...</p>
    </div>
  `;

  app.renderPagination();

  try {
    if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
      const remoteClips = await pasteCraftSupabase.fetchClipsPage(startIndex, pageSize);

      if (remoteClips && remoteClips.length > 0) {
        container.innerHTML = '';
        remoteClips.forEach((clip, pageIndex) => {
          const actualIndex = startIndex + pageIndex;
          const chip = createChip(app, clip, actualIndex);
          container.appendChild(chip);
        });
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>No more clips</h3>
            <p>You've reached the end of your clips</p>
          </div>
        `;
      }
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">☁️</div>
          <h3>Sign in to view more</h3>
          <p>Older clips are stored in the cloud</p>
        </div>
      `;
    }
  } catch (e) {
    console.error('Failed to lazy load clips:', e);
    const isNetworkError = isNetworkLoadError(e);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${isNetworkError ? '📡' : '⚠️'}</div>
        <h3>${isNetworkError ? 'Connection issue' : 'Failed to load'}</h3>
        <p>${isNetworkError ? 'Check your internet connection' : 'Please try again'}</p>
        <button class="btn-secondary" onclick="window.pasteCraftPopup.renderChips();">
          Retry
        </button>
      </div>
    `;
  } finally {
    app._isLazyLoading = false;
    _paintClipLucideIcons(container);
  }
}

export function renderPagination(app) {
  const { paginationControls: paginationContainer } = getClipElements();
  if (!paginationContainer) return;

  const totalClips = Math.max(app.totalClipsCount || 0, app.clips.length);
  const totalPages = Math.min(Math.ceil(totalClips / app.clipsPerPage), app.maxPages);

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let paginationHTML = '<div class="pagination-wrapper">';
  paginationHTML += `
    <button class="pagination-btn pagination-prev" ${app.currentPage === 0 ? 'disabled' : ''} data-page="${app.currentPage - 1}">
      ‹ Prev
    </button>
  `;
  paginationHTML += '<div class="pagination-numbers">';
  paginationHTML += getPaginationItems(app.currentPage, totalPages)
    .map(item => renderPaginationItem(item, app.currentPage))
    .join('');
  paginationHTML += '</div>';
  paginationHTML += `
    <button class="pagination-btn pagination-next" ${app.currentPage >= totalPages - 1 ? 'disabled' : ''} data-page="${app.currentPage + 1}">
      Next ›
    </button>
  `;
  paginationHTML += '</div>';

  paginationContainer.innerHTML = paginationHTML;
  _ensurePaginationDelegation(app, paginationContainer);
}

export function createChip(app, clip, index) {
  const chip = document.createElement('div');
  chip.className = 'chip animate-slide-in';
  chip.dataset.index = index;
  const {
    clipIdKey,
    clipCategory,
    isSelected,
    timeAgo,
    displayTitle,
    markupBadge,
    chipTextContent,
  } = getChipViewModel(app, clip, index);
  chip.dataset.clipId = clipIdKey;

  chip.innerHTML = `
    <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''}>
    ${markupBadge}
    <span class="chip-text pc-clip-stack" title="${app.escapeHtml(getClipPreviewText(clip))}">
      <span class="pc-clip-title" title="${app.escapeHtml(displayTitle)}">${app.escapeHtml(displayTitle)}</span>
      <span class="pc-clip-subtext">${chipTextContent}</span>
    </span>
    <span class="chip-time">${timeAgo}</span>
    <div class="chip-actions">
      <button class="chip-title-btn" title="Edit clip title" aria-label="Edit clip title"><i data-lucide="pencil-line"></i></button>
      <button class="chip-org-bundle-btn" type="button" title="Notes and categories" aria-label="Notes and categories" aria-haspopup="menu" aria-expanded="false"><i data-lucide="folders"></i></button>
      ${getGoogleSearchButtonHtml('chip-google-search-btn')}
      <button class="chip-open-btn" title="Open" aria-label="Open clip"><i data-lucide="search"></i></button>
      <button class="chip-share-btn" title="Share" aria-label="Share clip"><i data-lucide="link"></i></button>
      <button class="chip-ai-bundle-btn" type="button" title="AI actions" aria-label="AI actions" aria-haspopup="menu" aria-expanded="false"><i data-lucide="brain"></i></button>
      <button class="chip-remove" title="Remove clip" aria-label="Remove clip">×</button>
    </div>
  `;

  appendChipCategoryIndicator(chip, clipCategory);

  if (isSelected) {
    chip.classList.add('selected');
  }

  const checkbox = chip.querySelector('.chip-checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    app.toggleChip(clipIdKey, chip);
  });

  chip.addEventListener('click', (e) => {
    void handleChipAction({ app, clip, clipIdKey, chip, event: e });
  });

  return chip;
}

export function getTimeAgo(timestamp) {
  const now = Date.now();
  const clipTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(clipTime)) return 'unknown';
  const diffMs = now - clipTime;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function updateLastCapture(app) {
  const { lastCapture: lastCaptureEl } = getClipElements();
  if (!lastCaptureEl) return;
  if (app.clips.length > 0) {
    const lastClip = app.clips[0];
    const timeAgo = app.getTimeAgo(lastClip.timestamp);
    lastCaptureEl.textContent = `Last: ${timeAgo}`;
  } else {
    lastCaptureEl.textContent = 'No recent captures';
  }
}

export function updateQuickCopyButton(app) {
  const { quickCopyBtn, quickDeleteBtn, bulkAiActions } = getClipElements();
  if (!quickCopyBtn) return;
  const count = app.selectedChips.size;
  quickCopyBtn.style.display = count > 0 ? 'flex' : 'none';
  if (quickDeleteBtn) {
    if (count > 1) {
      quickDeleteBtn.style.display = 'flex';
    } else {
      quickDeleteBtn.style.display = 'none';
      quickDeleteBtn.classList.remove('success');
    }
  }
  if (bulkAiActions) {
    bulkAiActions.style.display = count > 1 ? 'flex' : 'none';
  }
}

export function updateCategoryBulkActions(app) {
  const bar = document.getElementById('categoryBulkActions');
  const countEl = document.getElementById('categoryBulkCount');
  const aiBar = document.getElementById('categoriesBulkAiActions');
  if (!bar || !countEl) return;

  const count = app.selectedCategoryClips ? app.selectedCategoryClips.size : 0;
  const isCategoriesTab = app.currentTab === 'categories';
  setBulkSelectionBar({
    bar,
    countEl,
    copyBtnId: 'categoryBulkCopyBtn',
    visible: isCategoriesTab && count > 0,
    count,
  });

  if (aiBar) {
    aiBar.style.display = (isCategoriesTab && count > 1) ? 'flex' : 'none';
  }
}

export function updateSearchBulkActions(app) {
  const bar = document.getElementById('searchBulkActions');
  const countEl = document.getElementById('searchBulkCount');
  if (!bar || !countEl) return;

  const visibleSelectedCount = getSelectedSearchClipIdsInUiOrder(app).length;

  if (app.currentTab === 'search' && visibleSelectedCount > 1) {
    bar.style.display = 'flex';
    countEl.textContent = `${visibleSelectedCount} selected`;
  } else {
    bar.style.display = 'none';
    countEl.textContent = '';
    const copyBtn = document.getElementById('searchBulkCopyBtn');
    if (copyBtn) copyBtn.classList.remove('success');
  }
}

export function renderSearchResults(app) {
  const { searchResults: container } = getClipElements();
  if (!container) return;

  if (!hasSearchFilters(app)) {
    container.innerHTML = `
      <div class="empty-search">
        <div class="empty-search-icon"><i data-lucide="search"></i></div>
        <h3>Start searching</h3>
        <p>Type in the search bar to find your clips</p>
      </div>
    `;
    app.updateSearchBulkActions();
    return;
  }

  const filteredClips = filterClips(app);

  if (filteredClips.length === 0) {
    container.innerHTML = `
      <div class="empty-search">
        <div class="empty-search-icon"><i data-lucide="frown"></i></div>
        <h3>No results found</h3>
        <p>Try adjusting your search criteria</p>
      </div>
    `;
    app.updateSearchBulkActions();
    return;
  }

  container.innerHTML = '';
  filteredClips.forEach(clip => {
    const resultItem = createSearchResultItem(app, clip);
    container.appendChild(resultItem);
  });

  if (shouldShowCloudSearchNotice(app)) {
    const cloudNotice = document.createElement('div');
    cloudNotice.className = 'cloud-search-notice';
    cloudNotice.innerHTML = `
      <div class="cloud-notice-content">
        <span class="cloud-notice-icon">☁️</span>
        <span>More clips may be available in the cloud (${app.totalArchivedCount - app.searchOnlyClips.length} additional)</span>
      </div>
    `;
    container.appendChild(cloudNotice);
  }

  app.updateSearchBulkActions();
}

export function filterClips(app) {
  const allClips = [...app.clips, ...app.searchOnlyClips];
  return allClips.filter(clip => matchesQuery(app, clip) && matchesCategory(app, clip) && matchesDateFilter(app, clip));
}

export function createSearchResultItem(app, clip) {
  const item = document.createElement('div');
  item.className = 'search-result-item';
  item.dataset.clipId = clip.id;

  const {
    isSelected,
    timeAgo,
    displayTitle,
    sBadge,
    searchTextContent,
  } = getSearchResultViewModel(app, clip);
  if (isSelected) item.classList.add('selected');

  item.innerHTML = `
    <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''}>
    <div class="search-result-content">
      <div class="search-result-text pc-clip-title-stack">
        <div class="pc-clip-title" title="${app.escapeHtml(displayTitle)}">${app.escapeHtml(displayTitle)}</div>
        <div class="pc-clip-subtext">${sBadge}${searchTextContent}</div>
      </div>
      <div class="search-result-meta">
        <span class="search-result-category">${app.escapeHtml(clip.category || CLIPS_DEFAULTS.CATEGORY)}</span>
        <span>${timeAgo}</span>
      </div>
    </div>
    <div class="search-result-actions">
      <button class="chip-title-btn" title="Edit clip title" aria-label="Edit clip title"><i data-lucide="pencil-line"></i></button>
      <button class="search-org-bundle-btn" type="button" title="Notes and categories" aria-label="Notes and categories" aria-haspopup="menu" aria-expanded="false"><i data-lucide="folders"></i></button>
      ${getGoogleSearchButtonHtml('search-google-search-btn')}
      <button class="chip-open-btn" title="Open" aria-label="Open clip"><i data-lucide="search"></i></button>
      <button class="chip-share-btn" title="Share" aria-label="Share clip"><i data-lucide="link"></i></button>
      <button class="search-ai-bundle-btn" type="button" title="AI actions" aria-label="AI actions" aria-haspopup="menu" aria-expanded="false"><i data-lucide="brain"></i></button>
      <button class="btn-copy" title="Copy to clipboard" aria-label="Copy to clipboard"><i data-lucide="clipboard"></i></button>
    </div>
  `;

  item.querySelector('.search-checkbox').addEventListener('click', (e) => {
    e.stopPropagation();
    app.toggleSearchClip(clip.id, item);
  });
  item.addEventListener('click', (e) => {
    if (!e.target.closest('.search-result-actions') && !e.target.classList.contains('search-checkbox')) {
      app.toggleSearchClip(clip.id, item);
    }
  });
  item.querySelector('.btn-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    app.copyClipToClipboard(clip.text);
  });
  item.querySelector('.chip-title-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    app.promptEditClipTitle(getClipIdKey(clip.id));
  });
  item.querySelector('.search-org-bundle-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openOrgBundleMenu(app, {
      anchor: e.currentTarget,
      clip,
      clipIdKey: getClipIdKey(clip.id),
      context: 'search',
    });
  });
  item.querySelector('.search-google-search-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openGoogleSearchMenu(app, { anchor: e.currentTarget, clip, context: 'search' });
  });
  item.querySelector('.chip-open-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof app.openClipViewer === 'function') app.openClipViewer(clip, 'search');
  });
  item.querySelector('.chip-share-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof app.showShareMenuForClip === 'function') app.showShareMenuForClip(clip);
  });
  item.querySelector('.search-ai-bundle-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openAiBundleMenu(app, { anchor: e.currentTarget, clip, context: 'search' });
  });

  return item;
}

export function createCategoryClipsHTML(app, clips) {
  if (clips.length === 0) {
    return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
  }

  return clips.map(clip => {
    const {
      timeAgo,
      isSelected,
      displayTitle,
      cBadge,
      catTextContent,
    } = getCategoryClipViewModel(app, clip);

    const html = `
      <div class="category-clip ${isSelected ? 'selected' : ''}" data-clip-id="${clip.id}" title="${app.escapeHtml(clip.text)}">
        <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''}>
        <div class="category-clip-content">
          <div class="category-clip-text pc-clip-title-stack">
            <div class="pc-clip-title" title="${app.escapeHtml(displayTitle)}">${app.escapeHtml(displayTitle)}</div>
            <div class="pc-clip-subtext">${cBadge}${catTextContent}</div>
          </div>
          <div class="category-clip-time">${timeAgo}</div>
        </div>
        <div class="category-clip-actions">
          <button class="category-clip-title-btn" data-clip-id="${clip.id}" title="Edit clip title" aria-label="Edit clip title"><i data-lucide="pencil-line"></i></button>
          <button class="category-clip-org-bundle-btn" data-clip-id="${clip.id}" type="button" title="Notes and categories" aria-label="Notes and categories" aria-haspopup="menu" aria-expanded="false"><i data-lucide="folders"></i></button>
          ${getGoogleSearchButtonHtml('category-clip-google-search-btn', ` data-clip-id="${clip.id}"`)}
          <button class="category-clip-open-btn" data-clip-id="${clip.id}" title="Open" aria-label="Open clip"><i data-lucide="search"></i></button>
          <button class="category-clip-share-btn" data-clip-id="${clip.id}" title="Share" aria-label="Share clip"><i data-lucide="link"></i></button>
          <button class="category-clip-ai-bundle-btn" data-clip-id="${clip.id}" type="button" title="AI actions" aria-label="AI actions" aria-haspopup="menu" aria-expanded="false"><i data-lucide="brain"></i></button>
          <button class="category-clip-copy-btn" data-clip-id="${clip.id}" title="Copy" aria-label="Copy clip"><i data-lucide="clipboard"></i></button>
        </div>
      </div>
    `;
    return html;
  }).join('');
}
