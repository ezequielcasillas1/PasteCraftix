/** @forward-slice Content → background clip save for Scholar capture tools. */

import { CAPTURE_MAX_TEXT } from './capture.constants.js';
import { incrementCaptureToolsStats } from './capture.stats.js';
import {
  peelImageDataUrlFromMeta,
  putClipImage,
  clearPendingClipImage,
  CLIP_IMAGE_CARRY_MAX,
  LOCAL_STORAGE_LIMIT_MESSAGE,
} from '../../shared/clip-images.js';

function pcSafeTrim(str, max) {
  const value = String(str ?? '');
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function isLocalStorageLimitMessage(value) {
  return String(value || '') === LOCAL_STORAGE_LIMIT_MESSAGE;
}

async function prepareClipImageForSave(meta) {
  const peeled = peelImageDataUrlFromMeta(meta);
  const lightMeta = peeled.meta ? { ...peeled.meta } : null;
  if (lightMeta?.image) {
    lightMeta.image = { ...lightMeta.image };
    delete lightMeta.image.dataUrl;
    if (peeled.dataUrl) lightMeta.image.hasImage = true;
  }
  const imageDataUrl = peeled.dataUrl && peeled.dataUrl.length <= CLIP_IMAGE_CARRY_MAX
    ? peeled.dataUrl
    : '';
  return {
    peeled,
    lightMeta,
    pendingImageKey: '',
    imageDataUrl,
    imageMime: peeled.mime,
  };
}

async function saveClipLocalFallback({ text, meta, category }) {
  try {
    const stored = await chrome.storage.local.get(['clips']);
    const clips = Array.isArray(stored?.clips) ? stored.clips : [];
    const now = Date.now();
    const peeled = peelImageDataUrlFromMeta(meta);
    const lightMeta = peeled.meta ? { ...peeled.meta } : null;
    if (lightMeta?.image) {
      lightMeta.image = { ...lightMeta.image };
      delete lightMeta.image.dataUrl;
      if (peeled.dataUrl) lightMeta.image.hasImage = true;
    }
    const newClip = {
      id: now + Math.random(),
      text,
      category: category || 'Uncategorized',
      timestamp: now,
      updatedAt: now,
      ...(lightMeta ? { meta: lightMeta } : {}),
    };
    if (peeled.dataUrl) {
      try {
        await putClipImage(newClip.id, peeled.dataUrl, peeled.mime);
      } catch (imgErr) {
        return { ok: false, error: LOCAL_STORAGE_LIMIT_MESSAGE };
      }
    }
    clips.unshift(newClip);
    await chrome.storage.local.set({ clips, pc_local_updatedAt: now });
    chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
    return { ok: true, fallback: true };
  } catch (err) {
    const msg = String(err?.message || '');
    return {
      ok: false,
      error: isLocalStorageLimitMessage(msg) ? LOCAL_STORAGE_LIMIT_MESSAGE : (msg || 'Local save failed.'),
    };
  }
}

function markCaptureSaved(meta) {
  const source = meta?.captureSource;
  if (source === 'spot' || source === 'image-picker') {
    return incrementCaptureToolsStats(source);
  }
  return Promise.resolve();
}

function limitOrMessage(value, fallback) {
  const msg = String(value || '');
  if (isLocalStorageLimitMessage(msg)) return LOCAL_STORAGE_LIMIT_MESSAGE;
  return msg || fallback;
}

async function sendSaveClipAttempts(payload) {
  let response = null;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await chrome.runtime.sendMessage(payload);
      if (response != null) return { response, lastError };
      lastError = 'No response from background saveClip.';
    } catch (err) {
      lastError = err?.message || 'Save failed.';
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
  }
  return { response, lastError };
}

function interpretSaveClipResponse(response, lastError, imageDataUrl) {
  const errText = response?.error || lastError || 'Save failed.';
  if (isLocalStorageLimitMessage(errText)) {
    return { ok: false, error: LOCAL_STORAGE_LIMIT_MESSAGE };
  }
  if (response?.success) {
    if (imageDataUrl && response.imageStored !== true) {
      return { ok: false, error: LOCAL_STORAGE_LIMIT_MESSAGE };
    }
    return { ok: true };
  }
  return { ok: false, error: errText, tryFallback: true };
}

export async function saveClipFromContent({ text, meta = null, category = 'Uncategorized', autoShow = false }) {
  const body = pcSafeTrim(text, CAPTURE_MAX_TEXT);
  const hasImage = !!(meta?.image?.dataUrl || meta?.image?.srcUrl);
  if (!body && !hasImage) {
    return { ok: false, error: 'Nothing to save.' };
  }

  const { lightMeta, pendingImageKey, imageDataUrl, imageMime } = await prepareClipImageForSave(meta);
  const saveText = body || pcSafeTrim(meta?.image?.srcUrl || 'Image clip', CAPTURE_MAX_TEXT);

  try {
    const { response, lastError } = await sendSaveClipAttempts({
      action: 'saveClip',
      text: saveText,
      meta: lightMeta,
      pendingImageKey,
      imageDataUrl,
      imageMime,
      category,
      autoShow: autoShow === true,
    });
    const outcome = interpretSaveClipResponse(response, lastError, imageDataUrl);
    if (outcome.ok) {
      await markCaptureSaved(meta);
      return { ok: true };
    }
    if (!outcome.tryFallback) return { ok: false, error: outcome.error };

    const fallback = await saveClipLocalFallback({ text: saveText, meta, category });
    if (pendingImageKey) await clearPendingClipImage(pendingImageKey);
    if (fallback.ok) {
      await markCaptureSaved(meta);
      return { ok: true, fallback: true };
    }
    return { ok: false, error: limitOrMessage(fallback.error, outcome.error) };
  } catch (err) {
    return { ok: false, error: limitOrMessage(err?.message, 'Save failed.') };
  }
}

export async function saveTextClipFromContent(text, options = {}) {
  const plain = String(text || '').trim();
  if (!plain) return { ok: false, error: 'No text to save.' };

  return saveClipFromContent({
    text: plain,
    category: options.category || 'Uncategorized',
    autoShow: options.autoShow === true,
    meta: {
      kind: 'text',
      plainText: plain,
      html: '',
      url: '',
      sourcePageUrl: pcSafeTrim(location.href, 4000),
      capturedAt: Date.now(),
      captureSource: 'spot',
      ...(options.meta || {}),
    },
  });
}

export async function saveImageTextClipFromContent({ text, dataUrl, srcUrl = '' }) {
  const plain = String(text || '').trim();
  if (!dataUrl && !srcUrl) return { ok: false, error: 'No image to save.' };

  return saveClipFromContent({
    text: plain || 'Image clip',
    category: 'Uncategorized',
    autoShow: false,
    meta: {
      kind: 'image',
      plainText: plain,
      html: '',
      url: '',
      image: {
        mime: 'image/png',
        dataUrl: dataUrl || '',
        srcUrl: pcSafeTrim(srcUrl, 4000),
      },
      sourcePageUrl: pcSafeTrim(location.href, 4000),
      capturedAt: Date.now(),
      captureSource: 'image-picker',
    },
  });
}
