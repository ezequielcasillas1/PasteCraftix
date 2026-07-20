import { INTERNAL_MESSAGE_ACTIONS as A } from '../messaging/message-types.js';

/**
 * Capture / clipboard / page-selection handlers (widget Capture Tools).
 * Keep each handler CC ≤ 9 via small helpers.
 */

function captureVisibleTabOnce(windowId) {
  return new Promise((resolve) => {
    try {
      const cb = (dataUrl) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr || !dataUrl) {
          resolve({ ok: false, error: lastErr?.message || 'capture_failed_no_data' });
          return;
        }
        resolve({ ok: true, dataUrl });
      };
      if (windowId != null) {
        chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, cb);
      } else {
        chrome.tabs.captureVisibleTab({ format: 'png' }, cb);
      }
    } catch (err) {
      resolve({ ok: false, error: err?.message || 'capture_throw' });
    }
  });
}

export function handlePcCaptureRegion(_message, { sender, sendResponse }) {
  const senderWindowId = sender.tab?.windowId;
  const captureTargetWindow = Number.isFinite(senderWindowId) ? senderWindowId : null;

  (async () => {
    try {
      const result = await captureVisibleTabOnce(captureTargetWindow);
      if (result.ok) {
        sendResponse({ success: true, dataUrl: result.dataUrl });
      } else {
        sendResponse({ success: false, error: result.error || 'capture_failed' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err?.message || 'capture_outer_throw' });
    }
  })();
  return true;
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
