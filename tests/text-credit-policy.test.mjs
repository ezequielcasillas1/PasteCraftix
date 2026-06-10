/**
 * Run: node --test tests/text-credit-policy.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accrueWeeklyRolloverLimit,
  getTextCreditPolicyFromPriceId,
  resolveTextAllowancePolicy,
  resolveTextAllowancePolicyFromPeriodEnd,
} from '../extension/popup/features/billing/text-credit-policy.js';

const MONTHLY_PRICE = 'price_1SUYs3LOdeLTrjapCFFDe7td';
const WEEKLY_PRICE = 'price_1Tf3UoLOdeLTrjap4O8BGFvS';
const YEARLY_PRICE = 'price_1SaMNJLOdeLTrjapjJ8iCoP7';

test('monthly price id grants 35k even when period end is in the past', () => {
  const expired = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const policy = resolveTextAllowancePolicy({
    stripePriceId: MONTHLY_PRICE,
    periodEndIso: expired,
  });
  assert.deepEqual(policy, { grant: 35_000, cap: 35_000 });
});

test('expired period end without price id defaults to monthly, not weekly', () => {
  const expired = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const policy = resolveTextAllowancePolicyFromPeriodEnd(expired);
  assert.deepEqual(policy, { grant: 35_000, cap: 35_000 });
});

test('weekly price id keeps rollover cap', () => {
  assert.deepEqual(getTextCreditPolicyFromPriceId(WEEKLY_PRICE), { grant: 4_000, cap: 20_000 });
});

test('yearly price id grants 500k', () => {
  assert.deepEqual(getTextCreditPolicyFromPriceId(YEARLY_PRICE), { grant: 500_000, cap: 500_000 });
});

test('weekly rollover accrues remaining up to cap', () => {
  assert.equal(accrueWeeklyRolloverLimit(18_000, 2_000, 4_000, 20_000), 20_000);
  assert.equal(accrueWeeklyRolloverLimit(10_000, 5_000, 4_000, 20_000), 9_000);
});

test('future weekly period end infers weekly when price id missing', () => {
  const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const policy = resolveTextAllowancePolicyFromPeriodEnd(inFiveDays);
  assert.deepEqual(policy, { grant: 4_000, cap: 20_000 });
});
