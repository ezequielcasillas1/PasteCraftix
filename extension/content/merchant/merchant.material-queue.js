import {
  MERCHANT_ACTIONS,
  MERCHANT_DEFAULT_PREFS,
} from './merchant.constants.js';
import { readListingDock } from './merchant.dock-storage.js';
import { validateMaterials } from './merchant.materials.js';
import {
  copyTextToClipboard,
  readMerchantPrefs,
} from './merchant.tag-queue.js';
import { syncMerchantQueueHints } from './merchant.queue-hints.js';

let _active = false;
let _index = 0;
let _materials = [];
let _prefs = { ...MERCHANT_DEFAULT_PREFS };
let _stripEl = null;
let _getToastRoot = null;
let _onFocusIn = null;
let _bound = false;

async function loadStagedMaterials() {
  const payload = await readListingDock();
  const raw = payload?.materials || '';
  const dock = window.__pasteCraftMerchant?.dock;
  const liveRaw = dock?.getFieldValues?.()?.materials;
  const source = (liveRaw || '').trim() ? liveRaw : raw;
  const result = validateMaterials(source);
  _materials = result.materials;
  if (_index > _materials.length) {
    _index = _materials.length;
  }
  return _materials;
}

export function isMaterialQueueActive() {
  return _active;
}

export function getMaterialQueueStatus() {
  const total = _materials.length;
  const at = total === 0 ? 0 : Math.min(_index + 1, total);
  const nextMaterial = _materials[_index] || null;
  const done = total > 0 && _index >= total;
  return {
    active: _active,
    index: _index,
    total,
    at,
    nextMaterial,
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

export function syncMaterialQueueStripUi() {
  if (!_stripEl) return;
  const btn = _stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.MATERIAL_QUEUE_TOGGLE}"]`);

  btn?.setAttribute('aria-pressed', _active ? 'true' : 'false');
  btn?.classList.toggle('is-active', _active);
  syncMerchantQueueHints(_stripEl);
}

function isLikelyMaterialInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();

  if (field.includes('material')) return true;
  if (aria.includes('material')) return true;
  if (placeholder.includes('material')) return true;
  if (name.includes('material')) return true;
  if (id.includes('material')) return true;

  return false;
}

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

async function handleMaterialFieldFocus(event) {
  if (!_active) return;
  const target = event.target;
  if (isInsideMerchantHost(target)) return;
  if (!isLikelyMaterialInput(target)) return;

  const result = await pasteNextMaterial();
  if (result.message) {
    showToast(result.message);
  }
  syncMaterialQueueStripUi();
}

function bindPageListeners() {
  if (_bound) return;
  _onFocusIn = (event) => {
    handleMaterialFieldFocus(event).catch(() => {});
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

export async function refreshMaterialQueueMaterials() {
  await loadStagedMaterials();
  syncMaterialQueueStripUi();
  return getMaterialQueueStatus();
}

export async function activateMaterialQueue() {
  await readMerchantPrefs();
  await loadStagedMaterials();
  if (_materials.length === 0) {
    return { ok: false, message: 'Stage materials in Listing Dock first.' };
  }
  _active = true;
  if (_index >= _materials.length) {
    _index = 0;
  }
  bindPageListeners();
  syncMaterialQueueStripUi();
  return {
    ok: true,
    message: `Material queue on — focus material field · ${_index + 1}/${_materials.length} next`,
  };
}

export function deactivateMaterialQueue() {
  _active = false;
  unbindPageListeners();
  syncMaterialQueueStripUi();
  return { ok: true, message: 'Material queue off.' };
}

export async function toggleMaterialQueue() {
  if (_active) {
    return deactivateMaterialQueue();
  }
  return activateMaterialQueue();
}

export async function pasteNextMaterial() {
  _prefs = await readMerchantPrefs();
  if (_materials.length === 0) {
    await loadStagedMaterials();
  }
  if (_materials.length === 0) {
    return { ok: false, message: 'No materials staged in dock.' };
  }
  if (_index >= _materials.length) {
    return { ok: false, message: 'Material queue complete — reset or add more.' };
  }

  const material = _materials[_index];
  const copyResult = await copyTextToClipboard(material);
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Copy failed.' };
  }

  const position = _index + 1;
  if (_prefs.queueAutoAdvance !== false) {
    _index += 1;
  }

  const status = getMaterialQueueStatus();
  let message = `Copied "${material}" (${position}/${_materials.length}) — paste with Ctrl+V`;
  if (status.done) {
    message = `Copied "${material}" — material queue complete`;
  }

  syncMaterialQueueStripUi();
  return { ok: true, material, message, status };
}

export function resetMaterialQueueIndex() {
  _index = 0;
  syncMaterialQueueStripUi();
}

export function deactivateMaterialQueueOnUnmount() {
  _active = false;
  _index = 0;
  _materials = [];
  unbindPageListeners();
}

export async function initMerchantMaterialQueue({ stripEl, getToastRoot } = {}) {
  _stripEl = stripEl || null;
  _getToastRoot = getToastRoot || null;
  await readMerchantPrefs();
  await loadStagedMaterials();
  syncMaterialQueueStripUi();
  return {
    isActive: isMaterialQueueActive,
    getStatus: getMaterialQueueStatus,
    toggle: toggleMaterialQueue,
    pasteNext: pasteNextMaterial,
    refresh: refreshMaterialQueueMaterials,
    resetIndex: resetMaterialQueueIndex,
  };
}
