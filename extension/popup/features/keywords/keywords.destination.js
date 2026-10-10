/** Save keyword picker. Opens on top of the clip viewer and works like Choose Category. */

import {
  DESTINATION_FILTER_MIN,
  countWordsByFolder,
  destinationTree,
  folderCount,
  pickStartFolder,
} from './keywords.destination.model.js';
import { escapeHtml } from './keywords.render.js';

const FOCUSABLE = 'button:not([disabled]), input:not([hidden]), select, [tabindex="0"]';
let active = null;

function wordCount(count) {
  return `${count} ${count === 1 ? 'word' : 'words'}`;
}

function folderRow(folder, state, esc) {
  const picked = folder.id === state.picked;
  const badge = folder.id === state.savedFolderId ? '<span class="keyword-destination-badge">Saved here</span>' : '';
  return `<button type="button" role="option" class="category-option keyword-destination-folder${picked ? ' selected' : ''}"
    data-folder="${esc(folder.id)}" aria-selected="${picked}" tabindex="${picked ? 0 : -1}">
    <span class="category-option-icon"><i data-lucide="folder"></i></span>
    <span class="keyword-destination-name">${esc(folder.name)}</span>
    ${badge}
    <span class="keyword-destination-count">${wordCount(state.counts.get(folder.id) || 0)}</span>
  </button>`;
}

function treeHtml(state, esc) {
  const groups = destinationTree(state.library, state.query);
  if (!groups.length) {
    const empty = state.query ? 'No folders match your search.' : 'No files yet.';
    return `<p class="keyword-destination-empty">${empty}</p>`;
  }
  return groups.map(({ file, folders }) => {
    const rows = folders.map((folder) => folderRow(folder, state, esc)).join('');
    return `<section class="keyword-destination-file">
      <h4><i data-lucide="file-text"></i> ${esc(file.name)}</h4>
      ${rows || '<p class="keyword-destination-empty">No folders</p>'}
    </section>`;
  }).join('');
}

function createHtml(state, esc) {
  if (!state.creating) return '';
  const current = state.library.folders.find((folder) => folder.id === state.picked)?.fileId;
  const options = state.library.files.map((file) => {
    const on = file.id === current ? ' selected' : '';
    return `<option value="${esc(file.id)}"${on}>${esc(file.name)}</option>`;
  }).join('');
  return `<div class="keyword-destination-create">
    <select data-field="dest-file" aria-label="File for the new folder">${options}</select>
    <input type="text" data-field="dest-folder-name" maxlength="40" placeholder="Folder name" aria-label="New folder name">
    <div class="keyword-destination-create-actions">
      <button type="button" class="btn-secondary" data-dest="create-cancel">Cancel</button>
      <button type="button" class="btn-primary" data-dest="create-confirm">Create</button>
    </div>
    <p class="keyword-destination-error" role="alert">${esc(state.error)}</p>
  </div>`;
}

function shellHtml(label, esc, showFilter) {
  return `<div class="modal-content keyword-destination-card">
    <div class="modal-header">
      <h3><i data-lucide="folder"></i> Save keyword</h3>
      <button type="button" class="modal-close" data-dest="cancel" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <p class="modal-text">Where would you like to save “${esc(label || 'word')}”?</p>
      <input type="search" class="keyword-destination-filter" data-field="dest-filter"
        placeholder="Search folders..." aria-label="Search folders"${showFilter ? '' : ' hidden'}>
      <div class="keyword-destination-tree" data-slot="tree" role="listbox" aria-label="Folders"></div>
      <div data-slot="create"></div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-dest="cancel">Cancel</button>
        <button type="button" class="btn-primary" data-dest="save">Add</button>
        <button type="button" class="btn-primary" data-dest="new-folder">+ New folder</button>
      </div>
    </div>
  </div>`;
}

function createPicker(dialog, state, esc) {
  const slot = (name) => dialog.querySelector(`[data-slot="${name}"]`);
  const rows = () => [...dialog.querySelectorAll('[data-folder]')];

  function paintTree() {
    slot('tree').innerHTML = treeHtml(state, esc);
    dialog.querySelector('[data-dest="save"]').disabled = !state.picked;
    dialog.querySelector('[data-dest="new-folder"]').hidden = state.creating || !state.createFolder;
    globalThis.window?.renderLucideIcons?.(dialog);
  }

  function paintCreate() {
    slot('create').innerHTML = createHtml(state, esc);
    paintTree();
    if (state.creating) dialog.querySelector('[data-field="dest-folder-name"]')?.focus();
  }

  function pick(folderId, { focus = false } = {}) {
    state.picked = folderId;
    rows().forEach((node) => {
      const on = node.dataset.folder === folderId;
      node.classList.toggle('selected', on);
      node.setAttribute('aria-selected', String(on));
      node.tabIndex = on ? 0 : -1;
      if (on && focus) node.focus();
    });
    dialog.querySelector('[data-dest="save"]').disabled = !state.picked;
  }

  function step(delta) {
    const list = rows();
    if (!list.length) return;
    const at = list.findIndex((node) => node.dataset.folder === state.picked);
    const next = list[(at + delta + list.length) % list.length];
    pick(next.dataset.folder, { focus: true });
  }

  function focusStart() {
    const target = rows().find((node) => node.dataset.folder === state.picked)
      || dialog.querySelector('[data-dest="save"]');
    target?.focus();
  }

  return { paintTree, paintCreate, pick, step, focusStart, rows };
}

async function confirmCreate(dialog, state, picker) {
  const fileId = dialog.querySelector('[data-field="dest-file"]')?.value;
  const name = dialog.querySelector('[data-field="dest-folder-name"]')?.value;
  const result = await state.createFolder(fileId, name);
  if (!result?.ok) {
    state.error = result?.error || 'Could not create this folder.';
    const error = dialog.querySelector('.keyword-destination-error');
    if (error) error.textContent = state.error;
    return;
  }
  state.library = result.library || state.library;
  state.counts = countWordsByFolder(result.bank || []);
  state.creating = false;
  state.error = '';
  state.query = '';
  const filter = dialog.querySelector('[data-field="dest-filter"]');
  if (filter) filter.value = '';
  picker.paintCreate();
  picker.pick(result.folderId, { focus: true });
}

function trapTab(event, dialog) {
  const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => !node.hidden && node.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const inside = dialog.contains(document.activeElement);
  if (event.shiftKey && (document.activeElement === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

function keyHandler(dialog, state, picker, actions) {
  return (event) => {
    const field = event.target?.dataset?.field;
    const onRow = !!event.target?.closest?.('[data-folder]');
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.creating) actions.cancelCreate();
      else actions.close(null);
    } else if (event.key === 'Tab') {
      trapTab(event, dialog);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (onRow || field === 'dest-filter')) {
      event.preventDefault();
      picker.step(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && field === 'dest-folder-name') {
      event.preventDefault();
      actions.create();
    } else if (event.key === 'Enter' && (onRow || field === 'dest-filter') && state.picked) {
      event.preventDefault();
      actions.close(state.picked);
    }
  };
}

function clickHandler(dialog, state, picker, actions) {
  return (event) => {
    if (event.target === dialog) {
      actions.close(null);
      return;
    }
    const row = event.target.closest?.('[data-folder]');
    if (row) {
      picker.pick(row.dataset.folder, { focus: true });
      return;
    }
    const dest = event.target.closest?.('[data-dest]')?.dataset.dest;
    if (dest === 'cancel') actions.close(null);
    else if (dest === 'save' && state.picked) actions.close(state.picked);
    else if (dest === 'new-folder') actions.startCreate();
    else if (dest === 'create-cancel') actions.cancelCreate();
    else if (dest === 'create-confirm') actions.create();
  };
}

function initialState(options) {
  const library = options.library || { files: [], folders: [] };
  const folders = Array.isArray(library.folders) ? library.folders : [];
  return {
    library: { ...library, files: library.files || [], folders },
    counts: countWordsByFolder(options.bank),
    savedFolderId: options.savedFolderId || '',
    picked: pickStartFolder(folders, options.savedFolderId, options.currentFolderId, library.selection?.folderId),
    query: '',
    creating: false,
    error: '',
    createFolder: typeof options.createFolder === 'function' ? options.createFolder : null,
  };
}

export function askKeywordDestination(options = {}) {
  const host = document.body;
  if (!host) return Promise.resolve(null);
  if (active) {
    active.focus();
    return active.promise;
  }

  const esc = (value) => escapeHtml(options.app, value);
  const state = initialState(options);
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay keyword-destination';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Save keyword');
  dialog.innerHTML = shellHtml(options.label, esc, folderCount(state.library) > DESTINATION_FILTER_MIN);
  const picker = createPicker(dialog, state, esc);

  let resolveChoice;
  const promise = new Promise((resolve) => { resolveChoice = resolve; });

  const actions = {
    close(folderId) {
      document.removeEventListener('keydown', onKey, true);
      dialog.remove();
      active = null;
      const back = options.returnFocusTo;
      if (back?.isConnected) back.focus?.();
      resolveChoice(folderId || null);
    },
    startCreate() {
      state.creating = true;
      state.error = '';
      picker.paintCreate();
    },
    cancelCreate() {
      state.creating = false;
      state.error = '';
      picker.paintCreate();
      picker.focusStart();
    },
    create: () => confirmCreate(dialog, state, picker),
  };

  const onKey = keyHandler(dialog, state, picker, actions);
  dialog.addEventListener('click', clickHandler(dialog, state, picker, actions));
  dialog.addEventListener('dblclick', (event) => {
    const row = event.target.closest?.('[data-folder]');
    if (row) actions.close(row.dataset.folder);
  });
  dialog.addEventListener('input', (event) => {
    if (event.target?.dataset?.field !== 'dest-filter') return;
    state.query = event.target.value;
    picker.paintTree();
  });
  document.addEventListener('keydown', onKey, true);

  host.appendChild(dialog);
  picker.paintTree();
  picker.focusStart();
  active = { promise, focus: () => picker.focusStart() };
  return promise;
}
