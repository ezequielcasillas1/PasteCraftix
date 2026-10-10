import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'extension/popup/features/clips/clips.viewer-lists.js')).href;
const {
  LIST_STYLES,
  applyStudyListEnter,
  applyStudyListFormat,
  detectStudyListStyle,
  resolveStudyListMarkupHint,
  shouldRenderStudyLists,
  toMarkdownStudyLists,
} = await import(url);

const bullets = applyStudyListFormat('alpha\nbeta', 0, 11, LIST_STYLES.BULLET);
assert.equal(bullets.text, '- alpha\n- beta');
assert.equal(bullets.toggledOff, false);

const toggled = applyStudyListFormat(bullets.text, 0, bullets.text.length, LIST_STYLES.BULLET);
assert.equal(toggled.text, 'alpha\nbeta');
assert.equal(toggled.toggledOff, true);

const numbered = applyStudyListFormat('- alpha\n- beta', 0, 15, LIST_STYLES.NUMBERED);
assert.equal(numbered.text, '1. alpha\n2. beta');
assert.equal(detectStudyListStyle(numbered.text, 0, numbered.text.length), LIST_STYLES.NUMBERED);

const middle = applyStudyListFormat('keep\nnote\nkeep', 5, 9, LIST_STYLES.BULLET);
assert.equal(middle.text, 'keep\n- note\nkeep');

const withBlank = applyStudyListFormat('one\n\ntwo', 0, 8, LIST_STYLES.NUMBERED);
assert.equal(withBlank.text, '1. one\n\n2. two');

const continued = applyStudyListEnter('- alpha', 7);
assert.equal(continued.text, '- alpha\n- ');
assert.equal(continued.exited, false);
assert.equal(continued.selectionStart, 10);

const nextNumber = applyStudyListEnter('1. first', 8);
assert.equal(nextNumber.text, '1. first\n2. ');

const exited = applyStudyListEnter('- alpha\n- ', 10);
assert.equal(exited.text, '- alpha\n');
assert.equal(exited.exited, true);

assert.equal(shouldRenderStudyLists('plain question'), false);
assert.equal(shouldRenderStudyLists('- study point'), true);
assert.equal(resolveStudyListMarkupHint(null, '1. step'), 'markdown');
assert.equal(resolveStudyListMarkupHint('latex', '1. step'), null);
assert.equal(resolveStudyListMarkupHint('markdown', 'plain'), null);
assert.equal(resolveStudyListMarkupHint(null, '**term**'), 'markdown');
assert.equal(resolveStudyListMarkupHint(null, '<u>term</u>'), 'markdown');
assert.equal(
  resolveStudyListMarkupHint(null, '<mark style="background-color:#fde047">term</mark>'),
  'markdown',
);
assert.equal(resolveStudyListMarkupHint('latex', '**term**'), null);
assert.equal(resolveStudyListMarkupHint('html', '<u>term</u>'), null);

const fromCrlf = applyStudyListFormat('alpha\r\nbeta', 0, 11, LIST_STYLES.BULLET);
assert.equal(fromCrlf.text, '- alpha\n- beta');

const dots = applyStudyListFormat('alpha\nbeta', 0, 11, LIST_STYLES.DOT);
assert.equal(dots.text, '• alpha\n• beta');
assert.equal(detectStudyListStyle(dots.text, 0, dots.text.length), LIST_STYLES.DOT);

const continuedDot = applyStudyListEnter('• alpha', 7);
assert.equal(continuedDot.text, '• alpha\n• ');

assert.equal(toMarkdownStudyLists('• alpha\n- beta'), '- alpha\n- beta');
assert.equal(shouldRenderStudyLists('• study point'), true);

console.log('clip-viewer-lists.test.mjs ok');
