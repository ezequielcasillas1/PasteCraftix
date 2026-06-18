import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'stripe'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireNotBanned } from '../_shared/security-gate.ts'
import {
  calculatePriceCents,
  getCreditAmountForPriceId,
  isCreditPackPriceId,
  meetsStripeMinimum,
  parseCustomCreditAmount,
  STRIPE_MIN_AMOUNT_CENTS,
} from '../_shared/credit_packs.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isAllowedRedirectUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw || ''))
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'pastecraft.com' || host.endsWith('.pastecraft.com')) return true
    if (host.endsWith('.chromiumapp.org')) return true
    return false
  } catch (_) {
    return false
  }
}

// Buying credit packs is itself a way to obtain AI usage, so any authenticated
// user (free / basic / coupon months_free / premium) may purchase. The only
// case we block is unlimited-AI users (e.g. the "unlimited" coupon): they
// already have infinite AI, so a credit purchase would be wasted money — we
// return a clear message instead of silently letting them pay.
async function requireCreditPurchaseEligibility(supabase: any, userId: string): Promise<Response | null> {
  const { data: sub, error } = await supabase
    .from('user_subscriptions')
    .select('has_unlimited_ai')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Unable to verify account' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }

  if (sub?.has_unlimited_ai === true) {
    return new Response(
      JSON.stringify({ error: 'You already have unlimited AI access — credit packs are not needed.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
    )
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const banResponse = await requireNotBanned(user.id, supabase)
    if (banResponse) return banResponse

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentEvents } = await supabase
      .from('security_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'checkout_attempt')
      .gte('triggered_at', oneHourAgo)

    const recentCount = recentEvents?.length ?? 0

    await supabase.from('security_events').insert({
      user_id: user.id,
      event_type: 'checkout_attempt',
      severity: 'low',
      details: { email: user.email },
      auto_banned: false,
    })

    if (recentCount >= 10) {
      await supabase.from('security_events').insert({
        user_id: user.id,
        event_type: 'checkout_fraud',
        severity: 'high',
        details: { checkout_attempts_1h: recentCount + 1, email: user.email },
        auto_banned: false,
      })
      return new Response(
        JSON.stringify({ error: 'Too many checkout attempts. Please contact support.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 },
      )
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const body = await req.json()
    const priceId = String(body?.priceId || body?.price_id || '').trim()
    const rawCreditAmount = body?.creditAmount ?? body?.credit_amount ?? body?.credits
    const hasCustomCredits = rawCreditAmount != null && rawCreditAmount !== ''
    const successUrl = body?.successUrl || body?.success_url
    const cancelUrl = body?.cancelUrl || body?.cancel_url
    const requestedMode = String(body?.mode || '').toLowerCase()

    if (!priceId && !hasCustomCredits) {
      throw new Error('Price ID or credit amount is required')
    }

    const isPresetCreditPack = priceId ? isCreditPackPriceId(priceId) : false
    const isCustomCreditPack = hasCustomCredits && !priceId

    if (hasCustomCredits && priceId && !isPresetCreditPack) {
      throw new Error('Provide either priceId or custom credits, not both')
    }

    if (isPresetCreditPack || isCustomCreditPack) {
      const eligibilityGate = await requireCreditPurchaseEligibility(supabase, user.id)
      if (eligibilityGate) return eligibilityGate
    }

    const safeSuccess = isAllowedRedirectUrl(successUrl)
      ? successUrl
      : 'https://pastecraft.com/success.html?session_id={CHECKOUT_SESSION_ID}'
    const safeCancel = isAllowedRedirectUrl(cancelUrl)
      ? cancelUrl
      : 'https://pastecraft.com/pricing.html'

    let checkoutMode = requestedMode === 'payment' ? 'payment' : 'subscription'
    let creditAmount: number | null = null
    let metadata: Record<string, string> = { supabase_user_id: user.id }
    let lineItems: Record<string, unknown>[] = []

    if (isCustomCreditPack) {
      creditAmount = parseCustomCreditAmount(rawCreditAmount)
      const amountCents = calculatePriceCents(creditAmount)

      if (!meetsStripeMinimum(creditAmount)) {
        throw new Error(
          `Minimum Stripe charge is $${(STRIPE_MIN_AMOUNT_CENTS / 100).toFixed(2)}. Buy at least 100 credits.`,
        )
      }

      checkoutMode = 'payment'

      metadata = {
        ...metadata,
        purchase_type: 'credit_pack',
        price_kind: 'custom',
        credit_amount: String(creditAmount),
        amount_cents: String(amountCents),
      }

      lineItems = [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `${creditAmount.toLocaleString()} AI Credits`,
            description: `PasteCraft custom credit purchase (${creditAmount.toLocaleString()} credits)`,
          },
        },
        quantity: 1,
      }]
    } else {
      if (!priceId) throw new Error('Price ID is required')

      checkoutMode = isPresetCreditPack ? 'payment' : checkoutMode
      creditAmount = isPresetCreditPack ? getCreditAmountForPriceId(priceId) : null

      if (isPresetCreditPack && creditAmount) {
        metadata.purchase_type = 'credit_pack'
        metadata.price_kind = 'preset'
        metadata.credit_amount = String(creditAmount)
      }

      lineItems = [{ price: priceId, quantity: 1 }]
    }

    const sessionParams: Record<string, unknown> = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: checkoutMode,
      success_url: safeSuccess,
      cancel_url: safeCancel,
      metadata,
      customer_email: user.email || undefined,
    }

    if (checkoutMode === 'payment') {
      sessionParams.payment_intent_data = { metadata }
    }

    const session = await stripe.checkout.sessions.create(sessionParams as any)

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        credits: creditAmount,
        amountCents: metadata.amount_cents ? Number(metadata.amount_cents) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
