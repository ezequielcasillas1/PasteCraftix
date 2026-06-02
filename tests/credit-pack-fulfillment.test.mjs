import test from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors supabase/functions/_shared/credit_packs.ts */
function isCreditPackBalanceApplied(purchase) {
  return !!purchase?.balance_applied_at;
}

test('purchase without balance_applied_at must receive credits on webhook retry', () => {
  const row = { id: 'p1', credits_amount: 1000, balance_applied_at: null };
  assert.equal(isCreditPackBalanceApplied(row), false);
});

test('purchase with balance_applied_at is idempotent on webhook retry', () => {
  const row = { id: 'p1', credits_amount: 1000, balance_applied_at: '2026-06-02T12:00:00.000Z' };
  assert.equal(isCreditPackBalanceApplied(row), true);
});

test('partial failure scenario: insert without apply must not short-circuit retry', () => {
  const afterInsertBeforeBalance = { credits_amount: 5000, balance_applied_at: null };
  assert.equal(isCreditPackBalanceApplied(afterInsertBeforeBalance), false);
});
