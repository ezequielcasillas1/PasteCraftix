import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AiWorkflowPreset = 'default' | 'cheapest' | 'gpt5_mini' | 'latest' | 'gemini_pro';
export type AiWorkflowProvider = 'openai' | 'google';

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

const ALLOWED_PROVIDERS: Set<AiWorkflowProvider> = new Set(['openai', 'google']);
const PRESETS_BY_PROVIDER: Record<AiWorkflowProvider, Set<string>> = {
  openai: new Set(['default', 'cheapest', 'gpt5_mini', 'latest']),
  google: new Set(['default', 'cheapest', 'gemini_pro', 'latest']),
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
    return { ...base, preset, chatTextModel: 'gpt-5-nano', chatVisionModel: 'gpt-5-nano', imageGenerationModel: 'dall-e-3' };
  }
  if (preset === 'gpt5_mini') {
    return { ...base, preset, chatTextModel: 'gpt-5-mini', chatVisionModel: 'gpt-5-mini', imageGenerationModel: 'dall-e-3' };
  }
  if (preset === 'latest') {
    return { ...base, preset, chatTextModel: 'gpt-5.2', chatVisionModel: 'gpt-5.2', imageGenerationModel: 'dall-e-3' };
  }
  // default
  return { ...base, preset: 'default', chatTextModel: 'gpt-4o-mini', chatVisionModel: 'gpt-4o', imageGenerationModel: 'dall-e-3' };
}

// ── Google Gemini model resolution (OpenAI-compatible endpoint) ──
function resolveGoogle(preset: AiWorkflowPreset): ResolvedAiModels {
  const base = { provider: 'google' as const, apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKeyEnv: 'GOOGLE_AI_KEY' };

  if (preset === 'cheapest') {
    return { ...base, preset, chatTextModel: 'gemini-2.0-flash-lite', chatVisionModel: 'gemini-2.0-flash-lite', imageGenerationModel: 'dall-e-3' };
  }
  if (preset === 'gemini_pro') {
    return { ...base, preset, chatTextModel: 'gemini-2.5-pro-preview-05-06', chatVisionModel: 'gemini-2.5-pro-preview-05-06', imageGenerationModel: 'dall-e-3' };
  }
  if (preset === 'latest') {
    return { ...base, preset, chatTextModel: 'gemini-2.5-flash-preview-04-17', chatVisionModel: 'gemini-2.5-flash-preview-04-17', imageGenerationModel: 'dall-e-3' };
  }
  // default
  return { ...base, preset: 'default', chatTextModel: 'gemini-2.0-flash', chatVisionModel: 'gemini-2.0-flash', imageGenerationModel: 'dall-e-3' };
}

export function resolveModelsFromWorkflow(workflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null): ResolvedAiModels {
  const provider = workflow ? workflow.provider : 'openai';
  const preset = workflow ? workflow.preset : 'default';

  if (provider === 'google') return resolveGoogle(preset);
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
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...payload,
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

    // Only retry on "model missing" class errors; otherwise fail fast.
    if (!looksLikeMissingModelError(msg)) {
      throw new Error(msg || `${provider} API error`);
    }
  }

  const msg = String(lastErr?.error?.message || lastErr?.error || `${provider} API error`);
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

function computeTextCreditsLimitFallback(resetAtIso: string | null): number {
  try {
    if (!resetAtIso) return 10_000;
    const resetMs = Date.parse(resetAtIso);
    if (!Number.isFinite(resetMs)) return 10_000;
    const diffDays = (resetMs - Date.now()) / 86400000;
    if (diffDays <= 10) return 4_000;
    if (diffDays <= 40) return 10_000;
    return 100_000;
  } catch (_) {
    return 10_000;
  }
}

// Legacy flat-credit limits → weighted-credit limits (one-time migration)
const LEGACY_LIMIT_MAP = new Map<number, number>([[100, 4_000], [250, 10_000], [2500, 100_000]]);

export type TextCreditGate = {
  user: any;
  userId: string;
  supabase: any;
  unlimited: boolean;
  creditsUsed: number;
  creditsLimit: number;
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

  const { data: sub, error: subErr } = await supabase
    .from('user_subscriptions')
    .select([
      'user_id', 'subscription_tier', 'subscription_status',
      'has_unlimited_ai', 'ai_access_expires_at',
      'stripe_current_period_end',
      'ai_text_credits_limit', 'ai_text_credits_used', 'ai_text_credits_reset_at',
    ].join(','))
    .eq('user_id', user.id)
    .maybeSingle();

  if (subErr || !sub) {
    return new Response(
      JSON.stringify({ error: 'Subscription not found' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 403 }
    );
  }

  const tier = String(sub.subscription_tier || '').toLowerCase();
  const status = String(sub.subscription_status || '').toLowerCase();
  const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
  const hasCouponAiAccess = !!(sub && (
    sub.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  ));
  const isPaidPremium = (tier === 'premium' || tier === 'admin') && (status === 'active' || status === 'past_due');
  const entitled = isPaidPremium || hasCouponAiAccess;

  if (!entitled) {
    return new Response(
      JSON.stringify({ error: 'Upgrade required' }),
      { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 403 }
    );
  }

  const unlimited = sub.has_unlimited_ai === true || tier === 'admin';

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
  if (!Number.isFinite(creditsLimit) || creditsLimit <= 0) {
    creditsLimit = unlimited ? Number.POSITIVE_INFINITY : computeTextCreditsLimitFallback(resetAtIso);
  }

  // Auto-reset if period passed
  if (!unlimited) {
    const nowMs = Date.now();
    const resetMs = resetAtIso ? Date.parse(resetAtIso) : NaN;
    const stripeMs = stripePeriodEndIso ? Date.parse(stripePeriodEndIso) : NaN;
    const shouldResetForTime = Number.isFinite(resetMs) && nowMs >= resetMs;
    const shouldResetForStripeShift = Number.isFinite(stripeMs) && Number.isFinite(resetMs) && (stripeMs > resetMs + 10 * 60 * 1000);

    if (shouldResetForTime || shouldResetForStripeShift) {
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
    const remaining = Math.max(0, Number(creditsLimit) - Math.max(0, creditsUsed));
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({ error: 'No text credits remaining', creditsRemaining: 0, creditsLimit, creditsResetAt: resetAtIso }),
        { headers: { ...TEXT_CREDITS_CORS, 'Content-Type': 'application/json' }, status: 402 }
      );
    }
  }

  return { user, userId: user.id, supabase, unlimited, creditsUsed, creditsLimit, resetAtIso };
}

/**
 * Decrement text credits after a successful AI call (compare-and-set with retry).
 * @param cost Weighted credit cost for the model used (default 40).
 * Returns { creditsRemaining, creditsLimit, creditsResetAt }.
 */
export async function decrementTextCredits(gate: TextCreditGate, cost: number = 40): Promise<{ creditsRemaining: number | null; creditsLimit: number | null; creditsResetAt: string | null }> {
  if (gate.unlimited) {
    return { creditsRemaining: null, creditsLimit: null, creditsResetAt: gate.resetAtIso };
  }

  const safeCost = Math.max(1, Math.round(cost));
  let { creditsUsed, creditsLimit, resetAtIso, supabase, userId } = gate;
  let creditsLimitOut: number | null = Number.isFinite(creditsLimit) ? creditsLimit : null;
  let creditsResetAt: string | null = resetAtIso;

  let updatedUsed: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const expectedUsed = creditsUsed;
    const nextUsed = expectedUsed + safeCost;

    const { data: updated, error: updErr } = await supabase
      .from('user_subscriptions')
      .update({
        ai_text_credits_used: nextUsed,
        ai_text_credits_limit: creditsLimitOut,
        ai_text_credits_reset_at: resetAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('ai_text_credits_used', expectedUsed)
      .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at')
      .maybeSingle();

    if (!updErr && updated) {
      updatedUsed = Number(updated.ai_text_credits_used);
      creditsLimitOut = Number.isFinite(Number(updated.ai_text_credits_limit)) ? Number(updated.ai_text_credits_limit) : creditsLimitOut;
      creditsResetAt = updated.ai_text_credits_reset_at ? new Date(updated.ai_text_credits_reset_at).toISOString() : creditsResetAt;
      break;
    }

    const { data: refetched } = await supabase
      .from('user_subscriptions')
      .select('ai_text_credits_used, ai_text_credits_limit, ai_text_credits_reset_at')
      .eq('user_id', userId)
      .maybeSingle();

    creditsUsed = Number.isFinite(Number(refetched?.ai_text_credits_used)) ? Number(refetched?.ai_text_credits_used) : creditsUsed;
    creditsLimit = Number.isFinite(Number(refetched?.ai_text_credits_limit)) ? Number(refetched?.ai_text_credits_limit) : creditsLimit;
    resetAtIso = refetched?.ai_text_credits_reset_at ? new Date(refetched.ai_text_credits_reset_at).toISOString() : resetAtIso;
  }

  const finalUsed = updatedUsed ?? (creditsUsed + safeCost);
  const finalLimit = Number.isFinite(Number(creditsLimitOut)) ? Number(creditsLimitOut) : Number(creditsLimit);
  const creditsRemaining = Math.max(0, finalLimit - Math.max(0, finalUsed));

  return { creditsRemaining, creditsLimit: creditsLimitOut, creditsResetAt };
}
