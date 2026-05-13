import { PROFILE_DEFAULTS } from './profile.constants.js';
import * as profileStorage from './profile.storage.js';

export function initProfileFeature(app) {
  if (app.currentGalleryPage === undefined) {
    app.currentGalleryPage = PROFILE_DEFAULTS.GALLERY_DEFAULT_PAGE;
  }

  return { storage: profileStorage };
}
