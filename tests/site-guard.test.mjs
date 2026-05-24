import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isSiteAllowed } from '../extension/content/safety/site-guard.js';

describe('content safety site guard', () => {
  test('allows ordinary https pages', () => {
    assert.equal(isSiteAllowed('https://example.com/docs?page=1'), true);
    assert.equal(isSiteAllowed('https://notpaypal.com/account'), true);
  });

  test('blocks extension, browser, and malformed URLs', () => {
    for (const url of [
      '',
      'not a url',
      'chrome://settings',
      'edge://extensions',
      'about:blank',
      'file:///tmp/page.html',
      'data:text/html,hello',
      'javascript:alert(1)',
    ]) {
      assert.equal(isSiteAllowed(url), false, `expected blocked: ${url}`);
    }
  });

  test('blocks sensitive finance hosts and their subdomains', () => {
    for (const url of [
      'https://paypal.com/signin',
      'https://www.paypal.com/signin',
      'https://checkout.stripe.com/pay/cs_test',
      'https://secure.chase.com/web/auth',
      'https://foo.bankofamerica.com/login',
    ]) {
      assert.equal(isSiteAllowed(url), false, `expected blocked: ${url}`);
    }
  });

  test('blocks known phishing hosts, punycode hosts, scam TLDs, and scam paths', () => {
    for (const url of [
      'https://secure-paypal-login.com/',
      'https://login.secure-paypal-login.com/',
      'https://xn--paypal-abc.com/login',
      'https://example.zip/download',
      'https://example.com/wallet-connect',
      'https://example.com/login?next=account-suspended',
    ]) {
      assert.equal(isSiteAllowed(url), false, `expected blocked: ${url}`);
    }
  });
});
