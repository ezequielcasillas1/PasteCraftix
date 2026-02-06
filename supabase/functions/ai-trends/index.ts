import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env not configured')
  }

  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) return null
  return await res.json()
}

async function getSubscriptionForUser(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role not configured')
  }

  const url = `${supabaseUrl}/rest/v1/user_subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  const res = await fetch(url, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

function isPremium(subscription: any) {
  try {
    if (!subscription) return false
    const tier = String(subscription.subscription_tier || '').toLowerCase()
    const status = String(subscription.subscription_status || '').toLowerCase()
    const isPaid = (tier === 'premium' || tier === 'admin') && status === 'active'

    const expiresAtMs = subscription.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN
    const hasCoupon =
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())

    return !!(isPaid || hasCoupon)
  } catch (_) {
    return false
  }
}

function extractRssTitles(xml: string, max = 12) {
  // Very lightweight RSS/Atom title extraction (no deps).
  // We intentionally skip the channel/feed title by ignoring the first <title> found.
  const titles: string[] = []
  const re = /<title[^>]*>([\s\S]*?)<\/title>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && titles.length < (max + 1)) {
    const raw = String(m[1] || '')
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!raw) continue
    titles.push(raw)
  }
  // drop likely feed title
  return titles.slice(1, max + 1)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const user = await requireUser(req)
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const subscription = await getSubscriptionForUser(String(user.id || ''))
    if (!isPremium(subscription)) {
      return new Response(
        JSON.stringify({ error: 'Premium required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
      )
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Read body early (for aiWorkflow only). Keep backward compatible with empty bodies.
    const body = await req.json().catch(() => ({}))
    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)

    // Curated lightweight sources (can be expanded later)
    const sources = [
      'https://hnrss.org/frontpage',
      'https://www.producthunt.com/feed',
    ]

    const titles: string[] = []
    for (const src of sources) {
      try {
        const r = await fetch(src, { headers: { 'User-Agent': 'PasteCraftTrends/1.0' } })
        if (!r.ok) continue
        const xml = await r.text()
        titles.push(...extractRssTitles(xml, 8))
      } catch (_) {
        // ignore per-source failures
      }
    }

    const seed = titles.slice(0, 12)
    const systemPrompt =
      'You generate daily PasteCraft usage tips from tech/productivity trends. ' +
      'Return STRICT JSON only: {"tips":[{"title":"...","body":"..."}]}. ' +
      'Rules: 1-3 tips max. title <= 40 chars. body <= 120 chars. No markdown. No extra keys. ' +
      'Focus on how PasteCraft can be used daily (batch copy, tags, reuse, saving links, avoiding one-time loss).'

    const userPrompt =
      seed.length
        ? `Today headlines:\n- ${seed.join('\n- ')}`
        : 'No headlines available. Create 2-3 generally useful daily PasteCraft tips.'

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 260,
      temperature: 0.5
    }

    const { data } = await fetchChatCompletionsWithModelFallback(openaiKey, payload, models.chatTextModel)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: any = null
    try { parsed = JSON.parse(raw) } catch (_) { parsed = null }

    const tips = Array.isArray(parsed?.tips)
      ? parsed.tips
          .filter((x: any) => x && typeof x.title === 'string' && typeof x.body === 'string')
          .slice(0, 3)
      : []

    return new Response(
      JSON.stringify({ tips, headlines: seed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

