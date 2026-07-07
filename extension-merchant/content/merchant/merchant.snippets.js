import {
  MERCHANT_ACTIONS,
  MERCHANT_DEFAULT_PREFS,
  MERCHANT_DEFAULT_SNIPPETS,
  MERCHANT_STORAGE_KEYS,
} from './merchant.constants.js';
import { copyTextToClipboard } from './merchant.tag-queue.js';

let _stripEl = null;
let _root = null;
let _menuOpen = false;
let _snippets = [...MERCHANT_DEFAULT_SNIPPETS];

function normalizeSnippet(entry, index) {
  const id = entry?.id || `snippet-${index}`;
  const label = (entry?.label || `Snippet ${index + 1}`).trim();
  const text = (entry?.text || '').trim();
  return { id, label, text };
}

export async function readSnippetLibrary() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.PREFS]);
    const raw = stored[MERCHANT_STORAGE_KEYS.PREFS];
    const fromPrefs = raw?.snippetLibrary;
    if (Array.isArray(fromPrefs) && fromPrefs.length > 0) {
      _snippets = fromPrefs.map(normalizeSnippet).filter((s) => s.text);
      return _snippets;
    }
  } catch (err) {
    console.error('[merchant.snippets:readSnippetLibrary]', err);
  }
  _snippets = MERCHANT_DEFAULT_SNIPPETS.map(normalizeSnippet);
  return _snippets;
}

export async function saveSnippetLibrary(snippets) {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.PREFS]);
    const current = {
      ...MERCHANT_DEFAULT_PREFS,
      ...(stored[MERCHANT_STORAGE_KEYS.PREFS] || {}),
    };
    const next = snippets.map(normalizeSnippet).filter((s) => s.text);
    const merged = { ...current, snippetLibrary: next };
    await chrome.storage.local.set({ [MERCHANT_STORAGE_KEYS.PREFS]: merged });
    _snippets = next.length > 0 ? next : MERCHANT_DEFAULT_SNIPPETS.map(normalizeSnippet);
    return _snippets;
  } catch (err) {
    console.error('[merchant.snippets:saveSnippetLibrary]', err);
    return _snippets;
  }
}

function getFocusedField() {
  const active = document.activeElement;
  if (!active) return null;
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
    return active;
  }
  if (active.isContentEditable) {
    return active;
  }
  return null;
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

function insertIntoField(field, text) {
  if (!field || !text) return false;

  if (field.isContentEditable) {
    field.focus();
    document.execCommand('insertText', false, text);
    return true;
  }

  if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const before = field.value.slice(0, start);
    const after = field.value.slice(end);
    field.value = `${before}${text}${after}`;
    const caret = start + text.length;
    field.setSelectionRange?.(caret, caret);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

export async function insertSnippet(snippetId) {
  const library = await readSnippetLibrary();
  const snippet = library.find((s) => s.id === snippetId);
  if (!snippet?.text) {
    return { ok: false, message: 'Snippet not found.' };
  }

  const field = getFocusedField();
  if (field && !isInsideMerchantHost(field)) {
    const inserted = insertIntoField(field, snippet.text);
    if (inserted) {
      closeSnippetsMenu();
      return { ok: true, message: `Inserted "${snippet.label}"` };
    }
  }

  const copyResult = await copyTextToClipboard(snippet.text);
  closeSnippetsMenu();
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Insert failed.' };
  }
  return {
    ok: true,
    message: field
      ? `Copied "${snippet.label}" — paste with Ctrl+V`
      : `Copied "${snippet.label}" — focus a field or paste`,
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMenuItems() {
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  if (!menu) return;

  if (_snippets.length === 0) {
    menu.innerHTML = '<p class="pc-merchant-snippet-empty">No snippets saved</p>';
    return;
  }

  menu.innerHTML = _snippets.map((snippet) => `
    <button
      type="button"
      class="pc-merchant-snippet-item"
      data-action="${MERCHANT_ACTIONS.SNIPPET_INSERT}"
      data-snippet-id="${escapeHtml(snippet.id)}"
      title="${escapeHtml(snippet.text.slice(0, 120))}"
    >
      <span class="pc-merchant-snippet-item-label">${escapeHtml(snippet.label)}</span>
    </button>
  `).join('');
}

export function isSnippetsMenuOpen() {
  return _menuOpen;
}

export function closeSnippetsMenu() {
  _menuOpen = false;
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  const btn = _stripEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export async function toggleSnippetsMenu() {
  if (_menuOpen) {
    closeSnippetsMenu();
    return { ok: true, message: 'Snippets closed.' };
  }
  await readSnippetLibrary();
  renderMenuItems();
  _menuOpen = true;
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  const btn = _stripEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
  if (menu) menu.hidden = false;
  if (btn) btn.setAttribute('aria-expanded', 'true');
  return { ok: true, message: 'Choose a snippet' };
}

export function bindSnippetsOutsideClick(stripEl) {
  if (!stripEl || stripEl.dataset.pcMerchantSnippetsBound === '1') return;
  stripEl.dataset.pcMerchantSnippetsBound = '1';

  document.addEventListener('click', (event) => {
    if (!_menuOpen) return;
    const wrap = stripEl.querySelector('[data-field="pc-merchant-snippet-wrap"]');
    if (wrap?.contains(event.target)) return;
    closeSnippetsMenu();
  }, true);
}

export async function initMerchantSnippets({ stripEl, root } = {}) {
  _stripEl = stripEl || null;
  _root = root || null;
  await readSnippetLibrary();
  renderMenuItems();
  if (_stripEl) {
    bindSnippetsOutsideClick(_stripEl);
  }
  return {
    readLibrary: readSnippetLibrary,
    saveLibrary: saveSnippetLibrary,
    insert: insertSnippet,
    toggleMenu: toggleSnippetsMenu,
    closeMenu: closeSnippetsMenu,
    isMenuOpen: isSnippetsMenuOpen,
  };
}
