/** @forward-slice PDF viewer capture bridge — Ctrl+C / clipboard poll (plugin selections). */

import { isPdfViewerPage } from './pdf.detect.js';
import { readClipboardPlainText, textFromClipboardEvent } from './pdf.clipboard.js';
import {
  PDF_CAPTURE_HINT,
  PDF_POLL_INTERVAL_MS,
  PDF_READ_DELAY_MS,
} from './pdf.constants.js';

let _installed = false;
let _handlers = new Set();
let _lastEmitted = '';
let _baseline = null;
let _pendingTimer = null;
let _pollTimer = null;
let _pollActive = false;

const READ_DELAY_MS = PDF_READ_DELAY_MS;
const POLL_MS = PDF_POLL_INTERVAL_MS;

function isCopyChord(event) {
  if (!event) return false;
  const key = String(event.key || '').toLowerCase();
  const code = String(event.code || '');
  const isC = key === 'c' || code === 'KeyC';
  if (!isC) return false;
  return !!(event.ctrlKey || event.metaKey);
}

function emitCopiedText(rawText, source) {
  const text = String(rawText || '').trim();
  if (!text) return;
  if (text === _lastEmitted) return;
  _lastEmitted = text;
  _baseline = text;

  for (const entry of _handlers) {
    try {
      entry.handler({ text, source });
    } catch (_) {}
  }
}

function scheduleClipboardRead(source) {
  clearTimeout(_pendingTimer);
  _pendingTimer = setTimeout(async () => {
    _pendingTimer = null;
    const text = await readClipboardPlainText();
    emitCopiedText(text, source);
  }, READ_DELAY_MS);
}

async function pollClipboardOnce() {
  if (!_pollActive || _handlers.size === 0) return;
  if (!isPdfViewerPage()) return;
  if (document.visibilityState === 'hidden') return;

  const text = await readClipboardPlainText();
  if (!text) return;

  if (_baseline === null) {
    _baseline = text;
    return;
  }
  if (text === _baseline) return;
  emitCopiedText(text, 'pdf-clipboard-poll');
}

function startPoll() {
  if (_pollTimer) return;
  _pollActive = true;
  _baseline = null;
  _pollTimer = setInterval(() => {
    pollClipboardOnce().catch(() => {});
  }, POLL_MS);
  pollClipboardOnce().catch(() => {});
}

function stopPoll() {
  _pollActive = false;
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function syncPoll() {
  if (_handlers.size > 0 && isPdfViewerPage()) startPoll();
  else stopPoll();
}

function onKeyDown(event) {
  if (!isPdfViewerPage()) return;
  if (!isCopyChord(event)) return;
  scheduleClipboardRead('pdf-ctrl-c');
}

function onCopy(event) {
  if (!isPdfViewerPage()) return;
  const fromEvent = textFromClipboardEvent(event);
  if (fromEvent) {
    emitCopiedText(fromEvent, 'pdf-copy-event');
    return;
  }
  scheduleClipboardRead('pdf-copy-fallback');
}

/**
 * Subscribe to PDF clipboard captures (Ctrl+C / system clipboard changes).
 * Native PDF plugins do not expose highlight→release selection to the page.
 * @param {(payload: { text: string, source: string }) => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribePdfClipboardCapture(handler) {
  if (typeof handler !== 'function') return () => {};

  if (!_installed) {
    _installed = true;
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', onCopy, true);
    window.addEventListener('copy', onCopy, true);
  }

  const entry = { handler };
  _handlers.add(entry);
  syncPoll();

  return () => {
    _handlers.delete(entry);
    syncPoll();
  };
}

export function getPdfCaptureHint() {
  return PDF_CAPTURE_HINT;
}

export { isPdfViewerPage };
