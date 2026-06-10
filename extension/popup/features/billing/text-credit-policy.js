/** Client + test mirror of supabase/functions/_shared/credit_packs.ts text allowance helpers. */

const MONTHLY_TEXT_ALLOWANCE = { grant: 35_000, cap: 35_000 };

export function getTextCreditPolicyFromPriceId(priceId) {
  switch (String(priceId || '').trim()) {
    case 'price_1Tf3UoLOdeLTrjap4O8BGFvS':
    case 'price_1SaMM0LOdeLTrjapKLTHBByC':
      return { grant: 4_000, cap: 20_000 };
    case 'price_1SUYs3LOdeLTrjapCFFDe7td':
      return MONTHLY_TEXT_ALLOWANCE;
    case 'price_1SaMNJLOdeLTrjapjJ8iCoP7':
      return { grant: 500_000, cap: 500_000 };
    default:
      return null;
  }
}

export function resolveTextAllowancePolicyFromPeriodEnd(periodEndIso, nowMs = Date.now()) {
  if (!periodEndIso) return MONTHLY_TEXT_ALLOWANCE;
  const resetMs = Date.parse(periodEndIso);
  if (!Number.isFinite(resetMs)) return MONTHLY_TEXT_ALLOWANCE;
  const diffDays = (resetMs - nowMs) / 86_400_000;
  if (diffDays < 0) return MONTHLY_TEXT_ALLOWANCE;
  if (diffDays <= 10) return { grant: 4_000, cap: 20_000 };
  if (diffDays <= 40) return MONTHLY_TEXT_ALLOWANCE;
  return { grant: 500_000, cap: 500_000 };
}

export function resolveTextAllowancePolicy({ stripePriceId, periodEndIso, nowMs } = {}) {
  const fromPrice = getTextCreditPolicyFromPriceId(stripePriceId);
  if (fromPrice) return fromPrice;
  return resolveTextAllowancePolicyFromPeriodEnd(periodEndIso, nowMs);
}

export function accrueWeeklyRolloverLimit(limit, used, grant, cap) {
  const remaining = Math.max(0, Number(limit) - Math.max(0, Number(used)));
  return Math.min(cap, remaining + grant);
}
