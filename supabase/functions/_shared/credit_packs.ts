/** Stripe one-time credit pack helpers (shared by create-checkout + stripe-webhook). */

export {
  CUSTOM_CREDIT_MIN,
  CUSTOM_CREDIT_MAX,
  CHECKOUT_MIN_CREDITS,
  STRIPE_MIN_AMOUNT_CENTS,
  CREDIT_PRICING_TIERS,
  calculatePriceCents,
  calculatePriceDollars,
  meetsStripeMinimum,
  customPriceIdForCredits,
  parseCustomCreditAmount,
} from './credit_pricing.ts';

export const CREDIT_PACK_PLACEHOLDERS = {
  PACK_1000: 'price_1TcB5ULOdeLTrjapKaztK3oM',
  PACK_5000: 'price_1TcB5bLOdeLTrjapqQ8kXXgE',
} as const;

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [CREDIT_PACK_PLACEHOLDERS.PACK_1000]: 1000,
  [CREDIT_PACK_PLACEHOLDERS.PACK_5000]: 5000,
};

function envPrice(key: 'STRIPE_PRICE_CREDITS_1000' | 'STRIPE_PRICE_CREDITS_5000', fallback: string): string {
  return (Deno.env.get(key) || fallback).trim();
}

export function resolveCreditPackPriceIds(): string[] {
  return [
    envPrice('STRIPE_PRICE_CREDITS_1000', CREDIT_PACK_PLACEHOLDERS.PACK_1000),
    envPrice('STRIPE_PRICE_CREDITS_5000', CREDIT_PACK_PLACEHOLDERS.PACK_5000),
  ];
}

export function getCreditAmountForPriceId(priceId: string): number | null {
  const id = String(priceId || '').trim();
  if (!id) return null;

  const pack1000 = envPrice('STRIPE_PRICE_CREDITS_1000', CREDIT_PACK_PLACEHOLDERS.PACK_1000);
  const pack5000 = envPrice('STRIPE_PRICE_CREDITS_5000', CREDIT_PACK_PLACEHOLDERS.PACK_5000);

  if (id === pack1000) return 1000;
  if (id === pack5000) return 5000;
  return CREDIT_PACK_AMOUNTS[id] ?? null;
}

export function isCreditPackPriceId(priceId: string): boolean {
  return getCreditAmountForPriceId(priceId) !== null;
}

export function computeTotalRemaining(subRemaining: number, purchasedBalance: number): number {
  return Math.max(0, subRemaining) + Math.max(0, purchasedBalance);
}

export function readPurchasedBalance(sub: { ai_purchased_credits_balance?: number | null }): number {
  return Number.isFinite(Number(sub?.ai_purchased_credits_balance))
    ? Math.max(0, Number(sub.ai_purchased_credits_balance))
    : 0;
}

/** Row shape for user_subscriptions credit/entitlement queries (no generated DB types). */
export type UserSubscriptionCreditRow = {
  user_id?: string;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  has_unlimited_ai?: boolean | null;
  ai_access_expires_at?: string | null;
  stripe_current_period_end?: string | null;
  ai_text_credits_limit?: number | null;
  ai_text_credits_used?: number | null;
  ai_text_credits_reset_at?: string | null;
  ai_purchased_credits_balance?: number | null;
};

/** Active Premium subscription or time-boxed / unlimited coupon AI access. */
export function hasSubscriptionAiAllowance(sub: UserSubscriptionCreditRow): boolean {
  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  const hasCouponAiAccess = !!(
    sub.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  );
  const isPaidTier = tier === 'premium'
    && (status === 'active' || status === 'past_due');
  return isPaidTier || hasCouponAiAccess;
}

/** May consume AI credits: paid tier, coupon access, or a purchased balance. */
export function hasAiUsageEntitlement(sub: UserSubscriptionCreditRow): boolean {
  return hasSubscriptionAiAllowance(sub) || readPurchasedBalance(sub) > 0;
}

export type CreditDrainPlan = {
  subUsedDelta: number;
  purchasedDelta: number;
};

export function planCreditDrain(
  subRemaining: number,
  purchasedBalance: number,
  cost: number,
): CreditDrainPlan | null {
  const safeCost = Math.max(1, Math.round(cost));
  const subRem = Math.max(0, subRemaining);
  const purchased = Math.max(0, purchasedBalance);

  if (subRem + purchased < safeCost) return null;
  if (safeCost <= subRem) return { subUsedDelta: safeCost, purchasedDelta: 0 };
  return { subUsedDelta: subRem, purchasedDelta: safeCost - subRem };
}

export async function fulfillCreditPackPurchase(opts: {
  supabase: any;
  userId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  priceId: string;
  creditsAmount: number;
  amountCents?: number | null;
  currency?: string | null;
}): Promise<{ ok: boolean; error?: string; alreadyFulfilled?: boolean }> {
  const {
    supabase,
    userId,
    stripeSessionId,
    stripePaymentIntentId,
    priceId,
    creditsAmount,
    amountCents,
    currency,
  } = opts;

  const { data: existing } = await supabase
    .from('credit_purchases')
    .select('id')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, alreadyFulfilled: true };
  }

  const { error: purchaseErr } = await supabase.from('credit_purchases').insert({
    user_id: userId,
    stripe_session_id: stripeSessionId,
    stripe_payment_intent_id: stripePaymentIntentId || null,
    price_id: priceId,
    credits_amount: creditsAmount,
    amount_cents: amountCents ?? null,
    currency: currency || 'usd',
  });

  if (purchaseErr) {
    if (String(purchaseErr.code) === '23505') {
      return { ok: true, alreadyFulfilled: true };
    }
    return { ok: false, error: purchaseErr.message || String(purchaseErr) };
  }

  const { data: sub, error: subErr } = await supabase
    .from('user_subscriptions')
    .select('ai_purchased_credits_balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (subErr || !sub) {
    return { ok: false, error: subErr?.message || 'Subscription row not found' };
  }

  const current = Number.isFinite(Number(sub.ai_purchased_credits_balance))
    ? Number(sub.ai_purchased_credits_balance)
    : 0;

  const { error: updErr } = await supabase
    .from('user_subscriptions')
    .update({
      ai_purchased_credits_balance: current + creditsAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updErr) {
    return { ok: false, error: updErr.message || String(updErr) };
  }

  return { ok: true };
}
