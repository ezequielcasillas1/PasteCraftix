/**
 * Custom credit purchase pricing (server-side source of truth).
 *
 * Input: credit count. Output: price in USD (cents for Stripe).
 *
 * Preset packs ($5 / 1,000 and $15 / 5,000) use fixed Stripe Price IDs.
 *
 * Custom tiered rates (by credits purchased):
 * | Credits      | Rate / credit | Anchor        |
 * |--------------|---------------|---------------|
 * | 25–999       | $0.005        | $5 / 1,000    |
 * | 1,000–4,999  | $0.005        | $5 / 1,000    |
 * | 5,000+       | $0.003        | $15 / 5,000   |
 *
 * UI minimum: 25 credits ($0.125 at base rate).
 * Stripe Checkout minimum: $0.50 USD → effective checkout floor 100 credits.
 */

export const CUSTOM_CREDIT_MIN = 25;
export const CUSTOM_CREDIT_MAX = 100_000;
export const STRIPE_MIN_AMOUNT_CENTS = 50;

/** Whole credits needed to reach Stripe $0.50 floor at base rate ($0.005/credit). */
export const CHECKOUT_MIN_CREDITS = 100;

export const CREDIT_PRICING_TIERS = [
  { minCredits: 25, maxCredits: 999, centsPerCredit: 0.5 },
  { minCredits: 1000, maxCredits: 4999, centsPerCredit: 0.5 },
  { minCredits: 5000, maxCredits: CUSTOM_CREDIT_MAX, centsPerCredit: 0.3 },
] as const;

export type CreditPricingTier = (typeof CREDIT_PRICING_TIERS)[number];

export function getTierForCredits(credits: number): CreditPricingTier | null {
  const c = Math.floor(credits);
  return CREDIT_PRICING_TIERS.find((t) => c >= t.minCredits && c <= t.maxCredits) ?? null;
}

export function parseCustomCreditAmount(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid credit amount');
  }
  return n;
}

export function calculatePriceCents(credits: number): number {
  const c = parseCustomCreditAmount(credits);
  if (c < CUSTOM_CREDIT_MIN || c > CUSTOM_CREDIT_MAX) {
    throw new Error(`Credits must be ${CUSTOM_CREDIT_MIN}–${CUSTOM_CREDIT_MAX.toLocaleString()}`);
  }
  const tier = getTierForCredits(c);
  if (!tier) {
    throw new Error('No pricing tier matches this credit amount');
  }
  return Math.ceil(c * tier.centsPerCredit);
}

export function calculatePriceDollars(credits: number): number {
  return calculatePriceCents(credits) / 100;
}

export function meetsStripeMinimum(credits: number): boolean {
  try {
    return calculatePriceCents(credits) >= STRIPE_MIN_AMOUNT_CENTS;
  } catch {
    return false;
  }
}

export function customPriceIdForCredits(credits: number): string {
  return `custom_credits_${Math.floor(credits)}`;
}

export function formatPriceDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
