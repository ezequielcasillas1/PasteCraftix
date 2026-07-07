/**
 * Scholar Image Picker (#21) — widget handler.
 * Region snip → OCR stub → preview modal → save clip (image + text).
 */

import { capturePageRegion, isRegionCaptureActive } from '../capture/capture.region.js';
import { extractTextFromImageDataUrl } from '../capture/capture.ocr.js';
import { saveImageTextClipFromContent } from '../capture/capture.clip-save.js';

let _previewHost = null;

function removePreview() {
  if (_previewHost?.parentNode) {
    _previewHost.parentNode.removeChild(_previewHost);
  }
  _previewHost = null;
}

function showImagePreviewModal({ dataUrl, initialText, onSave, onCancel }) {
  removePreview();

  const host = document.createElement('div');
  host.setAttribute('data-field', 'pc-widget-image-preview-host');
  host.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483645',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(15,23,42,0.55)',
    'padding:16px',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(420px,92vw)',
    'max-height:90vh',
    'overflow:auto',
    'background:#fff',
    'border-radius:12px',
    'padding:16px',
    'box-shadow:0 20px 50px rgba(0,0,0,0.35)',
    'font:14px system-ui,sans-serif',
    'color:#0f172a',
  ].join(';');

  const title = document.createElement('h3');
  title.textContent = 'Image Picker — edit extracted text';
  title.style.cssText = 'margin:0 0 12px;font-size:16px;';
  panel.appendChild(title);

  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Captured region';
    img.style.cssText = 'width:100%;max-height:160px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px;';
    panel.appendChild(img);
  }

  const textarea = document.createElement('textarea');
  textarea.value = initialText || '';
  textarea.placeholder = 'Extracted text (edit before saving)…';
  textarea.style.cssText = 'width:100%;min-height:100px;resize:vertical;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font:inherit;box-sizing:border-box;';
  panel.appendChild(textarea);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save clip';
  saveBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:600;';

  cancelBtn.addEventListener('click', () => {
    removePreview();
    onCancel?.();
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    await onSave?.(textarea.value.trim());
    removePreview();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  panel.appendChild(actions);
  host.appendChild(panel);
  document.documentElement.appendChild(host);
  _previewHost = host;
  textarea.focus();
}

export async function runWidgetImagePickerAction(showToast) {
  if (isRegionCaptureActive()) {
    return { ok: false, message: 'Capture already in progress.' };
  }

  const capture = await capturePageRegion();
  if (!capture.ok) {
    return { ok: false, message: capture.error || 'Capture cancelled.' };
  }

  const ocr = await extractTextFromImageDataUrl(capture.dataUrl);

  return new Promise((resolve) => {
    showImagePreviewModal({
      dataUrl: capture.dataUrl,
      initialText: ocr.text || '',
      onCancel: () => {
        resolve({ ok: false, message: 'Save cancelled.' });
      },
      onSave: async (text) => {
        const saveResult = await saveImageTextClipFromContent({
          text,
          dataUrl: capture.dataUrl,
        });
        if (!saveResult.ok) {
          showToast?.(saveResult.error || 'Save failed.');
          resolve({ ok: false, message: saveResult.error || 'Save failed.' });
          return;
        }
        const msg = text
          ? 'Image + text saved as clip.'
          : 'Image saved as clip.';
        showToast?.(msg);
        resolve({ ok: true, message: msg });
      },
    });

    if (ocr.message && !ocr.text) {
      showToast?.(ocr.message);
    }
  });
}

export function cancelWidgetImagePreview() {
  removePreview();
}
