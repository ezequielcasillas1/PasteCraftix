export type AiWorkflowPreset =
  | 'default'
  | 'cheapest'
  | 'gpt5_mini'
  | 'latest'
  | 'gpt4o'
  | 'gemini_pro'
  | 'gemini_36_flash'
  | 'gemini_35_flash_lite'
  | 'deepseek_v4_flash'
  | 'qwen_flash'
  | 'ling_flash';

export type AiWorkflowProvider =
  | 'openai'
  | 'google'
  | 'anthropic'
  | 'deepseek'
  | 'alibaba'
  | 'inclusionai';

export type AiWorkflowConfig = {
  enabled?: boolean;
  provider?: string;
  preset?: string;
  updatedAt?: number;
};

export type ResolvedAiModels = {
  provider: AiWorkflowProvider;
  preset: AiWorkflowPreset;
  chatTextModel: string;
  chatVisionModel: string;
  imageGenerationModel: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
};

export type TextCreditGate = {
  user: any;
  userId: string;
  supabase: any;
  unlimited: boolean;
  creditsUsed: number;
  creditsLimit: number;
  purchasedBalance: number;
  resetAtIso: string | null;
};

export type AuthenticatedUserGate = {
  user: { id: string; email?: string | null };
  userId: string;
  supabase: any;
};

export const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5';
export const REFACTOR_OPENAI_FALLBACK_MODEL = 'gpt-4o';
export const CLAUDE_FALLBACK_MODEL = CLAUDE_HAIKU_MODEL;

export const CRAFT_REGULAR_PRESET: AiWorkflowPreset = 'cheapest';
export const CRAFT_SUPER_PRESET: AiWorkflowPreset = 'default';

export const TEXT_CREDITS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_PROVIDERS: Set<AiWorkflowProvider> = new Set([
  'openai',
  'google',
  'anthropic',
  'deepseek',
  'alibaba',
  'inclusionai',
]);

const PRESETS_BY_PROVIDER: Record<AiWorkflowProvider, Set<string>> = {
  openai: new Set(['default', 'cheapest', 'gpt5_mini', 'latest', 'gpt4o']),
  google: new Set(['default', 'cheapest', 'gemini_pro', 'latest', 'gemini_36_flash', 'gemini_35_flash_lite']),
  anthropic: new Set(['default']),
  deepseek: new Set(['default', 'cheapest', 'deepseek_v4_flash']),
  alibaba: new Set(['default', 'qwen_flash']),
  inclusionai: new Set(['default', 'ling_flash']),
};

export function normalizeProvider(provider: unknown): AiWorkflowProvider {
  const p = String(provider || 'openai') as AiWorkflowProvider;
  return ALLOWED_PROVIDERS.has(p) ? p : 'openai';
}

export function normalizePreset(preset: unknown, provider: AiWorkflowProvider = 'openai'): AiWorkflowPreset {
  const p = String(preset || 'default') as AiWorkflowPreset;
  const allowed = PRESETS_BY_PROVIDER[provider] || PRESETS_BY_PROVIDER.openai;
  return allowed.has(p) ? p : 'default';
}

/** Weighted credit cost for a single AI text call (real API pricing baseline). */
const CREDIT_COST: Record<AiWorkflowProvider, Record<string, number>> = {
  openai: {
    default: 40,
    cheapest: 25,
    gpt5_mini: 200,
    latest: 500,
    gpt4o: 80,
  },
  google: {
    default: 40,
    cheapest: 25,
    gemini_pro: 350,
    latest: 100,
    gemini_36_flash: 40,
    gemini_35_flash_lite: 25,
  },
  anthropic: {
    default: 40,
  },
  deepseek: {
    default: 20,
    cheapest: 20,
    deepseek_v4_flash: 20,
  },
  alibaba: {
    default: 20,
    qwen_flash: 20,
  },
  inclusionai: {
    default: 15,
    ling_flash: 15,
  },
};

export function getTextCreditCost(
  provider: AiWorkflowProvider = 'openai',
  preset: AiWorkflowPreset = 'default',
): number {
  return CREDIT_COST[provider]?.[preset] ?? CREDIT_COST.openai.default;
}
