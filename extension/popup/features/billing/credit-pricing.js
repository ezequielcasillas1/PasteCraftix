/** Client-side preview only — server recalculates on checkout. */

export const CUSTOM_CREDIT_MIN = 25;
export const CUSTOM_CREDIT_MAX = 100_000;
export const STRIPE_MIN_AMOUNT_CENTS = 50;
export const CHECKOUT_MIN_CREDITS = 100;

export const CREDIT_PRICING_TIERS = Object.freeze([
  { minCredits: 25, maxCredits: 999, centsPerCredit: 0.5 },
  { minCredits: 1000, maxCredits: 4999, centsPerCredit: 0.5 },
  { minCredits: 5000, maxCredits: CUSTOM_CREDIT_MAX, centsPerCredit: 0.3 },
]);

function getTierForCredits(credits) {
  const c = Math.floor(credits);
  return CREDIT_PRICING_TIERS.find((t) => c >= t.minCredits && c <= t.maxCredits) ?? null;
}

export function calculatePriceCents(credits) {
  const c = Math.floor(Number(credits));
  if (!Number.isFinite(c) || c < CUSTOM_CREDIT_MIN || c > CUSTOM_CREDIT_MAX) return null;
  const tier = getTierForCredits(c);
  if (!tier) return null;
  return Math.ceil(c * tier.centsPerCredit);
}

export function calculatePriceDollars(credits) {
  const cents = calculatePriceCents(credits);
  return cents == null ? null : cents / 100;
}

export function meetsStripeMinimum(credits) {
  const cents = calculatePriceCents(credits);
  return cents != null && cents >= STRIPE_MIN_AMOUNT_CENTS;
}

export function formatCreditPricePreview(credits) {
  const c = Math.floor(Number(credits));
  if (!Number.isFinite(c) || c < CHECKOUT_MIN_CREDITS) {
    return `Enter credits (min ${CHECKOUT_MIN_CREDITS} to checkout)`;
  }
  if (c > CUSTOM_CREDIT_MAX) {
    return `Maximum ${CUSTOM_CREDIT_MAX.toLocaleString()} credits`;
  }
  const cents = calculatePriceCents(c);
  if (cents == null) return 'Invalid amount';
  const price = (cents / 100).toFixed(2);
  return `${c.toLocaleString()} credits = $${price}`;
}
