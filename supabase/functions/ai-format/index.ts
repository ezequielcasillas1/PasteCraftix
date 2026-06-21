import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_FILLER_RE = /\b(delve|delving|it's important to note|it is important to note|furthermore|in conclusion|additionally|moreover|it's worth noting|it is worth noting|in today's world|navigate the complexities|as an ai|underscores the importance|comprehensive overview|robust solution)\b/i

function countEmDashes(text: string): number {
  return (text.match(/—/g) || []).length
}

function isSuspiciousFormatOutput(original: string, formatted: string): boolean {
  const orig = String(original || '').trim()
  const fmt = String(formatted || '').trim()
  if (!fmt || fmt === orig) return false
  if (orig.length > 0 && fmt.length > orig.length * 1.12) return true
  if (AI_FILLER_RE.test(fmt) && !AI_FILLER_RE.test(orig)) return true
  if (countEmDashes(fmt) > countEmDashes(orig)) return true
  return false
}

const systemPrompt =
  'You are a copy editor fixing standard English grammar in clipboard snippets. Correctness only — not style upgrades or AI polish.\n' +
  'Fix when wrong:\n' +
  '- Subject-verb agreement, pronoun-antecedent agreement, verb tense consistency\n' +
  '- Double negatives, dangling or misplaced modifiers, sentence fragments, run-ons\n' +
  '- Homophones (your/you\'re, there/their/they\'re, its/it\'s, affect/effect, to/too/two)\n' +
  '- Punctuation, capitalization, and spelling\n' +
  '- Wordiness only when it is a clear tautology or grammar error\n' +
  'Do NOT:\n' +
  '- Rewrite for better wording, corporate tone, or marketing polish\n' +
  '- Add phrases, disclaimers, transitions, explanations, or new sentences\n' +
  '- Use AI filler (delve, furthermore, additionally, in conclusion, it\'s important to note, leverage, utilize, robust, comprehensive, landscape)\n' +
  '- Add em dashes (—) unless they already appear in the input\n' +
  '- Change vocabulary, tone, voice, or meaning\n' +
  '- Expand, summarize, or rephrase — minimal edits only\n' +
  'Preserve line breaks, lists, and formatting. Return code, URLs, emails, phones, and structured data unchanged.\n' +
  'If already grammatically correct, return unchanged.\n' +
  'Return STRICT JSON only: {"formatted":["text0","text1",...]}\n' +
  'Array length MUST match the number of input clips, in the same order.\n' +
  'No markdown wrapping, no extra keys'

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

    // Always use cheapest preset
    const cheapestWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
      provider: 'openai',
      preset: 'cheapest'
    }
    const models = resolveModelsFromWorkflow(cheapestWorkflow)
    const apiKey = getApiKeyForResolved(models)

    // Build clip texts for the prompt (truncated for token efficiency)
    const clipTexts = batch.map((c: any, i: number) => {
      const text = String(c.text || '').trim().slice(0, 500)
      return `[${i}]\n${text}\n[/${i}]`
    }).join('\n')

    const userPrompt = `Fix grammar only (no rewrites) for these ${batch.length} clipboard snippets:\n${clipTexts}`

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: Math.min(2000, batch.length * 60 + 100),
      temperature: 0.1
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

    const formatted: string[] = Array.isArray(parsed?.formatted)
      ? parsed.formatted.map((t: any, i: number) => {
          const original = String(batch[i]?.text || '').trim()
          const candidate = String(t || '').trim()
          if (!candidate || candidate === original) return original
          if (isSuspiciousFormatOutput(original, candidate)) return original
          return candidate
        })
      : []

    // Pad with originals if AI returned fewer results
    while (formatted.length < batch.length) {
      formatted.push(String(batch[formatted.length]?.text || '').trim())
    }
    if (formatted.length > batch.length) formatted.length = batch.length

    // Decrement text credits (cheapest cost)
    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

    return new Response(
      JSON.stringify({ formatted, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
