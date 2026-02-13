import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset } from "../_shared/ai_workflow.ts"

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
    const { clips } = body || {}

    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('clips array is required')
    }

    // Cap at 50 clips per request
    const batch = clips.slice(0, 50)

    // Always use cheapest preset regardless of user workflow setting
    const cheapestWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
      provider: 'openai',
      preset: 'cheapest'
    }
    const models = resolveModelsFromWorkflow(cheapestWorkflow)
    const apiKey = getApiKeyForResolved(models)

    // Build clip summaries for the prompt (truncated for token efficiency)
    const clipSummaries = batch.map((c: any, i: number) => {
      const text = String(c.text || '').trim().slice(0, 200)
      return `${i}: ${text}`
    }).join('\n')

    const systemPrompt =
      'You are a clipboard categorizer. Given a list of copied text snippets, assign each ONE short reusable category name.\n' +
      'Rules:\n' +
      '- Category names: 1-3 words max, Title Case (e.g. "Links", "Code", "Recipes", "Home Address", "Shopping List", "Work Notes", "Research", "Finance", "Health Tips")\n' +
      '- Use broad, reusable names that apply across many contexts\n' +
      '- Prefer existing common categories over inventing niche ones\n' +
      '- Return STRICT JSON only: {"categories":["Cat1","Cat2",...]}\n' +
      '- Array length MUST match the number of input clips, in the same order\n' +
      '- No markdown, no extra keys'

    const userPrompt = `Categorize these ${batch.length} clipboard snippets:\n${clipSummaries}`

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: Math.min(300, batch.length * 15 + 50),
      temperature: 0.2
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch (_) {
      // Try to extract JSON from markdown code block
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1].trim()) } catch (_) { parsed = null }
      }
    }

    const categories: string[] = Array.isArray(parsed?.categories)
      ? parsed.categories.map((c: any) => {
          const s = String(c || '').trim()
          // Enforce title case and max 30 chars
          return s.slice(0, 30) || 'Quick'
        })
      : []

    // Pad or trim to match input length
    while (categories.length < batch.length) categories.push('Quick')
    if (categories.length > batch.length) categories.length = batch.length

    // Decrement text credits (cheapest cost)
    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

    return new Response(
      JSON.stringify({ categories, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
