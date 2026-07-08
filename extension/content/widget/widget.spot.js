/**
 * Scholar Spot — arm mode; reads Monaco/code editor selections + all frames.
 * On PDF viewers, native plugin selections are captured via Ctrl+C / clipboard poll
 * (highlight→release is blocked by the browser PDF plugin).
 */

import {
  getPageSelectionText,
  getPageSelectionTextDeep,
  copyTextToClipboard,
} from '../capture/capture.selection.js';
import { saveTextClipFromContent } from '../capture/capture.clip-save.js';
import {
  isPdfViewerPage,
  subscribePdfClipboardCapture,
  getPdfCaptureHint,
} from '../pdf/pdf.capture.js';

let _armed = false;
let _lastSavedText = '';
let _onModeChange = null;
let _onToast = null;
let _onSaved = null;
let _checkTimer = null;
let _copyHandler = null;
let _pdfUnsub = null;

function scheduleCheck(delayMs = 220) {
  clearTimeout(_checkTimer);
  _checkTimer = setTimeout(() => {
    checkAndSaveSelection().catch(() => {});
  }, delayMs);
}

async function checkAndSaveSelection(explicitText = '') {
  if (!_armed) return null;

  const text = String(explicitText || '').trim() || await getPageSelectionTextDeep();
  if (!text || text.length < 1) return null;
  if (text === _lastSavedText) return null;

  const saveResult = await saveTextClipFromContent(text);
  if (!saveResult.ok) {
    const msg = saveResult.error || 'Could not save clip.';
    _onToast?.(msg);
    return { ok: false, message: msg };
  }

  _lastSavedText = text;
  _onSaved?.();

  const result = {
    ok: true,
    saved: true,
    message: `Spot saved clip (${text.length} chars) + copied.`,
  };
  _onToast?.(result.message);
  copyTextToClipboard(text).catch(() => {});
  return result;
}

function onSelectionEvent() {
  if (!_armed) return;
  scheduleCheck(120);
}

function onCopyWhileArmed(event) {
  if (!_armed) return;
  const cd = event?.clipboardData;
  const fromCopy = cd?.getData?.('text/plain')?.trim();
  if (fromCopy) {
    scheduleCheck(0);
    setTimeout(() => {
      checkAndSaveSelection(fromCopy).catch(() => {});
    }, 0);
    return;
  }
  scheduleCheck(80);
}

function onKeyReleaseEvent(event) {
  if (!_armed) return;
  if (event && event.ctrlKey && (event.key === 'a' || event.key === 'A')) {
    scheduleCheck(80);
    return;
  }
  if (event && (event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta')) {
    scheduleCheck(80);
    return;
  }
  if (event && event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End', 'Home'].includes(event.key)) {
    scheduleCheck(80);
  }
}

function onPdfClipboardCapture(payload) {
  if (!_armed) return;
  const text = String(payload?.text || '').trim();
  if (!text) return;
  checkAndSaveSelection(text).catch(() => {});
}

function bindSelectionListeners() {
  document.addEventListener('mouseup', onSelectionEvent, true);
  document.addEventListener('pointerup', onSelectionEvent, true);
  document.addEventListener('keyup', onKeyReleaseEvent, true);

  _copyHandler = onCopyWhileArmed;
  document.addEventListener('copy', _copyHandler, true);

  if (isPdfViewerPage()) {
    _pdfUnsub?.();
    _pdfUnsub = subscribePdfClipboardCapture(onPdfClipboardCapture);
  }
}

function unbindSelectionListeners() {
  document.removeEventListener('mouseup', onSelectionEvent, true);
  document.removeEventListener('pointerup', onSelectionEvent, true);
  document.removeEventListener('keyup', onKeyReleaseEvent, true);
  if (_copyHandler) {
    document.removeEventListener('copy', _copyHandler, true);
    _copyHandler = null;
  }
  if (_pdfUnsub) {
    _pdfUnsub();
    _pdfUnsub = null;
  }
  clearTimeout(_checkTimer);
  _checkTimer = null;
}

export function isWidgetSpotArmed() {
  return _armed;
}

export function setWidgetSpotModeChangeHandler(fn) {
  _onModeChange = typeof fn === 'function' ? fn : null;
}

export function setWidgetSpotToastHandler(fn) {
  _onToast = typeof fn === 'function' ? fn : null;
}

export function setWidgetSpotSavedHandler(fn) {
  _onSaved = typeof fn === 'function' ? fn : null;
}

export function armWidgetSpot() {
  if (_armed) {
    disarmWidgetSpot();
    return { ok: true, armed: false, message: 'Spot disarmed.' };
  }

  _armed = true;
  _lastSavedText = '';
  bindSelectionListeners();
  _onModeChange?.('spot');

  const onPdf = isPdfViewerPage();
  const pdfHint = onPdf ? ` ${getPdfCaptureHint()}` : '';
  return {
    ok: true,
    armed: true,
    message: onPdf
      ? `Spot active (PDF).${pdfHint}`
      : 'Spot active — highlight text (or Ctrl+C) to save.',
  };
}

export function disarmWidgetSpot() {
  if (!_armed) return;
  _armed = false;
  _lastSavedText = '';
  unbindSelectionListeners();
  _onModeChange?.('idle');
}

export async function flushWidgetSpotSelection() {
  const result = await checkAndSaveSelection();
  if (result?.ok && result.saved) return result;
  if (_armed) {
    const preview = getPageSelectionText();
    if (preview) {
      return checkAndSaveSelection(preview);
    }
    return { ok: true, saved: false, message: 'Spot active — select text on the page.' };
  }
  return { ok: false, saved: false, message: 'Spot is not active.' };
}

export function resetWidgetSpot() {
  disarmWidgetSpot();
}
