import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  fetchRefactorChatCompletions,
  fetchChatCompletionsWithModelFallback,
  parseAiWorkflowFromBody,
  resolveModelsFromWorkflow,
  getApiKeyForResolved,
  requireTextCredits,
  decrementTextCredits,
  getTextCreditCost,
} from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset, ResolvedAiModels } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Per-clip safety ceiling for prompt assembly (was 500 — truncated real clips). */
const MAX_CLIP_CHARS = 8000
/** Matches Anthropic clamp in fetchClaudeChat. */
const MAX_OUTPUT_TOKENS = 4096

/**
 * Strategy: scale output token budget from total input size + batch length.
 * Enough room for a full rewrite of every clip plus JSON wrapper.
 */
function computeRefactorMaxTokens(totalInputChars: number, batchLen: number): number {
  const n = Math.max(1, batchLen)
  const chars = Math.max(0, totalInputChars)
  // ~3.5 chars/token; rewrite ≈ input length with headroom for JSON array
  const inputTokensApprox = Math.ceil(chars / 3.5)
  const jsonOverhead = 120 + n * 40
  const needed = Math.ceil(inputTokensApprox * 1.5) + jsonOverhead
  const floor = Math.max(512, n * 200)
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(floor, needed))
}

const rewriteRules =
  'Rules:\n' +
  '- REWRITE every snippet in the requested style/register — do NOT explain it\n' +
  '- You MUST change wording and sentence structure visibly; never echo the input verbatim\n' +
  '- Preserve facts, meaning, and intent; do not invent new claims\n' +
  '- Rewrite must be COMPLETE: cover every point in the input; never stop mid-sentence or mid-thought\n' +
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

const CODE_OR_URL_RE = /^(https?:\/\/|www\.|[a-z0-9._%+-]+@|[{[\(<]|```|<\/?[a-z])/i
const STRUCTURED_RE = /^[\s]*[{[\]"]/ 

function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (!longer.length) return 1
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++
  }
  return matches / longer.length
}

function isPreservedContent(text: string): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  if (CODE_OR_URL_RE.test(t)) return true
  if (STRUCTURED_RE.test(t)) return true
  if (/^[\d\s+\-().]+$/.test(t) && t.replace(/\D/g, '').length >= 7) return true
  return false
}

function buildSynthesis(outcome: string, reasons: string[], level: string): string {
  const reasonText = reasons.length ? reasons.join(' ') : 'No specific blockers recorded.'
  switch (outcome) {
    case 'changed':
      return `Refactor at ${level} level succeeded with a meaningful rewrite.`
    case 'minimal_change':
      return `The model made only tiny edits at ${level} level. ${reasonText} The clip may already match that register or the content resisted deeper rewriting.`
    case 'unchanged':
      return `The model returned text identical to the input at ${level} level. ${reasonText} Try a higher-contrast level or check if the clip is code, a URL, or already polished.`
    case 'partial':
      return `The AI response was incomplete or hard to parse at ${level} level. ${reasonText} Original text was kept as fallback.`
    case 'preserved':
      return `Content looks like code, a URL, email, phone, or structured data — refactor rules preserve it unchanged at ${level} level.`
    default:
      return reasonText
  }
}

function buildDiagnostic(
  original: string,
  refactored: string,
  index: number,
  level: string,
  parseOk: boolean,
  usedFallback: boolean,
): Record<string, unknown> {
  const reasons: string[] = []
  let outcome = 'changed'

  if (!parseOk) {
    reasons.push('AI JSON response could not be parsed cleanly.')
    outcome = 'partial'
  }
  if (usedFallback) {
    reasons.push('Missing AI output slot was filled with the original clip.')
    if (outcome === 'changed') outcome = 'partial'
  }
  if (isPreservedContent(original)) {
    reasons.push('Input matches preserve-as-is rules (code, URL, email, phone, or structured data).')
    if (original === refactored) outcome = 'preserved'
  }
  if (original === refactored) {
    reasons.push('Output matched input exactly — no rewrite was applied.')
    outcome = outcome === 'partial' ? 'partial' : 'unchanged'
  } else {
    const ratio = similarityRatio(original, refactored)
    if (ratio >= 0.92 && outcome === 'changed') {
      reasons.push(`Output was ${Math.round(ratio * 100)}% similar to the original — only minimal wording shifted.`)
      outcome = 'minimal_change'
    }
  }

  return {
    index,
    outcome,
    level,
    reasons,
    synthesis: buildSynthesis(outcome, reasons, level),
    originalLen: original.length,
    refactoredLen: refactored.length,
    originalPreview: original.slice(0, 80),
    refactoredPreview: refactored.slice(0, 80),
  }
}

function parseRefactoredJson(raw: string): { refactored: string[]; parseOk: boolean } {
  let parsed: { refactored?: unknown[] } | null = null
  try {
    parsed = JSON.parse(raw)
  } catch (_) {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[1].trim()) } catch (_) { parsed = null }
    }
  }
  const parseOk = Array.isArray(parsed?.refactored)
  const refactored = parseOk
    ? parsed!.refactored!.map((t: unknown) => String(t || '').trim())
    : []
  return { refactored, parseOk }
}

async function callRefactorModel(
  systemPrompt: string,
  userPrompt: string,
  batchLen: number,
  temperature: number,
  forceOpenAi = false,
  totalInputChars = 0,
  workflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
    provider: 'anthropic',
    preset: 'default',
  },
  models: ResolvedAiModels = resolveModelsFromWorkflow({ provider: 'anthropic', preset: 'default' }),
) {
  let maxTokens = computeRefactorMaxTokens(totalInputChars, batchLen)
  const buildPayload = (tokens: number) => ({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: tokens,
    temperature,
  })

  async function run(tokens: number) {
    const payload = buildPayload(tokens)
    if (forceOpenAi || workflow.provider === 'anthropic') {
      return fetchRefactorChatCompletions(payload, { forceOpenAi })
    }
    const apiKey = getApiKeyForResolved(models)
    return fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
  }

  let { data } = await run(maxTokens)
  let finishReason = String(data?.choices?.[0]?.finish_reason || '')
  // One retry if provider hit the output cap (incomplete rewrite / JSON).
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    const higher = Math.min(MAX_OUTPUT_TOKENS, Math.ceil(maxTokens * 1.75))
    if (higher > maxTokens) {
      maxTokens = higher
      ;({ data } = await run(maxTokens))
      finishReason = String(data?.choices?.[0]?.finish_reason || '')
    }
  }

  const raw = String(data?.choices?.[0]?.message?.content || '').trim()
  return { raw, finishReason, ...parseRefactoredJson(raw) }
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

    const refactorWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } =
      parseAiWorkflowFromBody(body) || { provider: 'anthropic', preset: 'default' }
    const models = resolveModelsFromWorkflow(refactorWorkflow)

    const preparedTexts = batch.map((c: { text?: string }) =>
      String(c.text || '').trim().slice(0, MAX_CLIP_CHARS),
    )
    const totalInputChars = preparedTexts.reduce((sum, t) => sum + t.length, 0)
    const clipTexts = preparedTexts
      .map((text, i) => `[${i}]\n${text}\n[/${i}]`)
      .join('\n')

    const systemPrompt = levelPrompts[edgeLevel]
    const userPrompt =
      `Rewrite these ${batch.length} clipboard snippets. Each output MUST use different wording from its input and MUST be a complete rewrite (cover all points; do not end mid-sentence):\n${clipTexts}`

    const firstPass = await callRefactorModel(
      systemPrompt,
      userPrompt,
      batch.length,
      0.65,
      false,
      totalInputChars,
      refactorWorkflow,
      models,
    )
    const parseOk = firstPass.parseOk
    const aiCount = firstPass.refactored.length

    const refactored: string[] = [...firstPass.refactored]
    while (refactored.length < batch.length) {
      refactored.push(String(batch[refactored.length]?.text || '').trim())
    }
    if (refactored.length > batch.length) refactored.length = batch.length

    for (let i = 0; i < batch.length; i++) {
      const original = String(batch[i]?.text || '').trim()
      const promptText = preparedTexts[i] || original
      const out = refactored[i] || original
      if (original === out && !isPreservedContent(original)) {
        const retryPrompt =
          `Rewrite this snippet at ${edgeLevel} level. Use completely different words and sentence structure while keeping the same meaning. Produce a COMPLETE rewrite — do not stop mid-sentence. Do NOT copy the original:\n[0]\n${promptText}\n[/0]`
        const retry = await callRefactorModel(
          systemPrompt + '\n- RETRY: prior output matched input — you must produce a visibly different rewrite.',
          retryPrompt,
          1,
          0.85,
          true,
          promptText.length,
          refactorWorkflow,
          models,
        )
        if (retry.refactored[0] && retry.refactored[0] !== original) {
          refactored[i] = retry.refactored[0]
        }
      }
    }

    const diagnostics = batch.map((c: { text?: string }, i: number) => {
      const original = String(c.text || '').trim()
      const out = refactored[i] || original
      const usedFallback = i >= aiCount
      return buildDiagnostic(original, out, i, edgeLevel, parseOk, usedFallback)
    })

    const credits = await decrementTextCredits(gate, getTextCreditCost(refactorWorkflow.provider, refactorWorkflow.preset))

    return new Response(
      JSON.stringify({ refactored, diagnostics, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
