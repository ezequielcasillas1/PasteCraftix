import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { couponCode } = await req.json()

    if (!couponCode) {
      throw new Error('Coupon code is required')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Brute-force protection: Check recent attempts (5 per hour limit)
    const { data: recentAttempts, error: attemptsError } = await supabase
      .from('coupon_attempt_log')
      .select('id')
      .eq('user_id', user.id)
      .gte('attempted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if (!attemptsError && recentAttempts && recentAttempts.length >= 5) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many coupon attempts. Please try again in an hour.',
          attemptsRemaining: 0,
          resetIn: '1 hour'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Log this attempt (will be marked success/failure later)
    const attemptId = crypto.randomUUID()
    await supabase
      .from('coupon_attempt_log')
      .insert({
        id: attemptId,
        user_id: user.id,
        coupon_code: couponCode.toUpperCase().trim(),
        success: false
      })

    // Look up coupon code in database
    const codeUpper = couponCode.toUpperCase().trim()
    const { data: coupon, error: couponError } = await supabase
      .from('coupon_codes')
      .select('*')
      .eq('code', codeUpper)
      .eq('is_active', true)
      .single()

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or inactive coupon code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if coupon has expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'This coupon code has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if user has already redeemed this coupon
    const { data: existingRedemption, error: redemptionCheckError } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_code_id', coupon.id)
      .eq('user_id', user.id)
      .single()

    if (existingRedemption && !redemptionCheckError) {
      return new Response(
        JSON.stringify({ success: false, error: 'You have already redeemed this coupon code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check redemption limit
    if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
      return new Response(
        JSON.stringify({ success: false, error: 'This coupon code has reached its redemption limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if user_subscriptions row exists
    const { data: existingSubscription, error: checkError } = await supabase
      .from('user_subscriptions')
      .select('id, email, subscription_tier')
      .eq('user_id', user.id)
      .maybeSingle()

    // Prepare update data based on benefit type
    let updateData: any = {}
    let message = ''

    if (coupon.benefit_type === 'unlimited') {
      // Grant unlimited AI access (never expires)
      updateData.has_unlimited_ai = true
      updateData.ai_access_expires_at = null
      message = 'Coupon code redeemed! You now have unlimited AI access forever! 🎉'
    } else if (coupon.benefit_type === 'months_free') {
      // Grant free AI access for specified number of months
      const months = coupon.benefit_value || 0
      if (months <= 0) {
        throw new Error('Invalid benefit value for months_free coupon')
      }
      
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + months)
      
      updateData.has_unlimited_ai = false
      updateData.ai_access_expires_at = expiresAt.toISOString()
      
      const monthText = months === 1 ? 'month' : 'months'
      message = `Coupon code redeemed! You now have free AI access for ${months} ${monthText}! 🎉`
    } else if (coupon.benefit_type === 'basic_plan') {
      // Grant BASIC tier only (cloud sync yes, AI no)
      updateData.has_unlimited_ai = false
      updateData.ai_access_expires_at = null

      const existingTier = (existingSubscription?.subscription_tier || '').toLowerCase()
      const hasPaidPremium = existingTier === 'premium' || existingTier === 'admin'
      if (!hasPaidPremium) {
        updateData.subscription_tier = 'basic'
        updateData.subscription_status = 'active'
      }

      message = 'Coupon code redeemed! You now have Basic plan access (cloud sync, no AI).'
    } else {
      throw new Error(`Unknown benefit type: ${coupon.benefit_type}`)
    }

    let data: any = null
    let error: any = null

    // Use upsert if row doesn't exist, update if it does
    if (!existingSubscription) {
      // Create new subscription row with coupon benefits
      const upsertResult = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          email: user.email || '',
          subscription_tier: 'free',
          subscription_status: 'active',
          ...updateData
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      data = upsertResult.data
      error = upsertResult.error
    } else {
      // Update existing subscription
      const updateResult = await supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()

      data = updateResult.data
      error = updateResult.error
    }

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`)
    }

    // Record the redemption
    const { error: redemptionError } = await supabase
      .from('coupon_redemptions')
      .insert({
        coupon_code_id: coupon.id,
        user_id: user.id
      })

    if (redemptionError) {
      // Rollback subscription update if redemption recording fails
      console.error('Failed to record redemption:', redemptionError)
      // Note: In production, you might want to rollback the subscription update
      // For now, we'll continue but log the error
    }

    // Increment redemption count
    const { error: countError } = await supabase
      .from('coupon_codes')
      .update({ 
        redemption_count: (coupon.redemption_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', coupon.id)

    if (countError) {
      console.error('Failed to update redemption count:', countError)
      // Non-critical error, continue
    }

    // Mark attempt as successful
    await supabase
      .from('coupon_attempt_log')
      .update({ success: true })
      .eq('id', attemptId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: message,
        subscription: data,
        coupon: {
          code: coupon.code,
          benefit_type: coupon.benefit_type,
          benefit_value: coupon.benefit_value
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

