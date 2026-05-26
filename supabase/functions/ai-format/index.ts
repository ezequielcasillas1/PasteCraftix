import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import { guardAiTexts } from "../_shared/ai_input_guard.ts"
import { guardAiModelText, guardAiOutputStrings } from "../_shared/ai_output_guard.ts"
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

    // Cap at 30 clips per request (format needs more tokens than categorize)
    const batch = clips.slice(0, 30)

    const guarded = await guardAiTexts(
      gate.supabase,
      gate.userId,
      batch.map((c: any) => String(c.text || '')),
      'ai-format',
      corsHeaders,
      500,
    )
    if (guarded instanceof Response) return guarded

    // Always use cheapest preset
    const cheapestWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
      provider: 'openai',
      preset: 'cheapest'
    }
    const models = resolveModelsFromWorkflow(cheapestWorkflow)
    const apiKey = getApiKeyForResolved(models)

    // Build clip texts for the prompt (truncated for token efficiency)
    const clipTexts = batch.map((_c: any, i: number) => {
      const text = String(guarded.texts[i] || '').trim()
      return `[${i}]\n${text}\n[/${i}]`
    }).join('\n')

    const systemPrompt =
      'You are a grammar and punctuation editor. Fix ONLY grammar, punctuation, capitalization, and sentence structure.\n' +
      'Rules:\n' +
      '- Fix spelling, grammar, punctuation, and capitalization errors\n' +
      '- Improve sentence structure for clarity\n' +
      '- DO NOT change vocabulary, tone, or meaning\n' +
      '- DO NOT add new words or expand the text\n' +
      '- DO NOT rewrite or rephrase — just polish what exists\n' +
      '- Preserve line breaks, formatting, and code blocks as-is\n' +
      '- If text is already correct, return it unchanged\n' +
      '- If text is code, URL, email, phone, or data (JSON/YAML/XML/CSV) — return it unchanged\n' +
      '- Return STRICT JSON only: {"formatted":["text0","text1",...]}\n' +
      '- Array length MUST match the number of input clips, in the same order\n' +
      '- No markdown wrapping, no extra keys'

    const userPrompt = `Fix grammar and punctuation for these ${batch.length} clipboard snippets:\n${clipTexts}`

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: Math.min(2000, batch.length * 60 + 100),
      temperature: 0.1
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    let raw = String(data?.choices?.[0]?.message?.content || '').trim()
    const guardedRaw = await guardAiModelText(gate.supabase, gate.userId, raw, 'ai-format', corsHeaders, { apiKey })
    if (guardedRaw instanceof Response) return guardedRaw
    raw = guardedRaw

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

    const formatted: string[] = Array.isArray(parsed?.formatted)
      ? parsed.formatted.map((t: any) => String(t || '').trim())
      : []

    // Pad with originals if AI returned fewer results
    while (formatted.length < batch.length) {
      formatted.push(String(batch[formatted.length]?.text || '').trim())
    }
    if (formatted.length > batch.length) formatted.length = batch.length

    const safeFormatted = await guardAiOutputStrings(
      gate.supabase,
      gate.userId,
      formatted,
      'ai-format',
      2000,
    )

    // Decrement text credits (cheapest cost)
    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

    return new Response(
      JSON.stringify({ formatted: safeFormatted, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
