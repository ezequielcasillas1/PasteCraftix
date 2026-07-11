/** Imports popup controllers concurrently, then initializes in dependency order. */

const FEATURE_LOADERS = [
  ['clipsFeature', '../clips/clips.controller.js', 'initClipsFeature'],
  ['likedFeature', '../liked/liked.controller.js', 'initLikedFeature'],
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

const moduleImportPromises = new Map();
const appInitializationPromises = new WeakMap();
const appFeaturePromises = new WeakMap();

function defaultImportModule(moduleUrl) {
  return import(moduleUrl);
}

function importFeatureModule(modulePath, importModule) {
  const moduleUrl = new URL(modulePath, import.meta.url).href;
  if (importModule !== defaultImportModule) return importModule(moduleUrl);
  if (!moduleImportPromises.has(moduleUrl)) {
    moduleImportPromises.set(moduleUrl, importModule(moduleUrl));
  }
  return moduleImportPromises.get(moduleUrl);
}

function initializeLoadedFeatures(app, modules) {
  FEATURE_LOADERS.forEach(([featureKey, , initFnName], index) => {
    if (app[featureKey]) return;
    app[featureKey] = modules[index][initFnName](app);
  });
  return app;
}

function getFeaturePromiseMap(app) {
  if (!appFeaturePromises.has(app)) appFeaturePromises.set(app, new Map());
  return appFeaturePromises.get(app);
}

export function initializePopupFeature(app, featureKey, modulePath, initFnName) {
  if (app[featureKey]) return Promise.resolve(app[featureKey]);
  const featurePromises = getFeaturePromiseMap(app);
  if (featurePromises.has(featureKey)) return featurePromises.get(featureKey);

  const initialization = importFeatureModule(modulePath, defaultImportModule).then((module) => {
    if (!app[featureKey]) app[featureKey] = module[initFnName](app);
    return app[featureKey];
  });
  featurePromises.set(featureKey, initialization);
  return initialization;
}

export function initializeAllPopupFeatures(app, options = {}) {
  if (appInitializationPromises.has(app)) {
    return appInitializationPromises.get(app);
  }

  const importModule = options.importModule || defaultImportModule;
  const initialization = Promise.all(
    FEATURE_LOADERS.map(([, modulePath]) => importFeatureModule(modulePath, importModule)),
  ).then((modules) => initializeLoadedFeatures(app, modules));

  appInitializationPromises.set(app, initialization);
  return initialization;
}
