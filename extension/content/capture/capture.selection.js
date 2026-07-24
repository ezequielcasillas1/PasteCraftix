/** @forward-slice Page text selection helpers (plain DOM + code editors + iframes). */

import { CAPTURE_MESSAGE_ACTIONS } from './capture.constants.js';

function readInputSelection(el) {
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return '';
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start == null || end == null || end <= start) return '';
  return String(el.value || '').slice(start, end).trim();
}

function readMonacoGlobalSelection() {
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

      const text = String(model.getValueInRange(sel) || '').trim();
      if (text) return text;
    }
  } catch (_) {}
  return '';
}

function readMonacoSelection() {
  const global = readMonacoGlobalSelection();
  if (global) return global;

  const inputs = document.querySelectorAll(
    '.monaco-editor textarea.inputarea, .monaco-editor textarea, textarea.inputarea',
  );
  for (const input of inputs) {
    const text = readInputSelection(input);
    if (text) return text;
  }
  return '';
}

function readAceSelection() {
  try {
    const aceRoot = document.querySelector('.ace_editor');
    const editor = aceRoot?.env?.editor;
    if (editor?.getSelectedText) {
      const text = String(editor.getSelectedText() || '').trim();
      if (text) return text;
    }
  } catch (_) {}
  return '';
}

function readCodeMirrorSelection() {
  try {
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl?.CodeMirror?.getSelection) {
      const text = String(cmEl.CodeMirror.getSelection() || '').trim();
      if (text) return text;
    }
  } catch (_) {}
  return '';
}

function readWindowSelection() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
    const parts = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      parts.push(selection.getRangeAt(i).toString());
    }
    return parts.join('\n').trim();
  } catch (_) {
    return '';
  }
}

/** Read selection in the current frame only. */
export function getPageSelectionText() {
  try {
    const active = document.activeElement;
    const fromActive = readInputSelection(active);
    if (fromActive) return fromActive;

    const monaco = readMonacoSelection();
    if (monaco) return monaco;

    const ace = readAceSelection();
    if (ace) return ace;

    const cm = readCodeMirrorSelection();
    if (cm) return cm;

    if (active?.isContentEditable) {
      const fromEditable = readWindowSelection();
      if (fromEditable) return fromEditable;
    }

    const allInputs = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
    for (const input of allInputs) {
      const text = readInputSelection(input);
      if (text) return text;
    }

    return readWindowSelection();
  } catch (_) {
    return '';
  }
}

/**
 * Inline selection reader for chrome.scripting.executeScript (all frames).
 * Must stay self-contained — no imports.
 */
export function readPageSelectionInFrame() {
  function readInput(el) {
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return '';
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null || end <= start) return '';
    return String(el.value || '').slice(start, end).trim();
  }

  try {
    const active = document.activeElement;
    const fromActive = readInput(active);
    if (fromActive) return fromActive;

    const monacoInputs = document.querySelectorAll(
      '.monaco-editor textarea.inputarea, .monaco-editor textarea, textarea.inputarea',
    );
    for (const input of monacoInputs) {
      const text = readInput(input);
      if (text) return text;
    }

    try {
      const monaco = window.monaco;
      const getEditors = monaco?.editor?.getEditors;
      if (typeof getEditors === 'function') {
        for (const editor of getEditors()) {
          if (!editor?.getSelection || !editor?.getModel) continue;
          const sel = editor.getSelection();
          const model = editor.getModel();
          if (!sel || !model) continue;
          if (typeof sel.isEmpty === 'function' && sel.isEmpty()) continue;
          const picked = String(model.getValueInRange(sel) || '').trim();
          if (picked) return picked;
        }
      }
    } catch (_) {}

    const aceRoot = document.querySelector('.ace_editor');
    const aceText = aceRoot?.env?.editor?.getSelectedText?.();
    if (aceText && String(aceText).trim()) return String(aceText).trim();

    const cmEl = document.querySelector('.CodeMirror');
    const cmText = cmEl?.CodeMirror?.getSelection?.();
    if (cmText && String(cmText).trim()) return String(cmText).trim();

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const parts = [];
      for (let i = 0; i < sel.rangeCount; i++) {
        parts.push(sel.getRangeAt(i).toString());
      }
      const joined = parts.join('\n').trim();
      if (joined) return joined;
    }

    const inputs = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
    for (const input of inputs) {
      const text = readInput(input);
      if (text) return text;
    }
  } catch (_) {}

  return '';
}

/** Current frame first, then all frames via background scripting, then PDF clipboard. */
export async function getPageSelectionTextDeep() {
  const local = getPageSelectionText();
  if (local) return local;

  try {
    const response = await chrome.runtime.sendMessage({
      action: CAPTURE_MESSAGE_ACTIONS.PC_GET_PAGE_SELECTION,
    });
    if (response?.success && response.text) {
      return String(response.text).trim();
    }
  } catch (_) {}

  try {
    const { isPdfViewerPage } = await import('../pdf/pdf.detect.js');
    if (isPdfViewerPage()) {
      const { readClipboardPlainText } = await import('../pdf/pdf.clipboard.js');
      const clip = await readClipboardPlainText();
      if (clip) return clip;
    }
  } catch (_) {}

  return '';
}

export async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, error: 'Nothing to copy.' };

  try {
    await navigator.clipboard.writeText(value);
    return { ok: true };
  } catch (_) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: CAPTURE_MESSAGE_ACTIONS.PC_COPY_TEXT,
        text: value,
      });
      if (response?.success) return { ok: true };
      return { ok: false, error: response?.error || 'Clipboard unavailable.' };
    } catch (err) {
      return { ok: false, error: err?.message || 'Clipboard unavailable.' };
    }
  }
}
