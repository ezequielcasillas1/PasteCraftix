import { syncNativeInputEvents } from '../merchant.tag-submit.js';

export function queryInputs(selector, root = document) {
  if (!selector) return [];
  try {
    return [...root.querySelectorAll(selector)].filter((el) => {
      if (el.disabled || el.readOnly) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    });
  } catch (_) {
    return [];
  }
}

export function fillInputDirect(el, value, strategy = 'direct-set') {
  if (!el || value == null) return { ok: false, reason: 'missing' };
  const text = String(value);
  if (strategy !== 'direct-set') {
    return { ok: false, reason: 'unsupported_strategy' };
  }
  try {
    el.focus({ preventScroll: true });
    el.value = text;
    syncNativeInputEvents(el);
    return { ok: true };
  } catch (_) {
    return { ok: false, reason: 'fill_failed' };
  }
}

export function fillFieldGroup(selector, items, strategy = 'direct-set') {
  const inputs = queryInputs(selector);
  const safeItems = Array.isArray(items) ? items : [];
  let filled = 0;
  for (let i = 0; i < Math.min(inputs.length, safeItems.length); i += 1) {
    const result = fillInputDirect(inputs[i], safeItems[i], strategy);
    if (result.ok) filled += 1;
  }
  return {
    filled,
    slots: inputs.length,
    staged: safeItems.length,
  };
}
