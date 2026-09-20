/**
 * Facade for Clip viewer character counting.
 * Small, reusable, testable — no HTML/DOM policy leaks into the viewer.
 */

export const CLIP_VIEWER_CHAR_COUNT_ID = 'clipViewerCharCount';

function looksLikeHtml(raw) {
  return /<\/?[a-z][\s\S]*>/i.test(raw);
}

function stripHtmlToPlainText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function toClipViewerPlainText(value) {
  const raw = value == null ? '' : String(value);
  if (!raw || !looksLikeHtml(raw)) return raw;
  return stripHtmlToPlainText(raw);
}

export function countClipViewerCharacters(value) {
  return toClipViewerPlainText(value).length;
}

export function formatClipViewerCharacterCount(count, locale) {
  const n = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
  const grouped = n.toLocaleString(locale);
  const word = n === 1 ? 'character' : 'characters';
  return `${grouped} ${word}`;
}

export function describeClipViewerCharacterCount(value, locale) {
  const count = countClipViewerCharacters(value);
  return { count, label: formatClipViewerCharacterCount(count, locale) };
}

export function applyClipViewerCharacterCount(el, value, locale) {
  const { count, label } = describeClipViewerCharacterCount(value, locale);
  if (!el) return { count, label };
  el.textContent = label;
  if (el.dataset && typeof el.dataset === 'object') {
    el.dataset.charCount = String(count);
  }
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('aria-label', label);
  }
  return { count, label };
}

export function ensureClipViewerCharacterCountEl(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return null;

  const meta = root.getElementById?.('clipViewerMeta');
  const row =
    root.getElementById?.('clipViewerMetaRow') ||
    meta?.closest?.('.pc-viewer-shell-meta-row') ||
    root.querySelector?.('#clipViewerMetaRow, .pc-viewer-shell-meta-row');
  const host = meta || row;
  if (!host) return root.getElementById?.(CLIP_VIEWER_CHAR_COUNT_ID) || null;

  let el = root.getElementById?.(CLIP_VIEWER_CHAR_COUNT_ID);
  if (!el && typeof root.createElement === 'function') {
    el = root.createElement('span');
    el.id = CLIP_VIEWER_CHAR_COUNT_ID;
    el.className = 'clip-viewer-char-count';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    applyClipViewerCharacterCount(el, '');
  }
  if (!el) return null;

  // Prefer inside the Saved/meta pill so the chip stays beside Saved.
  if (meta && el.parentElement !== meta) {
    meta.appendChild(el);
  } else if (!meta && row && el.parentElement !== row) {
    const actions = row.querySelector('.pc-viewer-shell-actions');
    if (actions) row.insertBefore(el, actions);
    else row.appendChild(el);
  }

  return el;
}
