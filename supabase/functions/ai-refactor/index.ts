import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const rewriteRules =
  'Rules:\n' +
  '- REWRITE the snippet in the requested style/register — do NOT explain it\n' +
  '- Preserve facts, meaning, and intent; do not invent new claims\n' +
  '- Keep the same language as the input unless translation is implied\n' +
  '- Preserve code blocks, URLs, emails, phones, and structured data unchanged\n' +
  '- Do not add markdown lesson headings unless the input already uses them\n' +
  '- Return STRICT JSON only: {"refactored":["text0","text1",...]}\n' +
  '- Array length MUST match the number of input clips, in the same order\n' +
  '- No markdown wrapping, no extra keys'

const levelPrompts: Record<string, string> = {
  child: `Rewrite each snippet in very simple plain language (ELI5 register). Short sentences. ${rewriteRules}`,
  elementary: `Rewrite each snippet for an elementary reader (ages 8–11). Clear and simple. ${rewriteRules}`,
  highschool: `Rewrite each snippet for a high school reader. Clear with some technical terms when needed. ${rewriteRules}`,
  college: `Rewrite each snippet in undergraduate academic tone. ${rewriteRules}`,
  phd: `Rewrite each snippet in expert/PhD scholarly register. ${rewriteRules}`,
  wiseman: `Rewrite each snippet in a wise, philosophical voice with metaphor where natural. ${rewriteRules}`,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { clips, level } = body || {}

    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('clips array is required')
    }

    const edgeLevel = levelPrompts[String(level || '')] ? String(level) : 'college'
    const batch = clips.slice(0, 30)

    const cheapestWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
      provider: 'openai',
      preset: 'cheapest',
    }
    const models = resolveModelsFromWorkflow(cheapestWorkflow)
    const apiKey = getApiKeyForResolved(models)

    const clipTexts = batch.map((c: { text?: string }, i: number) => {
      const text = String(c.text || '').trim().slice(0, 500)
      return `[${i}]\n${text}\n[/${i}]`
    }).join('\n')

    const systemPrompt = levelPrompts[edgeLevel]
    const userPrompt = `Rewrite these ${batch.length} clipboard snippets:\n${clipTexts}`

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: Math.min(2500, batch.length * 80 + 100),
      temperature: 0.35,
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: { refactored?: unknown[] } | null = null
    try {
      parsed = JSON.parse(raw)
    } catch (_) {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1].trim()) } catch (_) { parsed = null }
      }
    }

    const refactored: string[] = Array.isArray(parsed?.refactored)
      ? parsed.refactored.map((t: unknown) => String(t || '').trim())
      : []

    while (refactored.length < batch.length) {
      refactored.push(String(batch[refactored.length]?.text || '').trim())
    }
    if (refactored.length > batch.length) refactored.length = batch.length

    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

    return new Response(
      JSON.stringify({ refactored, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
