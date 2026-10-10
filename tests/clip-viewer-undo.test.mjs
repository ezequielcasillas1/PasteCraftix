import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudyUndo, STUDY_UNDO_LIMIT } from '../extension/popup/features/clips/clips.viewer-undo.js';

test('undo restores the previous study snapshot', () => {
  const undo = createStudyUndo();
  assert.equal(undo.canUndo(), false);
  assert.equal(undo.push({ text: 'alpha', selectionStart: 0, selectionEnd: 5 }), true);
  assert.equal(undo.canUndo(), true);
  assert.deepEqual(undo.pop(), { text: 'alpha', selectionStart: 0, selectionEnd: 5 });
  assert.equal(undo.pop(), null);
});

test('identical snapshots are not stacked twice', () => {
  const undo = createStudyUndo();
  undo.push({ text: 'same', selectionStart: 1, selectionEnd: 2 });
  assert.equal(undo.push({ text: 'same', selectionStart: 1, selectionEnd: 2 }), false);
  assert.equal(undo.pop().text, 'same');
  assert.equal(undo.canUndo(), false);
});

test('stack keeps only the newest limit', () => {
  const undo = createStudyUndo();
  for (let i = 0; i < STUDY_UNDO_LIMIT + 3; i += 1) {
    undo.push({ text: `v${i}`, selectionStart: 0, selectionEnd: 0 });
  }
  let oldest = null;
  while (undo.canUndo()) oldest = undo.pop();
  assert.equal(oldest.text, 'v3');
});
