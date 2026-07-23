import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'stripe'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  customPriceIdForCredits,
  fulfillCreditPackPurchase,
  getCreditAmountForPriceId,
} from '../_shared/credit_packs.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

/**
 * Map Stripe Price ID to subscription tier
 * Update these Price IDs with your actual Stripe Price IDs from the dashboard
 */
function getTierFromPriceId(priceId: string): 'free' | 'basic' | 'premium' {
  // TODO: Replace these with your actual Stripe Price IDs
  // Get these from Stripe Dashboard → Products → [Your Product] → Pricing
  
  // Basic tier price IDs ($0.99/week, $1.99/month, $9.99/year)
  const BASIC_PRICE_IDS = [
    'price_1SsbbHLOdeLTrjapgaZzEbBt', // Basic Weekly
    'price_1SsbTZLOdeLTrjap9UnXhu0M', // Basic Monthly
    'price_1SsbBDLOdeLTrjapHTq7yxng', // Basic Yearly
  ]
  
  // Premium/Enhanced tier price IDs ($3.99/week, $9.99/month, $49.99/year)
  const PREMIUM_PRICE_IDS = [
    'price_1Tf3UoLOdeLTrjap4O8BGFvS', // Premium Weekly ($3.99/wk) — new checkouts
    'price_1SaMM0LOdeLTrjapKLTHBByC', // Premium Weekly ($1.99/wk) — legacy
    'price_1SUYs3LOdeLTrjapCFFDe7td', // Premium Monthly ($9.99/mo)
    'price_1SaMNJLOdeLTrjapjJ8iCoP7', // Premium Yearly
  ]
  
  if (BASIC_PRICE_IDS.includes(priceId)) {
    return 'basic'
  }
  if (PREMIUM_PRICE_IDS.includes(priceId)) {
    return 'premium'
  }
  
  // Default to free if price ID not recognized
  console.warn(`Unknown price ID: ${priceId}, defaulting to 'free'`)
  return 'free'
}

function getPriceIdFromSubscription(subscription: any): string | null {
  try {
    const items = subscription.items?.data || []
    const priceId = items[0]?.price?.id
    return priceId ? String(priceId) : null
  } catch (_) {
    return null
  }
}

/** Normalize Stripe id fields that may arrive as a string or expanded object. */
function getStripeId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    const id = (value as { id: string }).id
    return id || null
  }
  return null
}

function unixSecondsToIso(sec: unknown): string | null {
  const n = typeof sec === 'number' ? sec : Number(sec)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n * 1000).toISOString()
}

/**
 * Billing period end for entitlements / credit reset.
 * Basil+ (2025-03-31.basil): period lives on subscription items.
 * Classic / our pinned apiVersion: may still expose subscription.current_period_end.
 * Prefer items.data[0], then max item end, then top-level fallback.
 */
function getPeriodEndIso(subscription: any): string | null {
  try {
    const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : []
    if (items.length > 0) {
      const fromFirst = unixSecondsToIso(items[0]?.current_period_end)
      if (fromFirst) return fromFirst

      let maxSec = 0
      for (const item of items) {
        const n = Number(item?.current_period_end)
        if (Number.isFinite(n) && n > maxSec) maxSec = n
      }
      const fromMax = unixSecondsToIso(maxSec)
      if (fromMax) return fromMax
    }

    return unixSecondsToIso(subscription?.current_period_end)
  } catch (_) {
    return null
  }
}

/** Invoice to subscription id (classic invoice.subscription + Basil parent path). */
function getSubscriptionIdFromInvoice(invoice: any): string | null {
  return (
    getStripeId(invoice?.subscription)
    || getStripeId(invoice?.parent?.subscription_details?.subscription)
    || null
  )
}

function getTextCreditPolicyFromPriceId(priceId: string | null): { grant: number; cap: number } | null {
  if (!priceId) return null

  switch (priceId) {
    case 'price_1Tf3UoLOdeLTrjap4O8BGFvS': // Premium Weekly ($3.99/wk)
    case 'price_1SaMM0LOdeLTrjapKLTHBByC': // Premium Weekly ($1.99/wk)
      return { grant: 4_000, cap: 20_000 }
    case 'price_1SUYs3LOdeLTrjapCFFDe7td': // Premium Monthly ($9.99/mo)
      return { grant: 35_000, cap: 35_000 }
    case 'price_1SaMNJLOdeLTrjapjJ8iCoP7': // Premium Yearly ($49.99/yr)
      return { grant: 500_000, cap: 500_000 }
    default:
      return null
  }
}

function getImageCreditsLimitFromPriceId(priceId: string | null): number | null {
  return null
}

function getTextCreditsLimitFromPriceId(priceId: string | null): number | null {
  return getTextCreditPolicyFromPriceId(priceId)?.grant ?? null
}

function computeRolledTextCredits(opts: {
  existingLimit?: number | null,
  existingUsed?: number | null,
  previousPriceId?: string | null,
  nextPriceId?: string | null,
  previousPeriodEndIso?: string | null,
  nextPeriodEndIso?: string | null,
}): { limit: number | null, used: number | null } {
  const {
    existingLimit,
    existingUsed,
    previousPriceId,
    nextPriceId,
    previousPeriodEndIso,
    nextPeriodEndIso,
  } = opts

  const policy = getTextCreditPolicyFromPriceId(nextPriceId || null)
  if (!policy) return { limit: null, used: null }

  const prevEndMs = previousPeriodEndIso ? Date.parse(previousPeriodEndIso) : NaN
  const nextEndMs = nextPeriodEndIso ? Date.parse(nextPeriodEndIso) : NaN
  const priceChanged = !!previousPriceId && previousPriceId !== nextPriceId
  const periodAdvanced = priceChanged
    || !Number.isFinite(prevEndMs)
    || !Number.isFinite(nextEndMs)
    || nextEndMs > prevEndMs + 10 * 60 * 1000

  if (!periodAdvanced && Number.isFinite(Number(existingLimit)) && Number(existingLimit) > 0) {
    return {
      limit: Number(existingLimit),
      used: Number.isFinite(Number(existingUsed)) ? Number(existingUsed) : 0,
    }
  }

  if (policy.cap > policy.grant) {
    const remaining = Math.max(0, Number(existingLimit || 0) - Math.max(0, Number(existingUsed || 0)))
    return { limit: Math.min(policy.cap, remaining + policy.grant), used: 0 }
  }

  return { limit: policy.grant, used: 0 }
}

async function findSubscriptionByEmailOrStripeId(opts: {
  supabase: any,
  email: string,
  stripeSubscriptionId?: string | null,
}) {
  const { supabase, email, stripeSubscriptionId } = opts
  const cleanEmail = String(email || '').trim()

  if (stripeSubscriptionId) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, email, stripe_price_id, stripe_current_period_end, ai_text_credits_limit, ai_text_credits_used')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      return { ok: true, row: data }
    }
  }

  if (!cleanEmail) return { ok: false, error: 'Missing email' }

  const { data: row, error: findErr } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, email, stripe_price_id, stripe_current_period_end, ai_text_credits_limit, ai_text_credits_used')
    .ilike('email', cleanEmail)
    .limit(1)
    .maybeSingle()

  if (findErr || !row) {
    return { ok: false, error: findErr || 'No user_subscriptions row found for email' }
  }

  return { ok: true, row }
}

async function updateSubscriptionByEmailOrStripeId(opts: {
  supabase: any,
  email: string,
  stripeSubscriptionId?: string | null,
  update: Record<string, any>,
}) {
  const { supabase, email, stripeSubscriptionId, update } = opts

  const existing = await findSubscriptionByEmailOrStripeId({ supabase, email, stripeSubscriptionId })
  if (!existing.ok || !existing.row) {
    return existing
  }

  const { error: updErr } = await supabase
    .from('user_subscriptions')
    .update(update)
    .eq('user_id', existing.row.user_id)

  if (updErr) {
    return { ok: false, error: updErr }
  }
  return { ok: true, row: existing.row }
}

/**
 * Get subscription tier from Stripe subscription object
 */
async function getTierFromSubscription(subscription: any): Promise<'free' | 'basic' | 'premium'> {
  try {
    // Get the price ID from the subscription's items
    const items = subscription.items?.data || []
    if (items.length === 0) {
      return 'free'
    }
    
    // Get the first price ID (most subscriptions have one price)
    const priceId = items[0]?.price?.id
    if (!priceId) {
      return 'free'
    }
    
    return getTierFromPriceId(priceId)
  } catch (error) {
    console.error('Error getting tier from subscription:', error)
    return 'free'
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  try {
    // Get raw body for signature verification
    const body = await req.text()
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    // Deno uses SubtleCrypto; Stripe requires the async variant for webhook verification in this runtime.
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret || ''
    )

    console.log('Webhook event received:', event.type)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Handle different event types
    // IMPORTANT: Do not fail the webhook delivery for downstream DB/Stripe issues.
    // After signature verification succeeds, we return 2xx and rely on logs for debugging.
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          console.log('Checkout session completed:', session.id)

          // One-time credit pack purchase (mode=payment)
          if (session.mode === 'payment') {
            const meta = session.metadata || {}
            const purchaseType = String(meta.purchase_type || '')
            const userId = String(meta.supabase_user_id || '')
            const priceKind = String(meta.price_kind || '')
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
            const linePriceId = lineItems?.data?.[0]?.price?.id ? String(lineItems.data[0].price.id) : ''
            const metaCredits = Number(meta.credit_amount) || 0
            const priceId = linePriceId
              || (priceKind === 'custom' && metaCredits > 0 ? customPriceIdForCredits(metaCredits) : '')
            const creditAmount = metaCredits || getCreditAmountForPriceId(linePriceId) || 0

            if (purchaseType === 'credit_pack' && userId && priceId && creditAmount > 0) {
              const res = await fulfillCreditPackPurchase({
                supabase,
                userId,
                stripeSessionId: session.id,
                stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
                priceId,
                creditsAmount: creditAmount,
                amountCents: session.amount_total ?? null,
                currency: session.currency ?? 'usd',
              })

              if (!res.ok) {
                console.error('Credit pack fulfillment failed:', res.error)
              } else {
                console.log(`Credit pack fulfilled for ${userId}: +${creditAmount} credits (session=${session.id})`)
              }
            } else {
              console.warn('Payment checkout completed but not a credit pack or missing metadata:', {
                purchaseType,
                userId,
                priceId,
                creditAmount,
              })
            }
            break
          }

          // Prefer checkout.session.completed for subscription activation (not payment_intent alone).
          const customerEmail = session.customer_email || session.customer_details?.email
          const subscriptionId = getStripeId(session.subscription)

          if (session.mode === 'subscription' && (!customerEmail || !subscriptionId)) {
            console.warn('Subscription checkout completed but email/subscription missing; waiting for customer.subscription.*', {
              sessionId: session.id,
              hasEmail: !!customerEmail,
              hasSubscription: !!subscriptionId,
            })
          }

          if (customerEmail && subscriptionId) {
            // Fetch subscription from Stripe to get price ID + Basil-safe period fields
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const tier = await getTierFromSubscription(subscription)
            const priceId = getPriceIdFromSubscription(subscription)
            const periodEndIso = getPeriodEndIso(subscription)
            const existing = await findSubscriptionByEmailOrStripeId({
              supabase,
              email: customerEmail,
              stripeSubscriptionId: subscriptionId,
            })

            const isPremium = tier === 'premium'
            const imageCreditsLimit = isPremium ? (getImageCreditsLimitFromPriceId(priceId) ?? null) : null
            const textCreditState = isPremium
              ? computeRolledTextCredits({
                  existingLimit: existing.row?.ai_text_credits_limit,
                  existingUsed: existing.row?.ai_text_credits_used,
                  previousPriceId: existing.row?.stripe_price_id,
                  nextPriceId: priceId,
                  previousPeriodEndIso: existing.row?.stripe_current_period_end,
                  nextPeriodEndIso: periodEndIso,
                })
              : { limit: null, used: null }
            const resetAt = isPremium ? (periodEndIso || null) : null
            
            const update = {
              email: customerEmail,
              subscription_tier: tier,
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              stripe_current_period_end: periodEndIso,
              ai_image_credits_limit: imageCreditsLimit,
              ai_image_credits_used: null,
              ai_image_credits_reset_at: null,
              ai_text_credits_limit: textCreditState.limit,
              ai_text_credits_used: textCreditState.used,
              ai_text_credits_reset_at: resetAt,
              updated_at: new Date().toISOString(),
            }

            const res = await updateSubscriptionByEmailOrStripeId({
              supabase,
              email: customerEmail,
              stripeSubscriptionId: subscriptionId,
              update,
            })

            if (!res.ok) {
              console.error('Error updating subscription:', res.error)
            } else {
              console.log(`Subscription activated for ${customerEmail}: tier=${tier}, price=${priceId}, period_end=${periodEndIso}`)
            }
          }
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object
          console.log('Subscription updated:', subscription.id)
          
          const customer = await stripe.customers.retrieve(subscription.customer as string)
          const email = (customer as any).email
          
          if (email) {
            const status = subscription.status === 'active' ? 'active' : 
                          subscription.status === 'past_due' ? 'past_due' :
                          subscription.status === 'canceled' ? 'canceled' : 'inactive'
            
            // Get tier from subscription (in case user upgraded/downgraded)
            const tier = await getTierFromSubscription(subscription)
            
            // If subscription is canceled, set tier to 'free'
            const finalTier = status === 'canceled' ? 'free' : tier

            const priceId = getPriceIdFromSubscription(subscription)
            const periodEndIso = getPeriodEndIso(subscription)
            const existing = await findSubscriptionByEmailOrStripeId({
              supabase,
              email,
              stripeSubscriptionId: subscription.id,
            })
            const isPremium = finalTier === 'premium'
            const imageCreditsLimit = isPremium ? (getImageCreditsLimitFromPriceId(priceId) ?? null) : null
            const textCreditState = isPremium
              ? computeRolledTextCredits({
                  existingLimit: existing.row?.ai_text_credits_limit,
                  existingUsed: existing.row?.ai_text_credits_used,
                  previousPriceId: existing.row?.stripe_price_id,
                  nextPriceId: priceId,
                  previousPeriodEndIso: existing.row?.stripe_current_period_end,
                  nextPeriodEndIso: periodEndIso,
                })
              : { limit: null, used: null }
            const resetAt = isPremium ? (periodEndIso || null) : null
            
            const update: any = {
              subscription_tier: finalTier,
              subscription_status: status,
              stripe_price_id: priceId,
              stripe_current_period_end: periodEndIso,
              ai_image_credits_limit: imageCreditsLimit,
              ai_image_credits_reset_at: null,
              ai_text_credits_limit: textCreditState.limit,
              ai_text_credits_reset_at: resetAt,
              updated_at: new Date().toISOString(),
            }

            if (isPremium) {
              update.ai_image_credits_used = null
              update.ai_text_credits_used = textCreditState.used
            }
            // If canceled/downgraded, clear credits.
            if (!isPremium) {
              update.ai_image_credits_used = null
              update.ai_text_credits_used = null
            }

            const res = await updateSubscriptionByEmailOrStripeId({
              supabase,
              email,
              stripeSubscriptionId: subscription.id,
              update,
            })

            if (!res.ok) {
              console.error('Error updating subscription status:', res.error)
            } else {
              console.log(`Subscription updated: tier=${finalTier}, status=${status}, price=${priceId}, period_end=${periodEndIso}`)
            }
          }
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          console.log('Subscription deleted:', subscription.id)
          
          const customer = await stripe.customers.retrieve(subscription.customer as string) as any
          const email = customer?.email ? String(customer.email) : ''

          const update = {
            subscription_tier: 'free',
            subscription_status: 'canceled',
            stripe_price_id: null,
            stripe_current_period_end: null,
            ai_image_credits_limit: null,
            ai_image_credits_used: null,
            ai_image_credits_reset_at: null,
            ai_text_credits_limit: null,
            ai_text_credits_used: null,
            ai_text_credits_reset_at: null,
            updated_at: new Date().toISOString(),
          }

          const res = await updateSubscriptionByEmailOrStripeId({
            supabase,
            email,
            stripeSubscriptionId: subscription.id,
            update,
          })

          if (!res.ok) {
            console.error('Error canceling subscription:', res.error)
          } else {
            console.log('Subscription canceled')
          }
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          console.log('Payment failed for invoice:', invoice.id)

          const failedSubscriptionId = getSubscriptionIdFromInvoice(invoice)
          if (failedSubscriptionId) {
            const { error } = await supabase
              .from('user_subscriptions')
              .update({
                subscription_status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', failedSubscriptionId)

            if (error) {
              console.error('Error updating payment failure:', error)
            }
          } else {
            console.warn('invoice.payment_failed missing subscription id', { invoiceId: invoice.id })
          }
          break
        }

        default:
          console.log('Unhandled event type:', event.type)
      }
    } catch (handlerError) {
      console.error('Webhook handler error:', handlerError)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: (error as any)?.message || String(error) }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})




