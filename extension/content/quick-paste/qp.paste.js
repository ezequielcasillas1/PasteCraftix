/** @forward-slice — Quick Paste paste-into-field + toast helpers. */

import {
  copyImageBearingClipToClipboard,
  isImageBearingClip,
} from '../../shared/clipboard-image.js';
import { clipIdKey } from './qp.helpers.js';
import { QP_CLASSES, QP_LIMITS } from './qp.constants.js';

function isTextInput(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

function isEditableTarget(el) {
  return isTextInput(el) || (el && el.contentEditable === 'true');
}

function insertIntoInput(el, text) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const currentValue = el.value;
  el.value = currentValue.substring(0, start) + text + currentValue.substring(end);
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function pasteOrCopyText(qp, text) {
  const activeElement = document.activeElement;

  if (!isEditableTarget(activeElement)) {
    await navigator.clipboard.writeText(text);
    qp.showPasteSuccess('Copied to clipboard');
    return;
  }

  if (isTextInput(activeElement)) {
    insertIntoInput(activeElement, text);
  } else {
    document.execCommand('insertText', false, text);
  }

  qp.showPasteSuccess();
  qp.hideInterface();
}

/** Paste clip at index into active field, or copy to clipboard. */
export async function pasteQuickPasteClip(qp, index) {
  const clip = qp.clips[index];
  if (!clip) return;

  if (typeof clip === 'object' && isImageBearingClip(clip)) {
    try {
      await copyImageBearingClipToClipboard(clip);
      qp.showPasteSuccess('Image copied to clipboard');
      return;
    } catch (error) {
      console.error('Image copy failed:', error);
      qp.showPasteError();
      return;
    }
  }

  const text = clip.text || clip;
  try {
    await pasteOrCopyText(qp, text);
  } catch (error) {
    console.error('Paste failed:', error);
    qp.showPasteError();
  }
}

/** Resolve clip by stable id key, then paste by index. */
export async function pasteQuickPasteClipById(qp, rawClipId) {
  const id = String(rawClipId || '');
  if (!id) return;
  const clip = qp.clips.find((c) => clipIdKey(c?.id) === id);
  if (!clip) return;
  const index = qp.clips.indexOf(clip);
  if (index >= 0) return pasteQuickPasteClip(qp, index);
}

function toastBackground(type) {
  if (type === 'success') return '#2563eb';
  if (type === 'error') return '#ef4444';
  return '#3b82f6';
}

function ensureToastElement(state) {
  let toast = state.el;
  if (toast && toast.isConnected) return toast;
  toast = document.createElement('div');
  toast.className = QP_CLASSES.TOAST;
  state.el = toast;
  document.body.appendChild(toast);
  return toast;
}

function scheduleToastDismiss(state, toast) {
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }

  state.timerId = setTimeout(() => {
    toast.style.animation = 'pastecraft-toast-out 0.3s ease forwards';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, QP_LIMITS.TOAST_FADE_MS);
  }, QP_LIMITS.TOAST_DURATION_MS);
}

/** Single-instance toast with dedupe + auto-dismiss. */
export function showQuickPasteToast(qp, message, type = 'info') {
  qp._toastState = qp._toastState || {
    el: null,
    timerId: null,
    lastMessage: null,
    lastShownAt: 0,
  };

  const now = Date.now();
  const msg = String(message ?? '');
  if (!msg) return;

  if (
    qp._toastState.lastMessage === msg &&
    now - qp._toastState.lastShownAt < QP_LIMITS.TOAST_DEDUPE_MS
  ) {
    return;
  }
  qp._toastState.lastMessage = msg;
  qp._toastState.lastShownAt = now;

  const toast = ensureToastElement(qp._toastState);
  toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${toastBackground(type)};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000003;
      animation: pastecraft-toast-in 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      max-width: 90vw;
    `;
  toast.textContent = msg;
  scheduleToastDismiss(qp._toastState, toast);
}
