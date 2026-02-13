import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { TextCreditGate } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Credit gate: authenticate + check text credits
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    // Read body early (for aiWorkflow only). Keep backward compatible with empty bodies.
    const body = await req.json().catch(() => ({}))
    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

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

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: any = null
    try { parsed = JSON.parse(raw) } catch (_) { parsed = null }

    const tips = Array.isArray(parsed?.tips)
      ? parsed.tips
          .filter((x: any) => x && typeof x.title === 'string' && typeof x.body === 'string')
          .slice(0, 3)
      : []

    // Decrement weighted text credits after successful generation
    const credits = await decrementTextCredits(gate, getTextCreditCost(models.provider, models.preset))

    return new Response(
      JSON.stringify({ tips, headlines: seed, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

