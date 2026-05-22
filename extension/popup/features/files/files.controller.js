import * as constants from './files.constants.js';
import * as service from './files.service.js';
import * as render from './files.render.js';
import * as events from './files.events.js';

export function initFilesFeature(app) {
  const feature = {
    constants,
    service,
    render,
    events
  };
  
  app.filesFeature = feature;

  // Load data immediately
  service.loadFilesData(app).then(() => {
    render.renderFiles(app);
    events.setupFilesEvents(app);
  });

  return feature;
}
