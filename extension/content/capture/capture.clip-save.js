/** @forward-slice Content → background clip save for Scholar capture tools. */

import { CAPTURE_MAX_TEXT } from './capture.constants.js';
import { incrementCaptureToolsStats } from './capture.stats.js';
import { peelImageDataUrlFromMeta, putClipImage, stashPendingClipImage, clearPendingClipImage, pcDebugAf03f9 } from '../../shared/clip-images.js';

function pcSafeTrim(str, max) {
  const value = String(str ?? '');
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

async function prepareClipImageForSave(meta) {
  const peeled = peelImageDataUrlFromMeta(meta);
  const lightMeta = peeled.meta ? { ...peeled.meta } : null;
  if (lightMeta?.image) {
    lightMeta.image = { ...lightMeta.image };
    delete lightMeta.image.dataUrl;
    if (peeled.dataUrl) lightMeta.image.hasImage = true;
  }
  let pendingImageKey = '';
  if (peeled.dataUrl) {
    try {
      pendingImageKey = await stashPendingClipImage(peeled.dataUrl, peeled.mime);
      // #region agent log
      await pcDebugAf03f9('H6', 'capture.clip-save.js:prepare', 'stashed pending image', {
        pendingKeySuffix: pendingImageKey.slice(-20),
        dataUrlLen: peeled.dataUrl.length,
        mime: peeled.mime,
      });
      // #endregion
    } catch (err) {
      // #region agent log
      await pcDebugAf03f9('H7', 'capture.clip-save.js:prepare', 'stash pending failed', {
        dataUrlLen: peeled.dataUrl.length,
        error: String(err?.message || err).slice(0, 120),
      });
      // #endregion
    }
  }
  return { peeled, lightMeta, pendingImageKey };
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
      await putClipImage(newClip.id, peeled.dataUrl, peeled.mime);
    }
    clips.unshift(newClip);
    await chrome.storage.local.set({ clips, pc_local_updatedAt: now });
    chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
    return { ok: true, fallback: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Local save failed.' };
  }
}

export async function saveClipFromContent({ text, meta = null, category = 'Uncategorized', autoShow = false }) {
  const body = pcSafeTrim(text, CAPTURE_MAX_TEXT);
  const hasImage = !!(meta?.image?.dataUrl || meta?.image?.srcUrl);
  if (!body && !hasImage) {
    return { ok: false, error: 'Nothing to save.' };
  }

  const { lightMeta, pendingImageKey } = await prepareClipImageForSave(meta);

  try {
    let response = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await chrome.runtime.sendMessage({
          action: 'saveClip',
          text: body || pcSafeTrim(meta?.image?.srcUrl || 'Image clip', CAPTURE_MAX_TEXT),
          meta: lightMeta,
          pendingImageKey,
          category,
          autoShow: autoShow === true,
        });
        // #region agent log
        await pcDebugAf03f9('H6', 'capture.clip-save.js:saveClip', 'saveClip response', {
          attempt,
          success: response?.success === true,
          hasResponse: response != null,
          error: response?.error || lastError || '',
          pendingKeyLen: pendingImageKey.length,
          lightHasImage: lightMeta?.image?.hasImage === true,
          kind: lightMeta?.kind || null,
        });
        // #endregion
        if (response != null) break;
        lastError = 'No response from background saveClip.';
      } catch (err) {
        lastError = err?.message || 'Save failed.';
        // #region agent log
        await pcDebugAf03f9('H6', 'capture.clip-save.js:saveClip', 'saveClip send failed', {
          attempt,
          error: String(lastError).slice(0, 120),
          pendingKeyLen: pendingImageKey.length,
        });
        // #endregion
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          continue;
        }
      }
    }
    const errText = response?.error || lastError || 'Save failed.';
    if (response?.success) {
      const source = meta?.captureSource;
      if (source === 'spot' || source === 'image-picker') {
        await incrementCaptureToolsStats(source);
      }
      return { ok: true };
    }

    const fallback = await saveClipLocalFallback({
      text: body || pcSafeTrim(meta?.image?.srcUrl || 'Image clip', CAPTURE_MAX_TEXT),
      meta,
      category,
    });
    if (pendingImageKey) await clearPendingClipImage(pendingImageKey);
    if (fallback.ok) {
      const source = meta?.captureSource;
      if (source === 'spot' || source === 'image-picker') {
        await incrementCaptureToolsStats(source);
      }
      return { ok: true, fallback: true };
    }

    return { ok: false, error: fallback.error || errText };
  } catch (err) {
    return { ok: false, error: err?.message || 'Save failed.' };
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
