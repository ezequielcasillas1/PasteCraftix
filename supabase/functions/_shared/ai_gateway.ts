/**
 * Vercel AI Gateway routing helpers (OpenAI-compatible).
 * Key stays in Edge Function secrets only — never ship to the extension.
 */

export const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'
export const AI_GATEWAY_KEY_ENV = 'AI_GATEWAY_API_KEY'

const GATEWAY_KEY_ALIASES = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_AI_GATEWAY_API_KEY',
  'AI_GATEWAY_KEY',
] as const

/** Bare Anthropic model id used by native Messages API. */
export const ANTHROPIC_HAIKU_BARE = 'claude-haiku-4-5'
/** Gateway catalog slug (dot version). */
export const ANTHROPIC_HAIKU_GATEWAY = 'anthropic/claude-haiku-4.5'

export function peekAiGatewayKey(): string {
  for (const name of GATEWAY_KEY_ALIASES) {
    const key = (Deno.env.get(name) || '').trim()
    if (key) return key
  }
  return ''
}

export function hasAiGatewayKey(): boolean {
  return !!peekAiGatewayKey()
}

/**
 * Map provider + bare model → AI Gateway `provider/model` id.
 */
export function toGatewayModelId(provider: string, bareModel: string): string {
  const raw = String(bareModel || '').trim()
  if (!raw) return raw
  if (raw.includes('/')) return raw

  let model = raw
  if (provider === 'anthropic' && model === ANTHROPIC_HAIKU_BARE) {
    model = 'claude-haiku-4.5'
  }

  const prefix =
    provider === 'google'
      ? 'google'
      : provider === 'anthropic'
        ? 'anthropic'
        : provider === 'deepseek'
          ? 'deepseek'
          : provider === 'alibaba'
            ? 'alibaba'
            : provider === 'inclusionai'
              ? 'inclusionai'
              : 'openai'

  return `${prefix}/${model}`
}

export function isGatewayBaseUrl(baseUrl: string | undefined): boolean {
  return String(baseUrl || '').includes('ai-gateway.vercel.sh')
}
