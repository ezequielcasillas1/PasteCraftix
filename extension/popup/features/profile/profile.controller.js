import * as profileStorage from './profile.storage.js';
import * as profileRender from './profile.render.js';
import * as profileEvents from './profile.events.js';
import * as profileGenerators from './profile.generators.js';
import * as profileAiImage from './profile.ai-image.js';
import * as profileViewer from './profile.viewer.js';
import * as profileSocialShare from './profile.social-share.js';
import * as profileAccountInfo from './profile.account-info.js';

export function initProfileFeature(app) {
  return {
    storage: profileStorage,
    render: profileRender,
    events: profileEvents,
    generators: profileGenerators,
    aiImage: profileAiImage,
    viewer: profileViewer,
    socialShare: profileSocialShare,
    accountInfo: profileAccountInfo,
  };
}
