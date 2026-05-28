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
