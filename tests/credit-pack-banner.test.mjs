import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPurchaseCreditPacks,
  shouldShowCreditPackBanner,
} from '../extension/popup/features/ai-lab/ai-lab.credit-packs.js';

test('premium active user can purchase credit packs', () => {
  const sub = {
    subscription_tier: 'premium',
    subscription_status: 'active',
    has_unlimited_ai: false,
  };
  assert.equal(canPurchaseCreditPacks(sub), true);
  assert.equal(shouldShowCreditPackBanner(sub), true);
});

test('basic active user can purchase credit packs', () => {
  const sub = {
    subscription_tier: 'basic',
    subscription_status: 'active',
    has_unlimited_ai: false,
  };
  assert.equal(canPurchaseCreditPacks(sub), true);
  assert.equal(shouldShowCreditPackBanner(sub), true);
});

test('free tier signed-in user can purchase credit packs', () => {
  const sub = {
    subscription_tier: 'free',
    subscription_status: 'active',
    has_unlimited_ai: false,
  };
  assert.equal(canPurchaseCreditPacks(sub), true);
  assert.equal(shouldShowCreditPackBanner(sub), true);
});

test('unlimited coupon users cannot purchase credit packs', () => {
  const sub = {
    subscription_tier: 'free',
    subscription_status: 'developer access',
    has_unlimited_ai: true,
  };
  assert.equal(canPurchaseCreditPacks(sub), false);
  assert.equal(shouldShowCreditPackBanner(sub), false);
});

test('unsigned user cannot purchase credit packs', () => {
  assert.equal(canPurchaseCreditPacks(null), false);
});
