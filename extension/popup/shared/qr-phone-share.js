/** Client-side QR "Send to phone" — no SMS APIs; scan with phone camera. */

import qrcode from './qrcode-generator.js';

const TRUNCATION_NOTE =
  '\n\n[Full text copied on your computer — paste there or re-share shorter clip]';
const CLIPBOARD_ONLY_INSTRUCTION =
  'Full text copied on your computer. Paste from desktop clipboard into Notes.';

/** QR byte-mode ceiling at version 40 ECC L (~2953 UTF-8 bytes). */
export const PHONE_QR_ABSOLUTE_MAX_BYTES = 2953;

const IPHONE_HINT = 'Scan with Camera → tap banner → Copy → paste in Notes';
const IPHONE_HINT_TRUNCATED =
  'Scan with Camera → tap banner → Copy → paste in Notes. Full text is on your computer.';

function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

/** Prevent URL-only payloads that iPhone Camera would open in Safari. */
function ensurePlainTextPayload(text) {
  const value = String(text ?? '');
  if (/^https?:\/\//i.test(value.trim())) {
    return `Text:\n${value}`;
  }
  return value;
}

function truncateToUtf8Bytes(text, maxBytes, suffix = '') {
  const source = String(text ?? '');
  if (utf8ByteLength(source) <= maxBytes) return source;

  const suffixBytes = utf8ByteLength(suffix);
  const budget = Math.max(0, maxBytes - suffixBytes);
  if (budget === 0) return suffix.slice(0, Math.min(suffix.length, maxBytes));

  let low = 0;
  let high = source.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (utf8ByteLength(source.slice(0, mid)) <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return source.slice(0, low) + suffix;
}

export function preparePhoneQrPayload(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) {
    return { payload: '', mode: 'empty', copiedFull: false, showQr: false };
  }

  const full = ensurePlainTextPayload(raw);
  if (utf8ByteLength(full) <= PHONE_QR_ABSOLUTE_MAX_BYTES) {
    return { payload: full, mode: 'full', copiedFull: false, showQr: true };
  }

  const truncated = truncateToUtf8Bytes(full, PHONE_QR_ABSOLUTE_MAX_BYTES, TRUNCATION_NOTE);
  if (
    truncated.length > TRUNCATION_NOTE.length &&
    utf8ByteLength(truncated) <= PHONE_QR_ABSOLUTE_MAX_BYTES
  ) {
    return { payload: truncated, mode: 'truncated', copiedFull: true, showQr: true };
  }

  return {
    payload: CLIPBOARD_ONLY_INSTRUCTION,
    mode: 'clipboard-only',
    copiedFull: true,
    showQr: true,
  };
}

export function drawQrOnCanvas(canvas, payload) {
  const data = String(payload ?? '');
  if (!data) return false;

  const qr = qrcode(0, 'L');
  qr.addData(data);
  qr.make();

  const count = qr.getModuleCount();
  const margin = 2;
  const cellSize = Math.max(2, Math.floor(256 / (count + margin * 2)));
  const size = (count + margin * 2) * cellSize;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#111827';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
      }
    }
  }
  return true;
}

function getModeHint(mode) {
  if (mode === 'truncated') return IPHONE_HINT_TRUNCATED;
  if (mode === 'clipboard-only') {
    return 'Full text copied on your computer. Paste into Notes from desktop clipboard.';
  }
  return IPHONE_HINT;
}

export function createPhoneQrSection() {
  const section = document.createElement('div');
  section.className = 'pc-phone-qr-panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="pc-phone-qr-header">
      <span class="pc-phone-qr-title">Send to phone</span>
      <button type="button" class="pc-phone-qr-close" aria-label="Hide QR">✕</button>
    </div>
    <p class="pc-phone-qr-hint"></p>
    <div class="pc-phone-qr-canvas-wrap">
      <canvas class="pc-phone-qr-canvas" aria-label="QR code"></canvas>
    </div>
    <button type="button" class="pc-phone-qr-copy">Copy text</button>
  `;
  return section;
}

/**
 * Toggle QR panel inside a share card. Copies full text when payload is truncated.
 */
export async function togglePhoneQrPanel(section, app, text, { copyText } = {}) {
  if (!section) return false;

  const wasHidden = section.hidden;
  if (!wasHidden) {
    section.hidden = true;
    return false;
  }

  const { payload, mode, copiedFull, showQr } = preparePhoneQrPayload(text);
  if (mode === 'empty') {
    app?.showToast?.('Nothing to share', 'error');
    return false;
  }

  if (copiedFull) {
    try {
      if (typeof copyText === 'function') {
        await copyText(text);
      } else if (app?.copyClipToClipboard) {
        await app.copyClipToClipboard(text);
      } else {
        await navigator.clipboard.writeText(String(text ?? ''));
      }
      app?.showToast?.('Full text copied');
    } catch (e) {
      console.error('[qr-phone-share] Clipboard copy failed:', e);
      app?.showToast?.('Copy failed', 'error');
    }
  }

  const hint = section.querySelector('.pc-phone-qr-hint');
  if (hint) hint.textContent = getModeHint(mode);

  const canvasWrap = section.querySelector('.pc-phone-qr-canvas-wrap');
  const canvas = section.querySelector('.pc-phone-qr-canvas');
  if (!showQr || !payload) {
    if (canvasWrap) canvasWrap.hidden = true;
  } else if (canvas) {
    if (canvasWrap) canvasWrap.hidden = false;
    if (!drawQrOnCanvas(canvas, payload)) {
      if (canvasWrap) canvasWrap.hidden = true;
      app?.showToast?.('Could not generate QR', 'error');
      return false;
    }
  }

  section.hidden = false;
  return true;
}

export function wirePhoneQrSection(section, app, text, { copyText } = {}) {
  if (!section) return;

  section.querySelector('.pc-phone-qr-close')?.addEventListener('click', () => {
    section.hidden = true;
  });

  section.querySelector('.pc-phone-qr-copy')?.addEventListener('click', async () => {
    try {
      if (typeof copyText === 'function') {
        await copyText(text);
      } else if (app?.copyClipToClipboard) {
        await app.copyClipToClipboard(text);
      } else {
        await navigator.clipboard.writeText(String(text ?? ''));
      }
      app?.showToast?.('Copied for sharing');
    } catch (e) {
      console.error('[qr-phone-share] Copy failed:', e);
      app?.showToast?.('Copy failed', 'error');
    }
  });
}
