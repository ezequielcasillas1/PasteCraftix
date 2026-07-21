/**
 * Clips adapter for shared image annotate — persists to clip side-store.
 * UI/tools live in extension/shared/image-annotate.js.
 */

import { getClipImage, putClipImage } from '../../../shared/clip-images.js';
import { closeImageAnnotate, openImageAnnotate } from '../../../shared/image-annotate.js';
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

function isRepoLoaderManifest() {
  try {
    const mf = chrome.runtime?.getManifest?.();
    const name = String(mf?.name || '');
    const desc = String(mf?.description || '');
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

function resolveAnnotatePopupUrl(clipId) {
  const path = isRepoLoaderManifest()
    ? 'extension/clip-image-annotate.html'
    : 'clip-image-annotate.html';
  return `${chrome.runtime.getURL(path)}?clipId=${encodeURIComponent(String(clipId))}`;
}

function leftFullscreenBounds() {
  const left = Number.isFinite(window.screen?.availLeft) ? window.screen.availLeft : 0;
  const top = Number.isFinite(window.screen?.availTop) ? window.screen.availTop : 0;
  const width = Math.max(480, Math.round(window.screen?.availWidth || 1280));
  const height = Math.max(480, Math.round(window.screen?.availHeight || 800));
  return { left, top, width, height };
}

function openAnnotateWindowFallback(url, bounds, app) {
  chrome.windows.create({
    url,
    type: 'popup',
    focused: true,
    ...bounds,
  }).catch(() => {
    app?.showToast?.('Could not open full screen window', 'error');
  });
}

/** Open annotate as a left-docked fullscreen popup window. */
export function popOutClipImageAnnotate(app, { clipId }) {
  const id = clipId != null ? String(clipId) : '';
  if (!id) {
    app?.showToast?.('No image clip to pop out', 'error');
    return { ok: false };
  }

  const url = resolveAnnotatePopupUrl(id);
  const bounds = leftFullscreenBounds();
  const payload = { action: 'pcOpenPopupWindow', url, ...bounds };

  try {
    chrome.runtime.sendMessage(payload, (response) => {
      const err = chrome.runtime.lastError;
      if (err || response?.success === false) {
        openAnnotateWindowFallback(url, bounds, app);
      }
    });
    return { ok: true };
  } catch (_) {
    try {
      chrome.windows.create({ url, type: 'popup', focused: true, ...bounds });
      return { ok: true };
    } catch (err) {
      app?.showToast?.(err?.message || 'Could not open full screen window', 'error');
      return { ok: false };
    }
  }
}
