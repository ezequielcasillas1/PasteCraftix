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
  const newUploadBtn = _cloneReplace('uploadImageBtn');
  const profileImageUpload = document.getElementById('profileImageUpload');

  if (newUploadBtn && profileImageUpload) {
    newUploadBtn.addEventListener('click', () => {
      profileImageUpload.click();
    });

    profileImageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleProfileImageUpload(app, file);
      }
    });
  }
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

  _bindUploadHandlers(app);
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

async function _convertToPermanentUrl(app, imageUrl) {
  try {
    const userIdForUpload = app.currentUser?.id
      || await window.pasteCraftSupabase.getChromeUserId();
    const converted = await window.pasteCraftSupabase.convertToPermanentProfileImageUrl(imageUrl, userIdForUpload);
    return typeof converted === 'string' && converted ? converted : imageUrl;
  } catch (_) {
    return imageUrl;
  }
}

async function _saveImageToGallery(app, imageUrl) {
  try {
    await app.addToGallery(imageUrl, 'upload');
    app.loadAIGallery();
  } catch (_) {}
}

async function _processUploadedImage(app, imageUrl) {
  _displayUploadedImage(imageUrl);

  if (!app.userProfile) app.userProfile = {};
  app.userProfile.profileImageBase64 = imageUrl;

  const finalUrl = await _convertToPermanentUrl(app, imageUrl);
  app.userProfile.profileImageUrl = finalUrl;

  await app.saveUserProfile();
  app.displayImageTopLeft(finalUrl);
  await _saveImageToGallery(app, finalUrl);
  app.updateAIGenerateButtonState();

  app.showToast('✅ Profile image uploaded and saved to your gallery!', 'success');
}

// ── Public: handleProfileImageUpload ────────────────────────────────────────

export async function handleProfileImageUpload(app, file) {
  try {
    app.showToast('📷 Uploading image...', 'info');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = typeof e?.target?.result === 'string' ? e.target.result : '';
      if (!imageUrl) {
        app.showToast('❌ Failed to read image file', 'error');
        return;
      }
      await _processUploadedImage(app, imageUrl);
    };
    reader.readAsDataURL(file);

  } catch (error) {
    console.error('Failed to upload profile image:', error);
    app.showToast('❌ Failed to upload image', 'error');
  }
}
