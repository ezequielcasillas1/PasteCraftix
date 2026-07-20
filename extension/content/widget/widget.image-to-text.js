/** Scholar Image Picker — region snip + preview + clip save. */

import { CAPTURE_LAYER_Z, mountCaptureLayer } from '../capture/capture.constants.js';
import { capturePageRegion, cancelRegionCapture, isRegionCaptureActive } from '../capture/capture.region.js';
import { extractTextFromImageDataUrl } from '../capture/capture.ocr.js';
import { saveImageTextClipFromContent } from '../capture/capture.clip-save.js';

let _previewHost = null;
let _onModeChange = null;
let _onSaved = null;

export function setWidgetImageModeChangeHandler(fn) {
  _onModeChange = typeof fn === 'function' ? fn : null;
}

export function setWidgetImageSavedHandler(fn) {
  _onSaved = typeof fn === 'function' ? fn : null;
}

function removePreview() {
  if (_previewHost?.parentNode) _previewHost.parentNode.removeChild(_previewHost);
  _previewHost = null;
}

function showImagePreviewModal({ dataUrl, initialText, onSave, onCancel }) {
  removePreview();

  const host = document.createElement('div');
  host.setAttribute('data-field', 'pc-widget-image-preview-host');
  host.style.cssText = 'inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px;';

  const panel = document.createElement('div');
  panel.style.cssText = 'width:min(420px,92vw);max-height:90vh;overflow:auto;background:#fff;border-radius:12px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,0.35);font:14px system-ui,sans-serif;color:#0f172a;';

  const title = document.createElement('h3');
  title.textContent = 'Image Picker';
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
  textarea.placeholder = 'Add or edit extracted text…';
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
    _onModeChange?.('idle');
    onCancel?.();
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    await onSave?.(textarea.value.trim());
    removePreview();
    _onModeChange?.('idle');
  });

  actions.append(cancelBtn, saveBtn);
  panel.appendChild(actions);
  host.appendChild(panel);
  mountCaptureLayer(host, CAPTURE_LAYER_Z.PREVIEW);
  _previewHost = host;
  requestAnimationFrame(() => {
    if (!host.isConnected) {
      mountCaptureLayer(host, CAPTURE_LAYER_Z.PREVIEW);
    }
    textarea.focus();
  });
}

async function clearStaleMerchantForScholarCapture() {
  let merchantStorageEnabled = false;
  try {
    const bag = await chrome.storage.local.get(['pc_merchant_strip_enabled_v1']);
    merchantStorageEnabled = bag?.pc_merchant_strip_enabled_v1 === true;
  } catch (_) {
    merchantStorageEnabled = false;
  }
  const layer = window.__pasteCraftMerchant;
  if (!layer || merchantStorageEnabled) return;
  try {
    layer.disarmImageToText?.();
    layer.dock?.unmount?.();
    layer.strip?.unmount?.();
  } catch (_) {}
  window.__pasteCraftMerchant = null;
}

export async function runWidgetImagePickerAction(showToast) {
  if (isRegionCaptureActive()) {
    return { ok: false, message: 'Capture already in progress.' };
  }

  await clearStaleMerchantForScholarCapture();

  _onModeChange?.('image');
  showToast?.('Drag a region on the page…');

  const capture = await capturePageRegion();
  if (!capture.ok) {
    const message = capture.error || 'Capture cancelled.';
    showToast?.(message);
    _onModeChange?.('idle');
    return { ok: false, message };
  }

  const ocr = await extractTextFromImageDataUrl(capture.dataUrl);

  return new Promise((resolve) => {
    showImagePreviewModal({
      dataUrl: capture.dataUrl,
      initialText: ocr.text || '',
      onCancel: () => resolve({ ok: false, message: 'Save cancelled.' }),
      onSave: async (text) => {
        const saveResult = await saveImageTextClipFromContent({ text, dataUrl: capture.dataUrl });
        if (!saveResult.ok) {
          showToast?.(saveResult.error || 'Save failed.');
          resolve({ ok: false, message: saveResult.error || 'Save failed.' });
          return;
        }
        const msg = 'Image saved as clip.';
        showToast?.(msg);
        _onSaved?.();
        resolve({ ok: true, message: msg });
      },
    });
    if (ocr.message && !ocr.text) showToast?.(ocr.message);
  });
}

export function cancelWidgetImagePreview() {
  removePreview();
  cancelRegionCapture();
  _onModeChange?.('idle');
}
