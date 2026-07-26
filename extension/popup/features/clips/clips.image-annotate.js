/**
 * Clips adapter for shared image annotate — persists to clip side-store.
 * UI/tools live in extension/shared/image-annotate.js.
 */

import { getClipImage, putClipImage } from '../../../shared/clip-images.js';
import { closeImageAnnotate, openImageAnnotate } from '../../../shared/image-annotate.js';
import {
  openAnnotateFullscreenWindow,
  resolveExtensionPageUrl,
} from '../../../shared/image-annotate-window.js';
import { getClipIdKey } from './clips.state.js';

function findClipById(app, id) {
  const key = getClipIdKey(id);
  return (
    app?.clips?.find((c) => getClipIdKey(c?.id) === key) ||
    app?.searchOnlyClips?.find((c) => getClipIdKey(c?.id) === key) ||
    app?.currentClipViewerClip ||
    null
  );
}

function markClipHasImage(clip) {
  if (!clip?.meta?.image) return;
  clip.meta.image.hasImage = true;
  clip.meta.image.dataUrl = '';
  delete clip.meta.image.tooLarge;
}

function isStandaloneAnnotatePage() {
  try {
    return /clip-image-annotate\.html/i.test(String(location?.pathname || ''));
  } catch (_) {
    return false;
  }
}

async function reopenViewerAfterSave(app, clip) {
  if (typeof app?.clipsFeature?.viewer?.open !== 'function' || !clip) return;
  await app.clipsFeature.viewer.open(app, clip, app.clipViewerSourceContext || 'clips');
}

async function resolveAnnotateSource(clipId, dataUrl) {
  const id = clipId != null ? String(clipId) : '';
  let src = typeof dataUrl === 'string' ? dataUrl : '';
  if (!src.startsWith('data:image/') && id) {
    const stored = await getClipImage(id);
    src = stored?.dataUrl || '';
  }
  return { id, src };
}

async function persistClipAnnotation(app, id, outUrl) {
  if (id) await putClipImage(id, outUrl, 'image/png');
  const clip = findClipById(app, id);
  markClipHasImage(clip);
  if (app?.currentClipViewerClip && getClipIdKey(app.currentClipViewerClip.id) === getClipIdKey(id)) {
    app.currentClipViewerClip = clip || app.currentClipViewerClip;
  }
  app?.showToast?.('Annotation saved', 'success');
  try { chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {}); } catch (_) {}
  return clip;
}

function annotateOptionsForClips(app, id, src, pageMode) {
  return {
    dataUrl: src,
    ui: app,
    saveBehavior: pageMode ? 'bake' : 'close',
    awaitResult: !pageMode,
    onSave: (outUrl) => persistClipAnnotation(app, id, outUrl),
    onCancel: pageMode
      ? () => {
          try { window.close(); } catch (_) {}
        }
      : null,
  };
}

export async function openClipImageAnnotate(app, { clipId, dataUrl }) {
  const { id, src } = await resolveAnnotateSource(clipId, dataUrl);
  if (!src.startsWith('data:image/')) {
    app?.showToast?.('No image to annotate', 'error');
    return { ok: false };
  }

  const pageMode = isStandaloneAnnotatePage();
  const result = await openImageAnnotate(annotateOptionsForClips(app, id, src, pageMode));
  if (!pageMode && result?.ok) {
    await reopenViewerAfterSave(app, findClipById(app, id));
  }
  if (pageMode) return result;
  return { ok: Boolean(result?.ok || result?.cancelled) };
}

export function closeClipImageAnnotate() {
  closeImageAnnotate();
}

function resolveAnnotatePopupUrl(clipId) {
  return resolveExtensionPageUrl(
    'clip-image-annotate.html',
    `clipId=${encodeURIComponent(String(clipId))}`,
  );
}

/** Open annotate as a left-docked fullscreen popup window. */
export function popOutClipImageAnnotate(app, { clipId }) {
  const id = clipId != null ? String(clipId) : '';
  if (!id) {
    app?.showToast?.('No image clip to pop out', 'error');
    return { ok: false };
  }
  return openAnnotateFullscreenWindow(resolveAnnotatePopupUrl(id), app);
}
