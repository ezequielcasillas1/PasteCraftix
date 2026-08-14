import { INTERNAL_MESSAGE_ACTIONS as A } from '../messaging/message-types.js';
import {
  OPTIONAL_PERM_KINDS,
  detectBrowserBrand,
  ensureOptionalPermissions,
  markSiteAccessNeeded,
  originPatternFromUrl,
  pcDebugOperaAf03f9,
  tryOpenToolbarPopup,
} from '../../shared/optional-permissions.js';
import {
  CLIPBOARD_WRITER_BRIDGE,
  OFFSCREEN_CLIPBOARD_MSG,
  createOffscreenClipboardChannel,
} from '../../shared/offscreen-clipboard-channel.js';

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

/**
 * Decode a data: URL to a Blob without fetch().
 * Extension CSP connect-src blocks fetch('data:…') — same pattern as profile-images.js.
 */
function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  const chunk = 0x8000;
  for (let i = 0; i < binary.length; i += chunk) {
    const end = Math.min(i + chunk, binary.length);
    for (let j = i; j < end; j++) bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
}

function dataUrlToBlob(dataUrl) {
  const u = String(dataUrl || '');
  const comma = u.indexOf(',');
  if (comma < 0) throw new Error('invalid_data_url');
  const header = u.slice(0, comma);
  const base64Match = header.match(/^data:([^;]+);base64$/i);
  if (!base64Match) throw new Error('unsupported_data_url');
  return new Blob([base64ToUint8Array(u.slice(comma + 1))], {
    type: base64Match[1] || 'image/png',
  });
}

async function cropDataUrlInWorker(dataUrl, rect, dpr) {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const blob = dataUrlToBlob(dataUrl);
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
  // local (not session): content scripts can read it without setAccessLevel,
  // and we avoid shipping multi‑MB dataUrls back over sendMessage.
  await chrome.storage.local.set({ [key]: dataUrl });
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
    // Do not fall back to inline multi‑MB dataUrl — closes the message port.
    return {
      success: false,
      ok: false,
      error: err?.message || 'stash_failed',
    };
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

function hostAccessCheckOptions(sender) {
  return {
    checkOnly: true,
    originPattern: originPatternFromUrl(sender?.tab?.url),
  };
}

async function runPcCaptureRegion(message, sender) {
  const hostPerm = await ensureOptionalPermissions(OPTIONAL_PERM_KINDS.ALL_URLS, hostAccessCheckOptions(sender));
  // #region agent log
  console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify({
    sessionId: 'af03f9',
    runId: 'perm-pre',
    hypothesisId: 'H5',
    location: 'capture.handler.js:runPcCaptureRegion',
    message: 'host perm before capture',
    data: {
      ok: !!hostPerm.ok,
      already: !!hostPerm.already,
      error: hostPerm.error || null,
      hasWindowId: Number.isFinite(sender?.tab?.windowId),
    },
    timestamp: Date.now(),
  }));
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
    body: JSON.stringify({
      sessionId: 'af03f9',
      runId: 'perm-pre',
      hypothesisId: 'H5',
      location: 'capture.handler.js:runPcCaptureRegion',
      message: 'host perm before capture',
      data: {
        ok: !!hostPerm.ok,
        already: !!hostPerm.already,
        error: hostPerm.error || null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  pcDebugOperaAf03f9('H-O5', 'capture.handler.js:runPcCaptureRegion', 'host perm before capture', {
    ok: !!hostPerm.ok,
    scope: hostPerm.scope || null,
    error: hostPerm.error || null,
  });
  if (!hostPerm.ok) {
    return {
      success: false,
      ok: false,
      error: hostPerm.error || 'permission_denied',
      message: hostPerm.message,
    };
  }

  const windowId = sender.tab?.windowId;
  const cropRect = normalizeCropRect(message?.rect);
  const dpr = Number(message?.dpr);

  const shot = await captureSenderScreenshot(windowId);
  // #region agent log
  pcDebugOperaAf03f9('H-O4', 'capture.handler.js:runPcCaptureRegion', 'captureVisibleTab result', {
    ok: !!shot.ok,
    error: shot.error || null,
    hostOk: !!hostPerm.ok,
    hostScope: hostPerm.scope || null,
    hasWindowId: Number.isFinite(windowId),
  });
  // #endregion
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

  (async () => {
    const hostPerm = await ensureOptionalPermissions(OPTIONAL_PERM_KINDS.ALL_URLS, hostAccessCheckOptions(sender));
    if (!hostPerm.ok) {
      sendResponse({
        success: false,
        error: hostPerm.error || 'permission_denied',
        message: hostPerm.message,
      });
      return;
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
  })();
  return true;
}

/**
 * MAIN-world probe: MathJax keeps original TeX on MathItem.math (not in isolated DOM).
 * Only formulas whose typeset root intersects the selection (never whole-page jax).
 * Must stay closure-free for chrome.scripting.executeScript.
 */
function probePageMathTexInFrame() {
  const sel = window.getSelection && window.getSelection();
  if (!sel || !sel.rangeCount) return [];

  const ranges = [];
  for (let r = 0; r < sel.rangeCount; r++) ranges.push(sel.getRangeAt(r));

  const intersects = (node) => {
    if (!node) return false;
    for (let i = 0; i < ranges.length; i++) {
      try {
        if (ranges[i].intersectsNode(node)) return true;
      } catch (_) { /* ignore */ }
    }
    return false;
  };

  // One TeX string per math container (longest wins if duplicates).
  const byRoot = [];
  const remember = (math, domNode, requireIntersect) => {
    const s = String(math || '').trim();
    if (!s || !domNode) return;
    if (requireIntersect && !intersects(domNode)) return;
    for (let i = 0; i < byRoot.length; i++) {
      if (byRoot[i].dom === domNode) {
        if (s.length > byRoot[i].math.length) byRoot[i].math = s;
        return;
      }
    }
    byRoot.push({ dom: domNode, math: s });
  };

  // Primary: closest mjx/katex from selection endpoints (trusted — no intersect filter).
  const tips = [sel.anchorNode, sel.focusNode];
  for (let t = 0; t < tips.length; t++) {
    let el = tips[t];
    if (el && el.nodeType !== 1) el = el.parentElement;
    const root = el && el.closest
      ? el.closest('mjx-container, .MathJax_Display, .MathJax, .katex-display, .katex')
      : null;
    if (!root) continue;

    try {
      const doc = window.MathJax && window.MathJax.startup && window.MathJax.startup.document;
      if (doc && typeof doc.getMathItemsWithin === 'function') {
        const items = doc.getMathItemsWithin(root) || [];
        let best = '';
        for (let i = 0; i < items.length; i++) {
          const m = items[i] && items[i].math ? String(items[i].math).trim() : '';
          if (m.length > best.length) best = m;
        }
        if (best) remember(best, root, false);
      }
    } catch (_) { /* ignore */ }

    try {
      const hub = window.MathJax && window.MathJax.Hub;
      if (hub && typeof hub.getAllJax === 'function') {
        const jaxList = hub.getAllJax(root) || [];
        for (let i = 0; i < jaxList.length; i++) {
          const jax = jaxList[i];
          if (jax && jax.originalText) remember(jax.originalText, root, false);
        }
      }
    } catch (_) { /* ignore */ }

    try {
      const ann = root.querySelector && root.querySelector('annotation[encoding="application/x-tex"]');
      if (ann && ann.textContent) remember(ann.textContent, root, false);
    } catch (_) { /* ignore */ }
  }

  // Secondary: only when endpoints are in prose — MathItems overlapping selection.
  if (!byRoot.length) {
    try {
      const doc = window.MathJax && window.MathJax.startup && window.MathJax.startup.document;
      if (doc && doc.math) {
        for (let i = 0; i < doc.math.length; i++) {
          const item = doc.math[i];
          if (!item || !item.math || !item.typesetRoot) continue;
          remember(item.math, item.typesetRoot, true);
        }
      }
    } catch (_) { /* ignore */ }
  }

  return byRoot.map((entry) => entry.math);
}

function mergePageMathTexResults(results) {
  const out = [];
  const seen = Object.create(null);
  for (const entry of results || []) {
    const list = Array.isArray(entry?.result) ? entry.result : [];
    for (const tex of list) {
      const s = String(tex || '').trim();
      if (!s || seen[s]) continue;
      seen[s] = true;
      out.push(s);
    }
  }
  return out;
}

export function handlePcExtractPageMathTex(_message, { sender, sendResponse }) {
  const tabId = sender.tab?.id;
  if (!Number.isFinite(tabId)) {
    sendResponse({ success: false, error: 'missing_tab', texes: [] });
    return false;
  }

  (async () => {
    const hostPerm = await ensureOptionalPermissions(OPTIONAL_PERM_KINDS.ALL_URLS, hostAccessCheckOptions(sender));
    if (!hostPerm.ok) {
      sendResponse({
        success: false,
        error: hostPerm.error || 'permission_denied',
        message: hostPerm.message,
        texes: [],
      });
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: probePageMathTexInFrame,
      },
      (results) => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({
            success: false,
            error: err.message || 'math_tex_probe_failed',
            texes: [],
          });
          return;
        }
        const texes = mergePageMathTexResults(results);
        sendResponse({ success: texes.length > 0, texes });
      },
    );
  })();
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prefer BroadcastChannel (SW→offscreen sendMessage replies are often undefined).
 * Falls back to runtime.sendMessage for older offscreen builds.
 */
async function writeClipboardImageViaOffscreen(dataUrl, storageKey = '') {
  let lastError = 'offscreen_write_image_failed';

  try {
    const CH = OFFSCREEN_CLIPBOARD_MSG;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await new Promise((resolve) => {
      const bc = createOffscreenClipboardChannel();
      const timer = setTimeout(() => {
        try {
          bc.close();
        } catch (_) {}
        resolve({ success: false, error: 'offscreen_write_timeout' });
      }, 8000);
      bc.onmessage = (ev) => {
        const msg = ev?.data;
        if (!msg || msg.id !== id || msg.type !== CH.WRITE_RES) return;
        clearTimeout(timer);
        try {
          bc.close();
        } catch (_) {}
        resolve({ success: !!msg.success, error: msg.error || lastError });
      };
      bc.postMessage({
        type: CH.WRITE_REQ,
        id,
        dataUrl: storageKey ? '' : dataUrl,
        storageKey: storageKey || '',
      });
    });
    if (result?.success) return { success: true };
    lastError = result?.error || lastError;
  } catch (err) {
    lastError = err?.message || String(err) || lastError;
  }

  // Legacy sendMessage path (may drop reply when SW is also a listener).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await delay(40 * attempt);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'pcOffscreenWriteClipboardImage',
        dataUrl: storageKey ? undefined : dataUrl,
        storageKey: storageKey || undefined,
      });
      if (response?.success) return { success: true };
      if (response?.error) lastError = response.error;
    } catch (err) {
      lastError = err?.message || String(err) || lastError;
    }
  }
  return { success: false, error: lastError };
}

/**
 * Create/settle the offscreen clipboard document (popup then writes directly).
 * Return a Promise so the Mediator router owns sendResponse (callback replies
 * often arrive as undefined at the popup for this action).
 */
export function handlePcEnsureClipboardOffscreen(message) {
  return (async () => {
    try {
      const ready = await ensureClipboardOffscreenDocument({ force: !!message?.force });
      if (!ready.ok) {
        return { success: false, error: ready.error || 'offscreen_create_failed' };
      }
      if (ready.created) await delay(80);
      return { success: true, created: !!ready.created };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  })();
}

/**
 * Write a PNG (data URL) to the system clipboard via offscreen document.
 * Promise return → router sendResponse (avoids undefined popup replies).
 */
export function handlePcCopyImage(message) {
  const dataUrl = String(message?.dataUrl || '');
  const storageKey = String(message?.storageKey || '');
  return (async () => {
    try {
      if (!dataUrl.startsWith('data:image/') && !storageKey.startsWith('pc_clipboard_img_')) {
        return { success: false, error: 'invalid_image_data_url' };
      }
      const ready = await ensureClipboardOffscreenDocument();
      if (!ready.ok) {
        return { success: false, error: ready.error || 'offscreen_create_failed' };
      }
      if (ready.created) await delay(50);
      return await writeClipboardImageViaOffscreen(dataUrl, storageKey);
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  })();
}

/**
 * Open a tiny focused writer window for real image/png clipboard writes.
 * Action popups are Permissions-Policy blocked (crbug.com/414348233) and
 * offscreen documents are focus-blocked; a focused extension window is neither.
 * Promise return → router sendResponse.
 */
export function handlePcOpenClipboardWriter(message) {
  return (async () => {
    try {
      const id = String(message?.id || '');
      const storageKey = String(message?.storageKey || '');
      if (!id || !storageKey.startsWith('pc_clipboard_img_')) {
        return { success: false, error: 'invalid_writer_job' };
      }
      const WB = CLIPBOARD_WRITER_BRIDGE;
      await chrome.storage.local.set({ [WB.JOB]: { id, storageKey, ts: Date.now() } });
      const win = await chrome.windows.create({
        url: chrome.runtime.getURL('clipboard-writer.html'),
        type: 'popup',
        width: 160,
        height: 100,
        focused: true,
      });
      const windowId = win?.id;
      if (Number.isFinite(windowId)) {
        const onChange = (changes, area) => {
          if (area !== 'local') return;
          const res = changes?.[WB.RESULT]?.newValue;
          if (!res || res.id !== id) return;
          try { chrome.storage.onChanged.removeListener(onChange); } catch (_) {}
          chrome.windows.remove(windowId).catch(() => {});
        };
        chrome.storage.onChanged.addListener(onChange);
        setTimeout(() => {
          try { chrome.storage.onChanged.removeListener(onChange); } catch (_) {}
        }, 15000);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  })();
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

async function fetchRemoteImageDataUrl(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`image_fetch_${res.status}`);
  const blob = await res.blob();
  const mime = String(blob?.type || '');
  if (!mime.startsWith('image/')) throw new Error('not_image_response');
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, mime: mime || 'image/png' };
}

/** Fetch a remote image for clipboard copy when popup CSP blocks connect-src. */
export function handlePcFetchImageAsDataUrl(message, { sendResponse }) {
  const url = String(message?.url || '').trim();
  (async () => {
    try {
      if (!isHttpUrl(url)) {
        sendResponse({ success: false, error: 'invalid_image_url' });
        return;
      }
      const { dataUrl, mime } = await fetchRemoteImageDataUrl(url);
      sendResponse({ success: true, dataUrl, mime });
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();
  return true;
}

const OFFSCREEN_CLIPBOARD = Object.freeze({
  url: 'offscreen-clipboard.html',
  reasons: ['CLIPBOARD'],
  justification:
    'Read clipboard text when PDF viewer steals page focus; write image clips when popup Permissions Policy blocks Clipboard API',
});

const ENSURE_RESULT_KEY = 'pc_clipboard_ensure_result';

function isOffscreenAlreadyExistsError(err) {
  return /already exists|Only a single offscreen/i.test(String(err?.message || err || ''));
}

async function publishEnsureResult(result) {
  try {
    await chrome.storage.local.set({
      [ENSURE_RESULT_KEY]: { ...result, ts: Date.now() },
    });
  } catch (_) {}
}

async function ensureClipboardOffscreenDocument(options = {}) {
  const force = !!options.force;
  try {
    const hasDoc = !!(await chrome.offscreen.hasDocument?.());
    if (hasDoc && force && chrome.offscreen.closeDocument) {
      try { await chrome.offscreen.closeDocument(); } catch (_) {}
      try {
        await chrome.storage.local.remove([
          'pc_clipboard_offscreen_ready',
          ENSURE_RESULT_KEY,
        ]);
      } catch (_) {}
    } else if (hasDoc) {
      const out = { ok: true, created: false };
      await publishEnsureResult(out);
      return out;
    }
  } catch (_) {}

  try {
    await chrome.offscreen.createDocument(OFFSCREEN_CLIPBOARD);
    const out = { ok: true, created: true };
    await publishEnsureResult(out);
    return out;
  } catch (err) {
    if (isOffscreenAlreadyExistsError(err)) {
      const out = { ok: true, created: false };
      await publishEnsureResult(out);
      return out;
    }
    const out = {
      ok: false,
      error: String(err?.message || err || 'offscreen_create_failed'),
    };
    await publishEnsureResult(out);
    return out;
  }
}

async function readClipboardViaOffscreen() {
  const response = await chrome.runtime.sendMessage({ action: 'pcOffscreenReadClipboard' });
  const text = String(response?.text || '').trim();
  if (response?.success && text) return { success: true, text };
  return { success: false, error: response?.error || 'offscreen_read_empty' };
}

/** Offscreen clipboard read — PDF plugin often blocks page-focused clipboard APIs. */
export function handlePcReadClipboard(_message, { sendResponse }) {
  (async () => {
    const clipPerm = await ensureOptionalPermissions(OPTIONAL_PERM_KINDS.PDF_CLIPBOARD);
    if (!clipPerm.ok) {
      sendResponse({
        success: false,
        error: clipPerm.error || 'permission_denied',
        message: clipPerm.message,
      });
      return;
    }

    const ready = await ensureClipboardOffscreenDocument();
    if (!ready.ok) {
      sendResponse({ success: false, error: ready.error });
      return;
    }
    try {
      sendResponse(await readClipboardViaOffscreen());
    } catch (error) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handlePcEnsureOptionalPermissions(message, { sender, sendResponse }) {
  (async () => {
    sendResponse(await ensureOptionalPermissions(message?.kind, {
      checkOnly: message?.checkOnly === true,
      originPattern: message?.originPattern || originPatternFromUrl(sender?.tab?.url),
    }));
  })();
  return true;
}

function buildGrantPageUrl(srcTab, srcOrigin) {
  const base = chrome.runtime.getURL('grant-site-access.html');
  const params = new URLSearchParams();
  if (Number.isFinite(srcTab)) params.set('srcTab', String(srcTab));
  if (srcOrigin) params.set('srcOrigin', srcOrigin);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function openChromeEdgeGrantTab(srcTab, srcOrigin, sendResponse) {
  const base = chrome.runtime.getURL('grant-site-access.html');
  const grantUrl = buildGrantPageUrl(srcTab, srcOrigin);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => typeof tab?.url === 'string' && tab.url.startsWith(base));
  if (Number.isFinite(existing?.id)) {
    await chrome.tabs.update(existing.id, { active: true, url: grantUrl });
    sendResponse({ ok: true, reused: true, tabId: existing.id, via: 'grant-tab' });
    // #region agent log
    console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify({
      sessionId: 'af03f9', runId: 'perm-pre', hypothesisId: 'H1',
      location: 'capture.handler.js:handlePcOpenSiteAccessGrant',
      message: 'reused grant tab',
      data: { tabId: existing.id, srcTab },
      timestamp: Date.now(),
    }));
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
      body: JSON.stringify({
        sessionId: 'af03f9', runId: 'perm-pre', hypothesisId: 'H1',
        location: 'capture.handler.js:handlePcOpenSiteAccessGrant',
        message: 'reused grant tab',
        data: { tabId: existing.id, srcTab },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return;
  }
  const createOpts = { url: grantUrl, active: true };
  if (Number.isFinite(srcTab)) createOpts.openerTabId = srcTab;
  let tab;
  try {
    tab = await chrome.tabs.create(createOpts);
  } catch (_) {
    tab = await chrome.tabs.create({ url: grantUrl, active: true });
  }
  sendResponse({ ok: true, reused: false, tabId: tab?.id ?? null, via: 'grant-tab' });
  // #region agent log
  console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify({
    sessionId: 'af03f9', runId: 'perm-pre', hypothesisId: 'H1',
    location: 'capture.handler.js:handlePcOpenSiteAccessGrant',
    message: 'created grant tab',
    data: { tabId: tab?.id ?? null, srcTab },
    timestamp: Date.now(),
  }));
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
    body: JSON.stringify({
      sessionId: 'af03f9', runId: 'perm-pre', hypothesisId: 'H1',
      location: 'capture.handler.js:handlePcOpenSiteAccessGrant',
      message: 'created grant tab',
      data: { tabId: tab?.id ?? null, srcTab },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function handlePcOpenSiteAccessGrant(_message, { sender, sendResponse }) {
  (async () => {
    const brand = detectBrowserBrand();
    const srcTab = Number.isFinite(sender?.tab?.id) ? sender.tab.id : null;
    const srcOrigin = originPatternFromUrl(sender?.tab?.url);
    await markSiteAccessNeeded();

    if (brand.isOpera) {
      const popupAttempt = await tryOpenToolbarPopup();
      // #region agent log
      pcDebugOperaAf03f9('H-O2', 'capture.handler.js:handlePcOpenSiteAccessGrant', 'skipped grant tab on Opera', {
        skippedGrantTab: true,
        openPopupOk: popupAttempt.ok,
        openPopupError: popupAttempt.error || null,
        srcTab,
        hasSrcOrigin: !!srcOrigin,
      });
      // #endregion
      sendResponse({
        ok: true,
        via: 'popup',
        skippedGrantTab: true,
        openPopupOk: popupAttempt.ok,
        openPopupError: popupAttempt.error || null,
      });
      return;
    }

    try {
      await openChromeEdgeGrantTab(srcTab, srcOrigin, sendResponse);
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err || 'open_failed') });
    }
  })();
  return true;
}

/**
 * On write REQ: only ensure the offscreen document exists.
 * Offscreen owns the clipboard write + RES (avoids SW↔offscreen reply drops).
 */
export function installClipboardStorageBridge() {
  if (installClipboardStorageBridge._installed) return;
  installClipboardStorageBridge._installed = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes?.pc_clipboard_write_req?.newValue) return;
    ensureClipboardOffscreenDocument().catch(() => {});
  });
}

export function createCaptureHandlerMap() {
  installClipboardStorageBridge();
  return {
    [A.PC_CAPTURE_REGION]: handlePcCaptureRegion,
    [A.PC_GET_PAGE_SELECTION]: handlePcGetPageSelection,
    [A.PC_EXTRACT_PAGE_MATH_TEX]: handlePcExtractPageMathTex,
    [A.PC_COPY_TEXT]: handlePcCopyText,
    [A.PC_COPY_IMAGE]: handlePcCopyImage,
    [A.PC_ENSURE_CLIPBOARD_OFFSCREEN]: handlePcEnsureClipboardOffscreen,
    [A.PC_OPEN_CLIPBOARD_WRITER]: handlePcOpenClipboardWriter,
    [A.PC_FETCH_IMAGE_AS_DATA_URL]: handlePcFetchImageAsDataUrl,
    [A.PC_READ_CLIPBOARD]: handlePcReadClipboard,
    [A.PC_ENSURE_OPTIONAL_PERMISSIONS]: handlePcEnsureOptionalPermissions,
    [A.PC_OPEN_SITE_ACCESS_GRANT]: handlePcOpenSiteAccessGrant,
  };
}
