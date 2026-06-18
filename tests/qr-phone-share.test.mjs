/**
 * QR phone share payload preparation — truncation and URL safety.
 * Run: node --test tests/qr-phone-share.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PHONE_QR_ABSOLUTE_MAX_BYTES,
  preparePhoneQrPayload,
} from '../extension/popup/shared/qr-phone-share.js';

function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

describe('preparePhoneQrPayload', () => {
  test('returns empty mode for blank input', () => {
    const result = preparePhoneQrPayload('   ');

    assert.equal(result.mode, 'empty');
    assert.equal(result.showQr, false);
    assert.equal(result.payload, '');
  });

  test('prefixes bare URLs so iPhone Camera does not open Safari', () => {
    const result = preparePhoneQrPayload('https://example.com/path');

    assert.equal(result.mode, 'full');
    assert.match(result.payload, /^Text:\nhttps:\/\/example\.com\/path$/);
  });

  test('keeps short plain text in full mode', () => {
    const text = 'Meeting notes: ship v3.0.13';
    const result = preparePhoneQrPayload(text);

    assert.equal(result.mode, 'full');
    assert.equal(result.payload, text);
    assert.equal(result.copiedFull, false);
    assert.equal(result.showQr, true);
    assert.ok(utf8ByteLength(result.payload) <= PHONE_QR_ABSOLUTE_MAX_BYTES);
  });

  test('truncates oversized text and flags clipboard copy', () => {
    const text = 'x'.repeat(PHONE_QR_ABSOLUTE_MAX_BYTES + 500);
    const result = preparePhoneQrPayload(text);

    assert.equal(result.mode, 'truncated');
    assert.equal(result.copiedFull, true);
    assert.equal(result.showQr, true);
    assert.ok(utf8ByteLength(result.payload) <= PHONE_QR_ABSOLUTE_MAX_BYTES);
    assert.match(result.payload, /Full text copied on your computer/);
  });

  test('truncates multibyte unicode within QR byte ceiling', () => {
    const text = '😀'.repeat(1200);
    const result = preparePhoneQrPayload(text);

    assert.equal(result.mode, 'truncated');
    assert.equal(result.copiedFull, true);
    assert.ok(utf8ByteLength(result.payload) <= PHONE_QR_ABSOLUTE_MAX_BYTES);
  });
});
