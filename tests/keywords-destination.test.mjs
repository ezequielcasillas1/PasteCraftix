import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countWordsByFolder,
  destinationTree,
  pickStartFolder,
} from '../extension/popup/features/keywords/keywords.destination.model.js';
import { addKeywordFolder, ensureKeywordLibrary } from '../extension/popup/features/keywords/keywords.library.js';

const library = {
  files: [{ id: 'f1', name: 'Course' }, { id: 'f2', name: 'Work' }],
  folders: [
    { id: 'a', fileId: 'f1', name: 'Board' },
    { id: 'b', fileId: 'f1', name: 'Finance' },
    { id: 'c', fileId: 'f2', name: 'Meetings' },
  ],
  selection: { fileId: 'f1', folderId: 'b' },
};

test('counts saved words per folder', () => {
  const counts = countWordsByFolder([{ folderId: 'a' }, { folderId: 'a' }, { folderId: 'c' }, {}, null]);
  assert.equal(counts.get('a'), 2);
  assert.equal(counts.get('c'), 1);
  assert.equal(counts.get('b'), undefined);
  assert.equal(countWordsByFolder(undefined).size, 0);
});

test('starts on the saved folder, then the selected folder, then the first folder', () => {
  assert.equal(pickStartFolder(library.folders, 'c', 'b'), 'c');
  assert.equal(pickStartFolder(library.folders, undefined, 'b'), 'b');
  assert.equal(pickStartFolder(library.folders, 'gone', 'missing'), 'a');
  assert.equal(pickStartFolder([], 'a'), '');
});

test('filters folders by folder name or file name', () => {
  assert.equal(destinationTree(library).length, 2);
  const byFolder = destinationTree(library, 'fin');
  assert.deepEqual(byFolder.map((group) => group.file.id), ['f1']);
  assert.deepEqual(byFolder[0].folders.map((folder) => folder.id), ['b']);
  const byFile = destinationTree(library, 'work');
  assert.deepEqual(byFile[0].folders.map((folder) => folder.id), ['c']);
  assert.equal(destinationTree(library, 'zzz').length, 0);
});

test('a new folder from the picker gets an id and rejects duplicate names', () => {
  const base = ensureKeywordLibrary(library, []).library;
  const created = addKeywordFolder(base, 'f1', 'Governance');
  assert.equal(created.ok, true);
  assert.ok(created.folderId);
  assert.equal(pickStartFolder(created.library.folders, created.folderId), created.folderId);
  const dup = addKeywordFolder(created.library, 'f1', 'governance');
  assert.equal(dup.ok, false);
  assert.match(dup.error, /already has that name/);
});
