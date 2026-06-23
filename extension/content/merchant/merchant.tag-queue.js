import {
  MERCHANT_ACTIONS,
  MERCHANT_CUSTOM_TAG_LIMIT,
  MERCHANT_DEFAULT_PREFS,
  MERCHANT_PLATFORM_PRESETS,
  MERCHANT_STORAGE_KEYS,
  MERCHANT_TAG_LIMIT_PRESET_IDS,
} from './merchant.constants.js';
import { readListingDock } from './merchant.dock-storage.js';
import { tagsToStorageString, validateTags } from './merchant.tags.js';

let _active = false;
let _index = 0;
let _tags = [];
let _prefs = { ...MERCHANT_DEFAULT_PREFS };
let _stripEl = null;
let _getToastRoot = null;
let _onFocusIn = null;
let _bound = false;

export function clampCustomMaxTags(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT;
  }
  return Math.min(
    MERCHANT_CUSTOM_TAG_LIMIT.MAX,
    Math.max(MERCHANT_CUSTOM_TAG_LIMIT.MIN, parsed),
  );
}

export function getPlatformProfile(presetId, prefs = null) {
  const activePrefs = prefs || _prefs;
  const safeId = MERCHANT_TAG_LIMIT_PRESET_IDS.includes(presetId)
    || MERCHANT_PLATFORM_PRESETS[presetId]
    ? presetId
    : MERCHANT_DEFAULT_PREFS.platformPreset;

  if (safeId === 'custom') {
    const maxTags = clampCustomMaxTags(activePrefs.customMaxTags);
    return {
      id: 'custom',
      label: 'Custom',
      maxTags,
      maxChars: MERCHANT_PLATFORM_PRESETS.generic.maxChars,
    };
  }

  return MERCHANT_PLATFORM_PRESETS[safeId] || MERCHANT_PLATFORM_PRESETS.etsy;
}

export async function readMerchantPrefs() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.PREFS]);
    const raw = stored[MERCHANT_STORAGE_KEYS.PREFS];
    const merged = {
      ...MERCHANT_DEFAULT_PREFS,
      ...(raw && typeof raw === 'object' ? raw : {}),
    };
    const presetOk = MERCHANT_TAG_LIMIT_PRESET_IDS.includes(merged.platformPreset)
      || MERCHANT_PLATFORM_PRESETS[merged.platformPreset];
    if (!presetOk) {
      merged.platformPreset = MERCHANT_DEFAULT_PREFS.platformPreset;
    }
    if (merged.platformPreset === 'generic') {
      merged.platformPreset = 'custom';
      merged.customMaxTags = MERCHANT_PLATFORM_PRESETS.generic.maxTags;
    }
    merged.customMaxTags = clampCustomMaxTags(merged.customMaxTags);
    delete merged.tagDelimiter;
    _prefs = merged;
    return merged;
  } catch (err) {
    console.error('[merchant.tag-queue:readMerchantPrefs]', err);
    return { ...MERCHANT_DEFAULT_PREFS };
  }
}

export async function updateMerchantPrefs(partial) {
  const current = await readMerchantPrefs();
  const next = { ...current, ...partial };
  try {
    await chrome.storage.local.set({ [MERCHANT_STORAGE_KEYS.PREFS]: next });
    _prefs = next;
    return next;
  } catch (err) {
    console.error('[merchant.tag-queue:updateMerchantPrefs]', err);
    return current;
  }
}

export async function copyTextToClipboard(text) {
  if (!text) {
    return { ok: false, error: 'Nothing to copy.' };
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (_) {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok ? { ok: true } : { ok: false, error: 'Copy failed — try clicking the page first.' };
  } catch (err) {
    console.error('[merchant.tag-queue:copyTextToClipboard]', err);
    return { ok: false, error: 'Copy failed.' };
  }
}

async function loadStagedTags() {
  const profile = getPlatformProfile(_prefs.platformPreset, _prefs);
  const payload = await readListingDock();
  const raw = payload?.tags || '';
  const dock = window.__pasteCraftMerchant?.dock;
  const liveRaw = dock?.getFieldValues?.()?.tags;
  const source = (liveRaw || '').trim() ? liveRaw : raw;
  const result = validateTags(source, profile);
  _tags = result.tags;
  if (_index > _tags.length) {
    _index = _tags.length;
  }
  return _tags;
}

export function isTagQueueActive() {
  return _active;
}

export function getTagQueueStatus() {
  const total = _tags.length;
  const at = total === 0 ? 0 : Math.min(_index + 1, total);
  const nextTag = _tags[_index] || null;
  return {
    active: _active,
    index: _index,
    total,
    at,
    nextTag,
    done: total > 0 && _index >= total,
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

export function syncTagQueueStripUi() {
  if (!_stripEl) return;
  const btn = _stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.TAG_QUEUE_TOGGLE}"]`);
  const hint = _stripEl.querySelector('[data-field="pc-merchant-hint"]');
  const status = getTagQueueStatus();

  btn?.setAttribute('aria-pressed', _active ? 'true' : 'false');
  btn?.classList.toggle('is-active', _active);

  if (!_active) return;
  if (status.empty) {
    if (hint) hint.textContent = 'Tag queue — no tags staged';
    return;
  }
  if (status.done) {
    if (hint) hint.textContent = 'Tag queue complete';
    return;
  }
  const label = status.nextTag
    ? `Queue ${status.at}/${status.total}: ${status.nextTag}`
    : `Queue ${status.at}/${status.total}`;
  if (hint) hint.textContent = label;
}

function isLikelyTagInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
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
  if (maxLen != null && maxLen <= 25) return true;

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

async function handleTagFieldFocus(event) {
  if (!_active) return;
  const target = event.target;
  if (!isLikelyTagInput(target) || isInsideMerchantHost(target)) return;

  const result = await pasteNextTag();
  if (result.message) {
    showToast(result.message);
  }
  syncTagQueueStripUi();
}

function bindPageListeners() {
  if (_bound) return;
  _onFocusIn = (event) => {
    handleTagFieldFocus(event).catch(() => {});
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

export async function refreshTagQueueTags() {
  await loadStagedTags();
  syncTagQueueStripUi();
  return getTagQueueStatus();
}

export async function activateTagQueue() {
  await readMerchantPrefs();
  await loadStagedTags();
  if (_tags.length === 0) {
    return { ok: false, message: 'Stage tags in Listing Dock first.' };
  }
  _active = true;
  if (_index >= _tags.length) {
    _index = 0;
  }
  bindPageListeners();
  syncTagQueueStripUi();
  return {
    ok: true,
    message: `Tag queue on — click a tag field (${_index + 1}/${_tags.length} next)`,
  };
}

export function deactivateTagQueue() {
  _active = false;
  unbindPageListeners();
  syncTagQueueStripUi();
  return { ok: true, message: 'Tag queue off.' };
}

export async function toggleTagQueue() {
  if (_active) {
    return deactivateTagQueue();
  }
  return activateTagQueue();
}

export async function pasteNextTag() {
  await readMerchantPrefs();
  if (_tags.length === 0) {
    await loadStagedTags();
  }
  if (_tags.length === 0) {
    return { ok: false, message: 'No tags staged in dock.' };
  }
  if (_index >= _tags.length) {
    return { ok: false, message: 'Tag queue complete — reset or add more tags.' };
  }

  const tag = _tags[_index];
  const copyResult = await copyTextToClipboard(tag);
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Copy failed.' };
  }

  const position = _index + 1;
  if (_prefs.queueAutoAdvance !== false) {
    _index += 1;
  }

  const status = getTagQueueStatus();
  let message = `Copied "${tag}" (${position}/${_tags.length}) — paste with Ctrl+V`;
  if (status.done) {
    message = `Copied "${tag}" — queue complete`;
  }

  syncTagQueueStripUi();
  return { ok: true, tag, message, status };
}

export async function copyAllStagedTags() {
  await readMerchantPrefs();
  await loadStagedTags();
  if (_tags.length === 0) {
    return { ok: false, message: 'No tags to copy.' };
  }
  const text = tagsToStorageString(_tags);
  const copyResult = await copyTextToClipboard(text);
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Copy failed.' };
  }
  return {
    ok: true,
    message: `Copied ${_tags.length} tag(s)`,
    text,
  };
}

export function resetTagQueueIndex() {
  _index = 0;
  syncTagQueueStripUi();
}

export function deactivateTagQueueOnUnmount() {
  _active = false;
  _index = 0;
  _tags = [];
  unbindPageListeners();
}

export async function initMerchantTagQueue({ stripEl, getToastRoot } = {}) {
  _stripEl = stripEl || null;
  _getToastRoot = getToastRoot || null;
  await readMerchantPrefs();
  await loadStagedTags();
  syncTagQueueStripUi();
  return {
    isActive: isTagQueueActive,
    getStatus: getTagQueueStatus,
    toggle: toggleTagQueue,
    pasteNext: pasteNextTag,
    copyAll: copyAllStagedTags,
    refresh: refreshTagQueueTags,
    resetIndex: resetTagQueueIndex,
    readPrefs: readMerchantPrefs,
    updatePrefs: updateMerchantPrefs,
    getPlatformProfile,
  };
}
