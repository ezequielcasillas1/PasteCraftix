/**
 * Run: node --test tests/qr-phone-share.test.mjs
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  PHONE_QR_ABSOLUTE_MAX_BYTES,
  preparePhoneQrPayload,
} from '../extension/popup/shared/qr-phone-share.js';

describe('qr phone share payload', () => {
  test('empty text returns empty mode without QR', () => {
    const result = preparePhoneQrPayload('   ');
    assert.equal(result.mode, 'empty');
    assert.equal(result.showQr, false);
    assert.equal(result.payload, '');
  });

  test('short text fits in full mode', () => {
    const result = preparePhoneQrPayload('Hello from PasteCraft');
    assert.equal(result.mode, 'full');
    assert.equal(result.showQr, true);
    assert.equal(result.copiedFull, false);
    assert.equal(result.payload, 'Hello from PasteCraft');
  });

  test('URL-only text is prefixed to avoid Safari auto-open', () => {
    const result = preparePhoneQrPayload('https://example.com/path');
    assert.equal(result.mode, 'full');
    assert.match(result.payload, /^Text:\nhttps:\/\/example\.com\/path$/);
  });

  test('text within byte limit stays in full mode', () => {
    const text = 'x'.repeat(PHONE_QR_ABSOLUTE_MAX_BYTES - 10);
    const result = preparePhoneQrPayload(text);
    assert.equal(result.mode, 'full');
    assert.equal(result.copiedFull, false);
    assert.ok(new TextEncoder().encode(result.payload).length <= PHONE_QR_ABSOLUTE_MAX_BYTES);
  });

  test('oversized text uses truncated mode and flags clipboard copy', () => {
    const text = 'ü'.repeat(PHONE_QR_ABSOLUTE_MAX_BYTES);
    const result = preparePhoneQrPayload(text);
    assert.equal(result.mode, 'truncated');
    assert.equal(result.copiedFull, true);
    assert.equal(result.showQr, true);
    assert.match(result.payload, /Full text copied on your computer/);
    assert.ok(new TextEncoder().encode(result.payload).length <= PHONE_QR_ABSOLUTE_MAX_BYTES);
  });

  test('oversized ASCII text always truncates within QR byte ceiling', () => {
    const huge = 'A'.repeat(PHONE_QR_ABSOLUTE_MAX_BYTES * 4);
    const result = preparePhoneQrPayload(huge);
    assert.equal(result.mode, 'truncated');
    assert.equal(result.copiedFull, true);
    assert.ok(new TextEncoder().encode(result.payload).length <= PHONE_QR_ABSOLUTE_MAX_BYTES);
  });
});
