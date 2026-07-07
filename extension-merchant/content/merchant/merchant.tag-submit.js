/** Chip-style tag inputs (Etsy live, Shopify, WooCommerce) — paste sync + Enter commit. */

const SLOT_FIELD_PATTERN = /^(etsy|redbubble|printify|shopify|woocommerce|generic|teepublic|amazon|ebay)-(?:tag|keyword)-\d+$/i;

const CHIP_REMOVE_SELECTORS = [
  '[role="button"][aria-label*="remove" i]',
  'button[aria-label*="remove" i]',
  '[class*="chip" i]',
  '[class*="tag-item" i]',
  '[data-tag-index]',
].join(', ');

export function isLikelyTagInput(el) {
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();
  const maxLen = el.maxLength > 0 ? el.maxLength : null;

  if (field.includes('tag') || field.includes('keyword')) return true;
  if (aria.includes('tag') || aria.includes('keyword')) return true;
  if (placeholder.includes('tag') || placeholder.includes('keyword')) return true;
  if (name.includes('tag') || name.includes('keyword')) return true;
  if (id.includes('tag') || id.includes('keyword')) return true;
  if (maxLen != null && maxLen <= 40) return true;

  return false;
}

export function isMultiSlotTagInput(el) {
  const field = el?.getAttribute?.('data-field') || '';
  return SLOT_FIELD_PATTERN.test(field);
}

function hasNearbyTagChips(root) {
  if (!root) return false;
  try {
    return root.querySelectorAll(CHIP_REMOVE_SELECTORS).length > 0;
  } catch (_) {
    return false;
  }
}

function isEtsyListingHost() {
  try {
    return /(^|\.)etsy\.com$/i.test(window.location.hostname);
  } catch (_) {
    return false;
  }
}

/** Single-input chip widget (live Etsy) vs per-slot test-lab grids. */
export function isChipStyleTagInput(el) {
  if (!isLikelyTagInput(el)) return false;
  if (isMultiSlotTagInput(el)) return false;

  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  if (aria.includes('add tag') || placeholder.includes('add tag')) return true;
  if (aria.includes('add a tag') || placeholder.includes('add a tag')) return true;

  const container = el.closest('fieldset, section, [class*="tag" i], [id*="tag" i], form') || el.parentElement;
  if (hasNearbyTagChips(container)) return true;

  if (container) {
    const inputs = [...container.querySelectorAll('input[type="text"], input:not([type])')]
      .filter((node) => isLikelyTagInput(node) && !node.disabled && !node.readOnly);
    if (inputs.length === 1) return true;
  }

  return isEtsyListingHost() && isLikelyTagInput(el);
}

export function syncNativeInputEvents(el) {
  if (!el) return;
  try {
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: el.value,
    }));
  } catch (_) {
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchEnterOnInput(el) {
  const init = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

export function findNearbyTagAddButton(inputEl) {
  let node = inputEl?.parentElement;
  for (let depth = 0; depth < 5 && node; depth += 1) {
    const buttons = node.querySelectorAll('button');
    for (const btn of buttons) {
      const label = `${btn.textContent || ''} ${btn.getAttribute('aria-label') || ''}`.toLowerCase();
      if (/\badd\b.*\btag\b|\btag\b.*\badd\b|^add tag$|^add$/.test(label.trim())) {
        return btn;
      }
    }
    node = node.parentElement;
  }
  return null;
}

export function commitChipTagInput(inputEl) {
  const value = (inputEl?.value || '').trim();
  if (!value) return { ok: false, reason: 'empty' };

  syncNativeInputEvents(inputEl);
  dispatchEnterOnInput(inputEl);

  if (!(inputEl.value || '').trim()) {
    return { ok: true, method: 'enter' };
  }

  const addBtn = findNearbyTagAddButton(inputEl);
  if (addBtn) {
    addBtn.click();
    if (!(inputEl.value || '').trim()) {
      return { ok: true, method: 'button' };
    }
  }

  return { ok: false, reason: 'still_has_value' };
}

export function createTagSubmitController({ isActive, isInsideMerchantHost, onCommitSuccess }) {
  let _onPaste = null;
  let _onKeydown = null;
  let _bound = false;
  let _committing = false;

  function handlePaste(event) {
    if (!isActive()) return;
    const target = event.target;
    if (isInsideMerchantHost(target)) return;
    if (!isChipStyleTagInput(target)) return;

    window.setTimeout(() => {
      syncNativeInputEvents(target);
    }, 0);
  }

  function handleKeydown(event) {
    if (!isActive() || event.key !== 'Enter' || event.isComposing) return;
    // Synthetic Enter from commitChipTagInput must reach Etsy/React — never re-intercept.
    if (!event.isTrusted) return;
    if (_committing) return;

    const target = event.target;
    if (isInsideMerchantHost(target)) return;
    const chipStyle = isChipStyleTagInput(target);
    const value = (target.value || '').trim();
    if (!chipStyle) {
      if (value) {
      }
      return;
    }
    if (!value) return;

    event.preventDefault();
    event.stopPropagation();

    _committing = true;
    try {
      const result = commitChipTagInput(target);
      if (!result.ok) {
        return;
      }
      if (typeof onCommitSuccess === 'function') {
        onCommitSuccess().catch(() => {});
      }
    } finally {
      _committing = false;
    }
  }

  function bind() {
    if (_bound) return;
    _onPaste = handlePaste;
    _onKeydown = handleKeydown;
    document.addEventListener('paste', _onPaste, true);
    document.addEventListener('keydown', _onKeydown, true);
    _bound = true;
  }

  function unbind() {
    if (!_bound) return;
    document.removeEventListener('paste', _onPaste, true);
    document.removeEventListener('keydown', _onKeydown, true);
    _onPaste = null;
    _onKeydown = null;
    _bound = false;
  }

  return { bind, unbind };
}
