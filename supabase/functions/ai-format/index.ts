import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  CLAUDE_HAIKU_MODEL,
  fetchRefactorChatCompletions,
  fetchChatCompletionsWithModelFallback,
  parseAiWorkflowFromBody,
  resolveModelsFromWorkflow,
  getApiKeyForResolved,
  requireTextCredits,
  decrementTextCredits,
  getTextCreditCost,
} from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Per-clip safety ceiling for prompt assembly (was 500 — truncated real clips). */
const MAX_CLIP_CHARS = 8000
/** Matches Anthropic clamp in fetchClaudeChat. */
const MAX_OUTPUT_TOKENS = 4096

/**
 * Format polish ≈ input length + JSON wrapper (slightly tighter than refactor rewrite budget).
 */
function computeFormatMaxTokens(totalInputChars: number, batchLen: number): number {
  const n = Math.max(1, batchLen)
  const chars = Math.max(0, totalInputChars)
  const inputTokensApprox = Math.ceil(chars / 3.5)
  const jsonOverhead = 120 + n * 40
  const needed = Math.ceil(inputTokensApprox * 1.25) + jsonOverhead
  const floor = Math.max(512, n * 180)
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(floor, needed))
}

function firstDiffIndex(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i
  }
  return a.length === b.length ? -1 : n
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { clips } = body || {}

    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('clips array is required')
    }

    const batch = clips.slice(0, 30)

    // Default: Claude Haiku (same as refactor). Override when client sends aiWorkflow.
    const formatWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } =
      parseAiWorkflowFromBody(body) || { provider: 'anthropic', preset: 'default' }
    const models = resolveModelsFromWorkflow(formatWorkflow)
    const requestedModel = models.chatTextModel

    const preparedTexts = batch.map((c: { text?: string }) =>
      String(c.text || '').trim().slice(0, MAX_CLIP_CHARS),
    )
    const totalInputChars = preparedTexts.reduce((sum, t) => sum + t.length, 0)
    const clipTexts = preparedTexts
      .map((text, i) => `[${i}]\n${text}\n[/${i}]`)
      .join('\n')

    const systemPrompt =
      'You are a grammar and punctuation editor. Fix grammar, punctuation, capitalization, and sentence structure.\n' +
      'Rules:\n' +
      '- When text is messy (missing periods/commas, bad capitalization, run-ons, typos) you MUST apply visible polish\n' +
      '- Fix spelling, grammar, punctuation, and capitalization errors\n' +
      '- Improve sentence structure for clarity without changing meaning\n' +
      '- DO NOT change vocabulary, tone, or meaning\n' +
      '- DO NOT add new ideas, filler, or expand the text\n' +
      '- DO NOT rewrite into a different style — polish what exists\n' +
      '- Preserve line breaks, formatting, and code blocks as-is\n' +
      '- Only return unchanged when the text is already clean and correctly punctuated\n' +
      '- If text is code, URL, email, phone, or data (JSON/YAML/XML/CSV) — return it unchanged\n' +
      '- Return STRICT JSON only: {"formatted":["text0","text1",...]}\n' +
      '- Array length MUST match the number of input clips, in the same order\n' +
      '- No markdown wrapping, no extra keys'

    const userPrompt =
      `Polish grammar and punctuation for these ${batch.length} clipboard snippets. ` +
      `Apply corrections wherever the text is messy; do not invent content:\n${clipTexts}`

    const maxTokens = computeFormatMaxTokens(totalInputChars, batch.length)
    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }

    async function runFormat(tokens: number) {
      const nextPayload = { ...payload, max_tokens: tokens }
      if (formatWorkflow.provider === 'anthropic') {
        return fetchRefactorChatCompletions(nextPayload)
      }
      const apiKey = getApiKeyForResolved(models)
      return fetchChatCompletionsWithModelFallback(apiKey, nextPayload, models.chatTextModel, models)
    }

    let effectiveMaxTokens = maxTokens
    let { data, usedModel } = await runFormat(maxTokens)
    let finishReason = String(data?.choices?.[0]?.finish_reason || '')
    if (finishReason === 'length' || finishReason === 'max_tokens') {
      const higher = Math.min(MAX_OUTPUT_TOKENS, Math.ceil(maxTokens * 1.75))
      if (higher > maxTokens) {
        effectiveMaxTokens = higher
        ;({ data, usedModel } = await runFormat(higher))
        finishReason = String(data?.choices?.[0]?.finish_reason || '')
      }
    }

    const raw = String(data?.choices?.[0]?.message?.content || '').trim()

    let parsed: { formatted?: unknown[] } | null = null
    let parseOk = false
    try {
      parsed = JSON.parse(raw)
      parseOk = Array.isArray(parsed?.formatted)
    } catch (_) {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim())
          parseOk = Array.isArray(parsed?.formatted)
        } catch (_) {
          parsed = null
          parseOk = false
        }
      }
    }

    const modelFormatted: string[] = parseOk
      ? parsed!.formatted!.map((t: unknown) => String(t || '').trim())
      : []

    const diagnostics = batch.map((c: { text?: string }, i: number) => {
      const original = String(c?.text || '').trim()
      const candidate = modelFormatted[i]
      const hadCandidate = typeof candidate === 'string'
      const candidateText = hadCandidate ? candidate : ''
      const equal = hadCandidate && candidateText === original
      let outcome = 'accepted'
      if (!parseOk) outcome = 'parse_fail_pad'
      else if (!hadCandidate) outcome = 'missing_pad'
      else if (!candidateText) outcome = 'empty_pad'
      else if (equal) outcome = 'identical_model'
      return {
        index: i,
        outcome,
        originalLen: original.length,
        candidateLen: candidateText.length,
        equal,
        firstDiff: equal || !hadCandidate ? -1 : firstDiffIndex(original, candidateText),
        origPreview: original.slice(0, 80),
        candPreview: candidateText.slice(0, 80),
      }
    })

    const formatted: string[] = parseOk
      ? modelFormatted.map((t: string) => String(t || '').trim())
      : []

    let paddedCount = 0
    while (formatted.length < batch.length) {
      formatted.push(String(batch[formatted.length]?.text || '').trim())
      paddedCount++
    }
    if (formatted.length > batch.length) formatted.length = batch.length

    // Anthropic default (Haiku) = 40 credits — same as ai-refactor
    const credits = await decrementTextCredits(
      gate,
      getTextCreditCost(formatWorkflow.provider, formatWorkflow.preset),
    )

    return new Response(
      JSON.stringify({
        formatted,
        ...credits,
        debug: {
          sessionHint: 'e9511f',
          usedModel: usedModel || requestedModel || CLAUDE_HAIKU_MODEL,
          requestedModel,
          parseOk,
          finishReason,
          rawLen: raw.length,
          maxTokens: effectiveMaxTokens,
          paddedCount,
          modelResultCount: modelFormatted.length,
          diagnostics,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
