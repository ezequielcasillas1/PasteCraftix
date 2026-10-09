import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_KEYWORD_FILE_ID,
  DEFAULT_KEYWORD_FOLDER_ID,
} from '../extension/popup/features/keywords/keywords.constants.js';
import {
  addKeywordFile,
  addKeywordFolder,
  chooseKeywordFolder,
  describeKeywordPlace,
  ensureKeywordLibrary,
  placeKeyword,
  removeKeywordFile,
  removeKeywordFolder,
} from '../extension/popup/features/keywords/keywords.library.js';

test('places saved words that have no folder into Saved / All words', () => {
  const ensured = ensureKeywordLibrary(null, [
    { key: 'idea', text: 'idea', folderId: '' },
  ]);
  assert.equal(ensured.changed, true);
  assert.equal(ensured.library.files[0].name, 'Saved');
  assert.equal(ensured.library.folders[0].name, 'All words');
  assert.equal(ensured.library.selection.fileId, DEFAULT_KEYWORD_FILE_ID);
  assert.equal(ensured.library.selection.folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(ensured.bank[0].folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(describeKeywordPlace(ensured.library, DEFAULT_KEYWORD_FOLDER_ID), 'Saved / All words');

  const again = ensureKeywordLibrary(ensured.library, ensured.bank);
  assert.equal(again.changed, false);
  assert.equal(again.bank[0].key, 'idea');
});

test('creating a file or folder does not change where new words save', () => {
  const home = ensureKeywordLibrary(null, []).library;
  const added = addKeywordFile(home, 'Study');
  assert.equal(added.ok, true);
  assert.equal(added.library.selection.folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(added.library.folders.some((folder) => folder.id === added.folderId && folder.fileId === added.fileId), true);
  assert.equal(addKeywordFile(added.library, ' study ').ok, false);

  const folder = addKeywordFolder(added.library, added.fileId, 'Verbs');
  assert.equal(folder.ok, true);
  assert.equal(folder.library.selection.folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(addKeywordFolder(folder.library, added.fileId, 'verbs').ok, false);
  assert.equal(addKeywordFolder(folder.library, 'missing', 'Nouns').ok, false);

  const target = chooseKeywordFolder(folder.library, folder.folderId);
  assert.equal(describeKeywordPlace(target.library, target.library.selection.folderId), 'Study / Verbs');
});

test('moves a word into another folder', () => {
  const home = ensureKeywordLibrary(null, []).library;
  const added = addKeywordFolder(home, DEFAULT_KEYWORD_FILE_ID, 'Verbs');
  const moved = placeKeyword([{ key: 'run', folderId: DEFAULT_KEYWORD_FOLDER_ID }], added.library, 'Run', added.folderId);
  assert.equal(moved.ok, true);
  assert.equal(moved.bank[0].folderId, added.folderId);
  assert.equal(placeKeyword(moved.bank, added.library, 'walk', added.folderId).ok, false);
});

test('deletes a file by moving its words back to All words', () => {
  const home = ensureKeywordLibrary(null, []).library;
  const added = addKeywordFile(home, 'Study');
  const target = chooseKeywordFolder(added.library, added.folderId).library;
  const removed = removeKeywordFile(target, [{ key: 'idea', folderId: added.folderId }], added.fileId);
  assert.equal(removed.ok, true);
  assert.equal(removed.bank[0].folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(removed.library.selection.folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(removed.library.files.some((file) => file.name === 'Study'), false);
  assert.equal(removeKeywordFile(removed.library, removed.bank, DEFAULT_KEYWORD_FILE_ID).ok, false);
});

test('files and folders keep growing past the old page-one row', () => {
  let library = ensureKeywordLibrary(null, []).library;
  for (let i = 0; i < 13; i += 1) {
    const added = addKeywordFile(library, `File ${i}`);
    assert.equal(added.ok, true);
    library = added.library;
  }
  assert.equal(library.files.length, 14);
  const reloaded = ensureKeywordLibrary(library, []);
  assert.equal(reloaded.library.files.length, 14);

  for (let i = 0; i < 25; i += 1) {
    const added = addKeywordFolder(library, DEFAULT_KEYWORD_FILE_ID, `Folder ${i}`);
    assert.equal(added.ok, true);
    library = added.library;
  }
  const inSaved = library.folders.filter((folder) => folder.fileId === DEFAULT_KEYWORD_FILE_ID);
  assert.equal(inSaved.length, 26);
});

test('deletes a folder by moving its words to a sibling folder', () => {
  const home = ensureKeywordLibrary(null, []).library;
  const withFolder = addKeywordFolder(home, DEFAULT_KEYWORD_FILE_ID, 'Verbs');
  const target = chooseKeywordFolder(withFolder.library, withFolder.folderId).library;
  const removed = removeKeywordFolder(target, [{ key: 'run', folderId: withFolder.folderId }], withFolder.folderId);
  assert.equal(removed.ok, true);
  assert.equal(removed.bank[0].folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(removed.library.selection.folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.equal(removeKeywordFolder(removed.library, removed.bank, DEFAULT_KEYWORD_FOLDER_ID).ok, false);

  const study = addKeywordFile(home, 'Study');
  assert.equal(removeKeywordFolder(study.library, [], study.folderId).ok, false);
});
