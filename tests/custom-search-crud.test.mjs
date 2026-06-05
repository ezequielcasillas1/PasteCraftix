/**
 * Run: node --test tests/custom-search-crud.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGoogleSearchUrl,
  buildQueryFromTemplate,
  sanitizeCustomSearchQuery,
  sanitizeCustomSearchTemplate,
  templateUsesClipPlaceholder,
} from '../extension/popup/features/clips/clips.custom-search.service.js';

test('buildQueryFromTemplate substitutes clip placeholder', () => {
  const query = buildQueryFromTemplate('what does {clip} mean', 'hello world');
  assert.equal(query, 'what does hello world mean');
});

test('buildQueryFromTemplate uses template as-is when placeholder missing', () => {
  const query = buildQueryFromTemplate('site:example.com', 'alpha');
  assert.equal(query, 'site:example.com');
});

test('buildQueryFromTemplate returns clip text when template empty', () => {
  const query = buildQueryFromTemplate('', 'alpha');
  assert.equal(query, 'alpha');
});

test('templateUsesClipPlaceholder detects {clip} token', () => {
  assert.equal(templateUsesClipPlaceholder('site:example.com {clip}'), true);
  assert.equal(templateUsesClipPlaceholder('site:example.com'), false);
});

test('sanitize strips unsafe schemes and control chars', () => {
  const template = sanitizeCustomSearchTemplate('javascript:alert(1) {clip}\u0007');
  assert.equal(template, 'alert(1) {clip}');
});

test('buildGoogleSearchUrl encodes query safely', () => {
  const url = buildGoogleSearchUrl('hello & world');
  assert.equal(url, 'https://www.google.com/search?q=hello%20%26%20world');
});

test('sanitizeCustomSearchQuery rejects empty after cleaning', () => {
  assert.equal(sanitizeCustomSearchQuery('   '), '');
});

test('buildQueryFromTemplate with site: prefix and extra terms', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com async await', '');
  assert.equal(query, 'site:stackoverflow.com async await');
});

test('buildQueryFromTemplate with site: prefix and {clip} appended via drag-insert', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com {clip}', 'async await');
  assert.equal(query, 'site:stackoverflow.com async await');
});

test('buildQueryFromTemplate with site: prefix and empty clip falls back to template', () => {
  const query = buildQueryFromTemplate('site:stackoverflow.com', '');
  assert.equal(query, 'site:stackoverflow.com');
});
