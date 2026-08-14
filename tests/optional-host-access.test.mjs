import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectBrowserBrand,
  originPatternFromUrl,
} from '../extension/shared/optional-permissions.js';

test('detectBrowserBrand treats OPR as Opera even when Chrome is in UA', () => {
  const brand = detectBrowserBrand(
    'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36 OPR/128.0.0.0',
  );
  assert.equal(brand.isOpera, true);
  assert.equal(brand.uaBrand, 'opera');
});

test('detectBrowserBrand does not treat Chrome-only UA as Opera', () => {
  const brand = detectBrowserBrand(
    'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36',
  );
  assert.equal(brand.isOpera, false);
  assert.equal(brand.uaBrand, 'chrome');
});

test('originPatternFromUrl builds https host pattern', () => {
  assert.equal(
    originPatternFromUrl('https://news.ycombinator.com/item?id=1'),
    'https://news.ycombinator.com/*',
  );
  assert.equal(originPatternFromUrl('chrome://extensions'), '');
  assert.equal(originPatternFromUrl('https://example.com/*'), 'https://example.com/*');
});
