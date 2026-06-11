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
    const syncableProfile = {
      ...profile,
      profileImageUrl: null,
      profileImageBase64: null,
      generatedImageUrl: null,
      aiGeneratedImage: false,
    };
    await pasteCraftSupabase.syncUserProfileToSupabase(syncableProfile);
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
