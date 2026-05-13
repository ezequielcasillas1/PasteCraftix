import {
  PROFILE_STORAGE_KEYS,
  PROFILE_ELEMENT_IDS,
} from './profile.constants.js';

// ── loadUserProfile ──────────────────────────────────────────────────────────

export async function loadUserProfile(app) {
  try {
    console.log('🔄 Loading user profile from chrome.storage.local...');
    const { [PROFILE_STORAGE_KEYS.USER_PROFILE]: userProfile = null } =
      await chrome.storage.local.get([PROFILE_STORAGE_KEYS.USER_PROFILE]);
    app.userProfile = userProfile;
    console.log('✅ Loaded user profile:', app.userProfile);

    if (app.userProfile?.profileImageUrl) {
      console.log('✅ Profile image URL found:', app.userProfile.profileImageUrl);
    } else {
      console.log('🔍 No profile image URL in saved profile');
    }
  } catch (error) {
    console.error('❌ CRITICAL: Failed to load user profile:', error);
  }
}

// ── saveUserProfile ──────────────────────────────────────────────────────────

async function _syncProfileToSupabase(profile) {
  try {
    await pasteCraftSupabase.syncUserProfileToSupabase(profile);
    console.log('✅ User profile synced to database');
  } catch (syncError) {
    console.error('🔄 Failed to sync profile to database:', syncError);
  }
}

export async function saveUserProfile(app) {
  try {
    console.log('🔄 Attempting to save user profile:', app.userProfile);
    await chrome.storage.local.set({ [PROFILE_STORAGE_KEYS.USER_PROFILE]: app.userProfile });
    console.log('✅ User profile saved successfully to chrome.storage.local');

    const verification = await chrome.storage.local.get([PROFILE_STORAGE_KEYS.USER_PROFILE]);
    console.log('🔍 Verification - Profile in storage:', verification[PROFILE_STORAGE_KEYS.USER_PROFILE]);

    if (!verification[PROFILE_STORAGE_KEYS.USER_PROFILE]?.profileImageUrl) {
      console.error('⚠️ WARNING: Profile saved but verification failed!');
    }

    await _syncProfileToSupabase(app.userProfile);
    app.updateTopBarIdentity();
  } catch (error) {
    console.error('❌ CRITICAL: Failed to save user profile:', error);
    app.showToast('❌ Failed to save profile image', 'error');
  }
}

// ── Gallery helpers ──────────────────────────────────────────────────────────

export async function addToGallery(app, imageUrl, type) {
  try {
    const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
    const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];
    gallery.push({ url: imageUrl, type, timestamp: Date.now() });
    await chrome.storage.local.set({ [PROFILE_STORAGE_KEYS.AI_GALLERY]: gallery });
  } catch (error) {
    console.error('Failed to add to gallery:', error);
  }
}

export async function loadAIGallery(app) {
  try {
    const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
    const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];
    app.renderAIGallery(gallery);
  } catch (error) {
    console.error('Failed to load AI gallery:', error);
  }
}

export async function migrateProfileImageToGallery(app) {
  try {
    if (!app.userProfile?.profileImageUrl) return;

    const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
    const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];
    const imageExists = gallery.some(item => item.url === app.userProfile.profileImageUrl);

    if (!imageExists) {
      console.log('🔄 Migrating existing profile image to gallery...');
      await addToGallery(app, app.userProfile.profileImageUrl, 'profile');
      loadAIGallery(app);
      console.log('✅ Profile image migrated to gallery');
    }
  } catch (error) {
    console.error('Failed to migrate profile image:', error);
  }
}

export async function deleteFromGallery(app, index) {
  try {
    const result = await chrome.storage.local.get(PROFILE_STORAGE_KEYS.AI_GALLERY);
    const gallery = result[PROFILE_STORAGE_KEYS.AI_GALLERY] || [];

    if (index >= 0 && index < gallery.length) {
      gallery.splice(index, 1);
      await chrome.storage.local.set({ [PROFILE_STORAGE_KEYS.AI_GALLERY]: gallery });
      app.renderAIGallery(gallery);
      app.showToast('🗑️ Image removed from gallery', 'success');
    }
  } catch (error) {
    console.error('Failed to delete from gallery:', error);
    app.showToast('❌ Failed to delete image', 'error');
  }
}

// ── Inline name-save helpers (extracted from setupProfileModalEvents) ────────

export async function saveUserName(app) {
  try {
    const userName = document.getElementById(PROFILE_ELEMENT_IDS.userName)?.value?.trim() || '';
    if (!userName) {
      app.showToast('🎨 Please enter a name first', 'error');
      return;
    }
    if (!app.userProfile) app.userProfile = {};
    app.userProfile.userName = userName;
    await saveUserProfile(app);
    app.showToast('✅ Name saved', 'success');
  } catch (error) {
    console.error('Failed to save name:', error);
    app.showToast('❌ Failed to save name', 'error');
  }
}

export async function saveAiNameToProfile(app) {
  try {
    const aiNameFromUi = document.getElementById(PROFILE_ELEMENT_IDS.aiNameValue)?.textContent?.trim() || '';
    const aiName = aiNameFromUi ||
      (typeof app.userProfile?.aiGeneratedName === 'string' ? app.userProfile.aiGeneratedName.trim() : '');

    if (!aiName || aiName === '-') {
      app.showToast('🎨 Please generate a funky animal name first', 'error');
      return;
    }
    if (!app.userProfile) app.userProfile = {};
    app.userProfile.aiGeneratedName = aiName;
    await saveUserProfile(app);
    app.updateAIGenerateButtonState();
    app.showToast('✅ Funky name saved', 'success');
  } catch (error) {
    console.error('Failed to save funky name:', error);
    app.showToast('❌ Failed to save funky name', 'error');
  }
}
