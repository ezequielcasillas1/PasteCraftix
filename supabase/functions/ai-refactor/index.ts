import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost, resolveCraftWorkflow } from "../_shared/ai_workflow.ts"
import { guardAiTexts } from "../_shared/ai_input_guard.ts"
import type { ResolvedAiModels } from "../_shared/ai_workflow.ts"

// Reasoning models (gpt-5-nano) sometimes return empty/unparseable content even
// with a generous budget. This non-reasoning model honors JSON instructions
// reliably and is the retry target when the primary parse fails.
const JSON_RETRY_MODEL = 'gpt-4o-mini'

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

// Max characters of each clip sent to the model. Long clips (verses, flashcards,
// definitions) were previously cut at 500 chars, so only the opening fragment was
// ever rewritten. Keep generous but bounded to control token cost.
const PER_CLIP_INPUT_LIMIT = 4000

const JSON_ESCAPES: Record<string, string> = {
  n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/',
}

/** Decode the backslash escape at `s[i]` (i points at the '\'). */
function decodeEscape(s: string, i: number): { value: string; next: number } {
  const code = s[i + 1]
  if (code === 'u' && i + 5 < s.length) {
    return { value: String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)), next: i + 6 }
  }
  return { value: JSON_ESCAPES[code] ?? code, next: i + 2 }
}

/** Read one JSON string literal starting at the opening quote `s[start]`. */
function readJsonString(s: string, start: number): { value: string; next: number; closed: boolean } {
  let i = start + 1
  let buf = ''
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length) {
      const esc = decodeEscape(s, i)
      buf += esc.value
      i = esc.next
    } else if (ch === '"') {
      return { value: buf, next: i + 1, closed: true }
    } else {
      buf += ch
      i++
    }
  }
  return { value: buf, next: i, closed: false }
}

/** Decode a run of JSON string literals, tolerating a truncated final element. */
function extractJsonStrings(s: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] !== '"') { i++; continue }
    const token = readJsonString(s, i)
    if (token.closed) out.push(token.value)
    i = token.closed ? token.next : s.length
  }
  return out
}

/** Candidate substrings that might contain the JSON object. */
function jsonCandidates(raw: string): string[] {
  const attempts: string[] = [raw]
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) attempts.push(fence[1].trim())
  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')
  if (braceStart >= 0 && braceEnd > braceStart) {
    attempts.push(raw.slice(braceStart, braceEnd + 1))
  }
  return attempts
}

/** Parse one candidate string into the refactored array, or null. */
function tryParseRefactoredJson(attempt: string): string[] | null {
  try {
    const parsed = JSON.parse(attempt)
    if (Array.isArray(parsed?.refactored)) {
      return parsed.refactored.map((t: unknown) => String(t ?? ''))
    }
  } catch (_) { /* not valid JSON */ }
  return null
}

/** Parse {"refactored":[...]} from model output, salvaging truncated JSON. */
function parseRefactoredArray(raw: string): string[] | null {
  if (!raw) return null
  for (const attempt of jsonCandidates(raw)) {
    const parsed = tryParseRefactoredJson(attempt)
    if (parsed) return parsed
  }
  const arrMatch = raw.match(/"refactored"\s*:\s*\[([\s\S]*)/)
  if (arrMatch) {
    const items = extractJsonStrings(arrMatch[1])
    if (items.length) return items
  }
  return null
}

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

/** Call the model and parse {"refactored":[...]} from its content, or null. */
async function requestRefactoredArray(
  apiKey: string,
  payload: Record<string, unknown>,
  model: string,
  models: ResolvedAiModels,
): Promise<string[] | null> {
  const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, model, models)
  const raw = String(data?.choices?.[0]?.message?.content || '').trim()
  return parseRefactoredArray(raw)
}

/** Primary reasoning-model call with a reliable non-reasoning JSON retry. */
async function refactorWithRetry(
  apiKey: string,
  payload: Record<string, unknown>,
  models: ResolvedAiModels,
): Promise<string[] | null> {
  const primary = await requestRefactoredArray(apiKey, payload, models.chatTextModel, models)
  if (primary && primary.length > 0) return primary
  return requestRefactoredArray(apiKey, payload, JSON_RETRY_MODEL, models)
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

    // Server-validated craft power → model/credit tier (client cannot set cost).
    const craftWorkflow = resolveCraftWorkflow(body?.craftPower)

    const edgeLevel = levelPrompts[String(level || '')] ? String(level) : 'college'
    const batch = clips.slice(0, 30)

    const guarded = await guardAiTexts(
      gate.supabase,
      gate.userId,
      batch.map((c: { text?: string }) => String(c.text || '')),
      'ai-refactor',
      corsHeaders,
      PER_CLIP_INPUT_LIMIT,
    )
    if (guarded instanceof Response) return guarded

    const models = resolveModelsFromWorkflow(craftWorkflow)
    const apiKey = getApiKeyForResolved(models)

    const clipTexts = batch.map((_c: { text?: string }, i: number) => {
      const text = String(guarded.texts[i] || '').trim()
      return `[${i}]\n${text}\n[/${i}]`
    }).join('\n')

    const systemPrompt = levelPrompts[edgeLevel]
    const userPrompt = `Rewrite these ${batch.length} clipboard snippets:\n${clipTexts}`

    // gpt-5-nano is a reasoning model: max_completion_tokens covers hidden
    // reasoning AND visible output. A tiny budget (the old 80/clip formula) left
    // nothing for the rewrite, so output came back empty/truncated and unparseable.
    // Budget = estimated rewrite size + a reasoning buffer, bounded for cost.
    const totalInputChars = guarded.texts.reduce(
      (sum: number, t: string) => sum + String(t || '').trim().length,
      0,
    )
    const outputTokenEstimate = Math.ceil(totalInputChars / 3)
    const REASONING_BUFFER = 2000
    const maxTokens = Math.min(16000, Math.max(1200, outputTokenEstimate + REASONING_BUFFER))

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.35,
      // Force valid JSON output. The prompt already names "JSON" and the schema,
      // which OpenAI requires to enable json_object mode. normalizeChatCompletion-
      // Payload only touches max_tokens/temperature, so this passes through intact.
      response_format: { type: 'json_object' },
    }

    const parsedArr = await refactorWithRetry(apiKey, payload, models)
    const parseOk = Array.isArray(parsedArr) && parsedArr.length > 0
    const aiCount = parseOk ? parsedArr!.length : 0

    const refactored: string[] = parseOk
      ? parsedArr!.map((t: unknown) => String(t || '').trim())
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

    const credits = await decrementTextCredits(gate, getTextCreditCost(craftWorkflow.provider, craftWorkflow.preset))

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
