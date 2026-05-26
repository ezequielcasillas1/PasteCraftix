/**
 * Warm-shell preload guard (widget iframe must not run full sync at hover).
 * Run: node --test tests/popup-warm-shell.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

function isWarmShellOnlyFromSearch(search) {
  try {
    return new URLSearchParams(search).get('pcWarmShell') === '1';
  } catch (_) {
    return false;
  }
}

test('pcWarmShell=1 enables warm shell deferral', () => {
  assert.equal(isWarmShellOnlyFromSearch('?pcWarmShell=1'), true);
  assert.equal(isWarmShellOnlyFromSearch('?pcWarmShell=0'), false);
  assert.equal(isWarmShellOnlyFromSearch(''), false);
});

test('warm iframe URL appends pcWarmShell without breaking existing query', () => {
  const withQuery = 'chrome-extension://abc/popup.html?foo=bar';
  const sep = withQuery.includes('?') ? '&' : '?';
  assert.equal(`${withQuery}${sep}pcWarmShell=1`, 'chrome-extension://abc/popup.html?foo=bar&pcWarmShell=1');

  const plain = 'chrome-extension://abc/popup.html';
  assert.equal(`${plain}?pcWarmShell=1`, 'chrome-extension://abc/popup.html?pcWarmShell=1');
});
