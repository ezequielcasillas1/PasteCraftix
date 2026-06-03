import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isSiteAllowed } from '../extension/content/safety/site-guard.js';

describe('isSiteAllowed', () => {
  test('allows ordinary http and https pages', () => {
    assert.equal(isSiteAllowed('https://example.com/docs'), true);
    assert.equal(isSiteAllowed('http://localhost:3000/dashboard'), true);
  });

  test('blocks browser, file, and scriptable protocols', () => {
    assert.equal(isSiteAllowed('chrome://extensions'), false);
    assert.equal(isSiteAllowed('edge://settings'), false);
    assert.equal(isSiteAllowed('file:///tmp/page.html'), false);
    assert.equal(isSiteAllowed('javascript:alert(1)'), false);
    assert.equal(isSiteAllowed('data:text/html,<p>x</p>'), false);
  });

  test('blocks sensitive finance and known phishing hosts including subdomains', () => {
    assert.equal(isSiteAllowed('https://checkout.stripe.com/pay/cs_test'), false);
    assert.equal(isSiteAllowed('https://secure.paypal.com/signin'), false);
    assert.equal(isSiteAllowed('https://login.metamask-wallet.io/connect'), false);
    assert.equal(isSiteAllowed('https://foo.secure-paypal-login.com/session'), false);
  });

  test('blocks homoglyph, high-risk TLD, and scam keyword URLs', () => {
    assert.equal(isSiteAllowed('https://xn--pple-43d.com/login'), false);
    assert.equal(isSiteAllowed('https://promo.example.zip/'), false);
    assert.equal(isSiteAllowed('https://example.com/wallet-connect/start'), false);
    assert.equal(isSiteAllowed('https://example.com/login?next=account-suspended'), false);
  });
});
