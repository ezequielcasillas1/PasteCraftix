import { readListingDock } from './merchant.dock-storage.js';
import { copyTextToClipboard, readMerchantPrefs } from './merchant.tag-queue.js';
import { syncMerchantQueueHints } from './merchant.queue-hints.js';
import { splitQueueInput } from './merchant.queue-parse.js';

function isInsideMerchantHost(el) {
  let node = el;
  while (node) {
    const field = node.getAttribute?.('data-field');
    if (field === 'pc-merchant-strip-host' || field === 'pc-merchant-dock-host') {
      return true;
    }
    node = node.parentNode || node.host;
  }
  return false;
}

export function createMerchantQueue(config) {
  const {
    dockField,
    fallbackDockField = null,
    action,
    hintLabel,
    nextItemKey = 'nextItem',
    stageEmptyMessage,
    pasteEmptyMessage,
    pasteCompleteMessage,
    activateMessagePrefix,
    isLikelyInput,
    parseItems = splitQueueInput,
  } = config;

  let _active = false;
  let _index = 0;
  let _items = [];
  let _stripEl = null;
  let _getToastRoot = null;
  let _onFocusIn = null;
  let _bound = false;

  async function resolveStagedSource() {
    const payload = await readListingDock();
    const dock = window.__pasteCraftMerchant?.dock;
    const liveValues = dock?.getFieldValues?.() || {};
    let source = (liveValues[dockField] || '').trim();
    if (!source && fallbackDockField) {
      source = (liveValues[fallbackDockField] || '').trim();
    }
    if (!source) {
      source = (payload?.[dockField] || '').trim();
      if (!source && fallbackDockField) {
        source = (payload?.[fallbackDockField] || '').trim();
      }
    }
    return source;
  }

  async function loadStagedItems() {
    const source = await resolveStagedSource();
    _items = parseItems(source);
    if (_index > _items.length) {
      _index = _items.length;
    }
    return _items;
  }

  function isActive() {
    return _active;
  }

  function getStatus() {
    const total = _items.length;
    const at = total === 0 ? 0 : Math.min(_index + 1, total);
    const nextItem = _items[_index] || null;
    const done = total > 0 && _index >= total;
    return {
      active: _active,
      index: _index,
      total,
      at,
      [nextItemKey]: nextItem,
      done,
      empty: total === 0,
    };
  }

  function showToast(message) {
    const root = _getToastRoot?.();
    if (!root) return;
    let toast = root.querySelector('[data-field="pc-merchant-toast"]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'pc-merchant-toast';
      toast.setAttribute('data-field', 'pc-merchant-toast');
      root.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function syncStripUi() {
    if (!_stripEl) return;
    const btn = _stripEl.querySelector(`[data-action="${action}"]`);
    btn?.setAttribute('aria-pressed', _active ? 'true' : 'false');
    btn?.classList.toggle('is-active', _active);
    syncMerchantQueueHints(_stripEl);
  }

  async function handleFieldFocus(event) {
    if (!_active) return;
    const target = event.target;
    if (isInsideMerchantHost(target)) return;
    if (!isLikelyInput(target)) return;

    const result = await pasteNext();
    if (result.message) {
      showToast(result.message);
    }
    syncStripUi();
  }

  function bindPageListeners() {
    if (_bound) return;
    _onFocusIn = (event) => {
      handleFieldFocus(event).catch(() => {});
    };
    document.addEventListener('focusin', _onFocusIn, true);
    _bound = true;
  }

  function unbindPageListeners() {
    if (!_bound || !_onFocusIn) return;
    document.removeEventListener('focusin', _onFocusIn, true);
    _onFocusIn = null;
    _bound = false;
  }

  async function refresh() {
    await loadStagedItems();
    syncStripUi();
    return getStatus();
  }

  async function activate() {
    await readMerchantPrefs();
    await loadStagedItems();
    if (_items.length === 0) {
      return { ok: false, message: stageEmptyMessage };
    }
    _active = true;
    if (_index >= _items.length) {
      _index = 0;
    }
    bindPageListeners();
    syncStripUi();
    return {
      ok: true,
      message: `${activateMessagePrefix} · ${_index + 1}/${_items.length} next`,
    };
  }

  function deactivate() {
    _active = false;
    unbindPageListeners();
    syncStripUi();
    return { ok: true, message: `${hintLabel} queue off.` };
  }

  async function toggle() {
    if (_active) {
      return deactivate();
    }
    return activate();
  }

  async function pasteNext() {
    const prefs = await readMerchantPrefs();
    if (_items.length === 0) {
      await loadStagedItems();
    }
    if (_items.length === 0) {
      return { ok: false, message: pasteEmptyMessage };
    }
    if (_index >= _items.length) {
      return { ok: false, message: pasteCompleteMessage };
    }

    const item = _items[_index];
    const copyResult = await copyTextToClipboard(item);
    if (!copyResult.ok) {
      return { ok: false, message: copyResult.error || 'Copy failed.' };
    }

    const position = _index + 1;
    if (prefs.queueAutoAdvance !== false) {
      _index += 1;
    }

    const status = getStatus();
    let message = `Copied "${item}" (${position}/${_items.length}) — paste with Ctrl+V`;
    if (status.done) {
      message = `Copied "${item}" — ${hintLabel.toLowerCase()} queue complete`;
    }

    syncStripUi();
    return { ok: true, item, message, status };
  }

  function resetIndex() {
    _index = 0;
    syncStripUi();
  }

  function deactivateOnUnmount() {
    _active = false;
    _index = 0;
    _items = [];
    unbindPageListeners();
  }

  async function init({ stripEl, getToastRoot } = {}) {
    _stripEl = stripEl || null;
    _getToastRoot = getToastRoot || null;
    await readMerchantPrefs();
    await loadStagedItems();
    syncStripUi();
    return {
      isActive,
      getStatus,
      toggle,
      pasteNext,
      refresh,
      resetIndex,
    };
  }

  return {
    isActive,
    getStatus,
    toggle,
    pasteNext,
    refresh,
    resetIndex,
    deactivateOnUnmount,
    syncStripUi,
    init,
  };
}
