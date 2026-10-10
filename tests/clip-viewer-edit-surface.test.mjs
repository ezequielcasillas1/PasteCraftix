import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const url = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'extension/popup/features/clips/clips.viewer-edit-surface.js')).href;
const { renderStudyEditHtml } = await import(url);

test('highlight renders as a mark element, not escaped source', () => {
  const html = renderStudyEditHtml('structures of non <mark style="background-color:#fde047">profits.</mark>');
  assert.match(html, /<mark style="background-color:#fde047">profits\.<\/mark>/);
  assert.equal(html.includes('&lt;mark'), false);
  assert.equal(html.replace(/<[^>]+>/g, ''), 'structures of non profits.');
});

test('plain angle brackets stay escaped', () => {
  assert.equal(renderStudyEditHtml('1 < 2'), '1 &lt; 2');
});

test('bold and underline render without their source markers', () => {
  const html = renderStudyEditHtml('**profits** and <u>dues</u>');
  assert.match(html, /<strong>profits<\/strong>/);
  assert.match(html, /<u>dues<\/u>/);
  assert.equal(html.includes('**'), false);
  assert.equal(html.includes('&lt;u&gt;'), false);
});
