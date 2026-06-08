import {
  PROFILE_STORAGE_KEYS,
  PROFILE_ELEMENT_IDS,
  PROFILE_DEFAULTS,
} from './profile.constants.js';

// ── renderAIGallery ───────────────────────────────────────────────────────────

export function renderAIGallery(app, gallery) {
  const galleryGrid = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryGrid);
  const galleryCount = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryCount);
  const paginationContainer = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryPagination);

  if (!galleryGrid || !galleryCount) return;

  const imagesPerPage = PROFILE_DEFAULTS.GALLERY_PAGE_SIZE;
  const totalPages = Math.ceil(gallery.length / imagesPerPage);

  if (!app.currentGalleryPage) app.currentGalleryPage = PROFILE_DEFAULTS.GALLERY_DEFAULT_PAGE;
  if (app.currentGalleryPage > totalPages && totalPages > 0) app.currentGalleryPage = totalPages;

  galleryCount.textContent = `${gallery.length} image${gallery.length !== 1 ? 's' : ''}`;

  if (gallery.length === 0) {
    galleryGrid.innerHTML = `
      <div class="ai-gallery-empty">
        <div class="ai-empty-icon"><i data-lucide="palette"></i></div>
        <h4>No images yet</h4>
        <p>Upload your first image to start your gallery</p>
      </div>
    `;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  const startIndex = (app.currentGalleryPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentPageImages = gallery.slice(startIndex, endIndex);
  const currentProfileUrl = app.userProfile?.profileImageUrl;

  galleryGrid.innerHTML = currentPageImages.map((item, pageIndex) => {
    const actualIndex = startIndex + pageIndex;
    const isCurrentProfile = item.url === currentProfileUrl;
    const safeImageUrl = /^(https?:\/\/|data:image\/)/i.test(String(item.url || ''))
      ? app.escapeHtml(item.url || '')
      : '';
    return `
    <div class="ai-gallery-item ${isCurrentProfile ? 'is-profile' : ''}" data-index="${actualIndex}">
      <img src="${safeImageUrl}" alt="Saved image ${actualIndex + 1}" />
      ${isCurrentProfile ? '<div class="ai-profile-badge">✨ Profile</div>' : ''}
      <div class="ai-gallery-item-actions">
        <button class="ai-gallery-action-btn set-profile" data-action="set-profile" data-index="${actualIndex}" title="Set as Profile Image">
          👤
        </button>
        <button class="ai-gallery-action-btn delete" data-action="delete" data-index="${actualIndex}" title="Delete">
          🗑️
        </button>
      </div>
    </div>
  `;
  }).join('');

  setupGalleryEventListeners(app);
  renderGalleryPagination(app, totalPages);
}

// ── setupGalleryEventListeners ────────────────────────────────────────────────

export function setupGalleryEventListeners(app) {
  const galleryGrid = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryGrid);
  if (!galleryGrid) return;

  galleryGrid.removeEventListener('click', app.handleGalleryClick);
  app.handleGalleryClick = (e) => {
    const button = e.target.closest('.ai-gallery-action-btn');
    if (!button) return;

    e.stopPropagation();
    const action = button.dataset.action;
    const index = parseInt(button.dataset.index);

    if (action === 'set-profile') {
      app.setAsProfile(index);
    } else if (action === 'delete') {
      app.deleteFromGallery(index);
    }
  };

  galleryGrid.addEventListener('click', app.handleGalleryClick);
}

// ── renderGalleryPagination ───────────────────────────────────────────────────

export function renderGalleryPagination(app, totalPages) {
  const paginationContainer = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryPagination);
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  let paginationHTML = '';

  paginationHTML += `
    <button class="pagination-btn" ${app.currentGalleryPage === 1 ? 'disabled' : ''} 
      data-page="${app.currentGalleryPage - 1}">
      ◀
    </button>
  `;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, app.currentGalleryPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <button class="pagination-btn ${i === app.currentGalleryPage ? 'active' : ''}" 
        data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  paginationHTML += `
    <button class="pagination-btn" ${app.currentGalleryPage === totalPages ? 'disabled' : ''} 
      data-page="${app.currentGalleryPage + 1}">
      ▶
    </button>
  `;

  paginationContainer.innerHTML = paginationHTML;

  setupPaginationEventListeners(app);
}

// ── setupPaginationEventListeners ─────────────────────────────────────────────

export function setupPaginationEventListeners(app) {
  const paginationContainer = document.getElementById(PROFILE_ELEMENT_IDS.aiGalleryPagination);
  if (!paginationContainer) return;

  paginationContainer.removeEventListener('click', app.handlePaginationClick);
  app.handlePaginationClick = (e) => {
    const button = e.target.closest('.pagination-btn');
    if (!button || button.disabled) return;

    const page = parseInt(button.dataset.page);
    if (!isNaN(page)) {
      goToGalleryPage(app, page);
    }
  };

  paginationContainer.addEventListener('click', app.handlePaginationClick);
}

// ── goToGalleryPage ───────────────────────────────────────────────────────────

export async function goToGalleryPage(app, page) {
  app.currentGalleryPage = page;
  const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
  const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];
  renderAIGallery(app, gallery);
}

// ── setAsProfile ──────────────────────────────────────────────────────────────

export async function setAsProfile(app, index) {
  const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
  const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];

  if (index < 0 || index >= gallery.length) {
    app.showToast('⚠ Invalid gallery image', 'error');
    return;
  }

  const imageUrl = gallery[index].url;
  if (!imageUrl || typeof imageUrl !== 'string') {
    app.showToast('⚠ Gallery image has no URL', 'error');
    return;
  }

  if (!app.userProfile) app.userProfile = {};
  const previousImageUrl = app.userProfile.profileImageUrl || '';

  const rollback = async () => {
    try {
      app.userProfile.profileImageUrl = previousImageUrl;
      await chrome.storage.local.set({ [PROFILE_STORAGE_KEYS.USER_PROFILE]: app.userProfile });
      app.updateTopBarIdentity(previousImageUrl || undefined);
      renderAIGallery(app, gallery);
    } catch (_) {}
  };

  try {
    app.displayImageTopLeft(imageUrl);
    app.userProfile.profileImageUrl = imageUrl;

    const userIdForUpload = (app.currentUser && app.currentUser.id)
      ? app.currentUser.id
      : await pasteCraftSupabase.getChromeUserId();

    let finalUrl = imageUrl;
    try {
      finalUrl = await PasteCraftCRUD.retryOperation(async () => {
        const converted = await pasteCraftSupabase.convertToPermanentProfileImageUrl(imageUrl, userIdForUpload);
        return converted || imageUrl;
      }, 2, 500);
    } catch (_) {
      finalUrl = imageUrl;
    }

    if (finalUrl && finalUrl !== imageUrl) {
      gallery[index].url = finalUrl;
      try { await chrome.storage.local.set({ [PROFILE_STORAGE_KEYS.AI_GALLERY]: gallery }); } catch (_) {}
    }

    app.userProfile.profileImageUrl = finalUrl;

    await PasteCraftCRUD.retryOperation(async () => {
      await app.saveUserProfile();
    }, 2, 300);

    const verification = await chrome.storage.local.get([PROFILE_STORAGE_KEYS.USER_PROFILE]);
    if (!verification[PROFILE_STORAGE_KEYS.USER_PROFILE] || 
        verification[PROFILE_STORAGE_KEYS.USER_PROFILE].profileImageUrl !== finalUrl) {
      console.error('Profile image verification failed, rolling back');
      await rollback();
      app.showToast('⚠ Failed to save profile image', 'error');
      return;
    }

    app.displayImageTopLeft(finalUrl);
    renderAIGallery(app, gallery);

    const profileImg = document.getElementById(PROFILE_ELEMENT_IDS.profileImage);
    const profilePlaceholder = document.getElementById(PROFILE_ELEMENT_IDS.profileImagePlaceholder);
    if (profileImg) {
      profileImg.src = finalUrl;
      profileImg.style.display = 'block';
    }
    if (profilePlaceholder) profilePlaceholder.style.display = 'none';

    app.showToast('✨ Profile image updated!', 'success');
  } catch (error) {
    console.error('Failed to set profile image:', error);
    await rollback();
    app.showToast('⚠ Failed to set profile image', 'error');
  }
}
