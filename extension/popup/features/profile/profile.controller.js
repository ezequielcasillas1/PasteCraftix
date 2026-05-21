import { PROFILE_DEFAULTS } from './profile.constants.js';
import * as profileStorage from './profile.storage.js';
import * as profileRender from './profile.render.js';
import * as profileEvents from './profile.events.js';
import * as profileGenerators from './profile.generators.js';
import * as profileGallery from './profile.gallery.js';
import * as profileAiImage from './profile.ai-image.js';
import * as profileViewer from './profile.viewer.js';

export function initProfileFeature(app) {
  if (app.currentGalleryPage === undefined) {
    app.currentGalleryPage = PROFILE_DEFAULTS.GALLERY_DEFAULT_PAGE;
  }

  return {
    storage: profileStorage,
    render: profileRender,
    events: profileEvents,
    generators: profileGenerators,
    gallery: profileGallery,
    aiImage: profileAiImage,
    viewer: profileViewer,
  };
}
