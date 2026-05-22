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
  }
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

    const parseOk = Array.isArray(parsed?.refactored)
    const aiCount = parseOk ? parsed!.refactored!.length : 0

    const refactored: string[] = parseOk
      ? parsed!.refactored!.map((t: unknown) => String(t || '').trim())
      : []

    while (refactored.length < batch.length) {
      refactored.push(String(batch[refactored.length]?.text || '').trim())
    }
    if (refactored.length > batch.length) refactored.length = batch.length

    const diagnostics = batch.map((c: { text?: string }, i: number) => {
      const original = String(c.text || '').trim()
      const out = refactored[i] || original
      const usedFallback = i >= aiCount
      return buildDiagnostic(original, out, i, edgeLevel, parseOk, usedFallback)
    })

    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

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
