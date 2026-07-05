/**
 * Preserve page text selection before strip button clicks collapse it.
 */

let _cachedText = '';
let _lastNonEmpty = '';
let _initialized = false;

export function getPageSelectionText() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return '';
    return selection.toString().trim();
  } catch (_) {
    return '';
  }
}

/** Track last non-empty selection while user highlights page text. */
export function initSelectionCache() {
  if (_initialized) return;
  _initialized = true;
  document.addEventListener('selectionchange', () => {
    const live = getPageSelectionText();
    if (live) _lastNonEmpty = live;
  });
}

/** Call on pointerdown before click clears the selection. */
export function cachePageSelection() {
  const live = getPageSelectionText();
  _cachedText = live || _lastNonEmpty;
}

/** Prefer live selection; fall back to cached pointerdown snapshot. */
export function readSelectionText() {
  const live = getPageSelectionText();
  if (live) return live;
  if (_cachedText) return _cachedText;
  return _lastNonEmpty;
}

export function clearSelectionCache() {
  _cachedText = '';
  _lastNonEmpty = '';
}
