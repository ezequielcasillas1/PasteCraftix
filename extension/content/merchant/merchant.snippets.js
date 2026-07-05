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

export async function insertSnippet(snippetId) {
  const library = await readSnippetLibrary();
  const snippet = library.find((s) => s.id === snippetId);
  if (!snippet?.text) {
    return { ok: false, message: 'Snippet not found.' };
  }

  const copyResult = await copyTextToClipboard(snippet.text);
  closeSnippetsMenu();
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Copy failed.' };
  }
  return {
    ok: true,
    message: `Copied "${snippet.label}" — paste with Ctrl+V`,
  };
}

function deriveSnippetLabel(text) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 36) return oneLine;
  return `${oneLine.slice(0, 33)}…`;
}

export async function addSnippetFromInput(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter snippet text first.' };
  }
  await readSnippetLibrary();
  const entry = {
    id: `snippet-${Date.now()}`,
    label: deriveSnippetLabel(trimmed),
    text: trimmed,
  };
  await saveSnippetLibrary([..._snippets, entry]);
  renderMenuItems();
  if (_menuOpen) positionSnippetMenu();
  return { ok: true, message: `Saved "${entry.label}"` };
}

export async function deleteSnippet(snippetId) {
  const id = (snippetId || '').trim();
  if (!id) {
    return { ok: false, message: 'Snippet not found.' };
  }
  await readSnippetLibrary();
  const next = _snippets.filter((s) => s.id !== id);
  if (next.length === _snippets.length) {
    return { ok: false, message: 'Snippet not found.' };
  }
  await saveSnippetLibrary(next);
  renderMenuItems();
  if (_menuOpen) positionSnippetMenu();
  return { ok: true, message: 'Snippet removed.' };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isEventInsideSnippetsWrap(event, wrap) {
  if (!wrap) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.includes(wrap)) return true;
  return wrap.contains(event.target);
}

function positionSnippetMenu() {
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  const btn = _stripEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
  if (!menu || !btn) return;
  const rect = btn.getBoundingClientRect();
  menu.style.top = `${Math.round(rect.bottom + 4)}px`;
  menu.style.left = `${Math.round(rect.left)}px`;
}

function renderMenuItems() {
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  if (!menu) return;

  const listHtml = _snippets.length === 0
    ? '<p class="pc-merchant-snippet-empty">No snippets yet — add one below</p>'
    : _snippets.map((snippet) => `
    <div class="pc-merchant-snippet-row">
      <button
        type="button"
        class="pc-merchant-snippet-item"
        data-action="${MERCHANT_ACTIONS.SNIPPET_INSERT}"
        data-snippet-id="${escapeHtml(snippet.id)}"
        title="${escapeHtml(snippet.text.slice(0, 120))}"
      >
        <span class="pc-merchant-snippet-item-label">${escapeHtml(snippet.label)}</span>
      </button>
      <button
        type="button"
        class="pc-merchant-snippet-delete"
        data-action="${MERCHANT_ACTIONS.SNIPPET_DELETE}"
        data-snippet-id="${escapeHtml(snippet.id)}"
        aria-label="Delete ${escapeHtml(snippet.label)}"
      >×</button>
    </div>
  `).join('');

  menu.innerHTML = `
    <div class="pc-merchant-snippet-header">
      <span class="pc-merchant-snippet-label">Choose a snippet</span>
    </div>
    <div class="pc-merchant-snippet-list">${listHtml}</div>
    <div class="pc-merchant-snippet-add">
      <textarea
        data-field="pc-merchant-snippet-new-text"
        class="pc-merchant-snippet-input"
        rows="2"
        maxlength="2000"
        placeholder="New snippet text…"
      ></textarea>
      <button
        type="button"
        class="pc-merchant-snippet-save"
        data-action="${MERCHANT_ACTIONS.SNIPPET_SAVE}"
      >Save</button>
    </div>
  `;
}

export function isSnippetsMenuOpen() {
  return _menuOpen;
}

export function closeSnippetsMenu() {
  _menuOpen = false;
  const menu = _stripEl?.querySelector('[data-field="pc-merchant-snippet-menu"]');
  const btn = _stripEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
  const wrap = _stripEl?.querySelector('[data-field="pc-merchant-snippet-wrap"]');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
  wrap?.classList.remove('is-open');
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
  const wrap = _stripEl?.querySelector('[data-field="pc-merchant-snippet-wrap"]');
  if (menu) {
    menu.hidden = false;
    positionSnippetMenu();
  }
  if (btn) btn.setAttribute('aria-expanded', 'true');
  wrap?.classList.add('is-open');
  return { ok: true };
}

export function bindSnippetsOutsideClick(stripEl) {
  if (!stripEl || stripEl.dataset.pcMerchantSnippetsBound === '1') return;
  stripEl.dataset.pcMerchantSnippetsBound = '1';

  document.addEventListener('click', (event) => {
    if (!_menuOpen) return;
    const wrap = stripEl.querySelector('[data-field="pc-merchant-snippet-wrap"]');
    if (isEventInsideSnippetsWrap(event, wrap)) return;
    closeSnippetsMenu();
  }, true);

  window.addEventListener('resize', () => {
    if (_menuOpen) positionSnippetMenu();
  });

  const actions = stripEl.querySelector('.pc-merchant-actions');
  actions?.addEventListener('scroll', () => {
    if (_menuOpen) positionSnippetMenu();
  });
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
    addFromInput: addSnippetFromInput,
    delete: deleteSnippet,
    toggleMenu: toggleSnippetsMenu,
    closeMenu: closeSnippetsMenu,
    isMenuOpen: isSnippetsMenuOpen,
  };
}
