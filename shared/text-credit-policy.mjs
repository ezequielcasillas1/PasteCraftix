/** Shared Enhanced-tier text credit policy (weekly rollover, monthly, yearly). */

export const TEXT_CREDIT_POLICIES = Object.freeze({
  price_1Tf3UoLOdeLTrjap4O8BGFvS: { grant: 4_000, cap: 20_000 }, // Enhanced weekly ($3.99)
  price_1SaMM0LOdeLTrjapKLTHBByC: { grant: 4_000, cap: 20_000 }, // Enhanced weekly legacy ($1.99)
  price_1SUYs3LOdeLTrjapCFFDe7td: { grant: 35_000, cap: 35_000 }, // Enhanced monthly
  price_1SaMNJLOdeLTrjapjJ8iCoP7: { grant: 500_000, cap: 500_000 }, // Enhanced yearly
});

/**
 * @param {string | null | undefined} priceId
 * @returns {{ grant: number, cap: number } | null}
 */
export function getTextCreditPolicyFromPriceId(priceId) {
  const id = String(priceId || '').trim();
  if (!id) return null;
  return TEXT_CREDIT_POLICIES[id] ?? null;
}

/**
 * @param {number} existingLimit
 * @param {number} existingUsed
 * @param {{ grant: number, cap: number }} policy
 */
export function accrueTextCreditsOnPeriodReset(existingLimit, existingUsed, policy) {
  if (policy.cap > policy.grant) {
    const remaining = Math.max(0, Number(existingLimit || 0) - Math.max(0, Number(existingUsed || 0)));
    return Math.min(policy.cap, remaining + policy.grant);
  }
  return policy.grant;
}

/**
 * Stripe webhook rollover helper.
 * @param {{
 *   existingLimit?: number | null,
 *   existingUsed?: number | null,
 *   previousPriceId?: string | null,
 *   nextPriceId?: string | null,
 *   previousPeriodEndIso?: string | null,
 *   nextPeriodEndIso?: string | null,
 * }} opts
 * @returns {{ limit: number | null, used: number | null }}
 */
export function computeRolledTextCredits(opts) {
  const {
    existingLimit,
    existingUsed,
    previousPriceId,
    nextPriceId,
    previousPeriodEndIso,
    nextPeriodEndIso,
  } = opts;

  const policy = getTextCreditPolicyFromPriceId(nextPriceId || null);
  if (!policy) return { limit: null, used: null };

  const prevEndMs = previousPeriodEndIso ? Date.parse(previousPeriodEndIso) : NaN;
  const nextEndMs = nextPeriodEndIso ? Date.parse(nextPeriodEndIso) : NaN;
  const priceChanged = !!previousPriceId && previousPriceId !== nextPriceId;
  const periodAdvanced = priceChanged
    || !Number.isFinite(prevEndMs)
    || !Number.isFinite(nextEndMs)
    || nextEndMs > prevEndMs + 10 * 60 * 1000;

  if (!periodAdvanced && Number.isFinite(Number(existingLimit)) && Number(existingLimit) > 0) {
    return {
      limit: Number(existingLimit),
      used: Number.isFinite(Number(existingUsed)) ? Number(existingUsed) : 0,
    };
  }

  return {
    limit: accrueTextCreditsOnPeriodReset(
      Number(existingLimit || 0),
      Number(existingUsed || 0),
      policy,
    ),
    used: 0,
  };
}
