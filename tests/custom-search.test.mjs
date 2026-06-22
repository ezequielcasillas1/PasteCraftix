/**
 * Run: node --test tests/custom-search.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCombinedSearchQuery,
  buildGoogleSearchUrl,
  isCustomSearchQueryValid,
  sanitizeCustomSearchQuery,
} from '../extension/popup/features/clips/clips.custom-search.service.js';

test('buildCombinedSearchQuery joins highlight and question', () => {
  assert.equal(buildCombinedSearchQuery('async await', 'what is this'), 'async await what is this');
});

test('buildCombinedSearchQuery returns highlight only when question empty', () => {
  assert.equal(buildCombinedSearchQuery('async await', ''), 'async await');
});

test('buildCombinedSearchQuery returns question only when highlight empty', () => {
  assert.equal(buildCombinedSearchQuery('', 'what is async await'), 'what is async await');
});

test('buildCombinedSearchQuery returns empty when both empty', () => {
  assert.equal(buildCombinedSearchQuery('', ''), '');
});

test('sanitize strips unsafe schemes and control chars', () => {
  assert.equal(sanitizeCustomSearchQuery('javascript:alert(1)\u0007 hello'), 'alert(1) hello');
});

test('buildGoogleSearchUrl encodes query safely', () => {
  const url = buildGoogleSearchUrl('hello & world');
  assert.equal(url, 'https://www.google.com/search?q=hello%20%26%20world');
});

test('sanitizeCustomSearchQuery rejects empty after cleaning', () => {
  assert.equal(sanitizeCustomSearchQuery('   '), '');
});

test('isCustomSearchQueryValid requires at least one non-empty field', () => {
  assert.equal(isCustomSearchQueryValid('', ''), false);
  assert.equal(isCustomSearchQueryValid('term', ''), true);
  assert.equal(isCustomSearchQueryValid('', 'question'), true);
  assert.equal(isCustomSearchQueryValid('term', 'question'), true);
});
