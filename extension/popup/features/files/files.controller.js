import * as constants from './files.constants.js';
import * as service from './files.service.js';
import * as render from './files.render.js';
import * as events from './files.events.js';

const initializationPromises = new WeakMap();

export function initializeFilesOnFirstUse(app) {
  if (initializationPromises.has(app)) return initializationPromises.get(app);

  const initialization = service.loadFilesData(app)
    .then(() => {
      events.setupFilesEvents(app);
      render.renderFiles(app);
      return app.filesFeature;
    })
    .catch((error) => {
      initializationPromises.delete(app);
      throw error;
    });
  initializationPromises.set(app, initialization);
  return initialization;
}

export function initFilesFeature(app) {
  const feature = {
    constants,
    service,
    render,
    events,
    initialize: initializeFilesOnFirstUse,
  };

  app.filesFeature = feature;
  return feature;
}
