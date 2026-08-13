import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'extension/shared/clip-source.js')).href;
const {
  getClipSourcePageUrl,
  getClipSourceTitle,
  formatClipTextWithSource,
  joinClipsForSummary,
} = await import(url);

const clip = {
  text: 'The mitochondria is the powerhouse of the cell.',
  title: 'Cell biology notes',
  meta: { sourcePageUrl: 'https://example.edu/cell' },
};

assert.equal(getClipSourcePageUrl(clip), 'https://example.edu/cell');
assert.equal(getClipSourceTitle(clip), 'Cell biology notes');
assert.equal(
  formatClipTextWithSource(clip, clip.text),
  '[Source: Cell biology notes | https://example.edu/cell]\nThe mitochondria is the powerhouse of the cell.',
);
assert.equal(formatClipTextWithSource({ text: 'plain' }, 'plain'), 'plain');

const joined = joinClipsForSummary([
  clip,
  { text: 'Second clip', meta: { sourcePageUrl: 'https://other.example/page' } },
]);
assert.match(joined, /---/);
assert.match(joined, /https:\/\/example\.edu\/cell/);
assert.match(joined, /https:\/\/other\.example\/page/);

console.log('clip-source.test.mjs ok');
