import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'extension/popup/features/clips/clips.viewer-marks.js')).href;
const {
  MARK_KINDS,
  applyStudyMark,
  detectStudyMarks,
  hasStudyInlineMarks,
  normalizeStudyColor,
} = await import(url);

test('bold wraps a selection and toggles off', () => {
  const wrapped = applyStudyMark('hello', 0, 5, MARK_KINDS.BOLD);
  assert.equal(wrapped.text, '**hello**');
  assert.equal(wrapped.applied, true);
  assert.equal(wrapped.toggledOff, false);

  const off = applyStudyMark(wrapped.text, wrapped.selectionStart, wrapped.selectionEnd, MARK_KINDS.BOLD);
  assert.equal(off.text, 'hello');
  assert.equal(off.toggledOff, true);
});

test('bold wraps the word at the caret and leaves a gap alone', () => {
  const text = 'say hello there';
  const at = text.indexOf('hello') + 1;
  const wrapped = applyStudyMark(text, at, at, MARK_KINDS.BOLD);
  assert.equal(wrapped.text, 'say **hello** there');

  const gap = applyStudyMark('  hello', 0, 0, MARK_KINDS.BOLD);
  assert.equal(gap.applied, false);
  assert.equal(gap.text, '  hello');
});

test('bold caret inside a mark toggles the whole mark off', () => {
  const text = 'say **hello** there';
  const at = text.indexOf('hello') + 1;
  const off = applyStudyMark(text, at, at, MARK_KINDS.BOLD);
  assert.equal(off.text, 'say hello there');
  assert.equal(detectStudyMarks(text, at, at).bold, true);
});

test('underline wraps and toggles', () => {
  const wrapped = applyStudyMark('term', 0, 4, MARK_KINDS.UNDERLINE);
  assert.equal(wrapped.text, '<u>term</u>');
  const off = applyStudyMark(wrapped.text, wrapped.selectionStart, wrapped.selectionEnd, MARK_KINDS.UNDERLINE);
  assert.equal(off.text, 'term');
});

test('highlight wraps, recolors, and toggles off on the same color', () => {
  const once = applyStudyMark('term', 0, 4, MARK_KINDS.HIGHLIGHT, '#fde047');
  assert.equal(once.text, '<mark style="background-color:#fde047">term</mark>');

  const next = applyStudyMark(once.text, once.selectionStart, once.selectionEnd, MARK_KINDS.HIGHLIGHT, '#ff0000');
  assert.match(next.text, /background-color:#ff0000/);
  assert.equal(next.toggledOff, false);
  assert.equal(detectStudyMarks(next.text, next.selectionStart, next.selectionEnd).highlight, '#ff0000');

  const kept = applyStudyMark(
    next.text,
    next.selectionStart,
    next.selectionEnd,
    MARK_KINDS.HIGHLIGHT,
    '#ff0000',
    { recolorOnly: true },
  );
  assert.equal(kept.applied, false);
  assert.match(kept.text, /#ff0000/);

  const off = applyStudyMark(next.text, next.selectionStart, next.selectionEnd, MARK_KINDS.HIGHLIGHT, '#ff0000');
  assert.equal(off.text, 'term');
  assert.equal(off.toggledOff, true);
});

test('highlight rejects unsafe colors and does not change the text', () => {
  const bad = applyStudyMark('term', 0, 4, MARK_KINDS.HIGHLIGHT, 'red;background:url(x)');
  assert.equal(bad.applied, false);
  assert.equal(bad.invalidColor, true);
  assert.equal(bad.text, 'term');
  assert.equal(normalizeStudyColor('#gg0000'), null);
  assert.equal(normalizeStudyColor('javascript:alert(1)'), null);
});

test('color normalize accepts hex, rgb, hsl, and names', () => {
  assert.equal(normalizeStudyColor('#abc'), '#aabbcc');
  assert.equal(normalizeStudyColor('#FDE047'), '#fde047');
  assert.equal(normalizeStudyColor('rgb(255, 0, 0)'), '#ff0000');
  assert.equal(normalizeStudyColor('rgb(100%, 0%, 0%)'), '#ff0000');
  assert.equal(normalizeStudyColor('hsl(120, 100%, 50%)'), '#00ff00');
  assert.equal(normalizeStudyColor('yellow'), '#ffff00');
  assert.equal(normalizeStudyColor('red'), '#ff0000');
  assert.equal(normalizeStudyColor('rgb(255, 0, 0, 0.5)'), null);
});

test('inline marks are detected for the markdown save hint', () => {
  assert.equal(hasStudyInlineMarks('plain'), false);
  assert.equal(hasStudyInlineMarks('**term**'), true);
  assert.equal(hasStudyInlineMarks('<u>term</u>'), true);
  assert.equal(hasStudyInlineMarks('<mark style="background-color:#fde047">term</mark>'), true);
  assert.equal(hasStudyInlineMarks('****'), false);
});

test('caret after a highlight tag still toggles that word', () => {
  const text = 'structures of non <mark style="background-color:#fde047">profits.</mark>';
  const at = text.length;
  const off = applyStudyMark(text, at, at, MARK_KINDS.HIGHLIGHT, '#fde047');
  assert.equal(off.applied, true);
  assert.equal(off.toggledOff, true);
  assert.equal(off.text, 'structures of non profits.');
});

test('bold can sit on a list line', () => {
  const wrapped = applyStudyMark('- alpha', 2, 7, MARK_KINDS.BOLD);
  assert.equal(wrapped.text, '- **alpha**');
});
