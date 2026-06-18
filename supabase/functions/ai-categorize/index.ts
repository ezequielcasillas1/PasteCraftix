import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { AiWorkflowProvider, AiWorkflowPreset } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_CATEGORY_WORDS = 7
const MAX_CATEGORY_CHARS = 80
const SUGGESTION_COUNT = 5

const GENERIC_SUGGESTION_BLOCKLIST = new Set([
  'quick notes', 'links', 'work', 'personal', 'reference', 'quick', 'notes',
  'contacts', 'code', 'data', 'markup', 'diagrams', 'uncategorized', 'general',
])

function isGenericSuggestionTitle(title: string): boolean {
  return GENERIC_SUGGESTION_BLOCKLIST.has(title.trim().toLowerCase())
}

function normalizeCategoryTitle(raw: unknown): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return 'Quick'
  const words = trimmed.split(/\s+/).filter(Boolean).slice(0, MAX_CATEGORY_WORDS)
  const title = words.join(' ')
  return title.slice(0, MAX_CATEGORY_CHARS) || 'Quick'
}

function buildClipSummaries(batch: any[]): string {
  return batch.map((c: any, i: number) => {
    const text = String(c.text || '').trim().slice(0, 200)
    const sourceHint = extractSourceHint(c)
    const sourceTopic = extractSourceTopic(c)
    const sourceBits = [
      sourceHint ? `[source:${sourceHint}]` : '',
      sourceTopic ? `[topic:${sourceTopic}]` : '',
    ].filter(Boolean).join(' ')
    return sourceBits ? `${i}: ${text} ${sourceBits}` : `${i}: ${text}`
  }).join('\n')
}

function extractSourceHint(clip: any): string {
  const directHost = String(clip?.sourceHost || '').trim().toLowerCase()
  if (directHost) return directHost.slice(0, 80)

  const rawUrl = String(clip?.sourcePageUrl || clip?.url || '').trim()
  if (!rawUrl) return ''
  try {
    const parsed = new URL(rawUrl)
    return String(parsed.hostname || '').toLowerCase().slice(0, 80)
  } catch (_) {
    return rawUrl.slice(0, 80).toLowerCase()
  }
}

function extractSourceTopic(clip: any): string {
  const directTopic = String(clip?.sourceTopic || '').trim().toLowerCase()
  if (directTopic) return directTopic.slice(0, 120)

  const rawUrl = String(clip?.sourcePageUrl || clip?.url || '').trim()
  if (!rawUrl) return ''
  try {
    const parsed = new URL(rawUrl)
    const topic = String(parsed.pathname || '')
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
    return topic.slice(0, 120).toLowerCase()
  } catch (_) {
    return ''
  }
}

function parseJsonFromModel(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch (_) {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()) } catch (_) { return null }
    }
    return null
  }
}

function extractSuggestionsFromParsed(parsed: any): string[] {
  const rawList = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions
    : Array.isArray(parsed?.categories)
      ? parsed.categories
      : []

  const seen = new Set<string>()
  const out: string[] = []
  for (const item of rawList) {
    const title = normalizeCategoryTitle(item)
    if (!title || isGenericSuggestionTitle(title)) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(title)
    if (out.length >= SUGGESTION_COUNT) break
  }
  return out
}

const SUGGESTIONS_SYSTEM_PROMPT =
  'You invent custom clipboard category titles from the user\'s actual snippets.\n' +
  'Rules:\n' +
  '- Propose up to 5 distinct titles that describe the batch themes (not one title per clip)\n' +
  '- Each title: up to 7 words, Title Case, specific to the content (topics, projects, tools, subjects)\n' +
  '- If source/topic hints are present in brackets (e.g. [source:blueletterbible.org] [topic:book-of-proverbs]), use them as context for domain-aware titles\n' +
  '- For scripture-like content or Bible-source hosts, prefer canonical book-level titles (e.g. Psalms, Proverbs, Gospel Of John, Romans); do not invent chapter/verse unless explicitly present\n' +
  '- For encyclopedias/docs/news/information sites, prefer topic-based titles derived from snippet meaning and source/topic hints\n' +
  '- NEVER use generic bucket names like "Work", "Personal", "Links", "Quick Notes", "Reference", "Notes", "Contacts"\n' +
  '- Draw wording from the snippets (e.g. "React Hook Form Errors", "Q3 Budget Spreadsheets")\n' +
  '- Return STRICT JSON only: {"suggestions":["Title1","Title2",...]}\n' +
  '- 1 to 5 strings in suggestions; no markdown, no extra keys'

async function requestCategorySuggestions(
  apiKey: string,
  models: ReturnType<typeof resolveModelsFromWorkflow>,
  clipSummaries: string,
  batchLength: number,
  retryCustom: boolean,
): Promise<string[]> {
  const systemPrompt = retryCustom
    ? SUGGESTIONS_SYSTEM_PROMPT + '\n- Your previous answer was too generic; use highly specific titles from the snippets only.'
    : SUGGESTIONS_SYSTEM_PROMPT

  const userPrompt = retryCustom
    ? `Retry: suggest up to 5 specific custom category titles for these ${batchLength} snippet(s):\n${clipSummaries}`
    : `Suggest up to 5 custom category titles for these ${batchLength} clipboard snippet(s):\n${clipSummaries}`

  const payload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 320,
    temperature: retryCustom ? 0.55 : 0.45,
  }

  const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
  const raw = String(data?.choices?.[0]?.message?.content || '').trim()
  return extractSuggestionsFromParsed(parseJsonFromModel(raw))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { clips, mode } = body || {}

    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('clips array is required')
    }

    const batch = clips.slice(0, 50)
    const cheapestWorkflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } = {
      provider: 'openai',
      preset: 'cheapest'
    }
    const models = resolveModelsFromWorkflow(cheapestWorkflow)
    const apiKey = getApiKeyForResolved(models)
    const clipSummaries = buildClipSummaries(batch)

    if (mode === 'suggestions') {
      let suggestions = await requestCategorySuggestions(apiKey, models, clipSummaries, batch.length, false)

      const mostlyGeneric = suggestions.length > 0
        && suggestions.every((s) => isGenericSuggestionTitle(s))
      if (suggestions.length === 0 || mostlyGeneric) {
        const retry = await requestCategorySuggestions(apiKey, models, clipSummaries, batch.length, true)
        if (retry.length > 0) suggestions = retry
      }

      suggestions = suggestions.slice(0, SUGGESTION_COUNT)

      const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

      return new Response(
        JSON.stringify({ suggestions, ...credits }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const systemPrompt =
      'You are a clipboard categorizer. Given a list of copied text snippets, assign each ONE reusable category title.\n' +
      'Rules:\n' +
      '- Category titles: up to 7 words, Title Case (e.g. "Links", "Python API Error Logs", "Mom Birthday Gift Ideas List")\n' +
      '- Stay concise; use the shortest clear title that fits the clip (often 1-3 words, longer when needed)\n' +
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
      max_tokens: Math.min(500, batch.length * 25 + 50),
      temperature: 0.2
    }

    const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, models.chatTextModel, models)
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()
    const parsed = parseJsonFromModel(raw)

    const categories: string[] = Array.isArray(parsed?.categories)
      ? parsed.categories.map((c: any) => normalizeCategoryTitle(c))
      : []

    while (categories.length < batch.length) categories.push('Quick')
    if (categories.length > batch.length) categories.length = batch.length

    const credits = await decrementTextCredits(gate, getTextCreditCost(cheapestWorkflow.provider, cheapestWorkflow.preset))

    return new Response(
      JSON.stringify({ categories, ...credits }),
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
