import {
  LIKED_CLIPS_STORAGE_KEY,
  getLikedClipIds,
  toggleClipLiked,
} from '../../../shared/liked-clips.js';
import { getClipIdKey } from './clips.state.js';

function ensureLikedSet(app) {
  if (!(app.likedClipIds instanceof Set)) {
    app.likedClipIds = new Set();
  }
  return app.likedClipIds;
}

export async function hydrateLikedClipIds(app) {
  const ids = await getLikedClipIds();
  app.likedClipIds = new Set(ids);
  return app.likedClipIds;
}

export function isClipLikedInApp(app, clipId) {
  const key = getClipIdKey(clipId);
  if (!key) return false;
  return ensureLikedSet(app).has(key);
}

export async function toggleClipLike(app, clipId) {
  const key = getClipIdKey(clipId);
  if (!key) return false;

  const { liked, ids } = await toggleClipLiked(key);
  app.likedClipIds = new Set(ids);
  // #region agent log
  console.warn('[PasteCraft:debug:liked0711]', {
    runId: 'post-fix',
    hypothesisId: 'H3',
    location: 'clips.liked.js:toggleClipLike',
    message: 'clip heart toggled',
    data: {
      liked,
      key,
      idCount: ids.length,
      currentTab: app.currentTab || '',
    },
  });
  // #endregion
  if (app.currentTab === 'liked' && typeof app.likedFeature?.render?.renderLikedPage === 'function') {
    app.likedFeature.render.renderLikedPage(app);
  }
  return liked;
}

export function setupLikedStorageListener(app) {
  if (app._likedClipsStorageListener) return;

  app._likedClipsStorageListener = (changes, area) => {
    if (area !== 'local' || !changes[LIKED_CLIPS_STORAGE_KEY]) return;
    const next = changes[LIKED_CLIPS_STORAGE_KEY].newValue;
    app.likedClipIds = new Set(
      Array.isArray(next) ? next.map((id) => getClipIdKey(id)).filter(Boolean) : []
    );
    if (typeof app.renderChips === 'function') {
      app.renderChips();
    }
    if (app.currentTab === 'liked' && typeof app.likedFeature?.render?.renderLikedPage === 'function') {
      app.likedFeature.render.renderLikedPage(app);
    }
  };

  chrome.storage.onChanged.addListener(app._likedClipsStorageListener);
}

export { LIKED_CLIPS_STORAGE_KEY };
