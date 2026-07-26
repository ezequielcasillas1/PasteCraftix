/**
 * AI workflow facade — stable public API for Edge Functions.
 * Implementation lives in sibling modules; re-export so existing imports keep working.
 */
import type { AiWorkflowPreset, AiWorkflowProvider, ResolvedAiModels } from './ai_workflow_types.ts'
import {
  CLAUDE_HAIKU_MODEL,
  CRAFT_REGULAR_PRESET,
  CRAFT_SUPER_PRESET,
  normalizePreset,
  normalizeProvider,
} from './ai_workflow_types.ts'

export type {
  AiWorkflowPreset,
  AiWorkflowProvider,
  AiWorkflowConfig,
  ResolvedAiModels,
  TextCreditGate,
  AuthenticatedUserGate,
} from './ai_workflow_types.ts'

export {
  CLAUDE_HAIKU_MODEL,
  REFACTOR_OPENAI_FALLBACK_MODEL,
  CRAFT_REGULAR_PRESET,
  CRAFT_SUPER_PRESET,
  getTextCreditCost,
} from './ai_workflow_types.ts'

export {
  normalizeChatCompletionPayload,
  getChatModelFallbackChain,
  fetchRefactorChatCompletions,
  verifyAnthropicFallback,
  fetchChatCompletionsWithModelFallback,
} from './ai_workflow_openai.ts'

export {
  requireTextCredits,
  decrementTextCredits,
  requireAuthenticatedUser,
  checkAiNameRateLimit,
} from './ai_workflow_credits.ts'

/**
 * Map an untrusted client craftPower value to a server-whitelisted workflow.
 * Only the literal 'super' unlocks the higher tier; everything else (including
 * unknown/missing values) falls back to the cheapest regular preset.
 */
export function resolveCraftWorkflow(craftPower: unknown): { provider: AiWorkflowProvider; preset: AiWorkflowPreset } {
  const isSuper = String(craftPower || '').toLowerCase() === 'super'
  return { provider: 'openai', preset: isSuper ? CRAFT_SUPER_PRESET : CRAFT_REGULAR_PRESET }
}

export function parseAiWorkflowFromBody(body: any): { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null {
  try {
    const wf = body && typeof body === 'object' ? body.aiWorkflow : null
    if (!wf || typeof wf !== 'object') return null
    if (wf.enabled !== true) return null
    const provider = normalizeProvider(wf.provider)
    const preset = normalizePreset(wf.preset, provider)
    return { provider, preset }
  } catch (_) {
    return null
  }
}

type ChatModelPair = { chatTextModel: string; chatVisionModel: string }

type ProviderModelTable = {
  provider: AiWorkflowProvider
  apiBaseUrl: string
  apiKeyEnv: string
  modelsByPreset: Record<string, ChatModelPair>
}

const OPENAI_PROVIDER: ProviderModelTable = {
  provider: 'openai',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKeyEnv: 'OPENAI_API_KEY',
  modelsByPreset: {
    cheapest: { chatTextModel: 'gpt-5-nano', chatVisionModel: 'gpt-5-nano' },
    gpt5_mini: { chatTextModel: 'gpt-5-mini', chatVisionModel: 'gpt-5-mini' },
    latest: { chatTextModel: 'gpt-5.2', chatVisionModel: 'gpt-5.2' },
    gpt4o: { chatTextModel: 'gpt-4o', chatVisionModel: 'gpt-4o' },
    default: { chatTextModel: 'gpt-4o-mini', chatVisionModel: 'gpt-4o' },
  },
}

const GOOGLE_PROVIDER: ProviderModelTable = {
  provider: 'google',
  apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKeyEnv: 'GOOGLE_AI_KEY',
  modelsByPreset: {
    cheapest: { chatTextModel: 'gemini-2.0-flash-lite', chatVisionModel: 'gemini-2.0-flash-lite' },
    gemini_pro: { chatTextModel: 'gemini-2.5-pro-preview-05-06', chatVisionModel: 'gemini-2.5-pro-preview-05-06' },
    latest: { chatTextModel: 'gemini-2.5-flash-preview-04-17', chatVisionModel: 'gemini-2.5-flash-preview-04-17' },
    gemini_36_flash: { chatTextModel: 'gemini-3.6-flash', chatVisionModel: 'gemini-3.6-flash' },
    default: { chatTextModel: 'gemini-2.0-flash', chatVisionModel: 'gemini-2.0-flash' },
  },
}

function resolveFromProviderTable(table: ProviderModelTable, preset: AiWorkflowPreset): ResolvedAiModels {
  const models = table.modelsByPreset[preset] || table.modelsByPreset.default
  const resolvedPreset = (table.modelsByPreset[preset] ? preset : 'default') as AiWorkflowPreset
  return {
    provider: table.provider,
    apiBaseUrl: table.apiBaseUrl,
    apiKeyEnv: table.apiKeyEnv,
    preset: resolvedPreset,
    chatTextModel: models.chatTextModel,
    chatVisionModel: models.chatVisionModel,
    imageGenerationModel: 'gpt-image-1',
  }
}

function resolveAnthropic(_preset: AiWorkflowPreset): ResolvedAiModels {
  return {
    provider: 'anthropic',
    preset: 'default',
    chatTextModel: CLAUDE_HAIKU_MODEL,
    chatVisionModel: CLAUDE_HAIKU_MODEL,
    imageGenerationModel: 'gpt-image-1',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  }
}

export function resolveModelsFromWorkflow(
  workflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null,
): ResolvedAiModels {
  const provider = workflow ? workflow.provider : 'openai'
  const preset = workflow ? workflow.preset : 'default'

  if (provider === 'google') return resolveFromProviderTable(GOOGLE_PROVIDER, preset)
  if (provider === 'anthropic') return resolveAnthropic(preset)
  return resolveFromProviderTable(OPENAI_PROVIDER, preset)
}

/** Resolve the API key from Deno env based on the resolved provider. Falls back to OPENAI_API_KEY. */
export function getApiKeyForResolved(resolved: ResolvedAiModels): string {
  const key = Deno.env.get(resolved.apiKeyEnv) || Deno.env.get('OPENAI_API_KEY') || ''
  if (!key) throw new Error(`API key not configured (expected ${resolved.apiKeyEnv})`)
  return key
}
