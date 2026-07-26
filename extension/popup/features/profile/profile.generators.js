import { PROFILE_ELEMENT_IDS, ANIMAL_TYPES_REGEX } from './profile.constants.js';
import * as sel from './profile.selectors.js';

// ── Private helpers ─────────────────────────────────────────────────────────

// Premium gate. Returns true when the feature may proceed.
// Mirrors prior popup.js behavior: skip check if there is no signed-in user.
async function _checkPremiumAccess(app, feature) {
  if (!app.currentUser) return true;
  try {
    return await pasteCraftSupabase.checkPremiumAccess(app.currentUser.id, feature);
  } catch (err) {
    console.error(`[profile.generators] premium check failed for ${feature}:`, err);
    return false;
  }
}

function _setLoadingText(text) {
  const loadingTextEl = document.querySelector('.loading-text');
  if (loadingTextEl) loadingTextEl.textContent = text;
}

function _setDisplay(id, display) {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

function _showGenerationLoading(text) {
  _setDisplay('profileImageLoading', 'flex');
  _setLoadingText(text);
  _setDisplay(PROFILE_ELEMENT_IDS.profileImage, 'none');
  _setDisplay(PROFILE_ELEMENT_IDS.profileImagePlaceholder, 'none');
}

function _hideGenerationLoading({ showPlaceholder = false } = {}) {
  _setDisplay('profileImageLoading', 'none');
  if (showPlaceholder) {
    _setDisplay(PROFILE_ELEMENT_IDS.profileImagePlaceholder, 'flex');
  }
}

function _displayGeneratedImage(imageUrl) {
  _setDisplay('profileImageLoading', 'none');
  const profileImg = sel.getProfileImage();
  if (profileImg) {
    profileImg.src = imageUrl;
    profileImg.style.display = 'block';
  }
  _setDisplay(PROFILE_ELEMENT_IDS.profileImagePlaceholder, 'none');
}

function _extractAnimalType(aiName) {
  if (typeof aiName !== 'string') return null;
  const match = aiName.match(ANIMAL_TYPES_REGEX);
  return match ? match[1] : null;
}

function _setButton(btnId, { disabled, text } = {}) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (typeof disabled === 'boolean') btn.disabled = disabled;
  if (typeof text === 'string') btn.textContent = text;
}

async function _persistGeneratedAvatar(app, imageUrl, extraProfileFields = {}) {
  if (!app.userProfile) app.userProfile = {};
  app.userProfile.profileImageUrl = imageUrl;
  app.userProfile.profileImageBase64 = imageUrl;
  Object.assign(app.userProfile, extraProfileFields);

  await app.saveUserProfile();
  console.log('✅ Generated avatar saved locally');

  app.displayImageTopLeft(imageUrl);
}

async function _refreshCreditsAfterGen(app) {
  try {
    if (app.currentUser?.id) {
      app.userSubscription = await pasteCraftSupabase.getUserSubscription(app.currentUser.id);
    }
  } catch (_) { /* best-effort */ }
  app.updateAiCreditsPills('post-gen');
}

function _readUserNameField() {
  const el = sel.getUserName();
  return typeof el?.value === 'string' ? el.value.trim() : '';
}

function _showCartoonError(app, error) {
  const message = (error && error.message) || 'Unknown error';
  if (message.includes('quota') || message.includes('billing')) {
    app.showToast('❌ OpenAI API quota exceeded. Check your billing.', 'error');
  } else if (message.includes('invalid')) {
    app.showToast('❌ Invalid API key. Check config.js', 'error');
  } else {
    app.showToast(`❌ Error: ${message}`, 'error');
  }
}

// ── generateAnimalAvatar ────────────────────────────────────────────────────

function _validateAnimalInputs(app, userName, aiGeneratedName) {
  if (!userName || !aiGeneratedName) {
    app.showToast('🎲 Please generate a funky animal name first', 'error');
    return false;
  }
  return true;
}

async function _runAnimalGeneration(app, userName, animalType, aiGeneratedName) {
  void app;
  void userName;
  void animalType;
  void aiGeneratedName;
  return '';
}

async function _onAnimalGenSuccess(app, imageUrl, animalType) {
  _displayGeneratedImage(imageUrl);
  await _persistGeneratedAvatar(app, imageUrl, { generatedImageUrl: imageUrl });
  app.startProfileImageCollapse();
  app.showToast(`✅ ${animalType} avatar created and saved!`, 'success');
  await _refreshCreditsAfterGen(app);
}

export async function generateAnimalAvatar(app) {
  void _checkPremiumAccess;
  void _validateAnimalInputs;
  void _extractAnimalType;
  void _runAnimalGeneration;
  void _onAnimalGenSuccess;
  void _hideGenerationLoading;
  app.showToast('Image generation has been removed. Upload your own image instead.', 'info');
}

// ── generateMyCartoon ───────────────────────────────────────────────────────

function _validateCartoonInputs(app, userName, userImageBase64) {
  if (!userName) {
    app.showToast('🎨 Please enter your name first', 'error');
    return false;
  }
  if (!userImageBase64) {
    app.showToast('📷 Please upload a photo first', 'error');
    return false;
  }
  return true;
}

async function _runCartoonGeneration(app, userName, userImageBase64) {
  void app;
  void userName;
  void userImageBase64;
  return '';
}

async function _onCartoonGenSuccess(app, imageUrl, userImageBase64) {
  _displayGeneratedImage(imageUrl);
  await _persistGeneratedAvatar(app, imageUrl, { aiGeneratedImage: true });
  app.startProfileImageCollapse();

  if (userImageBase64) {
    app.showToast('🎉 Your funky cartoon remix is ready and saved!', 'success');
  } else {
    app.showToast('✅ AI image generated and saved!', 'success');
  }

  await _refreshCreditsAfterGen(app);
}

export async function generateMyCartoon(app) {
  void _checkPremiumAccess;
  void _validateCartoonInputs;
  void _runCartoonGeneration;
  void _onCartoonGenSuccess;
  void _showCartoonError;
  void _hideGenerationLoading;
  app.showToast('Image generation has been removed. Upload your own image instead.', 'info');
}

// ── generateAIName ──────────────────────────────────────────────────────────

async function _persistAiName(app, userName, aiName) {
  if (!app.userProfile) app.userProfile = {};
  app.userProfile.userName = userName;
  app.userProfile.aiGeneratedName = aiName;
  app._pendingFunkyAiName = aiName;
  return app.saveUserProfile();
}

function _displayAiName(aiName) {
  const aiNameEl = sel.getAiNameValue();
  if (aiNameEl) {
    aiNameEl.textContent = aiName;
    aiNameEl.setAttribute('data-has-name', '1');
    aiNameEl.title = aiName;
  }
  _setDisplay('aiNameDisplay', 'flex');
}

function _emitProfileNameArtifact(app, userName, aiName) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  app.emitAiTaskOutput({
    source: 'profile.generators',
    taskType: 'profile-name',
    title: 'AI Profile Name',
    sourceText: userName,
    question: 'Generate funky animal name',
    outputText: aiName,
  });
}

export async function generateAIName(app) {
  const hasAccess = await _checkPremiumAccess(app, 'name');
  if (!hasAccess) return;

  try {
    const userName = _readUserNameField();
    if (!userName) {
      app.showToast('📝 Enter your display name above first', 'error');
      return;
    }

    app.showToast('🎲 Generating AI funky animal name...', 'info');
    _setButton('generateNameBtn', { disabled: true, text: '⏳ Generating...' });

    const result = await pasteCraftSupabase.generateAIName(userName);
    const aiName = typeof result === 'string' ? result : result?.aiName;

    if (aiName) {
      app._pendingFunkyAiName = aiName;
      _displayAiName(aiName);
      const saved = await _persistAiName(app, userName, aiName);
      _emitProfileNameArtifact(app, userName, aiName);
      app.updateAIGenerateButtonState();
      app.startNameSectionCollapse();
      if (!saved) {
        app.showToast('⚠️ Name generated but not saved — tap Save funky name', 'error');
      } else if (result?.cycleComplete) {
        app.showToast('🔄 Full animal cycle complete — deck reshuffled!', 'success');
      } else {
        app.showToast('✅ Funky animal name generated and saved!', 'success');
      }
    } else {
      const errMsg = result?.error || 'Failed to generate funky animal name';
      app.showToast(`❌ ${errMsg}`, 'error');
    }
  } catch (error) {
    console.error('Failed to generate AI name:', error);
    app.showToast('❌ Failed to generate funky animal name', 'error');
  } finally {
    _setButton('generateNameBtn', { disabled: false, text: 'Generate funky animal name' });
  }
}
