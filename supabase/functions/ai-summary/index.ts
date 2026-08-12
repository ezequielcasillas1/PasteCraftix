import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { fetchChatCompletionsWithModelFallback, parseAiWorkflowFromBody, resolveModelsFromWorkflow, getApiKeyForResolved, requireTextCredits, decrementTextCredits, getTextCreditCost } from "../_shared/ai_workflow.ts"
import type { ResolvedAiModels } from "../_shared/ai_workflow.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Keep vision payloads small; Gemini OpenAI-compat often 400s on huge bodies. */
const MAX_IMAGE_CHARS = 1_200_000

type ProviderFail = {
  status: number
  body: string
  message: string
}

function jsonError(message: string, extra: Record<string, unknown> = {}, status = 400) {
  return new Response(
    JSON.stringify({ error: message, ...extra }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
  )
}

function normalizeImageUrl(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://')) return s
  return `data:image/jpeg;base64,${s}`
}

function parseDataImage(dataUrl: string): { mime: string; data: string } | null {
  const m = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
  if (!m) return null
  const mime = m[1]
  const data = m[2].replace(/\s+/g, '')
  if (!data) return null
  return { mime, data }
}

function buildTextPrompts(opts: {
  text: string
  question?: string
  generateQuestions?: boolean
  hasImage: boolean
}): { systemPrompt: string; userPrompt: string } {
  const { text, question, generateQuestions, hasImage } = opts

  // Keep vision prompts short — long formatRules + image triggered opaque Gemini 400s.
  if (hasImage) {
    if (generateQuestions) {
      return {
        systemPrompt: 'Generate exactly 4 short insightful questions about this image. Return ONLY the questions, one per line, no numbering.',
        userPrompt: `Context text (may be a placeholder):\n${text}`,
      }
    }
    if (question) {
      return {
        systemPrompt: 'Answer the question using the image and any context text. Be concise but thorough. Use Markdown when helpful.',
        userPrompt: `Context: ${text}\n\nQuestion: ${question}`,
      }
    }
    return {
      systemPrompt: 'Describe and summarize this image clearly. Use Markdown headings and bullets when helpful.',
      userPrompt: `Context text (may be a placeholder):\n${text}`,
    }
  }

  const formatRules = `
FORMATTING RULES (strict):
- Use Markdown formatting: headings (#, ##, ###), bold (**text**), italic (*text*), bullet lists (- item), numbered lists (1. item), tables, and code blocks.
- For math/formulas use LaTeX notation: inline math with $...$, display math with $$...$$.
- For diagrams, use Mermaid in a fenced code block tagged "mermaid".
- Use tables for comparisons. Use code blocks for code.
- Never use // or \\\\ as decorative separators.
- Be detailed but minimal.`

  if (generateQuestions) {
    return {
      systemPrompt: `You are a helpful assistant. Generate 4 short, insightful questions about the provided text. Return ONLY the questions, one per line, no numbering or bullets.${formatRules}`,
      userPrompt: `Generate 4 questions about this text:\n\n${text}`,
    }
  }
  if (question) {
    return {
      systemPrompt: `You are a helpful assistant. Answer the question based on the provided text. Be concise but thorough.${formatRules}`,
      userPrompt: `Text: ${text}\n\nQuestion: ${question}`,
    }
  }
  return {
    systemPrompt: `You are a helpful assistant. Provide a clear, concise summary of the text.${formatRules}`,
    userPrompt: `Summarize this text:\n\n${text}`,
  }
}

function buildTextOnlyPayload(systemPrompt: string, userPrompt: string) {
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  }
}

async function readProviderFail(resp: Response): Promise<ProviderFail> {
  const body = await resp.text().catch(() => '')
  let message = resp.statusText || 'Bad Request'
  try {
    const parsed = JSON.parse(body || '{}')
    const nested = parsed?.error?.message || parsed?.error || parsed?.message
    if (typeof nested === 'string' && nested.trim()) message = nested.trim()
    else if (nested && typeof nested === 'object') message = JSON.stringify(nested).slice(0, 400)
  } catch (_) {
    if (body.trim()) message = body.trim().slice(0, 400)
  }
  return { status: resp.status, body: body.slice(0, 800), message }
}

/** Native Gemini vision — more reliable than OpenAI-compat image_url for clip-sized data URLs. */
async function callGeminiNativeVision(opts: {
  apiKey: string
  model: string
  text: string
  dataUrl: string
}): Promise<string> {
  const parsed = parseDataImage(opts.dataUrl)
  if (!parsed) {
    throw Object.assign(new Error('Image must be an inline data:image/...;base64 URL (remote http URLs are not supported)'), {
      providerFail: { status: 400, body: '', message: 'non_data_url_image' } as ProviderFail,
    })
  }

  const model = String(opts.model || '').replace(/^models\//, '')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: opts.text },
          { inline_data: { mime_type: parsed.mime, data: parsed.data } },
        ],
      }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  })

  if (!resp.ok) {
    const fail = await readProviderFail(resp)
    throw Object.assign(new Error(`Gemini ${fail.status}: ${fail.message}`), { providerFail: fail })
  }

  const json = await resp.json().catch(() => ({}))
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) {
    throw new Error('Gemini returned no candidates')
  }
  return parts.map((p: { text?: string }) => String(p?.text || '')).join('').trim()
}

/** OpenAI-compat vision with full error body capture (used for OpenAI / Anthropic fallbacks). */
async function callOpenAiCompatVision(opts: {
  apiKey: string
  models: ResolvedAiModels
  model: string
  text: string
  dataUrl: string
}): Promise<string> {
  const baseUrl = opts.models.apiBaseUrl || 'https://api.openai.com/v1'
  const payload = {
    model: opts.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: opts.text },
        { type: 'image_url', image_url: { url: opts.dataUrl } },
      ],
    }],
    max_tokens: 2000,
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const fail = await readProviderFail(resp)
    throw Object.assign(new Error(`${opts.models.provider} ${fail.status}: ${fail.message}`), { providerFail: fail })
  }

  const json = await resp.json().catch(() => ({}))
  return String(json?.choices?.[0]?.message?.content || '').trim()
}

async function runVisionSummary(opts: {
  apiKey: string
  models: ResolvedAiModels
  model: string
  text: string
  dataUrl: string
}): Promise<string> {
  const viaGateway = String(opts.models.apiBaseUrl || '').includes('ai-gateway.vercel.sh')
  // Native Gemini path needs GOOGLE_AI_KEY; gateway uses OpenAI-compat vision.
  if (opts.models.provider === 'google' && !viaGateway) {
    return await callGeminiNativeVision({
      apiKey: opts.apiKey,
      model: opts.model,
      text: opts.text,
      dataUrl: opts.dataUrl,
    })
  }
  return await callOpenAiCompatVision(opts)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let debugMeta: Record<string, unknown> = {}

  try {
    const gate = await requireTextCredits(req)
    if (gate instanceof Response) return gate

    const body = await req.json().catch(() => ({}))
    const { text, question, generateQuestions, imageBase64 } = body || {}

    if (!text) {
      throw new Error('Text is required')
    }

    const rawImage = typeof imageBase64 === 'string' ? imageBase64.trim() : ''
    const hasImage = rawImage.length > 0
    let imageUrl = hasImage ? normalizeImageUrl(rawImage) : ''

    if (hasImage && /^https?:\/\//i.test(imageUrl)) {
      // Gemini will not reliably fetch remote URLs via OpenAI-compat; require inline data.
      return jsonError(
        'Remote image URLs are not supported for AI Summary. Re-open the clip so PasteCraft can attach an inline image.',
        { imagePrefix: imageUrl.slice(0, 48), imageChars: imageUrl.length, reason: 'http_image_url' },
      )
    }

    if (hasImage && imageUrl.length > MAX_IMAGE_CHARS) {
      return jsonError('Image too large for summary. Try a smaller image.', {
        imageChars: imageUrl.length,
        reason: 'image_too_large',
      })
    }

    if (hasImage && !parseDataImage(imageUrl)) {
      return jsonError('Invalid image payload for summary (expected data:image/...;base64,...)', {
        imagePrefix: imageUrl.slice(0, 48),
        imageChars: imageUrl.length,
        reason: 'invalid_data_url',
      })
    }

    const workflow = parseAiWorkflowFromBody(body)
    const models = resolveModelsFromWorkflow(workflow)
    const apiKey = getApiKeyForResolved(models)
    const { systemPrompt, userPrompt } = buildTextPrompts({
      text: String(text),
      question: question ? String(question) : undefined,
      generateQuestions: !!generateQuestions,
      hasImage,
    })

    const chatModel = hasImage ? models.chatVisionModel : models.chatTextModel
    debugMeta = {
      hasImage,
      generateQuestions: !!generateQuestions,
      hasQuestion: !!question,
      imageChars: imageUrl.length,
      imagePrefix: imageUrl.slice(0, 40),
      imageMime: parseDataImage(imageUrl)?.mime || null,
      model: chatModel,
      provider: models.provider,
    }

    console.log(JSON.stringify({ tag: 'ai-summary', ...debugMeta }))

    let result = ''
    if (hasImage) {
      try {
        result = await runVisionSummary({
          apiKey,
          models,
          model: chatModel,
          text: `${systemPrompt}\n\n${userPrompt}`,
          dataUrl: imageUrl,
        })
      } catch (providerErr) {
        const detail = providerErr instanceof Error ? providerErr.message : String(providerErr)
        const fail = (providerErr as { providerFail?: ProviderFail })?.providerFail
        console.error(JSON.stringify({
          tag: 'ai-summary-provider-error',
          ...debugMeta,
          detail: detail.slice(0, 500),
          providerStatus: fail?.status ?? null,
          providerBody: fail?.body?.slice(0, 500) ?? null,
        }))
        return jsonError(detail || 'AI provider rejected the summary request', {
          ...debugMeta,
          providerStatus: fail?.status ?? null,
          providerBody: fail?.body?.slice(0, 500) ?? null,
        })
      }
    } else {
      const payload = buildTextOnlyPayload(systemPrompt, userPrompt)
      const { data } = await fetchChatCompletionsWithModelFallback(apiKey, payload, chatModel, models)
      result = String(data?.choices?.[0]?.message?.content || '').trim()
    }

    const credits = await decrementTextCredits(gate, getTextCreditCost(models.provider, models.preset))

    if (generateQuestions) {
      const questions = result.split('\n').filter((q: string) => q.trim()).slice(0, 4)
      return new Response(
        JSON.stringify({ questions, ...credits }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    return new Response(
      JSON.stringify({ summary: result, ...credits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ tag: 'ai-summary-error', message: message.slice(0, 500), ...debugMeta }))
    return jsonError(message, debugMeta)
  }
})
