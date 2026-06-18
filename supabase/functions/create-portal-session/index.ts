import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "stripe"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
    const authHeader = req.headers.get("Authorization") || ""

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const body = await req.json().catch(() => ({}))
    const returnUrl = typeof body?.returnUrl === "string" && body.returnUrl ? body.returnUrl : req.headers.get("origin") || ""

    const { data: subRow, error: subErr } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status, subscription_tier, email, user_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle()

    if (subErr) {
      return new Response(JSON.stringify({ error: "Failed to read subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (!subRow?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No Stripe customer on file" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    })

    const session = await stripe.billingPortal.sessions.create({
      customer: subRow.stripe_customer_id,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any)?.message || "Portal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})































