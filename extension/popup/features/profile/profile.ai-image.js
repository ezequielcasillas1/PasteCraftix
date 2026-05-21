/** Profile AI gallery image generation (from name / random). */

const PROFILE_GEN_BTN_HTML = '<span class="ai-gen-icon" aria-hidden="true"></span><span>Generate from Profile</span>';
const RANDOM_GEN_BTN_HTML = '<span class="ai-gen-icon" aria-hidden="true"></span><span>Random Avatar</span>';

const RANDOM_ANIMALS = ['Tiger', 'Dragon', 'Fox', 'Wolf', 'Lion', 'Eagle', 'Phoenix', 'Panda', 'Bear', 'Owl'];

async function _refreshCreditsAfterGen(app) {
  try {
    app.userSubscription = await pasteCraftSupabase.getUserSubscription(app.currentUser.id);
  } catch (_) {}
  app.updateAiCreditsPills('post-gen');
}

export async function generateAIImageFromProfile(app) {
  try {
    if (!app.userProfile?.aiGeneratedName) {
      app.showToast('Generate your funky name first in Profile!', 'error');
      return;
    }

    app.showToast('Generating AI image…', 'info');
    const btn = document.getElementById('aiGenerateFromProfileBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating…';
    }

    const gen = await pasteCraftSupabase.generateProfileImage(null, null, app.userProfile.aiGeneratedName);
    const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';

    if (imageUrl) {
      await app.addToGallery(imageUrl, 'profile');
      app.showToast('AI image generated!', 'success');
      app.showAIGenerationTimer();
      app.loadAIGallery();
      await _refreshCreditsAfterGen(app);
    } else {
      app.showToast('Failed to generate AI image', 'error');
    }
  } catch (error) {
    console.error('Failed to generate AI image:', error);
    app.showToast('Failed to generate AI image', 'error');
  } finally {
    const btn = document.getElementById('aiGenerateFromProfileBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = PROFILE_GEN_BTN_HTML;
    }
  }
}

export async function generateRandomAIImage(app) {
  try {
    app.showToast('Generating random avatar…', 'info');
    const btn = document.getElementById('aiGenerateRandomBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating…';
    }

    const randomAnimal = RANDOM_ANIMALS[Math.floor(Math.random() * RANDOM_ANIMALS.length)];
    const randomName = `Random${randomAnimal}`;

    const gen = await pasteCraftSupabase.generateProfileImage(null, null, randomName);
    const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';

    if (imageUrl) {
      await app.addToGallery(imageUrl, 'random');
      app.showToast('Random avatar generated!', 'success');
      app.showAIGenerationTimer();
      app.loadAIGallery();
      await _refreshCreditsAfterGen(app);
    } else {
      app.showToast('Failed to generate random avatar', 'error');
    }
  } catch (error) {
    console.error('Failed to generate random avatar:', error);
    app.showToast('Failed to generate random avatar', 'error');
  } finally {
    const btn = document.getElementById('aiGenerateRandomBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = RANDOM_GEN_BTN_HTML;
    }
  }
}
