import * as likedRender from './liked.render.js';

export function initLikedFeature(app) {
  likedRender.setupLikedPageEvents(app);

  return {
    render: likedRender,
  };
}
