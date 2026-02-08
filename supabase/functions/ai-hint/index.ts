import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits } from "../_shared/ai_workflow.ts"
import type { TextCreditGate } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Credit gate: authenticate + check text credits
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { kind, text, url, pageUrl, study } = body || {}
    const t = String(text || '').trim()
    const u = String(url || '').trim()
    const p = String(pageUrl || '').trim()

    if (!t && !u) {
      throw new Error('text or url is required')
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)

    const systemPrompt =
      'You are PasteCraft Tips. You help users decide whether to save copied content, how to batch it, and how to avoid re-copying. ' +
      'Return STRICT JSON only: {"tips":[{"title":"...","body":"..."}]}. ' +
      'Rules: 1-3 tips max. title <= 40 chars. body <= 120 chars. No markdown. No extra keys.'

    const studyLine = (study && typeof study === 'object')
      ? `\nUserStudyStats (daily aggregate): ${JSON.stringify(study).slice(0, 800)}\n`
      : '\n'

    const userPrompt =
      `Copy kind: ${String(kind || 'text')}\n` +
      (p ? `Page: ${p}\n` : '') +
      (u ? `URL: ${u}\n` : '') +
      studyLine +
      `Copied:\n${t.slice(0, 5000)}`

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 220,
      temperature: 0.4
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch (_) {
      parsed = null
    }

    const tips = Array.isArray(parsed?.tips)
      ? parsed.tips
          .filter((x: any) => x && typeof x.title === 'string' && typeof x.body === 'string')
          .slice(0, 3)
      : []

    // Decrement text credits after successful generation
    const credits = await decrementTextCredits(gate)

    return new Response(
      JSON.stringify({ tips, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

