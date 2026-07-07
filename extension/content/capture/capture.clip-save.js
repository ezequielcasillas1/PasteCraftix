/**
 * @forward-slice Content → background clip save (Scholar capture tools).
 * Normalizes meta shape to match widget drag-capture conventions.
 */

import { CAPTURE_MAX_TEXT } from './capture.constants.js';

function pcSafeTrim(str, max) {
  const value = String(str ?? '');
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

export async function saveClipFromContent({
  text,
  meta = null,
  category = 'Uncategorized',
  autoShow = false,
}) {
  const body = pcSafeTrim(text, CAPTURE_MAX_TEXT);
  if (!body && !(meta?.image?.dataUrl || meta?.image?.srcUrl)) {
    return { ok: false, error: 'Nothing to save.' };
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveClip',
      text: body || pcSafeTrim(meta?.image?.srcUrl || meta?.image?.dataUrl || 'Image clip', CAPTURE_MAX_TEXT),
      meta,
      category,
      autoShow,
    });
    if (response?.success) {
      return { ok: true };
    }
    return { ok: false, error: response?.error || 'Save failed.' };
  } catch (err) {
    return { ok: false, error: err?.message || 'Save failed.' };
  }
}

export async function saveTextClipFromContent(text, options = {}) {
  const capturedAt = Date.now();
  const plain = String(text || '').trim();
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
      capturedAt,
      ...(options.meta || {}),
    },
  });
}

export async function saveImageTextClipFromContent({ text, dataUrl, srcUrl = '' }) {
  const capturedAt = Date.now();
  const plain = String(text || '').trim();
  const imageSrc = srcUrl || dataUrl || '';
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
        srcUrl: pcSafeTrim(imageSrc, 4000),
      },
      sourcePageUrl: pcSafeTrim(location.href, 4000),
      capturedAt,
    },
  });
}
