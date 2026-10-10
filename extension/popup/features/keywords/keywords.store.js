/** Saved words + their files and folders in chrome.storage.local. Rolls back on a failed write. */

import {
  DEFAULT_KEYWORD_FOLDER_ID,
  KEYWORD_BANK_STORAGE_KEY,
  KEYWORD_LIBRARY_STORAGE_KEY,
} from './keywords.constants.js';
import { readKeywordBank, removeKeywordFromBank, upsertKeyword } from './keywords.bank.js';
import { ensureKeywordLibrary } from './keywords.library.js';

export function createKeywordStore({ storage, onChange }) {
  let bank = [];
  let library = ensureKeywordLibrary(null, []).library;

  async function persist() {
    const ensured = ensureKeywordLibrary(library, bank);
    bank = readKeywordBank({ [KEYWORD_BANK_STORAGE_KEY]: ensured.bank });
    library = ensured.library;
    if (!storage?.set) return;
    await storage.set({
      [KEYWORD_BANK_STORAGE_KEY]: bank,
      [KEYWORD_LIBRARY_STORAGE_KEY]: library,
    });
  }

  async function commit(next) {
    const previous = { bank, library };
    if (next.bank) bank = next.bank;
    if (next.library) library = next.library;
    onChange();
    try {
      await persist();
    } catch {
      bank = previous.bank;
      library = previous.library;
      onChange();
      return false;
    }
    onChange();
    return true;
  }

  async function hydrate() {
    if (!storage?.get) return true;
    try {
      const stored = await storage.get([KEYWORD_BANK_STORAGE_KEY, KEYWORD_LIBRARY_STORAGE_KEY]);
      const ensured = ensureKeywordLibrary(stored?.[KEYWORD_LIBRARY_STORAGE_KEY], readKeywordBank(stored));
      bank = ensured.bank;
      library = ensured.library;
      onChange();
      if (ensured.changed) await persist();
      return true;
    } catch {
      return false;
    }
  }

  const ready = hydrate();

  return {
    ready,
    getBank: () => bank,
    getLibrary: () => library,
    async apply(build) {
      await ready;
      const result = build(library, bank);
      if (!result?.ok) return result || { ok: false };
      const saved = await commit(result);
      return saved ? result : { ok: false, error: 'Could not update keywords.' };
    },
    async saveWord(draft) {
      await ready;
      const existing = bank.find((item) => item.key === draft.key);
      const folderId = draft.folderId || existing?.folderId || library.selection?.folderId || DEFAULT_KEYWORD_FOLDER_ID;
      return commit({ bank: upsertKeyword(bank, { ...draft, folderId }) });
    },
    async removeWord(key) {
      await ready;
      return commit({ bank: removeKeywordFromBank(bank, key) });
    },
  };
}
