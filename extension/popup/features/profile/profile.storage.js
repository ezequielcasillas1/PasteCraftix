import {
  PROFILE_STORAGE_KEYS,
  PROFILE_ELEMENT_IDS,
} from './profile.constants.js';
import { refreshProfileNameFields } from './profile.render.js';

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
    const savedAt = Date.now();
    if (!app.userProfile || typeof app.userProfile !== 'object') app.userProfile = {};
    app.userProfile.profileUpdatedAt = savedAt;

    console.log('🔄 Attempting to save user profile:', app.userProfile);
    await chrome.storage.local.set({
      [PROFILE_STORAGE_KEYS.USER_PROFILE]: app.userProfile,
      pc_local_updatedAt: savedAt,
    });
    console.log('✅ User profile saved successfully to chrome.storage.local');

    const verification = await chrome.storage.local.get([PROFILE_STORAGE_KEYS.USER_PROFILE]);
    app.userProfile = verification[PROFILE_STORAGE_KEYS.USER_PROFILE] || app.userProfile;
    console.log('🔍 Verification - Profile in storage:', app.userProfile);

    await _syncProfileToSupabase(app.userProfile);
    refreshProfileNameFields(app);
    return true;
  } catch (error) {
    console.error('❌ CRITICAL: Failed to save user profile:', error);
    app.showToast('❌ Failed to save profile', 'error');
    return false;
  }
}

// ── Inline name-save helpers (extracted from setupProfileModalEvents) ────────

export async function saveUserName(app) {
  try {
    const userName = document.getElementById(PROFILE_ELEMENT_IDS.userName)?.value?.trim() || '';
    if (!userName) {
      app.showToast('📝 Enter your display name first', 'error');
      return false;
    }
    if (!app.userProfile) app.userProfile = {};
    app.userProfile.userName = userName;
    const saved = await saveUserProfile(app);
    if (!saved) return false;
    app.showToast('✅ Display name saved', 'success');
    return true;
  } catch (error) {
    console.error('Failed to save name:', error);
    app.showToast('❌ Failed to save name', 'error');
    return false;
  }
}

function _trimName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function _resolvePendingFunkyName(app) {
  const candidates = [
    _trimName(app._pendingFunkyAiName),
    _trimName(document.getElementById(PROFILE_ELEMENT_IDS.aiNameValue)?.textContent),
    _trimName(app.userProfile?.aiGeneratedName),
  ];
  return candidates.find((name) => name && name !== '-') || '';
}

export async function saveAiNameToProfile(app) {
  try {
    const aiName = _resolvePendingFunkyName(app);

    if (!aiName) {
      app.showToast('🎨 Please generate a funky animal name first', 'error');
      return false;
    }
    if (!app.userProfile) app.userProfile = {};
    app.userProfile.aiGeneratedName = aiName;
    app._pendingFunkyAiName = aiName;

    const saved = await saveUserProfile(app);
    if (!saved) return false;

    app.updateAIGenerateButtonState();
    app.showToast('✅ Funky name saved', 'success');
    return true;
  } catch (error) {
    console.error('Failed to save funky name:', error);
    app.showToast('❌ Failed to save funky name', 'error');
    return false;
  }
}
