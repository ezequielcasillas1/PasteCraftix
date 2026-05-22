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
  Object.assign(app.userProfile, extraProfileFields);

  await app.saveUserProfile();
  console.log('✅ Generated avatar saved to storage');

  await app.addToGallery(imageUrl, 'profile');
  console.log('✅ Generated avatar added to AI Gallery');

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
  _showGenerationLoading(`Creating your ${animalType}...`);
  app.showToast(`🦁 Creating your funky ${animalType}...`, 'info');
  _setButton(PROFILE_ELEMENT_IDS.generateAnimalBtn, { disabled: true, text: '⏳ Creating...' });

  const description = `${userName} - ${animalType} avatar`;
  const gen = await pasteCraftSupabase.generateProfileImage(description, 'animal', aiGeneratedName);
  return typeof gen?.imageUrl === 'string' ? gen.imageUrl : '';
}

async function _onAnimalGenSuccess(app, imageUrl, animalType) {
  _displayGeneratedImage(imageUrl);
  await _persistGeneratedAvatar(app, imageUrl, { generatedImageUrl: imageUrl });
  app.startProfileImageCollapse();
  app.showToast(`✅ ${animalType} avatar created and saved!`, 'success');
  await _refreshCreditsAfterGen(app);
}

export async function generateAnimalAvatar(app) {
  console.log('🦁 generateAnimalAvatar() CALLED!');

  const hasAccess = await _checkPremiumAccess(app, 'avatar');
  if (!hasAccess) return;

  try {
    const userName = _readUserNameField();
    const aiGeneratedName = app.userProfile?.aiGeneratedName;

    if (!_validateAnimalInputs(app, userName, aiGeneratedName)) return;

    const animalType = _extractAnimalType(aiGeneratedName);
    if (!animalType) {
      app.showToast('🐾 No animal found in your funky animal name', 'error');
      return;
    }

    const imageUrl = await _runAnimalGeneration(app, userName, animalType, aiGeneratedName);
    if (imageUrl) {
      await _onAnimalGenSuccess(app, imageUrl, animalType);
    }
  } catch (error) {
    console.error('Failed to generate animal avatar:', error);
    _hideGenerationLoading({ showPlaceholder: true });
    app.showToast('❌ Failed to generate animal avatar', 'error');
  } finally {
    _setButton(PROFILE_ELEMENT_IDS.generateAnimalBtn, { disabled: false, text: '🐾 Animal Avatar' });
  }
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
  _showGenerationLoading('Creating your cartoon...');
  app.showToast('🎨 Creating your cartoon avatar...', 'info');
  _setButton(PROFILE_ELEMENT_IDS.generateCartoonBtn, { disabled: true, text: '⏳ Creating...' });

  const description = `${userName} - cartoon avatar`;
  const gen = await pasteCraftSupabase.generateProfileImage(description, userImageBase64, null);
  return typeof gen?.imageUrl === 'string' ? gen.imageUrl : '';
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
  console.log('🎨 generateMyCartoon() CALLED!');

  const hasAccess = await _checkPremiumAccess(app, 'cartoon');
  if (!hasAccess) return;

  try {
    const userName = _readUserNameField();
    const userImageBase64 = app.userProfile?.profileImageBase64;

    if (!_validateCartoonInputs(app, userName, userImageBase64)) return;

    const imageUrl = await _runCartoonGeneration(app, userName, userImageBase64);
    if (imageUrl) {
      await _onCartoonGenSuccess(app, imageUrl, userImageBase64);
    } else {
      _hideGenerationLoading({ showPlaceholder: true });
      app.showToast('❌ Failed to generate AI image', 'error');
    }
  } catch (error) {
    console.error('Failed to generate AI profile image:', error);
    _hideGenerationLoading({ showPlaceholder: true });
    _showCartoonError(app, error);
  } finally {
    _setButton(PROFILE_ELEMENT_IDS.generateCartoonBtn, { disabled: false, text: '🎨 My Cartoon' });
  }
}

// ── generateAIName ──────────────────────────────────────────────────────────

async function _persistAiName(app, userName, aiName) {
  if (!app.userProfile) app.userProfile = {};
  app.userProfile.userName = userName;
  app.userProfile.aiGeneratedName = aiName;
  await app.saveUserProfile();
}

function _displayAiName(aiName) {
  const aiNameEl = sel.getAiNameValue();
  if (aiNameEl) aiNameEl.textContent = aiName;
  _setDisplay('aiNameDisplay', 'flex');
}

export async function generateAIName(app) {
  const hasAccess = await _checkPremiumAccess(app, 'name');
  if (!hasAccess) return;

  try {
    const userName = _readUserNameField();
    if (!userName) {
      app.showToast('📝 Please enter your name first', 'error');
      return;
    }

    app.showToast('🎲 Generating funky animal name...', 'info');
    _setButton('generateNameBtn', { disabled: true, text: '⏳ Generating...' });

    const result = await pasteCraftSupabase.generateAIName(userName);
    const aiName = typeof result === 'string' ? result : result?.aiName;

    if (aiName) {
      _displayAiName(aiName);
      await _persistAiName(app, userName, aiName);
      app.updateAIGenerateButtonState();
      app.startNameSectionCollapse();
      if (result?.cycleComplete) {
        app.showToast('🔄 Full animal cycle complete — deck reshuffled!', 'success');
      } else {
        app.showToast('✅ Funky animal name generated!', 'success');
      }
    } else {
      app.showToast('❌ Failed to generate funky animal name', 'error');
    }
  } catch (error) {
    console.error('Failed to generate AI name:', error);
    app.showToast('❌ Failed to generate funky animal name', 'error');
  } finally {
    _setButton('generateNameBtn', { disabled: false, text: 'Generate Funky Animal Name' });
  }
}
