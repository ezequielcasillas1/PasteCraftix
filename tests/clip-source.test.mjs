import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'extension/shared/clip-source.js')).href;
const {
  collectClipSources,
  getClipSourcePageUrl,
  getClipSourceTitle,
  formatClipTextWithSource,
  joinClipBodiesForSummary,
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
  getClipSourceTitle({ meta: { sourcePageTitle: 'Whirligig World', sourcePageUrl: 'https://example.edu/cell' } }),
  'Whirligig World',
);
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

assert.equal(
  getClipSourcePageUrl({ meta: { pageUrl: 'https://news.example/rhetoric' } }),
  'https://news.example/rhetoric',
);
assert.equal(
  getClipSourcePageUrl({ sourceUrl: 'https://archive.example/speech' }),
  'https://archive.example/speech',
);

const collected = collectClipSources([
  clip,
  { text: 'Essay only', title: 'Influence of Rhetoric' },
]);
assert.equal(collected.length, 2);
assert.equal(collected[0].url, 'https://example.edu/cell');
assert.equal(collected[1].title, 'Influence of Rhetoric');
assert.equal(collectClipSources([{ text: 'plain paste' }]).length, 0);
assert.equal(joinClipBodiesForSummary([clip]), clip.text);
assert.equal(joinClipBodiesForSummary([clip]).includes('[Source:'), false);

console.log('clip-source.test.mjs ok');
