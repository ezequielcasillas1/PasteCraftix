/** Profile AI image stubs retained after image generation removal. */

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
  void _refreshCreditsAfterGen;
  void PROFILE_GEN_BTN_HTML;
  app.showToast('AI image generation has been removed. Upload your own image in Profile instead.', 'info');
}

export async function generateRandomAIImage(app) {
  void RANDOM_GEN_BTN_HTML;
  void RANDOM_ANIMALS;
  app.showToast('AI image generation has been removed. Upload your own image in Profile instead.', 'info');
}
