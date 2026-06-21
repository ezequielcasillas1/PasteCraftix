import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireNotBanned } from './security-gate.ts'
import { computeTotalRemaining, hasAiUsageEntitlement, planCreditDrain, readPurchasedBalance, type UserSubscriptionCreditRow } from './credit_packs.ts'

export type AiWorkflowPreset = 'default' | 'cheapest' | 'gpt5_mini' | 'latest' | 'gemini_pro';
export type AiWorkflowProvider = 'openai' | 'google' | 'anthropic';

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

const ALLOWED_PROVIDERS: Set<AiWorkflowProvider> = new Set(['openai', 'google', 'anthropic']);
const PRESETS_BY_PROVIDER: Record<AiWorkflowProvider, Set<string>> = {
  openai: new Set(['default', 'cheapest', 'gpt5_mini', 'latest']),
  google: new Set(['default', 'cheapest', 'gemini_pro', 'latest']),
  anthropic: new Set(['default']),
};

function normalizeProvider(provider: unknown): AiWorkflowProvider {
  const p = String(provider || 'openai') as AiWorkflowProvider;
  return ALLOWED_PROVIDERS.has(p) ? p : 'openai';
}

function normalizePreset(preset: unknown, provider: AiWorkflowProvider = 'openai'): AiWorkflowPreset {
  const p = String(preset || 'default') as AiWorkflowPreset;
  const allowed = PRESETS_BY_PROVIDER[provider] || PRESETS_BY_PROVIDER.openai;
  return allowed.has(p) ? p : 'default';
}

// ── Craft power (two modes: regular | super) ───────────────────
// Craft batch operations (refactor/format/categorize) default to the cheapest
// model. "Super" opts into a single higher tier. CHANGE CRAFT_SUPER_PRESET to
// upgrade the Super model later — it must stay a valid OpenAI preset key.
export const CRAFT_REGULAR_PRESET: AiWorkflowPreset = 'cheapest';
export const CRAFT_SUPER_PRESET: AiWorkflowPreset = 'default';

/**
 * Map an untrusted client craftPower value to a server-whitelisted workflow.
 * Only the literal 'super' unlocks the higher tier; everything else (including
 * unknown/missing values) falls back to the cheapest regular preset.
 */
export function resolveCraftWorkflow(craftPower: unknown): { provider: AiWorkflowProvider; preset: AiWorkflowPreset } {
  const isSuper = String(craftPower || '').toLowerCase() === 'super';
  return { provider: 'openai', preset: isSuper ? CRAFT_SUPER_PRESET : CRAFT_REGULAR_PRESET };
}

export function parseAiWorkflowFromBody(body: any): { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null {
  try {
    const wf = body && typeof body === 'object' ? body.aiWorkflow : null;
    if (!wf || typeof wf !== 'object') return null;
    if (wf.enabled !== true) return null;
    const provider = normalizeProvider(wf.provider);
    const preset = normalizePreset(wf.preset, provider);
    return { provider, preset };
  } catch (_) {
    return null;
  }
}

// ── OpenAI model resolution ────────────────────────────
function resolveOpenAi(preset: AiWorkflowPreset): ResolvedAiModels {
  const base = { provider: 'openai' as const, apiBaseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY' };

  if (preset === 'cheapest') {
    return { ...base, preset, chatTextModel: 'gpt-5-nano', chatVisionModel: 'gpt-5-nano', imageGenerationModel: 'gpt-image-1' };
  }
  if (preset === 'gpt5_mini') {
    return { ...base, preset, chatTextModel: 'gpt-5-mini', chatVisionModel: 'gpt-5-mini', imageGenerationModel: 'gpt-image-1' };
  }
  if (preset === 'latest') {
    return { ...base, preset, chatTextModel: 'gpt-5.2', chatVisionModel: 'gpt-5.2', imageGenerationModel: 'gpt-image-1' };
  }
  // default
  return { ...base, preset: 'default', chatTextModel: 'gpt-4o-mini', chatVisionModel: 'gpt-4o', imageGenerationModel: 'gpt-image-1' };
}

// ── Google Gemini model resolution (OpenAI-compatible endpoint) ──
function resolveGoogle(preset: AiWorkflowPreset): ResolvedAiModels {
  const base = { provider: 'google' as const, apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKeyEnv: 'GOOGLE_AI_KEY' };

  if (preset === 'cheapest') {
    return { ...base, preset, chatTextModel: 'gemini-2.0-flash-lite', chatVisionModel: 'gemini-2.0-flash-lite', imageGenerationModel: 'gpt-image-1' };
  }
  if (preset === 'gemini_pro') {
    return { ...base, preset, chatTextModel: 'gemini-2.5-pro-preview-05-06', chatVisionModel: 'gemini-2.5-pro-preview-05-06', imageGenerationModel: 'gpt-image-1' };
  }
  if (preset === 'latest') {
    return { ...base, preset, chatTextModel: 'gemini-2.5-flash-preview-04-17', chatVisionModel: 'gemini-2.5-flash-preview-04-17', imageGenerationModel: 'gpt-image-1' };
  }
  // default
  return { ...base, preset: 'default', chatTextModel: 'gemini-2.0-flash', chatVisionModel: 'gemini-2.0-flash', imageGenerationModel: 'gpt-image-1' };
}

// ── Anthropic Claude model resolution ──────────────────────────
function resolveAnthropic(_preset: AiWorkflowPreset): ResolvedAiModels {
  return {
    provider: 'anthropic',
    preset: 'default',
    chatTextModel: CLAUDE_HAIKU_MODEL,
    chatVisionModel: CLAUDE_HAIKU_MODEL,
    imageGenerationModel: 'gpt-image-1',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  };
}

export function resolveModelsFromWorkflow(workflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null): ResolvedAiModels {
  const provider = workflow ? workflow.provider : 'openai';
  const preset = workflow ? workflow.preset : 'default';

  if (provider === 'google') return resolveGoogle(preset);
  if (provider === 'anthropic') return resolveAnthropic(preset);
  return resolveOpenAi(preset);
}

/** Resolve the API key from Deno env based on the resolved provider. Falls back to OPENAI_API_KEY. */
export function getApiKeyForResolved(resolved: ResolvedAiModels): string {
  const key = Deno.env.get(resolved.apiKeyEnv) || Deno.env.get('OPENAI_API_KEY') || '';
  if (!key) throw new Error(`API key not configured (expected ${resolved.apiKeyEnv})`);
  return key;
}

function looksLikeMissingModelError(msg: string) {
  const s = String(msg || '').toLowerCase();
  return s.includes('model') && (s.includes('not found') || s.includes('does not exist') || s.includes('no such model'));
}

/** GPT-5 / reasoning models reject legacy max_tokens on chat/completions. */
function usesMaxCompletionTokens(model: string): boolean {
  const m = String(model || '').toLowerCase();
  return m.startsWith('gpt-5') || /^o[134]/.test(m);
}

function looksLikeMaxTokensParamError(msg: string): boolean {
  const s = String(msg || '').toLowerCase();
  return s.includes('max_tokens') && s.includes('max_completion_tokens');
}

export function normalizeChatCompletionPayload(payload: Record<string, unknown>, model: string): Record<string, unknown> {
  const out = { ...payload };
  if (!usesMaxCompletionTokens(model)) return out;
  if (out.max_tokens != null && out.max_completion_tokens == null) {
    out.max_completion_tokens = out.max_tokens;
  }
  delete out.max_tokens;
  if (out.temperature !== undefined && out.temperature !== 1) {
    delete out.temperature;
  }
  return out;
}

export function getChatModelFallbackChain(model: string, provider: AiWorkflowProvider = 'openai'): string[] {
  const m = String(model || '').trim();

  if (provider === 'google') {
    if (!m) return ['gemini-2.0-flash'];
    if (m.includes('2.5-pro')) return [m, 'gemini-2.0-flash'];
    if (m.includes('2.5-flash')) return [m, 'gemini-2.0-flash'];
    if (m.includes('flash-lite')) return [m, 'gemini-2.0-flash'];
    return [m, 'gemini-2.0-flash'];
  }

  // OpenAI fallbacks
  if (!m) return ['gpt-4o-mini'];
  if (m === 'gpt-5.2') return ['gpt-5.2', 'gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-5-mini') return ['gpt-5-mini', 'gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-5-nano') return ['gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini'];
  if (m === 'gpt-5') return ['gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-4o') return ['gpt-4o', 'gpt-4o-mini'];

  return [m, 'gpt-4o-mini'];
}

export const CLAUDE_HAIKU_MODEL = 'claude-3-5-haiku-latest';
export const REFACTOR_OPENAI_FALLBACK_MODEL = 'gpt-4o';
const CLAUDE_FALLBACK_MODEL = CLAUDE_HAIKU_MODEL;

function payloadHasVisionContent(payload: any): boolean {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  return messages.some((msg: any) => {
    if (!Array.isArray(msg?.content)) return false;
    return msg.content.some((part: any) => part?.type === 'image_url' || part?.type === 'image');
  });
}

function toAnthropicMessages(payload: any): { system?: string; messages: Array<{ role: string; content: unknown }> } {
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  let system: string | undefined;
  const messages: Array<{ role: string; content: unknown }> = [];

  for (const msg of rawMessages) {
    const role = String(msg?.role || 'user');
    if (role === 'system') {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }
    if (role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
      });
      continue;
    }
    messages.push({
      role: 'user',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
    });
  }

  if (!messages.length) {
    messages.push({ role: 'user', content: 'Hello' });
  }

  return { system, messages };
}

function toOpenAiChatResponse(anthropicData: any) {
  const text = Array.isArray(anthropicData?.content)
    ? anthropicData.content
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => String(part.text || ''))
      .join('')
    : '';

  return {
    choices: [{ message: { role: 'assistant', content: text } }],
  };
}

function getAnthropicApiKey(): string {
  return (Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC-API-KEY') || '').trim();
}

async function fetchClaudeChat(payload: any, model: string = CLAUDE_HAIKU_MODEL) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const { system, messages } = toAnthropicMessages(payload);
  const maxTokens = Number(payload?.max_completion_tokens ?? payload?.max_tokens ?? 1024);
  const body: Record<string, unknown> = {
    model,
    max_tokens: Number.isFinite(maxTokens) ? Math.max(256, Math.min(maxTokens, 4096)) : 1024,
    messages,
  };
  if (system) body.system = system;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  return { data: toOpenAiChatResponse(data), usedModel: model };
}

async function fetchClaudeChatFallback(payload: any) {
  return fetchClaudeChat(payload, CLAUDE_FALLBACK_MODEL);
}

async function fetchOpenAiChatSingleModel(apiKey: string, payload: any, model: string) {
  const bodyPayload = normalizeChatCompletionPayload(payload, model);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...bodyPayload, model }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = String(err?.error?.message || err?.error || resp.statusText || 'OpenAI API error');
    throw new Error(msg);
  }

  const data = await resp.json();
  return { data, usedModel: model };
}

/** Refactor path: Claude Haiku primary, GPT-4o fallback (no 4o-mini). */
export async function fetchRefactorChatCompletions(
  payload: any,
  options?: { forceOpenAi?: boolean },
) {
  if (!options?.forceOpenAi) {
    const claudeResult = await fetchClaudeChat(payload, CLAUDE_HAIKU_MODEL);
    if (claudeResult) return { ...claudeResult, provider: 'anthropic' as const };
  }

  const openAiKey = Deno.env.get('OPENAI_API_KEY') || '';
  if (!openAiKey) {
    throw new Error(options?.forceOpenAi
      ? 'OpenAI API key not configured'
      : 'Anthropic and OpenAI unavailable');
  }

  const result = await fetchOpenAiChatSingleModel(openAiKey, payload, REFACTOR_OPENAI_FALLBACK_MODEL);
  return { ...result, provider: 'openai' as const };
}

export async function verifyAnthropicFallback() {
  const configured = !!getAnthropicApiKey();
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      model: CLAUDE_FALLBACK_MODEL,
      detail: 'ANTHROPIC_API_KEY not set',
    };
  }

  const result = await fetchClaudeChatFallback({
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    max_tokens: 16,
  });

  return {
    configured: true,
    reachable: !!result,
    model: CLAUDE_FALLBACK_MODEL,
    detail: result ? 'Claude fallback reachable' : 'Claude API call failed',
  };
}

export async function fetchChatCompletionsWithModelFallback(
  apiKey: string,
  payload: any,
  model: string,
  resolved?: ResolvedAiModels
) {
  const baseUrl = resolved?.apiBaseUrl || 'https://api.openai.com/v1';
  const provider = resolved?.provider || 'openai';
  const candidates = getChatModelFallbackChain(model, provider);
  let lastErr: any = null;

  for (const m of candidates) {
    const bodyPayload = normalizeChatCompletionPayload(payload, m);
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...bodyPayload,
        model: m,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return { data, usedModel: m };
    }

    const err = await resp.json().catch(() => ({}));
    lastErr = err;
    const msg = String(err?.error?.message || err?.error || resp.statusText || '');

    if (looksLikeMaxTokensParamError(msg) && payload.max_tokens != null) {
      const retryPayload = normalizeChatCompletionPayload(payload, m);
      const retryResp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ...retryPayload, model: m }),
      });
      if (retryResp.ok) {
        const data = await retryResp.json();
        return { data, usedModel: m };
      }
    }

    // Only retry on "model missing" class errors; otherwise try Claude fallback.
    if (!looksLikeMissingModelError(msg)) {
      if (!payloadHasVisionContent(payload)) {
        const claudeResult = await fetchClaudeChatFallback(payload);
        if (claudeResult) return claudeResult;
      }
      throw new Error(msg || `${provider} API error`);
    }
  }

  const msg = String(lastErr?.error?.message || lastErr?.error || `${provider} API error`);
  if (!payloadHasVisionContent(payload)) {
    const claudeResult = await fetchClaudeChatFallback(payload);
    if (claudeResult) return claudeResult;
  }
  throw new Error(msg);
}

// ── Weighted Credit Costs Per Model ────────────────────────────
// Cost is based on real API pricing (input + output per call).
// Cheapest baseline ≈ 25 credits; scales with actual $/call ratio.

const CREDIT_COST: Record<AiWorkflowProvider, Record<string, number>> = {
  openai: {
    default:   40,   // GPT-4o Mini
    cheapest:  25,   // GPT-5 Nano
    gpt5_mini: 200,  // GPT-5 Mini
    latest:    500,  // GPT-5.2
  },
  google: {
    default:    40,   // Gemini 2.0 Flash
    cheapest:   25,   // Gemini 2.0 Flash Lite
    gemini_pro: 350,  // Gemini 2.5 Pro
    latest:     100,  // Gemini 2.5 Flash
  },
  anthropic: {
    default: 40,   // Claude 3.5 Haiku
  },
};

/** Return the weighted credit cost for a single AI text call. */
export function getTextCreditCost(provider: AiWorkflowProvider = 'openai', preset: AiWorkflowPreset = 'default'): number {
  return CREDIT_COST[provider]?.[preset] ?? CREDIT_COST.openai.default;
}

// ── Text Credit Enforcement Helpers ────────────────────────────

const TEXT_CREDITS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseBearerToken(authHeader: string | null): string {
  const raw = String(authHeader || '');
  const lower = raw.toLowerCase();
  if (!lower.startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

type TextAllowancePolicy = {
  grant: number;
  cap: number;
};

function resolveTextAllowancePolicy(resetAtIso: string | null): TextAllowancePolicy {
  try {
    if (!resetAtIso) return { grant: 35_000, cap: 35_000 };
    const resetMs = Date.parse(resetAtIso);
    if (!Number.isFinite(resetMs)) return { grant: 35_000, cap: 35_000 };
    const diffDays = (resetMs - Date.now()) / 86400000;
    if (diffDays <= 10) return { grant: 4_000, cap: 20_000 };
    if (diffDays <= 40) return { grant: 35_000, cap: 35_000 };
    return { grant: 500_000, cap: 500_000 };
  } catch (_) {
    return { grant: 35_000, cap: 35_000 };
  }
}

function computeTextCreditsLimitFallback(resetAtIso: string | null): number {
  return resolveTextAllowancePolicy(resetAtIso).grant;
}

function accrueWeeklyRolloverLimit(limit: number, used: number, grant: number, cap: number): number {
  const remaining = Math.max(0, Number(limit) - Math.max(0, Number(used)));
  return Math.min(cap, remaining + grant);
}

// Legacy flat-credit limits → weighted-credit limits (one-time migration)
const LEGACY_LIMIT_MAP = new Map<number, number>([
  [100, 4_000],
  [250, 35_000],
  [2500, 500_000],
  [10_000, 35_000],
  [100_000, 500_000],
]);

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

/**
 * Authenticate user + check text credit balance.
 * Returns a TextCreditGate on success, or a ready-to-return Response on failure.
 */
export async function requireTextCredits(req: Request): Promise<TextCreditGate | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase env not configured' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user || null;
  if (userErr || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const banResponse = await requireNotBanned(user.id, supabase);
  if (banResponse) return banResponse;

  const { data: subRaw, error: subErr } = await supabase
    .from('user_subscriptions')
    .select([
      'user_id', 'subscription_tier', 'subscription_status',
      'has_unlimited_ai', 'ai_access_expires_at',
      'stripe_current_period_end',
      'ai_text_credits_limit', 'ai_text_credits_used', 'ai_text_credits_reset_at',
      'ai_purchased_credits_balance',
    ].join(','))
    .eq('user_id', user.id)
    .maybeSingle();

  if (subErr || !subRaw) {
    return new Response(
      JSON.stringify({ error: 'Subscription not found' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 403 }
    );
  }

  const sub = subRaw as UserSubscriptionCreditRow;
  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  const hasCouponAiAccess = !!(sub && (
    sub.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  ));
  const purchasedBalance = readPurchasedBalance(sub);
  const hasAllowance = hasAiUsageEntitlement(sub);

  if (!hasAllowance) {
    return new Response(
      JSON.stringify({ error: 'Upgrade required' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 403 }
    );
  }

  const unlimited = sub.has_unlimited_ai === true;
  const isPaidTier = tier === 'premium'
    && (status === 'active' || status === 'past_due');

  const stripePeriodEndIso = sub.stripe_current_period_end
    ? new Date(sub.stripe_current_period_end).toISOString()
    : null;
  let resetAtIso = sub.ai_text_credits_reset_at
    ? new Date(sub.ai_text_credits_reset_at).toISOString()
    : (stripePeriodEndIso || null);

  if (!resetAtIso && hasCouponAiAccess && !unlimited) {
    resetAtIso = new Date(Date.now() + 30 * 86400000).toISOString();
  }

  let creditsUsed = Number.isFinite(Number(sub.ai_text_credits_used)) ? Number(sub.ai_text_credits_used) : 0;
  let creditsLimit = Number.isFinite(Number(sub.ai_text_credits_limit)) ? Number(sub.ai_text_credits_limit) : NaN;
  const allowancePolicy = unlimited ? null : resolveTextAllowancePolicy(resetAtIso);
  if (!Number.isFinite(creditsLimit) || creditsLimit <= 0) {
    creditsLimit = unlimited
      ? Number.POSITIVE_INFINITY
      : ((isPaidTier || hasCouponAiAccess) ? computeTextCreditsLimitFallback(resetAtIso) : 0);
  }

  // Auto-reset if period passed
  if (!unlimited) {
    const nowMs = Date.now();
    const resetMs = resetAtIso ? Date.parse(resetAtIso) : NaN;
    const stripeMs = stripePeriodEndIso ? Date.parse(stripePeriodEndIso) : NaN;
    const shouldResetForTime = Number.isFinite(resetMs) && nowMs >= resetMs;
    const shouldResetForStripeShift = Number.isFinite(stripeMs) && Number.isFinite(resetMs) && (stripeMs > resetMs + 10 * 60 * 1000);

    if (shouldResetForTime || shouldResetForStripeShift) {
      creditsLimit = allowancePolicy && allowancePolicy.cap > allowancePolicy.grant
        ? accrueWeeklyRolloverLimit(creditsLimit, creditsUsed, allowancePolicy.grant, allowancePolicy.cap)
        : (allowancePolicy?.grant ?? creditsLimit);
      creditsUsed = 0;
      resetAtIso = (Number.isFinite(stripeMs) && stripeMs > nowMs)
        ? new Date(stripeMs).toISOString()
        : new Date(nowMs + 30 * 86400000).toISOString();

      await supabase
        .from('user_subscriptions')
        .update({
          ai_text_credits_used: 0,
          ai_text_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
          ai_text_credits_reset_at: resetAtIso,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    } else if (!sub.ai_text_credits_reset_at && resetAtIso) {
      await supabase
        .from('user_subscriptions')
        .update({
          ai_text_credits_limit: Number.isFinite(creditsLimit) ? creditsLimit : null,
          ai_text_credits_reset_at: resetAtIso,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }
  }

  // Migrate legacy flat-credit limits to weighted scale
  if (!unlimited && LEGACY_LIMIT_MAP.has(creditsLimit)) {
    const newLimit = LEGACY_LIMIT_MAP.get(creditsLimit)!;
    const scaledUsed = Math.round(creditsUsed * 40);
    creditsLimit = newLimit;
    creditsUsed = scaledUsed;
    await supabase
      .from('user_subscriptions')
      .update({
        ai_text_credits_limit: newLimit,
        ai_text_credits_used: scaledUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  }

  if (!unlimited) {
    const subRemaining = Math.max(0, Number(creditsLimit) - Math.max(0, creditsUsed));
    const totalRemaining = computeTotalRemaining(subRemaining, purchasedBalance);
    if (totalRemaining <= 0) {
      return new Response(
        JSON.stringify({
          error: 'No text credits remaining',
          creditsRemaining: 0,
          creditsLimit,
          purchasedBalance,
          creditsResetAt: resetAtIso,
        }),
        { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 402 }
      );
    }
  }

  return { user, userId: user.id, supabase, unlimited, creditsUsed, creditsLimit, purchasedBalance, resetAtIso };
}

/**
 * Decrement text credits after a successful AI call (compare-and-set with retry).
 * @param cost Weighted credit cost for the model used (default 40).
 * Returns { creditsRemaining, creditsLimit, creditsResetAt }.
 */
export async function decrementTextCredits(
  gate: TextCreditGate,
  cost: number = 40,
): Promise<{ creditsRemaining: number | null; creditsLimit: number | null; creditsResetAt: string | null; purchasedBalance: number | null }> {
  if (gate.unlimited) {
    return { creditsRemaining: null, creditsLimit: null, creditsResetAt: gate.resetAtIso, purchasedBalance: null };
  }

  const safeCost = Math.max(1, Math.round(cost));
  let { creditsUsed, creditsLimit, purchasedBalance, resetAtIso, supabase, userId } = gate;
  let creditsLimitOut: number | null = Number.isFinite(creditsLimit) ? creditsLimit : null;
  let creditsResetAt: string | null = resetAtIso;
  let purchasedOut = Math.max(0, purchasedBalance);

  const subRemaining = Math.max(0, Number(creditsLimitOut ?? creditsLimit) - Math.max(0, creditsUsed));
  const drainPlan = planCreditDrain(subRemaining, purchasedOut, safeCost);
  if (!drainPlan) {
    return { creditsRemaining: 0, creditsLimit: creditsLimitOut, creditsResetAt, purchasedBalance: purchasedOut };
  }

  let updatedUsed: number | null = null;
  let updatedPurchased: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const expectedUsed = creditsUsed;
    const expectedPurchased = purchasedOut;
    const nextUsed = expectedUsed + drainPlan.subUsedDelta;
    const nextPurchased = Math.max(0, expectedPurchased - drainPlan.purchasedDelta);

    const { data: updated, error: updErr } = await supabase
      .from('user_subscriptions')
      .update({
        ai_text_credits_used: nextUsed,
        ai_text_credits_limit: creditsLimitOut,
        ai_text_credits_reset_at: resetAtIso,
        ai_purchased_credits_balance: nextPurchased,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('ai_text_credits_used', expectedUsed)
      .eq('ai_purchased_credits_balance', expectedPurchased)
      .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at, ai_purchased_credits_balance')
      .maybeSingle();

    if (!updErr && updated) {
      updatedUsed = Number(updated.ai_text_credits_used);
      updatedPurchased = Number(updated.ai_purchased_credits_balance);
      creditsLimitOut = Number.isFinite(Number(updated.ai_text_credits_limit)) ? Number(updated.ai_text_credits_limit) : creditsLimitOut;
      creditsResetAt = updated.ai_text_credits_reset_at ? new Date(updated.ai_text_credits_reset_at).toISOString() : creditsResetAt;
      break;
    }

    const { data: refetched } = await supabase
      .from('user_subscriptions')
      .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at, ai_purchased_credits_balance')
      .eq('user_id', userId)
      .maybeSingle();

    creditsUsed = Number.isFinite(Number(refetched?.ai_text_credits_used)) ? Number(refetched.ai_text_credits_used) : creditsUsed;
    creditsLimit = Number.isFinite(Number(refetched?.ai_text_credits_limit)) ? Number(refetched.ai_text_credits_limit) : creditsLimit;
    purchasedOut = Number.isFinite(Number(refetched?.ai_purchased_credits_balance))
      ? Math.max(0, Number(refetched.ai_purchased_credits_balance))
      : purchasedOut;
    resetAtIso = refetched?.ai_text_credits_reset_at ? new Date(refetched.ai_text_credits_reset_at).toISOString() : resetAtIso;
  }

  const finalUsed = updatedUsed ?? (creditsUsed + drainPlan.subUsedDelta);
  const finalPurchased = updatedPurchased ?? Math.max(0, purchasedOut - drainPlan.purchasedDelta);
  const finalLimit = Number.isFinite(Number(creditsLimitOut)) ? Number(creditsLimitOut) : Number(creditsLimit);
  const subRem = Math.max(0, finalLimit - Math.max(0, finalUsed));
  const creditsRemaining = computeTotalRemaining(subRem, finalPurchased);

  return { creditsRemaining, creditsLimit: creditsLimitOut, creditsResetAt, purchasedBalance: finalPurchased };
}

export type AuthenticatedUserGate = {
  user: { id: string; email?: string | null };
  userId: string;
  supabase: any;
};

/** JWT required + ban gate. No premium required (e.g. ai-name). */
export async function requireAuthenticatedUser(req: Request): Promise<AuthenticatedUserGate | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase env not configured' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 500 },
    );
  }

  const token = parseBearerToken(req.headers.get('authorization'));
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 401 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user || null;
  if (userErr || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 401 },
    );
  }

  const banResponse = await requireNotBanned(user.id, supabase);
  if (banResponse) return banResponse;

  return { user, userId: user.id, supabase };
}

const AI_NAME_HOURLY_LIMIT = 20;

export async function checkAiNameRateLimit(supabase: any, userId: string): Promise<Response | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_name_attempt_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('attempted_at', oneHourAgo);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Rate limit check failed' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 503 },
    );
  }

  if ((count ?? 0) >= AI_NAME_HOURLY_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'Too many AI name requests. Try again later.' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 429 },
    );
  }

  await supabase.from('ai_name_attempt_log').insert({ user_id: userId });
  return null;
}
