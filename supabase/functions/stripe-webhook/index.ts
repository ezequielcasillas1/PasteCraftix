import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  
  // Premium/Enhanced tier price IDs ($1.99/week, $4.99/month, $49.99/year)
  const PREMIUM_PRICE_IDS = [
    'price_1SaMM0LOdeLTrjapKLTHBByC', // Premium Weekly
    'price_1SUYs3LOdeLTrjapCFFDe7td', // Premium Monthly
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

function getPeriodEndIso(subscription: any): string | null {
  try {
    const sec = subscription?.current_period_end
    const n = typeof sec === 'number' ? sec : Number(sec)
    if (!Number.isFinite(n) || n <= 0) return null
    return new Date(n * 1000).toISOString()
  } catch (_) {
    return null
  }
}

function getImageCreditsLimitFromPriceId(priceId: string | null): number | null {
  if (!priceId) return null

  // Enhanced tier credits (DALL·E 3 @ 1024 standard, ~50% cost coverage)
  switch (priceId) {
    case 'price_1SaMM0LOdeLTrjapKLTHBByC': // Premium Weekly ($1.99/wk)
      return 24
    case 'price_1SUYs3LOdeLTrjapCFFDe7td': // Premium Monthly ($4.99/mo)
      return 62
    case 'price_1SaMNJLOdeLTrjapjJ8iCoP7': // Premium Yearly ($49.99/yr)
      return 624
    default:
      return null
  }
}

function getTextCreditsLimitFromPriceId(priceId: string | null): number | null {
  if (!priceId) return null

  // Text AI credits (GPT-4o @ ~$0.005/call, ~50% cost coverage)
  switch (priceId) {
    case 'price_1SaMM0LOdeLTrjapKLTHBByC': // Premium Weekly ($1.99/wk)
      return 100
    case 'price_1SUYs3LOdeLTrjapCFFDe7td': // Premium Monthly ($4.99/mo)
      return 250
    case 'price_1SaMNJLOdeLTrjapjJ8iCoP7': // Premium Yearly ($49.99/yr)
      return 2500
    default:
      return null
  }
}

async function updateSubscriptionByEmailOrStripeId(opts: {
  supabase: any,
  email: string,
  stripeSubscriptionId?: string | null,
  update: Record<string, any>,
}) {
  const { supabase, email, stripeSubscriptionId, update } = opts
  const cleanEmail = String(email || '').trim()
  if (!cleanEmail) return { ok: false, error: 'Missing email' }

  // Prefer matching by stripe_subscription_id when available.
  if (stripeSubscriptionId) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(update)
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .select('id')

    if (!error && Array.isArray(data) && data.length > 0) {
      return { ok: true }
    }
  }

  // Fallback: match by email (pricing page checkout flow doesn't attach user_id).
  const { data: row, error: findErr } = await supabase
    .from('user_subscriptions')
    .select('user_id, email')
    .ilike('email', cleanEmail)
    .limit(1)
    .maybeSingle()

  if (findErr || !row) {
    return { ok: false, error: findErr || 'No user_subscriptions row found for email' }
  }

  const { error: updErr } = await supabase
    .from('user_subscriptions')
    .update(update)
    .eq('user_id', row.user_id)

  if (updErr) {
    return { ok: false, error: updErr }
  }
  return { ok: true }
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
          
          // Get customer email and subscription ID
          const customerEmail = session.customer_email || session.customer_details?.email
          const subscriptionId = session.subscription as string
          
          if (customerEmail && subscriptionId) {
            // Fetch subscription from Stripe to get price ID
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const tier = await getTierFromSubscription(subscription)
            const priceId = getPriceIdFromSubscription(subscription)
            const periodEndIso = getPeriodEndIso(subscription)

            const isPremium = tier === 'premium'
            const imageCreditsLimit = isPremium ? (getImageCreditsLimitFromPriceId(priceId) ?? null) : null
            const textCreditsLimit = isPremium ? (getTextCreditsLimitFromPriceId(priceId) ?? null) : null
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
              ai_image_credits_used: isPremium ? 0 : null,
              ai_image_credits_reset_at: resetAt,
              ai_text_credits_limit: textCreditsLimit,
              ai_text_credits_used: isPremium ? 0 : null,
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
            const isPremium = finalTier === 'premium'
            const imageCreditsLimit = isPremium ? (getImageCreditsLimitFromPriceId(priceId) ?? null) : null
            const textCreditsLimit = isPremium ? (getTextCreditsLimitFromPriceId(priceId) ?? null) : null
            const resetAt = isPremium ? (periodEndIso || null) : null
            
            const update: any = {
              subscription_tier: finalTier,
              subscription_status: status,
              stripe_price_id: priceId,
              stripe_current_period_end: periodEndIso,
              ai_image_credits_limit: imageCreditsLimit,
              ai_image_credits_reset_at: resetAt,
              ai_text_credits_limit: textCreditsLimit,
              ai_text_credits_reset_at: resetAt,
              updated_at: new Date().toISOString(),
            }

            // If (re)activated into premium, reset credits at the start of a new period.
            if (isPremium && periodEndIso) {
              update.ai_image_credits_used = 0
              update.ai_text_credits_used = 0
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
          
          if (invoice.subscription) {
            const { error } = await supabase
              .from('user_subscriptions')
              .update({
                subscription_status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', invoice.subscription as string)

            if (error) {
              console.error('Error updating payment failure:', error)
            }
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




