/**
 * Scholar Spot — arm mode; reads Monaco/code editor selections + all frames.
 */

import {
  getPageSelectionText,
  getPageSelectionTextDeep,
  copyTextToClipboard,
} from '../capture/capture.selection.js';
import { saveTextClipFromContent } from '../capture/capture.clip-save.js';

let _armed = false;
let _lastSavedText = '';
let _onModeChange = null;
let _onToast = null;
let _onSaved = null;
let _checkTimer = null;
let _copyHandler = null;

function scheduleCheck(delayMs = 220) {
  clearTimeout(_checkTimer);
  _checkTimer = setTimeout(() => {
    checkAndSaveSelection().catch(() => {});
  }, delayMs);
}

async function checkAndSaveSelection(explicitText = '') {
  if (!_armed) return null;

  const localText = getPageSelectionText();
  const text = String(explicitText || '').trim() || await getPageSelectionTextDeep();
  // #region agent log
  console.warn('[PasteCraft:debug:a58b3c]', {
    runId: 'pre-fix',
    hypothesisId: 'H1',
    location: 'widget.spot.js:checkAndSaveSelection',
    message: 'spot selection probe',
    data: {
      armed: _armed,
      explicitLen: String(explicitText || '').trim().length,
      localLen: localText.length,
      deepLen: text.length,
      sameAsLast: text === _lastSavedText,
    },
  });
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'pre-fix', hypothesisId: 'H1', location: 'widget.spot.js:checkAndSaveSelection', message: 'spot selection probe', data: { armed: _armed, explicitLen: String(explicitText || '').trim().length, localLen: localText.length, deepLen: text.length, sameAsLast: text === _lastSavedText }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
  if (!text || text.length < 1) return null;
  if (text === _lastSavedText) return null;

  const saveResult = await saveTextClipFromContent(text);
  // #region agent log
  console.warn('[PasteCraft:debug:a58b3c]', {
    runId: 'post-fix',
    hypothesisId: 'H2',
    location: 'widget.spot.js:checkAndSaveSelection',
    message: `spot save ok=${saveResult.ok} err=${saveResult.error || 'none'}`,
    data: { ok: saveResult.ok, error: saveResult.error || null, textLen: text.length },
  });
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'pre-fix', hypothesisId: 'H2', location: 'widget.spot.js:checkAndSaveSelection', message: 'spot save result', data: { ok: saveResult.ok, error: saveResult.error || null, textLen: text.length }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
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
  // #region agent log
  console.warn('[PasteCraft:debug:a58b3c]', {
    runId: 'post-fix',
    hypothesisId: 'H3',
    location: 'widget.spot.js:checkAndSaveSelection',
    message: 'spot saved + counter callback fired',
    data: { textLen: text.length, hasSavedHandler: typeof _onSaved === 'function' },
  });
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'post-fix', hypothesisId: 'H3', location: 'widget.spot.js:checkAndSaveSelection', message: 'spot saved + counter callback fired', data: { textLen: text.length, hasSavedHandler: typeof _onSaved === 'function' }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
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

function bindSelectionListeners() {
  document.addEventListener('mouseup', onSelectionEvent, true);
  document.addEventListener('pointerup', onSelectionEvent, true);
  document.addEventListener('keyup', onKeyReleaseEvent, true);

  _copyHandler = onCopyWhileArmed;
  document.addEventListener('copy', _copyHandler, true);
}

function unbindSelectionListeners() {
  document.removeEventListener('mouseup', onSelectionEvent, true);
  document.removeEventListener('pointerup', onSelectionEvent, true);
  document.removeEventListener('keyup', onKeyReleaseEvent, true);
  if (_copyHandler) {
    document.removeEventListener('copy', _copyHandler, true);
    _copyHandler = null;
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
  // #region agent log
  console.warn('[PasteCraft:debug:a58b3c]', {
    runId: 'pre-fix',
    hypothesisId: 'H4',
    location: 'widget.spot.js:armWidgetSpot',
    message: 'spot armed',
    data: { armed: _armed },
  });
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a58b3c' }, body: JSON.stringify({ sessionId: 'a58b3c', runId: 'pre-fix', hypothesisId: 'H4', location: 'widget.spot.js:armWidgetSpot', message: 'spot armed', data: { armed: _armed }, timestamp: Date.now() }) }).catch(() => {});
  // #endregion

  return {
    ok: true,
    armed: true,
    message: 'Spot active — highlight text (or Ctrl+C) to save.',
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
