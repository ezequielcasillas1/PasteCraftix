import { PROFILE_ELEMENT_IDS } from './profile.constants.js';
import * as sel from './profile.selectors.js';

// ── Private binding helpers ─────────────────────────────────────────────────

function _cloneReplace(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  return clone;
}

function _bindUploadHandlers(app) {
  const uploadBtn = document.getElementById('uploadImageBtn');
  const fileInput = document.getElementById('profileImageUpload');
  if (!uploadBtn || !fileInput) return false;

  const newUploadBtn = _cloneReplace('uploadImageBtn');
  const newFileInput = _cloneReplace('profileImageUpload');
  if (!newUploadBtn || !newFileInput) return false;

  newUploadBtn.type = 'button';
  newUploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    newFileInput.value = '';
    newFileInput.click();
  });

  newFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await handleProfileImageUpload(app, file);
    } finally {
      e.target.value = '';
    }
  });

  return true;
}

export function initProfileImageUpload(app) {
  if (app._profileImageUploadBound) return;
  if (!_bindUploadHandlers(app)) return;
  app._profileImageUploadBound = true;
}

function _bindNameHandlers(app) {
  const newSaveUserNameBtn = _cloneReplace('saveUserNameBtn');
  const newGenerateNameBtn = _cloneReplace('generateNameBtn');
  const newSaveAiNameBtn = _cloneReplace('saveAiNameBtn');

  if (newSaveUserNameBtn) {
    newSaveUserNameBtn.addEventListener('click', async () => {
      await app.saveUserName();
    });
  }

  if (newGenerateNameBtn) {
    newGenerateNameBtn.addEventListener('click', async () => {
      console.log('🎲 Generate Name button CLICKED!');
      await app.generateAIName();
    });
  }

  if (newSaveAiNameBtn) {
    newSaveAiNameBtn.addEventListener('click', async () => {
      await app.saveAiNameToProfile();
    });
  }
}

function _bindCollapseHandlers(app) {
  const newNameRegHeader = _cloneReplace('nameRegHeader');
  const newPhotoCreationHeader = _cloneReplace('photoCreationHeader');

  if (newNameRegHeader) {
    newNameRegHeader.addEventListener('click', () => {
      app.toggleSection('nameRegContent', 'nameToggleBtn');
    });
  }

  if (newPhotoCreationHeader) {
    newPhotoCreationHeader.addEventListener('click', () => {
      app.toggleSection('photoCreationContent', 'photoToggleBtn');
    });
  }
}

function _bindModalCloseHandlers(app) {
  const profileModal = sel.getProfileModal();
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target.id === PROFILE_ELEMENT_IDS.profileModal) {
        app.hideProfileModal();
      }
    });
  }
}

function _bindAccountInfoHandlers(app) {
  const resetBtn = _cloneReplace('profileResetPasswordBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      app.openPasswordResetFromProfile();
    });
  }

  const signInBtn = _cloneReplace('profileSignInBtn');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      app.hideProfileModal();
      app.showAuthModal();
    });
  }
}

function _bindUnsubscribeHandler(app) {
  const newUnsubscribeBtn = _cloneReplace('unsubscribeBtn');
  if (newUnsubscribeBtn) {
    newUnsubscribeBtn.addEventListener('click', () => {
      console.log('🚫 Unsubscribe button CLICKED!');
      app.showUnsubscribeConfirmation();
    });
  }
}

function _bindLoadingExitHandler() {
  const loadingExitBtn = document.getElementById('loadingExitBtn');
  if (loadingExitBtn) {
    loadingExitBtn.addEventListener('click', () => {
      console.log('🚪 User clicked exit button - hiding loading overlay');
      const loadingEl = document.getElementById('profileImageLoading');
      if (loadingEl) loadingEl.style.display = 'none';

      const profileImage = sel.getProfileImage();
      const placeholder = sel.getProfileImagePlaceholder();

      if (profileImage && profileImage.src) {
        profileImage.style.display = 'block';
      } else if (placeholder) {
        placeholder.style.display = 'flex';
      }
      console.log('✅ Loading screen closed - generation continues in background');
    });
  }
}

// ── Public: setupProfileModalEvents ─────────────────────────────────────────

export function setupProfileModalEvents(app) {
  if (app._profileModalEventsBound) return;
  app._profileModalEventsBound = true;

  initProfileImageUpload(app);
  _bindNameHandlers(app);
  _bindCollapseHandlers(app);
  _bindModalCloseHandlers(app);
  _bindAccountInfoHandlers(app);
  _bindUnsubscribeHandler(app);
  _bindLoadingExitHandler();
}

// ── Private: upload helpers ─────────────────────────────────────────────────

function _displayUploadedImage(imageUrl) {
  const profileImage = sel.getProfileImage();
  const placeholder = sel.getProfileImagePlaceholder();

  if (profileImage) {
    profileImage.src = imageUrl;
    profileImage.style.display = 'block';
  }
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

const PROFILE_IMAGE_MAX_DIMENSION = 512;
const PROFILE_IMAGE_MAX_DATA_URL_LENGTH = 220000;

function _readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = typeof e?.target?.result === 'string' ? e.target.result : '';
      if (!imageUrl) {
        reject(new Error('Failed to read image file'));
        return;
      }
      resolve(imageUrl);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function _loadImageElement(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image preview'));
    img.src = imageUrl;
  });
}

async function _optimizeImageForLocalStorage(file) {
  const originalDataUrl = await _readFileAsDataUrl(file);
  if (originalDataUrl.length <= PROFILE_IMAGE_MAX_DATA_URL_LENGTH) {
    return originalDataUrl;
  }

  const image = await _loadImageElement(originalDataUrl);
  const width = image.naturalWidth || image.width || PROFILE_IMAGE_MAX_DIMENSION;
  const height = image.naturalHeight || image.height || PROFILE_IMAGE_MAX_DIMENSION;
  const scale = Math.min(1, PROFILE_IMAGE_MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return originalDataUrl;

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const attempts = [
    ['image/webp', 0.82],
    ['image/webp', 0.68],
    ['image/jpeg', 0.8],
    ['image/jpeg', 0.62],
  ];

  let bestCandidate = originalDataUrl;
  for (const [type, quality] of attempts) {
    const candidate = canvas.toDataURL(type, quality);
    if (candidate.length < bestCandidate.length) bestCandidate = candidate;
    if (candidate.length <= PROFILE_IMAGE_MAX_DATA_URL_LENGTH) {
      return candidate;
    }
  }

  return bestCandidate;
}

async function _processUploadedImage(app, imageUrl) {
  _displayUploadedImage(imageUrl);

  if (!app.userProfile) app.userProfile = {};
  app.userProfile.profileImageBase64 = imageUrl;
  app.userProfile.profileImageUrl = imageUrl;
  app.userProfile.generatedImageUrl = null;
  app.userProfile.aiGeneratedImage = false;

  await app.saveUserProfile();
  app.displayImageTopLeft(imageUrl);
  app.updateAIGenerateButtonState();

  app.showToast('✅ Profile image uploaded and saved locally!', 'success');
}

// ── Public: handleProfileImageUpload ────────────────────────────────────────

export async function handleProfileImageUpload(app, file) {
  try {
    if (!file?.type?.startsWith('image/')) {
      app.showToast('❌ Please choose an image file', 'error');
      return;
    }

    app.showToast('📷 Uploading image...', 'info');

    let imageUrl;
    try {
      imageUrl = await _optimizeImageForLocalStorage(file);
    } catch (optimizeError) {
      console.warn('Profile image optimization failed, using original file:', optimizeError);
      imageUrl = await _readFileAsDataUrl(file);
    }

    await _processUploadedImage(app, imageUrl);
  } catch (error) {
    console.error('Failed to upload profile image:', error);
    app.showToast(error?.message === 'Failed to read image file' ? '❌ Failed to read image file' : '❌ Failed to upload image', 'error');
  }
}
