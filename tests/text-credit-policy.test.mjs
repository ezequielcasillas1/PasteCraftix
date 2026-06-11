/**
 * Text credit policy tests (monthly/yearly must not downgrade to weekly near renewal).
 * Run: node --test tests/text-credit-policy.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BILLING_PRICE_IDS } from '../extension/popup/features/billing/billing.constants.js';
import {
  accrueTextCreditsOnPeriodReset,
  computeRolledTextCredits,
  getTextCreditPolicyFromPriceId,
} from '../shared/text-credit-policy.mjs';

test('monthly price id grants 35k credits', () => {
  const policy = getTextCreditPolicyFromPriceId(BILLING_PRICE_IDS.ENHANCED_MONTHLY);
  assert.deepEqual(policy, { grant: 35_000, cap: 35_000 });
});

test('yearly price id grants 500k credits', () => {
  const policy = getTextCreditPolicyFromPriceId(BILLING_PRICE_IDS.ENHANCED_YEARLY);
  assert.deepEqual(policy, { grant: 500_000, cap: 500_000 });
});

test('monthly renewal keeps 35k grant even when reset date is today', () => {
  const policy = getTextCreditPolicyFromPriceId(BILLING_PRICE_IDS.ENHANCED_MONTHLY);
  const nextLimit = accrueTextCreditsOnPeriodReset(35_000, 30_000, policy);
  assert.equal(nextLimit, 35_000);
});

test('yearly renewal keeps 500k grant when period advances', () => {
  const nowIso = new Date().toISOString();
  const nextEndIso = new Date(Date.now() + 365 * 86400000).toISOString();
  const result = computeRolledTextCredits({
    existingLimit: 500_000,
    existingUsed: 400_000,
    previousPriceId: BILLING_PRICE_IDS.ENHANCED_YEARLY,
    nextPriceId: BILLING_PRICE_IDS.ENHANCED_YEARLY,
    previousPeriodEndIso: nowIso,
    nextPeriodEndIso: nextEndIso,
  });
  assert.equal(result.limit, 500_000);
  assert.equal(result.used, 0);
});

test('weekly rollover caps at 20k', () => {
  const policy = getTextCreditPolicyFromPriceId(BILLING_PRICE_IDS.ENHANCED_WEEKLY);
  const nextLimit = accrueTextCreditsOnPeriodReset(20_000, 2_000, policy);
  assert.equal(nextLimit, 20_000);
});

test('duplicate webhook preserves existing credits when period unchanged', () => {
  const periodEnd = new Date(Date.now() + 20 * 86400000).toISOString();
  const result = computeRolledTextCredits({
    existingLimit: 35_000,
    existingUsed: 12_000,
    previousPriceId: BILLING_PRICE_IDS.ENHANCED_MONTHLY,
    nextPriceId: BILLING_PRICE_IDS.ENHANCED_MONTHLY,
    previousPeriodEndIso: periodEnd,
    nextPeriodEndIso: periodEnd,
  });
  assert.equal(result.limit, 35_000);
  assert.equal(result.used, 12_000);
});
