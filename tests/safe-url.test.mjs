import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveSafeExternalUrl } from '../extension/safe-url.js';

describe('resolveSafeExternalUrl', () => {
  test('allows normalized http, https, and mailto links', () => {
    assert.equal(resolveSafeExternalUrl(' https://example.com/path?q=1 '), 'https://example.com/path?q=1');
    assert.equal(resolveSafeExternalUrl('http://example.com/'), 'http://example.com/');
    assert.equal(resolveSafeExternalUrl('mailto:support@example.com'), 'mailto:support@example.com');
  });

  test('rejects scriptable and embedded-document schemes', () => {
    assert.equal(resolveSafeExternalUrl('javascript:alert(1)'), null);
    assert.equal(resolveSafeExternalUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(resolveSafeExternalUrl('blob:https://example.com/id'), null);
  });

  test('rejects empty and relative values', () => {
    assert.equal(resolveSafeExternalUrl(''), null);
    assert.equal(resolveSafeExternalUrl(null), null);
    assert.equal(resolveSafeExternalUrl('/relative/path'), null);
    assert.equal(resolveSafeExternalUrl('//example.com/protocol-relative'), null);
  });
});
