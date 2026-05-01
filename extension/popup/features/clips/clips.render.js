import { CLIPS_DEFAULTS } from './clips.constants.js';
import { getClipElements } from './clips.selectors.js';
import {
  getClipFallbackTitle,
  getClipIdKey,
  getClipTitle,
  getSelectedSearchClipIdsInUiOrder,
} from './clips.state.js';

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
    const isNetworkError = e.message?.includes('network') || e.message?.includes('fetch') || !navigator.onLine;
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

  if (app.currentPage > 2) {
    paginationHTML += '<button class="pagination-number" data-page="0">0</button>';
    if (app.currentPage > 3) {
      paginationHTML += '<span class="pagination-ellipsis">...</span>';
    }
  }

  const startPage = Math.max(0, app.currentPage - 2);
  const endPage = Math.min(totalPages - 1, app.currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === app.currentPage ? 'active' : '';
    paginationHTML += `<button class="pagination-number ${isActive}" data-page="${i}">${i}</button>`;
  }

  if (app.currentPage < totalPages - 3) {
    if (app.currentPage < totalPages - 4) {
      paginationHTML += '<span class="pagination-ellipsis">...</span>';
    }
    paginationHTML += `<button class="pagination-number" data-page="${totalPages - 1}">${totalPages - 1}</button>`;
  }

  paginationHTML += '</div>';
  paginationHTML += `
    <button class="pagination-btn pagination-next" ${app.currentPage >= totalPages - 1 ? 'disabled' : ''} data-page="${app.currentPage + 1}">
      Next ›
    </button>
  `;
  paginationHTML += '</div>';

  paginationContainer.innerHTML = paginationHTML;
  paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = parseInt(e.target.dataset.page);
      if (!isNaN(page) && page >= 0 && page < totalPages) {
        app.currentPage = page;
        app.renderChips();
      }
    });
  });
}

export function createChip(app, clip, index) {
  const chip = document.createElement('div');
  chip.className = 'chip animate-slide-in';
  chip.dataset.index = index;
  const clipIdKey = getClipIdKey(clip?.id != null ? clip.id : index);
  chip.dataset.clipId = clipIdKey;

  const plainText = clip.text.length > 30 ? clip.text.substring(0, 30) + '...' : clip.text;
  const timeAgo = app.getTimeAgo(clip.timestamp);
  const clipTitle = getClipTitle(clip);
  const displayTitle = clipTitle || getClipFallbackTitle(clip, 42);

  const clipCategory = clip.category || CLIPS_DEFAULTS.CATEGORY;
  const isSelected = app.selectedChips.has(clipIdKey);
  const clipMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
  const markupBadge = window.PCMarkup ? window.PCMarkup.getMarkupBadgeForClip(clip.text, clipMeta) : '';
  const markupPreview = window.PCMarkup ? window.PCMarkup.renderMarkupPreview(clip.text, clipMeta, 80) : '';
  const chipTextContent = markupPreview
    ? `<span class="pc-chip-preview">${markupPreview}</span>`
    : app.escapeHtml(plainText);

  chip.innerHTML = `
    <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''}>
    ${markupBadge}
    <span class="chip-text pc-clip-stack" title="${app.escapeHtml(clip.text)}">
      <span class="pc-clip-title" title="${app.escapeHtml(displayTitle)}">${app.escapeHtml(displayTitle)}</span>
      <span class="pc-clip-subtext">${chipTextContent}</span>
    </span>
    <span class="chip-time">${timeAgo}</span>
    <div class="chip-actions">
      <button class="chip-title-btn" title="Edit clip title"><i data-lucide="pencil"></i></button>
      <button class="chip-breakdown-btn" title="AI Breakdown"><i data-lucide="brain"></i></button>
      <button class="chip-open-btn" title="Open"><i data-lucide="search"></i></button>
      <button class="chip-share-btn" title="Share"><i data-lucide="link"></i></button>
      <button class="chip-summary-btn" title="AI Summary"><i data-lucide="notebook-pen"></i></button>
      <button class="chip-notes-btn" title="Send to Notes"><i data-lucide="folder-plus"></i></button>
      <button class="chip-category-btn" title="Add to category"><i data-lucide="folder"></i></button>
      <button class="chip-remove" title="Remove clip">×</button>
    </div>
  `;

  if (clipCategory !== CLIPS_DEFAULTS.CATEGORY) {
    const categoryIndicator = document.createElement('span');
    categoryIndicator.className = 'chip-category-indicator';
    categoryIndicator.style.cssText = `
      font-size: 10px;
      background: rgba(0,0,0,0.1);
      padding: 2px 6px;
      border-radius: 8px;
      margin-left: 4px;
    `;
    categoryIndicator.textContent = clipCategory;
    chip.querySelector('.chip-text').appendChild(categoryIndicator);
  }

  if (isSelected) {
    chip.classList.add('selected');
  }

  const checkbox = chip.querySelector('.chip-checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    app.toggleChip(clipIdKey, chip);
  });

  chip.addEventListener('click', (e) => {
    const removeBtn = e.target.classList.contains('chip-remove') ? e.target : null;
    const breakdownBtn = e.target.closest('.chip-breakdown-btn');
    const openBtn = e.target.closest('.chip-open-btn');
    const shareBtn = e.target.closest('.chip-share-btn');
    const summaryBtn = e.target.closest('.chip-summary-btn');
    const notesBtn = e.target.closest('.chip-notes-btn');
    const categoryBtn = e.target.closest('.chip-category-btn');
    const titleBtn = e.target.closest('.chip-title-btn');
    const isCheckbox = e.target.classList.contains('chip-checkbox');

    if (removeBtn) {
      app.removeChip(clipIdKey);
    } else if (titleBtn) {
      e.stopPropagation();
      app.promptEditClipTitle(clipIdKey);
    } else if (breakdownBtn) {
      e.stopPropagation();
      const textToSend = app.getSelectedOrCurrentText(clip.text, 'clips');
      app.showBreakdownModal(textToSend);
    } else if (openBtn) {
      e.stopPropagation();
      if (typeof app.openClipViewer === 'function') {
        app.openClipViewer(clip);
      }
    } else if (shareBtn) {
      e.stopPropagation();
      app.showShareMenuForClip(clip);
    } else if (summaryBtn) {
      e.stopPropagation();
      const textToSend = app.getSelectedOrCurrentText(clip.text, 'clips');
      app.showSummaryModal(textToSend);
    } else if (notesBtn) {
      e.stopPropagation();
      app.loadNotes().then(() => {
        app.showAlbumPicker();
        app.pendingClipForNotes = clip;
      });
    } else if (categoryBtn) {
      e.stopPropagation();
      app.pendingText = clip.text;
      app.pendingClipId = clipIdKey;
      app.showCategoryModal(true);
    } else if (!isCheckbox) {
      app.toggleChip(clipIdKey, chip);
    }
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

  if (isCategoriesTab && count > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${count} selected`;
  } else {
    bar.style.display = 'none';
    countEl.textContent = '';
    const copyBtn = document.getElementById('categoryBulkCopyBtn');
    if (copyBtn) copyBtn.classList.remove('success');
  }

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

  if (!app.searchQuery && !app.selectedCategory && !app.selectedDateFilter) {
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

  if (app.totalArchivedCount > app.searchOnlyClips.length &&
      app.tieredArchivedStore?.needsLazyLoading() &&
      typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
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

  return allClips.filter(clip => {
    const query = app.searchQuery ? app.searchQuery.toLowerCase() : '';
    const title = getClipTitle(clip).toLowerCase();
    if (query && !clip.text.toLowerCase().includes(query) && !title.includes(query)) {
      return false;
    }

    if (app.selectedCategory && clip.category !== app.selectedCategory) {
      return false;
    }

    if (app.selectedDateFilter) {
      const clipDate = new Date(clip.timestamp);
      const now = new Date();
      switch (app.selectedDateFilter) {
        case 'today':
          if (clipDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week': {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (clipDate < weekAgo) return false;
          break;
        }
        case 'month': {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          if (clipDate < monthAgo) return false;
          break;
        }
      }
    }

    return true;
  });
}

export function createSearchResultItem(app, clip) {
  const item = document.createElement('div');
  item.className = 'search-result-item';
  item.dataset.clipId = clip.id;

  const isSelected = app.selectedSearchClips.has(getClipIdKey(clip.id));
  if (isSelected) item.classList.add('selected');

  const truncatedText = clip.text.length > 100 ? clip.text.substring(0, 100) + '...' : clip.text;
  const timeAgo = app.getTimeAgo(clip.timestamp);
  const clipTitle = getClipTitle(clip);
  const displayTitle = clipTitle || getClipFallbackTitle(clip, 64);
  const sMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
  const sBadge = window.PCMarkup ? window.PCMarkup.getMarkupBadgeForClip(clip.text, sMeta) : '';
  const sPreview = window.PCMarkup ? window.PCMarkup.renderMarkupPreview(clip.text, sMeta, 200) : '';
  const searchTextContent = sPreview
    ? `<div class="pc-search-preview" title="${app.escapeHtml(clip.text)}">${sPreview}</div>`
    : `<div title="${app.escapeHtml(clip.text)}">${app.escapeHtml(truncatedText)}</div>`;

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
      <button class="chip-title-btn" title="Edit clip title"><i data-lucide="pencil"></i></button>
      <button class="chip-breakdown-btn" title="AI Breakdown"><i data-lucide="brain"></i></button>
      <button class="chip-open-btn" title="Open"><i data-lucide="search"></i></button>
      <button class="chip-share-btn" title="Share"><i data-lucide="link"></i></button>
      <button class="chip-summary-btn" title="AI Summary"><i data-lucide="notebook-pen"></i></button>
      <button class="search-notes-btn" title="Send to Notes"><i data-lucide="folder-plus"></i></button>
      <button class="chip-category-btn" title="Add to category"><i data-lucide="folder"></i></button>
      <button class="btn-copy" title="Copy to clipboard"><i data-lucide="clipboard"></i></button>
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
  item.querySelector('.chip-breakdown-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    app.showBreakdownModal(app.getSelectedOrCurrentText(clip.text, 'search'));
  });
  item.querySelector('.chip-open-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof app.openClipViewer === 'function') app.openClipViewer(clip);
  });
  item.querySelector('.chip-share-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    app.showShareMenuForClip(clip);
  });
  item.querySelector('.chip-summary-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    app.showSummaryModal(app.getSelectedOrCurrentText(clip.text, 'search'));
  });
  item.querySelector('.search-notes-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await app.loadNotes();
    app.showAlbumPicker();
    app.pendingClipForNotes = clip;
  });
  item.querySelector('.chip-category-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    app.pendingText = clip.text;
    app.pendingClipId = getClipIdKey(clip.id);
    app.showCategoryModal(true);
  });

  return item;
}

export function createCategoryClipsHTML(app, clips) {
  if (clips.length === 0) {
    return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
  }

  return clips.map(clip => {
    const truncatedText = clip.text.length > 60 ? clip.text.substring(0, 60) + '...' : clip.text;
    const timeAgo = app.getTimeAgo(clip.timestamp);
    const isSelected = app.selectedCategoryClips.has(getClipIdKey(clip.id));
    const clipTitle = getClipTitle(clip);
    const displayTitle = clipTitle || getClipFallbackTitle(clip, 46);
    const cMeta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
    const cBadge = window.PCMarkup ? window.PCMarkup.getMarkupBadgeForClip(clip.text, cMeta) : '';
    const cPreview = window.PCMarkup ? window.PCMarkup.renderMarkupPreview(clip.text, cMeta, 120) : '';
    const catTextContent = cPreview
      ? `<div class="pc-cat-preview" title="${app.escapeHtml(clip.text)}">${cPreview}</div>`
      : `<span title="${app.escapeHtml(clip.text)}">${app.escapeHtml(truncatedText)}</span>`;

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
          <button class="category-clip-title-btn" data-clip-id="${clip.id}" title="Edit clip title"><i data-lucide="pencil"></i></button>
          <button class="category-clip-breakdown-btn" data-clip-id="${clip.id}" title="AI Breakdown"><i data-lucide="brain"></i></button>
          <button class="category-clip-open-btn" data-clip-id="${clip.id}" title="Open"><i data-lucide="search"></i></button>
          <button class="category-clip-share-btn" data-clip-id="${clip.id}" title="Share"><i data-lucide="link"></i></button>
          <button class="category-clip-summary-btn" data-clip-id="${clip.id}" title="AI Summary"><i data-lucide="notebook-pen"></i></button>
          <button class="category-clip-notes-btn" data-clip-id="${clip.id}" title="Send to Notes"><i data-lucide="folder-plus"></i></button>
          <button class="category-clip-copy-btn" data-clip-id="${clip.id}" title="Copy"><i data-lucide="clipboard"></i></button>
        </div>
      </div>
    `;
    console.log(`🏗️ Creating category clip with ID: ${clip.id} (type: ${typeof clip.id})`);
    return html;
  }).join('');
}
