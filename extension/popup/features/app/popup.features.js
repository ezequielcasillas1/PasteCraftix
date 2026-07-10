/** Lazy-load popup feature controllers in dependency order. */

const FEATURE_LOADERS = [
  ['clipsFeature', '../clips/clips.controller.js', 'initClipsFeature'],
  ['categoriesFeature', '../categories/categories.controller.js', 'initCategoriesFeature'],
  ['filesFeature', '../files/files.controller.js', 'initFilesFeature'],
  ['notesFeature', '../notes/notes.controller.js', 'initNotesFeature'],
  ['widgetsFeature', '../widgets/widgets.controller.js', 'initWidgetsFeature'],
  ['aiLabFeature', '../ai-lab/ai-lab.controller.js', 'initAiLabFeature'],
  ['settingsFeature', '../settings/settings.controller.js', 'initSettingsFeature'],
  ['activityFeature', '../activity/activity.controller.js', 'initActivityFeature'],
  ['authFeature', '../auth/auth.controller.js', 'initAuthFeature'],
  ['profileFeature', '../profile/profile.controller.js', 'initProfileFeature'],
  ['billingFeature', '../billing/billing.controller.js', 'initBillingFeature'],
  ['syncFeature', '../sync/sync.controller.js', 'initSyncFeature'],
];

export async function initializePopupFeature(app, featureKey, modulePath, initFnName) {
  if (app[featureKey]) return app[featureKey];
  const mod = await import(new URL(modulePath, import.meta.url).href);
  app[featureKey] = mod[initFnName](app);
  return app[featureKey];
}

export async function initializeAllPopupFeatures(app) {
  for (const [key, path, initName] of FEATURE_LOADERS) {
    await initializePopupFeature(app, key, path, initName);
  }
  return app;
}
