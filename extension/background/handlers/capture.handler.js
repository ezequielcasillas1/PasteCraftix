import { INTERNAL_MESSAGE_ACTIONS as A } from '../messaging/message-types.js';

/**
 * Capture / clipboard / page-selection handlers (widget Capture Tools).
 * Keep each handler CC ≤ 9 via small helpers.
 */

const CAPTURE_OPTIONS = { format: 'png' };
const CAPTURE_JPEG_FALLBACK = { format: 'jpeg', quality: 92 };
/** Above this, return a session storage key instead of inline dataUrl (MV3 message size). */
const INLINE_DATAURL_MAX = 450000;
const CAPTURE_STORAGE_PREFIX = 'pc_capture_shot_';

async function captureVisibleTabOnce(windowId, options = CAPTURE_OPTIONS) {
  try {
    const dataUrl = Number.isFinite(windowId)
      ? await chrome.tabs.captureVisibleTab(windowId, options)
      : await chrome.tabs.captureVisibleTab(options);
    if (!dataUrl) return { ok: false, error: 'capture_failed_no_data' };
    return { ok: true, dataUrl };
  } catch (err) {
    return { ok: false, error: err?.message || 'capture_throw' };
  }
}

async function captureSenderScreenshot(windowId) {
  const primary = await captureVisibleTabOnce(
    Number.isFinite(windowId) ? windowId : null,
    CAPTURE_OPTIONS,
  );
  if (primary.ok) return primary;

  // Second attempt: jpeg (smaller) + optional null windowId fallback.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const jpeg = await captureVisibleTabOnce(
    Number.isFinite(windowId) ? windowId : null,
    CAPTURE_JPEG_FALLBACK,
  );
  if (jpeg.ok) return jpeg;

  if (Number.isFinite(windowId)) {
    const anyWindow = await captureVisibleTabOnce(null, CAPTURE_OPTIONS);
    if (anyWindow.ok) return anyWindow;
    return {
      ok: false,
      error: [primary.error, jpeg.error, anyWindow.error].filter(Boolean).join(' | ') || 'capture_failed',
    };
  }

  return {
    ok: false,
    error: [primary.error, jpeg.error].filter(Boolean).join(' | ') || 'capture_failed',
  };
}

function normalizeCropRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, slice);
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

async function cropDataUrlInWorker(dataUrl, rect, dpr) {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas unavailable');
  ctx.drawImage(
    bitmap,
    Math.round(rect.x * scale),
    Math.round(rect.y * scale),
    width,
    height,
    0,
    0,
    width,
    height,
  );
  bitmap.close?.();
  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(outBlob);
}

async function stashCaptureDataUrl(dataUrl) {
  const key = `${CAPTURE_STORAGE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.session.set({ [key]: dataUrl });
  return key;
}

async function buildCaptureSuccessPayload(dataUrl) {
  if (typeof dataUrl === 'string' && dataUrl.length <= INLINE_DATAURL_MAX) {
    return { success: true, ok: true, dataUrl };
  }
  try {
    const storageKey = await stashCaptureDataUrl(dataUrl);
    return { success: true, ok: true, storageKey };
  } catch (err) {
    // Last resort: try inline anyway (may fail on channel size).
    return { success: true, ok: true, dataUrl, stashError: err?.message || 'stash_failed' };
  }
}

async function maybeCropShot(dataUrl, cropRect, dpr) {
  if (!cropRect || typeof OffscreenCanvas !== 'function') {
    return { dataUrl, cropped: false };
  }
  try {
    return { dataUrl: await cropDataUrlInWorker(dataUrl, cropRect, dpr), cropped: true };
  } catch (_) {
    return { dataUrl, cropped: false };
  }
}

async function buildDeliverableCapturePayload(outUrl, cropped) {
  const payload = await buildCaptureSuccessPayload(outUrl);
  payload.cropped = cropped;
  return payload;
}

async function runPcCaptureRegion(message, sender) {
  const windowId = sender.tab?.windowId;
  const cropRect = normalizeCropRect(message?.rect);
  const dpr = Number(message?.dpr);

  const shot = await captureSenderScreenshot(windowId);
  if (!shot.ok) {
    return { success: false, ok: false, error: shot.error || 'capture_failed' };
  }

  const croppedShot = await maybeCropShot(shot.dataUrl, cropRect, dpr);
  return buildDeliverableCapturePayload(croppedShot.dataUrl, croppedShot.cropped);
}

/** Promise payload reply — avoids return-true + sendResponse races with other listeners. */
export function handlePcCaptureRegion(message, { sender }) {
  return (async () => {
    try {
      return await runPcCaptureRegion(message, sender);
    } catch (err) {
      return { success: false, ok: false, error: err?.message || 'capture_outer_throw' };
    }
  })();
}

/**
 * Injected into the page (all frames). Must stay self-contained — no outer scope refs.
 */
export function probePageSelectionInFrame() {
  function readInput(el) {
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return '';
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null || end <= start) return '';
    return String(el.value || '').slice(start, end).trim();
  }

  function readMonacoApi() {
    try {
      const monaco = window.monaco;
      const getEditors = monaco?.editor?.getEditors;
      if (typeof getEditors !== 'function') return '';
      for (const editor of getEditors()) {
        if (!editor?.getSelection || !editor?.getModel) continue;
        const sel = editor.getSelection();
        const model = editor.getModel();
        if (!sel || !model) continue;
        if (typeof sel.isEmpty === 'function' && sel.isEmpty()) continue;
        const picked = String(model.getValueInRange(sel) || '').trim();
        if (picked) return picked;
      }
    } catch (_) {}
    return '';
  }

  function readEditorFallbacks() {
    const aceRoot = document.querySelector('.ace_editor');
    const aceText = aceRoot?.env?.editor?.getSelectedText?.();
    if (aceText && String(aceText).trim()) return String(aceText).trim();

    const cmEl = document.querySelector('.CodeMirror');
    const cmText = cmEl?.CodeMirror?.getSelection?.();
    if (cmText && String(cmText).trim()) return String(cmText).trim();
    return '';
  }

  function readDomSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount <= 0) return '';
    const parts = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      parts.push(sel.getRangeAt(i).toString());
    }
    return parts.join('\n').trim();
  }

  try {
    const fromActive = readInput(document.activeElement);
    if (fromActive) return fromActive;

    const monacoInputs = document.querySelectorAll(
      '.monaco-editor textarea.inputarea, .monaco-editor textarea, textarea.inputarea',
    );
    for (const input of monacoInputs) {
      const text = readInput(input);
      if (text) return text;
    }

    const fromMonaco = readMonacoApi();
    if (fromMonaco) return fromMonaco;

    const fromEditors = readEditorFallbacks();
    if (fromEditors) return fromEditors;

    const fromDom = readDomSelection();
    if (fromDom) return fromDom;

    const inputs = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
    for (const input of inputs) {
      const text = readInput(input);
      if (text) return text;
    }
  } catch (_) {}

  return '';
}

function pickLongestSelectionResult(results) {
  let best = '';
  for (const entry of results || []) {
    const t = String(entry?.result || '').trim();
    if (t.length > best.length) best = t;
  }
  return best;
}

export function handlePcGetPageSelection(_message, { sender, sendResponse }) {
  const tabId = sender.tab?.id;
  if (!Number.isFinite(tabId)) {
    sendResponse({ success: false, error: 'missing_tab' });
    return false;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId, allFrames: true },
      func: probePageSelectionInFrame,
    },
    (results) => {
      const err = chrome.runtime.lastError;
      if (err) {
        sendResponse({ success: false, error: err.message || 'selection_probe_failed' });
        return;
      }
      const best = pickLongestSelectionResult(results);
      sendResponse({ success: !!best, text: best });
    },
  );
  return true;
}

export function handlePcCopyText(message, { sendResponse }) {
  const text = String(message.text || '');
  (async () => {
    try {
      await navigator.clipboard.writeText(text);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();
  return true;
}

export function createCaptureHandlerMap() {
  return {
    [A.PC_CAPTURE_REGION]: handlePcCaptureRegion,
    [A.PC_GET_PAGE_SELECTION]: handlePcGetPageSelection,
    [A.PC_COPY_TEXT]: handlePcCopyText,
  };
}
