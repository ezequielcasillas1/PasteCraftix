/** Keywords page actions: pick a file, open folders, name things inline, move or delete words. */

import { DEFAULT_KEYWORD_FILE_ID, KEYWORD_PAGINATION, PHRASE_LOOKUP_DELAY_MS } from './keywords.constants.js';
import { askKeywordDestination } from './keywords.destination.js';
import { lookupStudyTitle, lookupWord } from './keywords.dictionary.js';
import { learnBankDraft, pickBestLearnKeyword } from './keywords.learn.js';
import {
  addKeywordFile,
  addKeywordFolder,
  chooseKeywordFolder,
  describeKeywordPlace,
  placeKeyword,
  removeKeywordFile,
  removeKeywordFolder,
  renameKeywordFile,
  renameKeywordFolder,
} from './keywords.library.js';
import { renderKeywordLibrary } from './keywords.library.render.js';
import { createKeywordsPageState } from './keywords.state.js';

const FORM_BUILDERS = Object.freeze({
  'new-file': (form, name) => (library) => addKeywordFile(library, name),
  'new-folder': (form, name) => (library) => addKeywordFolder(library, form.id, name),
  'rename-file': (form, name) => (library) => renameKeywordFile(library, form.id, name),
  'rename-folder': (form, name) => (library) => renameKeywordFolder(library, form.id, name),
});

const FORM_TOASTS = Object.freeze({
  'new-file': 'File created',
  'new-folder': 'Folder created',
  'rename-file': 'File renamed',
  'rename-folder': 'Folder renamed',
});

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createKeywordsPage({ app, store }) {
  const page = createKeywordsPageState();

  function syncView() {
    const library = store.getLibrary();
    if (!library.files.some((file) => file.id === page.viewFileId)) {
      page.viewFileId = library.selection?.fileId || DEFAULT_KEYWORD_FILE_ID;
    }
    if (!page.expandedSeeded) {
      page.expanded.add(library.selection?.folderId);
      page.expandedSeeded = true;
    }
    if (!store.getBank().some((item) => item.key === page.openKey)) page.openKey = '';
  }

  function resetMovePicker() {
    page.movePicker = { open: false, search: '', page: 0 };
  }

  function closeLearnCard() {
    page.learnOpenTitle = '';
    page.learnEntry = null;
    page.learnSeq += 1;
  }

  function clearLearnTimer() {
    clearTimeout(page.learnSearchTimer);
    page.learnSearchTimer = 0;
  }

  function render() {
    syncView();
    renderKeywordLibrary(app, { library: store.getLibrary(), bank: store.getBank(), page });
  }

  async function run(build, toast) {
    const result = await store.apply(build);
    if (!result?.ok) {
      if (result?.error) app.showToast?.(result.error);
      return result || { ok: false };
    }
    const message = typeof toast === 'function' ? toast(result) : toast;
    if (message) app.showToast?.(message);
    return result;
  }

  return {
    state: page,
    render,
    viewFile(fileId) {
      page.viewFileId = String(fileId || '');
      page.form = null;
      page.folderPage = 0;
      render();
    },
    toggleFolder(folderId) {
      if (page.expanded.has(folderId)) page.expanded.delete(folderId);
      else page.expanded.add(folderId);
      render();
    },
    openWord(key) {
      resetMovePicker();
      const next = normalizeKey(key);
      page.openKey = page.openKey === next ? '' : next;
      const item = store.getBank().find((word) => word.key === page.openKey);
      if (item) page.expanded.add(item.folderId);
      render();
    },
    startForm(kind, id = '', value = '') {
      if (!FORM_BUILDERS[kind]) return;
      page.form = { kind, id: String(id || ''), value: String(value || ''), error: '' };
      render();
    },
    updateForm(value) {
      if (page.form) page.form.value = String(value ?? '');
    },
    cancelForm() {
      page.form = null;
      render();
    },
    async submitForm(value) {
      const form = page.form;
      if (!form) return { ok: false };
      const name = String(value ?? form.value);
      const result = await store.apply(FORM_BUILDERS[form.kind](form, name));
      if (!result?.ok) {
        page.form = { ...form, value: name, error: result?.error || 'Could not save.' };
        render();
        return result || { ok: false };
      }
      page.form = null;
      if (result.fileId) {
        page.viewFileId = result.fileId;
        page.folderPage = 0;
        const fileIndex = store.getLibrary().files.findIndex((file) => file.id === result.fileId);
        if (fileIndex >= 0) page.filePage = Math.floor(fileIndex / KEYWORD_PAGINATION.FILES_PER_PAGE);
      }
      if (result.folderId) {
        page.expanded.add(result.folderId);
        const folder = store.getLibrary().folders.find((item) => item.id === result.folderId);
        const siblings = store.getLibrary().folders.filter((item) => item.fileId === folder?.fileId);
        const folderIndex = siblings.findIndex((item) => item.id === result.folderId);
        if (folderIndex >= 0) page.folderPage = Math.floor(folderIndex / KEYWORD_PAGINATION.FOLDERS_PER_PAGE);
      }
      render();
      app.showToast?.(FORM_TOASTS[form.kind]);
      return result;
    },
    setTarget(folderId) {
      return run(
        (library) => chooseKeywordFolder(library, folderId),
        () => `New words save to ${describeKeywordPlace(store.getLibrary(), folderId)}`,
      );
    },
    deleteFile(fileId) {
      return run((library, bank) => removeKeywordFile(library, bank, fileId), 'File deleted');
    },
    deleteFolder(folderId) {
      page.expanded.delete(folderId);
      return run((library, bank) => removeKeywordFolder(library, bank, folderId), 'Folder deleted');
    },
    moveWord(key, folderId) {
      resetMovePicker();
      page.expanded.add(folderId);
      return run(
        (library, bank) => placeKeyword(bank, library, key, folderId),
        () => `Moved to ${describeKeywordPlace(store.getLibrary(), folderId)}`,
      );
    },
    async removeWord(key) {
      const target = normalizeKey(key);
      if (page.openKey === target) page.openKey = '';
      const ok = await store.removeWord(target);
      app.showToast?.(ok ? 'Keyword deleted' : 'Could not delete this keyword.');
      return { ok };
    },
    setFileSearch(query) {
      page.fileSearch = String(query ?? '');
      page.filePage = 0;
      render();
    },
    setFilePage(pageNum) {
      page.filePage = Math.max(0, Number(pageNum) || 0);
      render();
    },
    clearFileSearch() {
      page.fileSearch = '';
      page.filePage = 0;
      render();
    },
    setFolderSearch(query) {
      page.folderSearch = String(query ?? '');
      page.folderPage = 0;
      render();
    },
    setFolderPage(pageNum) {
      page.folderPage = Math.max(0, Number(pageNum) || 0);
      render();
    },
    clearFolderSearch() {
      page.folderSearch = '';
      page.folderPage = 0;
      render();
    },
    setWordSearch(query) {
      page.wordSearch = String(query ?? '');
      page.wordPages.clear();
      if (page.wordSearch) {
        const q = page.wordSearch.toLowerCase();
        const bank = store.getBank();
        bank.forEach((item) => {
          if (item.text.toLowerCase().includes(q) || item.key.toLowerCase().includes(q)) {
            if (item.folderId) page.expanded.add(item.folderId);
          }
        });
      }
      render();
    },
    setWordPage(folderId, pageNum) {
      const fid = String(folderId || '');
      page.wordPages.set(fid, Math.max(0, Number(pageNum) || 0));
      render();
    },
    clearWordSearch() {
      page.wordSearch = '';
      page.wordPages.clear();
      render();
    },
    toggleNerdStats() {
      page.nerdStatsOpen = !page.nerdStatsOpen;
      render();
    },
    toggleGuide() {
      page.guideOpen = !page.guideOpen;
      render();
    },
    closeGuide() {
      if (!page.guideOpen) return;
      page.guideOpen = false;
      render();
    },
    toggleMovePicker() {
      const open = !page.movePicker.open;
      resetMovePicker();
      page.movePicker.open = open;
      render();
    },
    closeMovePicker() {
      if (!page.movePicker.open) return;
      resetMovePicker();
      render();
    },
    setMovePickerSearch(query) {
      page.movePicker.search = String(query ?? '');
      page.movePicker.page = 0;
      render();
    },
    setMovePickerPage(pageNum) {
      page.movePicker.page = Math.max(0, Number(pageNum) || 0);
      render();
    },
    clearMovePickerSearch() {
      page.movePicker.search = '';
      page.movePicker.page = 0;
      render();
    },
    toggleLearn() {
      page.learnOpen = !page.learnOpen;
      render();
    },
    setLearnGroup(groupId) {
      const next = String(groupId || '');
      if (!next || next === page.learnGroup) return;
      page.learnGroup = next;
      page.learnSubject = '';
      page.learnQuery = '';
      page.learnPage = 0;
      clearLearnTimer();
      closeLearnCard();
      render();
    },
    setLearnSubject(title) {
      const next = String(title || '').trim();
      if (!next) return;
      page.learnSubject = next;
      page.learnQuery = '';
      page.learnPage = 0;
      clearLearnTimer();
      closeLearnCard();
      render();
    },
    clearLearnSubject() {
      page.learnSubject = '';
      page.learnQuery = '';
      page.learnPage = 0;
      clearLearnTimer();
      closeLearnCard();
      render();
    },
    setLearnSearch(query) {
      const next = String(query ?? '');
      page.learnQuery = next;
      page.learnPage = 0;
      clearLearnTimer();
      closeLearnCard();
      const seq = page.learnSeq;
      render();
      page.learnSearchTimer = setTimeout(() => {
        if (page.learnQuery !== next || page.learnSeq !== seq) return;
        const best = pickBestLearnKeyword(next, page.learnGroup, page.learnSubject);
        if (best) this.openLearnTitle(best.title, { keepOpen: true });
      }, PHRASE_LOOKUP_DELAY_MS);
    },
    setLearnPage(pageNum) {
      page.learnPage = Math.max(0, Number(pageNum) || 0);
      render();
    },
    clearLearnSearch() {
      page.learnQuery = '';
      page.learnPage = 0;
      clearLearnTimer();
      closeLearnCard();
      render();
    },
    async openLearnTitle(title, options = {}) {
      const next = String(title || '').trim();
      if (!next) return;
      if (page.learnOpenTitle === next) {
        if (options.keepOpen) return;
        closeLearnCard();
        render();
        return;
      }
      page.learnOpenTitle = next;
      page.learnEntry = { status: 'loading' };
      page.learnSeq += 1;
      const seq = page.learnSeq;
      render();
      let entry;
      try {
        entry = await lookupStudyTitle(next);
        if (!entry?.found && !entry?.error) entry = await lookupWord(next);
      } catch {
        entry = { found: false, error: true };
      }
      if (seq !== page.learnSeq || page.learnOpenTitle !== next) return;
      page.learnEntry = entry?.found
        ? { status: 'ready', entry }
        : { status: entry?.error ? 'error' : 'missing', entry };
      render();
    },
    async saveLearn() {
      const entry = page.learnEntry?.status === 'ready' ? page.learnEntry.entry : null;
      const draft = learnBankDraft(entry);
      if (!draft) {
        app.showToast?.('Wait for the summary, then save.');
        return { ok: false };
      }
      const folderId = await askKeywordDestination({
        library: store.getLibrary(),
        bank: store.getBank(),
        app,
        label: draft.text || draft.key,
        savedFolderId: store.getBank().find((item) => item.key === draft.key)?.folderId,
        currentFolderId: store.getLibrary().selection?.folderId,
        createFolder: async (fileId, name) => {
          const result = await store.apply((library) => addKeywordFolder(library, fileId, name));
          if (!result?.ok) return result;
          return { ok: true, folderId: result.folderId, library: store.getLibrary(), bank: store.getBank() };
        },
        returnFocusTo: globalThis.document?.activeElement,
      });
      if (!folderId) return { ok: false };
      const ok = await store.saveWord({ ...draft, folderId });
      const place = describeKeywordPlace(store.getLibrary(), folderId);
      app.showToast?.(ok ? `Keyword saved to ${place}` : 'Could not save this keyword.');
      return { ok };
    },
  };
}
