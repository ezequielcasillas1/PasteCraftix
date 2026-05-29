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
    ai_text_credits_limit: 2500,
    ai_text_credits_used: 100,
  };
  assert.equal(canPurchaseCreditPacks(sub), true);
  assert.equal(shouldShowCreditPackBanner(sub), true);
});

test('premium user with high remaining credits still sees buy banner', () => {
  const sub = {
    subscription_tier: 'premium',
    subscription_status: 'active',
    has_unlimited_ai: false,
    ai_text_credits_limit: 2500,
    ai_text_credits_used: 0,
    ai_image_credits_limit: 624,
    ai_image_credits_used: 0,
  };
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

test('free tier without AI access cannot purchase credit packs', () => {
  const sub = {
    subscription_tier: 'free',
    subscription_status: 'active',
    has_unlimited_ai: false,
  };
  assert.equal(canPurchaseCreditPacks(sub), false);
});
