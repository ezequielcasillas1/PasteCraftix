/** @forward-slice Content → background clip save for Scholar capture tools. */

import { CAPTURE_MAX_TEXT } from './capture.constants.js';
import { incrementCaptureToolsStats } from './capture.stats.js';

function pcSafeTrim(str, max) {
  const value = String(str ?? '');
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

async function saveClipLocalFallback({ text, meta, category }) {
  try {
    const stored = await chrome.storage.local.get(['clips']);
    const clips = Array.isArray(stored?.clips) ? stored.clips : [];
    const now = Date.now();
    const newClip = {
      id: now + Math.random(),
      text,
      category: category || 'Uncategorized',
      timestamp: now,
      updatedAt: now,
      ...(meta ? { meta } : {}),
    };
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

  try {
    let response = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await chrome.runtime.sendMessage({
          action: 'saveClip',
          text: body || pcSafeTrim(meta?.image?.srcUrl || 'Image clip', CAPTURE_MAX_TEXT),
          meta,
          category,
          autoShow: autoShow === true,
        });
        if (response != null) break;
        lastError = 'No response from background saveClip.';
      } catch (err) {
        lastError = err?.message || 'Save failed.';
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          continue;
        }
      }
    }
    const errText = response?.error || lastError || 'Save failed.';
    // #region agent log
    console.warn('[PasteCraft:debug:a58b3c]', {
      runId: 'post-fix',
      hypothesisId: 'H2',
      location: 'capture.clip-save.js:saveClipFromContent',
      message: `saveClip response success=${!!response?.success} err=${errText}`,
      data: {
        success: !!response?.success,
        error: errText,
        hasResponse: response != null,
      },
    });
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'post-fix', hypothesisId: 'H2', location: 'capture.clip-save.js:saveClipFromContent', message: `saveClip response success=${!!response?.success} err=${errText}`, data: { success: !!response?.success, error: errText, hasResponse: response != null }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
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
    if (fallback.ok) {
      const source = meta?.captureSource;
      if (source === 'spot' || source === 'image-picker') {
        await incrementCaptureToolsStats(source);
      }
      // #region agent log
      console.warn('[PasteCraft:debug:a58b3c]', {
        runId: 'post-fix',
        hypothesisId: 'H2',
        location: 'capture.clip-save.js:saveClipLocalFallback',
        message: 'saveClip local fallback succeeded',
        data: { textLen: body.length },
      });
      fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'post-fix', hypothesisId: 'H2', location: 'capture.clip-save.js:saveClipLocalFallback', message: 'saveClip local fallback succeeded', data: { textLen: body.length }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
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
