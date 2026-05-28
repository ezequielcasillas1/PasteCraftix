/**
 * Smoke tests for credit pricing (custom purchases).
 * Run: node --test tests/credit-pricing.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculatePriceCents,
  calculatePriceDollars,
  meetsStripeMinimum,
  CHECKOUT_MIN_CREDITS,
  CUSTOM_CREDIT_MIN,
} from '../extension/popup/features/billing/credit-pricing.js';

test('25 credits costs $0.13 (rounded up from $0.125)', () => {
  assert.equal(calculatePriceCents(25), 13);
  assert.equal(calculatePriceDollars(25), 0.13);
});

test('100 credits meets Stripe minimum at $0.50', () => {
  assert.equal(calculatePriceCents(100), 50);
  assert.equal(meetsStripeMinimum(100), true);
  assert.equal(CHECKOUT_MIN_CREDITS, 100);
});

test('25 credits below Stripe checkout minimum', () => {
  assert.equal(meetsStripeMinimum(25), false);
  assert.equal(meetsStripeMinimum(CUSTOM_CREDIT_MIN), false);
});

test('5000 credits uses bulk rate ($0.003/credit = $15)', () => {
  assert.equal(calculatePriceCents(5000), 1500);
  assert.equal(calculatePriceDollars(5000), 15);
});

test('1000 credits matches $5 anchor', () => {
  assert.equal(calculatePriceCents(1000), 500);
});
