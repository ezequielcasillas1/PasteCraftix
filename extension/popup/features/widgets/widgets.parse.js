import {
  WIDGET_MAX_EMBED_CHARS,
  WIDGET_SIZES,
  WIDGET_TITLE_MAX,
} from './widgets.constants.js';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

/** Sandbox for remote https iframes only (in-popup). */
export const WIDGET_REMOTE_SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox';

function _trim(value) {
  return String(value || '').trim();
}

function _isSafeUrl(raw) {
  try {
    const u = new URL(_trim(raw));
    return ALLOWED_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

function _escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _extractIframeSrc(html) {
  const match = html.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  return match ? _trim(match[1]) : '';
}

function _extractScriptSrc(html) {
  const match = html.match(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  return match ? _trim(match[1]) : '';
}

function _parsePlainUrl(raw) {
  if (raw.includes('<')) return null;
  if (_isSafeUrl(raw)) return { ok: true, mode: 'iframe', src: raw, raw };
  return { ok: false, error: 'URL must start with http:// or https://.' };
}

function _parseIframeEmbed(raw) {
  const iframeSrc = _extractIframeSrc(raw);
  if (!iframeSrc) return null;
  if (!_isSafeUrl(iframeSrc)) return { ok: false, error: 'Iframe src must be http(s).' };
  return { ok: true, mode: 'iframe', src: iframeSrc, raw };
}

/**
 * Script/HTML embeds cannot run inside the extension popup (MV3 CSP inheritance
 * blocks remote scripts in blob/srcdoc children of extension pages — H6).
 * Store HTML and open live in a normal browser tab instead.
 */
function _toExternalPlan(raw) {
  const scriptSrc = _extractScriptSrc(raw);
  if (scriptSrc && !_isSafeUrl(scriptSrc)) {
    return { ok: false, error: 'Script src must be http(s).' };
  }
  const cleaned = raw
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:12px;overflow:auto;background:#ffffff;color:#0f172a;font-family:system-ui,sans-serif;}</style></head><body>${cleaned}</body></html>`;
  return { ok: true, mode: 'external', srcdoc, raw };
}

export function parseEmbedInput(rawInput) {
  const raw = _trim(rawInput);
  if (!raw) return { ok: false, error: 'Paste an embed snippet or URL.' };
  if (raw.length > WIDGET_MAX_EMBED_CHARS) {
    return { ok: false, error: `Embed is too long (max ${WIDGET_MAX_EMBED_CHARS} chars).` };
  }
  return _parsePlainUrl(raw) || _parseIframeEmbed(raw) || _toExternalPlan(raw);
}

export function normalizeWidgetRecord(input, existingId) {
  const title = _trim(input.title).slice(0, WIDGET_TITLE_MAX) || 'Untitled widget';
  const size = Object.values(WIDGET_SIZES).includes(input.size) ? input.size : WIDGET_SIZES.MD;
  const parsed = parseEmbedInput(input.embedRaw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const now = Date.now();
  return {
    ok: true,
    widget: {
      id: existingId || `pcw_${now}_${Math.random().toString(36).slice(2, 9)}`,
      title,
      size,
      embedRaw: parsed.raw,
      mode: parsed.mode,
      src: parsed.src || '',
      srcdoc: parsed.srcdoc || '',
      createdAt: input.createdAt || now,
      updatedAt: now,
    },
  };
}

/** True when widget needs a normal browser tab (script embeds). */
export function isExternalWidget(widget) {
  if (!widget) return false;
  return widget.mode === 'external' || widget.mode === 'blob' || widget.mode === 'srcdoc';
}

export function sandboxForMode(_mode) {
  return WIDGET_REMOTE_SANDBOX;
}

export function revokeIframeBlobUrl(iframeEl) {
  if (!iframeEl) return;
  const prev = iframeEl.dataset?.pcBlobUrl;
  if (!prev) return;
  try {
    URL.revokeObjectURL(prev);
  } catch {
    /* ignore */
  }
  delete iframeEl.dataset.pcBlobUrl;
}

export function buildWidgetBlobUrl(html) {
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}

/** Top-level data: tab is NOT chrome-extension:// — avoids extension CSP (H10). */
const DATA_URL_SOFT_MAX = 500000;

function _extractLcwCoin(html) {
  const raw = String(html || '');
  const patterns = [
    /data-coin(?:-id)?=["']([a-z0-9-]+)["']/i,
    /data-currency=["']([a-z0-9-]+)["']/i,
    /\bcoin=["']([a-z0-9-]+)["']/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return '';
}

export function buildWidgetDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Open script-based widget outside extension CSP.
 * Prefer data:text/html top-level tab (not blob:chrome-extension).
 * Fallback: Live Coin Watch coin page when data URL is too large.
 */
export function openWidgetInTab(widget) {
  const html = widget?.srcdoc || '';
  if (!html) return { ok: false, error: 'No embed HTML to open.' };

  let url = buildWidgetDataUrl(html);
  let openScheme = 'data';
  let fallback = false;

  if (url.length > DATA_URL_SOFT_MAX) {
    const coin = _extractLcwCoin(widget.embedRaw || html);
    if (coin) {
      url = `https://www.livecoinwatch.com/price/${encodeURIComponent(coin)}`;
      openScheme = 'lcw-price';
      fallback = true;
    } else {
      return { ok: false, error: 'Embed is too large to open as a data URL.' };
    }
  }

  chrome.tabs.create({ url, active: true });
  return { ok: true, url, openScheme };
}

export function applyIframePlan(iframeEl, widget) {
  if (!iframeEl || !widget) return;
  if (isExternalWidget(widget)) {
    return;
  }

  const sandbox = sandboxForMode(widget.mode);
  iframeEl.setAttribute('sandbox', sandbox);
  iframeEl.removeAttribute('srcdoc');
  revokeIframeBlobUrl(iframeEl);
  iframeEl.removeAttribute('src');

  if (widget.mode === 'iframe' && widget.src) {
    iframeEl.src = widget.src;
  }
}

export function escapeHtml(text) {
  return _escapeHtml(text);
}
