import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseBearerToken(authHeader: string | null) {
  const raw = String(authHeader || '')
  const lower = raw.toLowerCase()
  if (!lower.startsWith('bearer ')) return ''
  return raw.slice(7).trim()
}

function computeCreditsLimitFallback(resetAtIso: string | null) {
  // Best-effort heuristic based on time remaining.
  // - weekly ≈ <= 10 days → 24 credits
  // - monthly ≈ <= 40 days → 62 credits
  // - yearly otherwise → 624 credits
  try {
    if (!resetAtIso) return 62
    const resetMs = Date.parse(resetAtIso)
    if (!Number.isFinite(resetMs)) return 62
    const diffDays = (resetMs - Date.now()) / 86400000
    if (diffDays <= 10) return 24
    if (diffDays <= 40) return 62
    return 624
  } catch (_) {
    return 62
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // =====================================================
    // AUTH + SUBSCRIPTION LOOKUP (credits are enforced server-side)
    // =====================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase env not configured')
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const token = parseBearerToken(req.headers.get('authorization'))
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    const user = userData?.user || null
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Pull subscription/credit state
    const { data: sub, error: subErr } = await supabase
      .from('user_subscriptions')
      .select([
        'user_id',
        'email',
        'subscription_tier',
        'subscription_status',
        'has_unlimited_ai',
        'ai_access_expires_at',
        'stripe_current_period_end',
        'ai_image_credits_limit',
        'ai_image_credits_used',
        'ai_image_credits_reset_at',
      ].join(','))
      .eq('user_id', user.id)
      .maybeSingle()

    if (subErr || !sub) {
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const tier = String(sub.subscription_tier || '').toLowerCase()
    const status = String(sub.subscription_status || '').toLowerCase()

    const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN
    const hasCouponAiAccess = !!(sub && (
      sub.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ))

    const isPaidPremium = (tier === 'premium' || tier === 'admin') && (status === 'active' || status === 'past_due')
    const entitled = isPaidPremium || hasCouponAiAccess

    if (!entitled) {
      return new Response(
        JSON.stringify({ error: 'Upgrade required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const unlimited = sub.has_unlimited_ai === true || tier === 'admin'

    // Determine reset timestamp (next billing / next refresh)
    const stripePeriodEndIso = sub.stripe_current_period_end
      ? new Date(sub.stripe_current_period_end).toISOString()
      : null
    let resetAtIso = sub.ai_image_credits_reset_at
      ? new Date(sub.ai_image_credits_reset_at).toISOString()
      : (stripePeriodEndIso || null)

    // Coupon-only access (months_free) has no Stripe period end → create a rolling 30-day window.
    if (!resetAtIso && hasCouponAiAccess && !unlimited) {
      resetAtIso = new Date(Date.now() + 30 * 86400000).toISOString()
    }

    // Normalize used/limit
    let creditsUsed = Number.isFinite(Number(sub.ai_image_credits_used)) ? Number(sub.ai_image_credits_used) : 0
    let creditsLimit = Number.isFinite(Number(sub.ai_image_credits_limit)) ? Number(sub.ai_image_credits_limit) : NaN
    if (!Number.isFinite(creditsLimit) || creditsLimit <= 0) {
      creditsLimit = unlimited ? Number.POSITIVE_INFINITY : computeCreditsLimitFallback(resetAtIso)
    }

    // Refresh window: if reset passed, or Stripe period end moved forward, reset usage.
    if (!unlimited) {
      const nowMs = Date.now()
      const resetMs = resetAtIso ? Date.parse(resetAtIso) : NaN
      const stripeMs = stripePeriodEndIso ? Date.parse(stripePeriodEndIso) : NaN
      const shouldResetForTime = Number.isFinite(resetMs) && nowMs >= resetMs
      const shouldResetForStripeShift = Number.isFinite(stripeMs) && Number.isFinite(resetMs) && (stripeMs > resetMs + 10 * 60 * 1000)

      if (shouldResetForTime || shouldResetForStripeShift) {
        creditsUsed = 0
        // Prefer Stripe period end if it's in the future; otherwise roll forward 30 days.
        if (Number.isFinite(stripeMs) && stripeMs > nowMs) {
          resetAtIso = new Date(stripeMs).toISOString()
        } else {
          resetAtIso = new Date(nowMs + 30 * 86400000).toISOString()
        }

        // Persist refreshed state (best-effort).
        await supabase
          .from('user_subscriptions')
          .update({
            ai_image_credits_used: 0,
            ai_image_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
            ai_image_credits_reset_at: resetAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else if (!sub.ai_image_credits_reset_at && resetAtIso) {
        // Backfill reset timestamp if missing.
        await supabase
          .from('user_subscriptions')
          .update({
            ai_image_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
            ai_image_credits_reset_at: resetAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
    }

    if (!unlimited) {
      const remaining = Math.max(0, Number(creditsLimit) - Math.max(0, creditsUsed))
      if (remaining <= 0) {
        return new Response(
          JSON.stringify({ error: 'No credits remaining', creditsRemaining: 0, creditsLimit, creditsResetAt: resetAtIso }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const { prompt, type, animalType, imageBase64 } = body || {}
    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)

    let finalPrompt: string

    if (type === 'animal' && animalType) {
      // Animal avatar generation
      const animalTraits: Record<string, string> = {
        'Rabbit': 'cute, fluffy, energetic, with long ears',
        'Tiger': 'fierce, powerful, majestic, with bold stripes',
        'Dragon': 'mythical, wise, powerful, with scales and wings',
        'Fox': 'clever, sly, elegant, with a fluffy tail',
        'Wolf': 'loyal, fierce, pack leader, with piercing eyes',
        'Bear': 'strong, protective, cuddly yet powerful',
        'Panda': 'peaceful, zen, adorable, black and white',
        'Lion': 'regal, brave, king of the jungle, with majestic mane',
        'Eagle': 'soaring, free, sharp-eyed, patriotic',
        'Phoenix': 'mythical, reborn from fire, radiant, immortal',
        'Owl': 'wise, nocturnal, mysterious, with big eyes',
        'Cat': 'independent, graceful, mysterious, with whiskers',
        'Dog': 'loyal, friendly, playful, mans best friend'
      }
      const trait = animalTraits[animalType] || 'cool, funky, energetic'
      finalPrompt = `Create a single ultra-funky cartoon ${animalType} character avatar. The ${animalType} is ${trait}. Style: vibrant neon colors (pink, cyan, yellow, purple), bold thick black outlines, modern animated/anime style, playful and full of energy. The ${animalType} is anthropomorphic - standing upright on two legs, wearing cool streetwear or accessories, expressive face with personality. Background: simple gradient or solid color. Composition: portrait style, centered, showing character from chest up. Make it colorful, fun, and bursting with character! Show ONLY ONE ${animalType}, no other animals or people.`
    } else if (type === 'cartoon' && imageBase64) {
      // Analyze uploaded photo first
      const visionPayload = {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this person\'s appearance in detail for creating a cartoon avatar. Include: hair color/style, skin tone, facial features, any distinctive characteristics. Be specific but brief (2-3 sentences).'
              },
              {
                type: 'image_url',
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
        max_tokens: 200
      }

      const { data: visionData } = await fetchChatCompletionsWithModelFallback(openaiKey, visionPayload, models.chatVisionModel)
      const personDescription = String(visionData?.choices?.[0]?.message?.content || '').trim()

      finalPrompt = `Create a single funky cartoon avatar portrait of this person: ${personDescription}. Style: vibrant colors, bold black outlines, modern cartoon/animated character style, playful and fun. Show ONLY ONE person, centered, portrait orientation. Make it colorful and energetic while keeping their recognizable features.`
    } else if (prompt) {
      finalPrompt = prompt
    } else {
      throw new Error('Invalid request: provide prompt, animal type, or image')
    }

    // Generate image with DALL-E 3
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: models.imageGenerationModel,
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'DALL-E API error')
    }

    const data = await response.json()
    const imageUrl = data.data[0].url

    // =====================================================
    // DECREMENT CREDITS (success-only)
    // =====================================================
    let creditsRemaining: number | null = null
    let creditsResetAt: string | null = resetAtIso || null
    let creditsLimitOut: number | null = unlimited ? null : Number(creditsLimit)

    if (!unlimited) {
      // Compare-and-set update to avoid simple double-spend races.
      let updatedUsed: number | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const expectedUsed = creditsUsed
        const nextUsed = expectedUsed + 1

        const q = supabase
          .from('user_subscriptions')
          .update({
            ai_image_credits_used: nextUsed,
            ai_image_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
            ai_image_credits_reset_at: resetAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('ai_image_credits_used', expectedUsed)

        const { data: updated, error: updErr } = await q.select('ai_image_credits_used, ai_image_credits_limit, ai_image_credits_reset_at').maybeSingle()
        if (!updErr && updated) {
          updatedUsed = Number(updated.ai_image_credits_used)
          creditsLimitOut = Number.isFinite(Number(updated.ai_image_credits_limit)) ? Number(updated.ai_image_credits_limit) : Number(creditsLimit)
          creditsResetAt = updated.ai_image_credits_reset_at ? new Date(updated.ai_image_credits_reset_at).toISOString() : creditsResetAt
          break
        }

        // Re-fetch and retry if needed
        const { data: refetched } = await supabase
          .from('user_subscriptions')
          .select('ai_image_credits_used, ai_image_credits_limit, ai_image_credits_reset_at')
          .eq('user_id', user.id)
          .maybeSingle()

        creditsUsed = Number.isFinite(Number(refetched?.ai_image_credits_used)) ? Number(refetched?.ai_image_credits_used) : creditsUsed
        creditsLimit = Number.isFinite(Number(refetched?.ai_image_credits_limit)) ? Number(refetched?.ai_image_credits_limit) : creditsLimit
        resetAtIso = refetched?.ai_image_credits_reset_at ? new Date(refetched.ai_image_credits_reset_at).toISOString() : resetAtIso
      }

      const finalUsed = updatedUsed ?? (creditsUsed + 1)
      const finalLimit = Number.isFinite(Number(creditsLimitOut)) ? Number(creditsLimitOut) : Number(creditsLimit)
      creditsRemaining = Math.max(0, finalLimit - Math.max(0, finalUsed))
    }

    return new Response(
      JSON.stringify({
        imageUrl,
        creditsRemaining,
        creditsLimit: creditsLimitOut,
        creditsResetAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


