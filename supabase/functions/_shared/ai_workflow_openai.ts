import type { AiWorkflowProvider, ResolvedAiModels } from './ai_workflow_types.ts'
import {
  CLAUDE_FALLBACK_MODEL,
  CLAUDE_HAIKU_MODEL,
  REFACTOR_OPENAI_FALLBACK_MODEL,
} from './ai_workflow_types.ts'

export type ChatCompletionResult = { data: any; usedModel: string }

type ChatPostFailure = { ok: false; msg: string; err: any }
type ChatPostSuccess = { ok: true; data: any }
type ChatPostResult = ChatPostSuccess | ChatPostFailure

function looksLikeMissingModelError(msg: string): boolean {
  const s = String(msg || '').toLowerCase()
  return s.includes('model') && (s.includes('not found') || s.includes('does not exist') || s.includes('no such model'))
}

/** GPT-5 / reasoning models reject legacy max_tokens on chat/completions. */
function usesMaxCompletionTokens(model: string): boolean {
  const m = String(model || '').toLowerCase()
  return m.startsWith('gpt-5') || /^o[134]/.test(m)
}

function looksLikeMaxTokensParamError(msg: string): boolean {
  const s = String(msg || '').toLowerCase()
  return s.includes('max_tokens') && s.includes('max_completion_tokens')
}

export function normalizeChatCompletionPayload(
  payload: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const out = { ...payload }
  if (!usesMaxCompletionTokens(model)) return out
  if (out.max_tokens != null && out.max_completion_tokens == null) {
    out.max_completion_tokens = out.max_tokens
  }
  delete out.max_tokens
  if (out.temperature !== undefined && out.temperature !== 1) {
    delete out.temperature
  }
  return out
}

function googleFallbackChain(model: string): string[] {
  const m = String(model || '').trim()
  if (!m) return ['gemini-3.6-flash', 'gemini-2.0-flash']
  if (m === 'gemini-3.6-flash') return ['gemini-3.6-flash', 'gemini-2.0-flash']
  return [m, 'gemini-2.0-flash']
}

const OPENAI_FALLBACK_CHAINS: Record<string, string[]> = {
  'gpt-5.2': ['gpt-5.2', 'gpt-5', 'gpt-4o-mini'],
  'gpt-5-mini': ['gpt-5-mini', 'gpt-5', 'gpt-4o-mini'],
  'gpt-5-nano': ['gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini'],
  'gpt-5': ['gpt-5', 'gpt-4o-mini'],
  'gpt-4o': ['gpt-4o', 'gpt-4o-mini'],
}

function openAiFallbackChain(model: string): string[] {
  const m = String(model || '').trim()
  if (!m) return ['gpt-4o-mini']
  return OPENAI_FALLBACK_CHAINS[m] ?? [m, 'gpt-4o-mini']
}

export function getChatModelFallbackChain(
  model: string,
  provider: AiWorkflowProvider = 'openai',
): string[] {
  if (provider === 'google') return googleFallbackChain(model)
  return openAiFallbackChain(model)
}

function payloadHasVisionContent(payload: any): boolean {
  const messages = Array.isArray(payload?.messages) ? payload.messages : []
  return messages.some((msg: any) => {
    if (!Array.isArray(msg?.content)) return false
    return msg.content.some((part: any) => part?.type === 'image_url' || part?.type === 'image')
  })
}

function contentAsString(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content ?? '')
}

function toAnthropicMessages(payload: any): { system?: string; messages: Array<{ role: string; content: unknown }> } {
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : []
  let system: string | undefined
  const messages: Array<{ role: string; content: unknown }> = []

  for (const msg of rawMessages) {
    const role = String(msg?.role || 'user')
    if (role === 'system') {
      const text = contentAsString(msg.content)
      system = system ? `${system}\n\n${text}` : text
      continue
    }
    if (role === 'assistant') {
      messages.push({ role: 'assistant', content: contentAsString(msg.content) })
      continue
    }
    messages.push({ role: 'user', content: contentAsString(msg.content) })
  }

  if (!messages.length) {
    messages.push({ role: 'user', content: 'Hello' })
  }

  return { system, messages }
}

function extractAnthropicText(anthropicData: any): string {
  if (!Array.isArray(anthropicData?.content)) return ''
  return anthropicData.content
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => String(part.text || ''))
    .join('')
}

function mapAnthropicFinishReason(stopReason: unknown): string {
  const stop = String(stopReason || '')
  return stop === 'max_tokens' ? 'length' : (stop || 'stop')
}

function toOpenAiChatResponse(anthropicData: any) {
  return {
    choices: [{
      message: { role: 'assistant', content: extractAnthropicText(anthropicData) },
      finish_reason: mapAnthropicFinishReason(anthropicData?.stop_reason),
    }],
  }
}

function getAnthropicApiKey(): string {
  return (Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC-API-KEY') || '').trim()
}

function resolveClaudeMaxTokens(payload: any): number {
  const maxTokens = Number(payload?.max_completion_tokens ?? payload?.max_tokens ?? 1024)
  return Number.isFinite(maxTokens) ? Math.max(256, Math.min(maxTokens, 4096)) : 1024
}

async function fetchClaudeChat(payload: any, model: string = CLAUDE_HAIKU_MODEL): Promise<ChatCompletionResult | null> {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) return null

  const { system, messages } = toAnthropicMessages(payload)
  const body: Record<string, unknown> = {
    model,
    max_tokens: resolveClaudeMaxTokens(payload),
    messages,
  }
  if (system) body.system = system

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) return null

  const data = await resp.json()
  return { data: toOpenAiChatResponse(data), usedModel: model }
}

async function fetchClaudeChatFallback(payload: any): Promise<ChatCompletionResult | null> {
  return fetchClaudeChat(payload, CLAUDE_FALLBACK_MODEL)
}

async function readOpenAiErrorMessage(resp: Response): Promise<string> {
  const err = await resp.json().catch(() => ({}))
  return String(err?.error?.message || err?.error || resp.statusText || 'OpenAI API error')
}

async function fetchOpenAiChatSingleModel(
  apiKey: string,
  payload: any,
  model: string,
): Promise<ChatCompletionResult> {
  const bodyPayload = normalizeChatCompletionPayload(payload, model)
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...bodyPayload, model }),
  })

  if (!resp.ok) {
    throw new Error(await readOpenAiErrorMessage(resp))
  }

  const data = await resp.json()
  return { data, usedModel: model }
}

function refactorOpenAiMissingKeyError(forceOpenAi: boolean): Error {
  return new Error(forceOpenAi ? 'OpenAI API key not configured' : 'Anthropic and OpenAI unavailable')
}

async function fetchRefactorOpenAiFallback(payload: any, forceOpenAi: boolean) {
  const openAiKey = Deno.env.get('OPENAI_API_KEY') || ''
  if (!openAiKey) throw refactorOpenAiMissingKeyError(forceOpenAi)
  const result = await fetchOpenAiChatSingleModel(openAiKey, payload, REFACTOR_OPENAI_FALLBACK_MODEL)
  return { ...result, provider: 'openai' as const }
}

/** Refactor path: Claude Haiku primary, GPT-4o fallback (no 4o-mini). */
export async function fetchRefactorChatCompletions(
  payload: any,
  options?: { forceOpenAi?: boolean },
) {
  const forceOpenAi = !!options?.forceOpenAi
  if (!forceOpenAi) {
    const claudeResult = await fetchClaudeChat(payload, CLAUDE_HAIKU_MODEL)
    if (claudeResult) return { ...claudeResult, provider: 'anthropic' as const }
  }
  return fetchRefactorOpenAiFallback(payload, forceOpenAi)
}

export async function verifyAnthropicFallback() {
  const configured = !!getAnthropicApiKey()
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      model: CLAUDE_FALLBACK_MODEL,
      detail: 'ANTHROPIC_API_KEY not set',
    }
  }

  const result = await fetchClaudeChatFallback({
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    max_tokens: 16,
  })

  return {
    configured: true,
    reachable: !!result,
    model: CLAUDE_FALLBACK_MODEL,
    detail: result ? 'Claude fallback reachable' : 'Claude API call failed',
  }
}

type ChatEndpointCtx = {
  baseUrl: string
  apiKey: string
  payload: any
  provider: string
}

function chatAuthHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

function parseChatFailure(err: any, statusText: string): ChatPostFailure {
  const msg = String(err?.error?.message || err?.error || statusText || '')
  return { ok: false, msg, err }
}

async function postChatCompletions(ctx: ChatEndpointCtx, model: string): Promise<ChatPostResult> {
  const bodyPayload = normalizeChatCompletionPayload(ctx.payload, model)
  const resp = await fetch(`${ctx.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: chatAuthHeaders(ctx.apiKey),
    body: JSON.stringify({ ...bodyPayload, model }),
  })

  if (resp.ok) return { ok: true, data: await resp.json() }
  return parseChatFailure(await resp.json().catch(() => ({})), resp.statusText)
}

async function retryAfterMaxTokensParamError(
  ctx: ChatEndpointCtx,
  model: string,
): Promise<ChatCompletionResult | null> {
  const retryPayload = normalizeChatCompletionPayload(ctx.payload, model)
  const retryResp = await fetch(`${ctx.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: chatAuthHeaders(ctx.apiKey),
    body: JSON.stringify({ ...retryPayload, model }),
  })
  if (!retryResp.ok) return null
  return { data: await retryResp.json(), usedModel: model }
}

async function claudeFallbackIfAllowed(payload: any): Promise<ChatCompletionResult | null> {
  if (payloadHasVisionContent(payload)) return null
  return fetchClaudeChatFallback(payload)
}

async function resolveNonMissingModelFailure(
  payload: any,
  msg: string,
  provider: string,
): Promise<ChatCompletionResult> {
  const claudeResult = await claudeFallbackIfAllowed(payload)
  if (claudeResult) return claudeResult
  throw new Error(msg || `${provider} API error`)
}

async function tryMaxTokensRetry(
  ctx: ChatEndpointCtx,
  model: string,
  msg: string,
): Promise<ChatCompletionResult | null> {
  if (!looksLikeMaxTokensParamError(msg) || ctx.payload.max_tokens == null) return null
  return retryAfterMaxTokensParamError(ctx, model)
}

type CandidateAttempt =
  | { status: 'success'; value: ChatCompletionResult }
  | { status: 'missing_model'; err: any }

async function attemptModelCandidate(ctx: ChatEndpointCtx, model: string): Promise<CandidateAttempt> {
  const result = await postChatCompletions(ctx, model)
  if (result.ok) return { status: 'success', value: { data: result.data, usedModel: model } }

  const retried = await tryMaxTokensRetry(ctx, model, result.msg)
  if (retried) return { status: 'success', value: retried }

  // Only continue chain on "model missing"; otherwise Claude fallback or throw.
  if (!looksLikeMissingModelError(result.msg)) {
    return {
      status: 'success',
      value: await resolveNonMissingModelFailure(ctx.payload, result.msg, ctx.provider),
    }
  }

  return { status: 'missing_model', err: result.err }
}

function lastFallbackErrorMessage(lastErr: any, provider: string): string {
  return String(lastErr?.error?.message || lastErr?.error || `${provider} API error`)
}

export async function fetchChatCompletionsWithModelFallback(
  apiKey: string,
  payload: any,
  model: string,
  resolved?: ResolvedAiModels,
): Promise<ChatCompletionResult> {
  const provider = resolved?.provider || 'openai'
  const ctx: ChatEndpointCtx = {
    baseUrl: resolved?.apiBaseUrl || 'https://api.openai.com/v1',
    apiKey,
    payload,
    provider,
  }
  const candidates = getChatModelFallbackChain(model, provider)
  let lastErr: any = null

  for (const candidate of candidates) {
    const attempt = await attemptModelCandidate(ctx, candidate)
    if (attempt.status === 'success') return attempt.value
    lastErr = attempt.err
  }

  return await resolveNonMissingModelFailure(
    payload,
    lastFallbackErrorMessage(lastErr, provider),
    provider,
  )
}
