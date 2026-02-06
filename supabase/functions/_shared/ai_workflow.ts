export type AiWorkflowPreset = 'default' | 'cheapest' | 'gpt5_mini' | 'latest';
export type AiWorkflowProvider = 'openai';

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
};

const ALLOWED_PRESETS: Set<AiWorkflowPreset> = new Set(['default', 'cheapest', 'gpt5_mini', 'latest']);

function normalizePreset(preset: unknown): AiWorkflowPreset {
  const p = String(preset || 'default') as AiWorkflowPreset;
  return ALLOWED_PRESETS.has(p) ? p : 'default';
}

export function parseAiWorkflowFromBody(body: any): { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null {
  try {
    const wf = body && typeof body === 'object' ? body.aiWorkflow : null;
    if (!wf || typeof wf !== 'object') return null;
    if (wf.enabled !== true) return null;
    const provider: AiWorkflowProvider = 'openai';
    const preset = normalizePreset(wf.preset);
    return { provider, preset };
  } catch (_) {
    return null;
  }
}

export function resolveModelsFromWorkflow(workflow: { provider: AiWorkflowProvider; preset: AiWorkflowPreset } | null): ResolvedAiModels {
  const preset = workflow ? workflow.preset : 'default';
  const provider: AiWorkflowProvider = 'openai';

  // Defaults must preserve current behavior when override is off.
  if (preset === 'default') {
    return {
      provider,
      preset,
      chatTextModel: 'gpt-4o-mini',
      chatVisionModel: 'gpt-4o',
      imageGenerationModel: 'dall-e-3',
    };
  }

  // “Cheapest” = GPT‑5 nano for text; keep vision stable for reliability.
  if (preset === 'cheapest') {
    return {
      provider,
      preset,
      chatTextModel: 'gpt-5-nano',
      chatVisionModel: 'gpt-5-nano',
      imageGenerationModel: 'dall-e-3',
    };
  }

  if (preset === 'gpt5_mini') {
    return {
      provider,
      preset,
      chatTextModel: 'gpt-5-mini',
      chatVisionModel: 'gpt-5-mini',
      imageGenerationModel: 'dall-e-3',
    };
  }

  // Latest = GPT‑5.2
  return {
    provider,
    preset: 'latest',
    chatTextModel: 'gpt-5.2',
    chatVisionModel: 'gpt-5.2',
    imageGenerationModel: 'dall-e-3',
  };
}

function looksLikeMissingModelError(msg: string) {
  const s = String(msg || '').toLowerCase();
  return s.includes('model') && (s.includes('not found') || s.includes('does not exist') || s.includes('no such model'));
}

export function getChatModelFallbackChain(model: string): string[] {
  const m = String(model || '').trim();
  if (!m) return ['gpt-4o-mini'];

  // Keep fallback chains short and safe.
  if (m === 'gpt-5.2') return ['gpt-5.2', 'gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-5-mini') return ['gpt-5-mini', 'gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-5-nano') return ['gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini'];
  if (m === 'gpt-5') return ['gpt-5', 'gpt-4o-mini'];
  if (m === 'gpt-4o') return ['gpt-4o', 'gpt-4o-mini'];

  return [m, 'gpt-4o-mini'];
}

export async function fetchChatCompletionsWithModelFallback(openaiKey: string, payload: any, model: string) {
  const candidates = getChatModelFallbackChain(model);
  let lastErr: any = null;

  for (const m of candidates) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
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

    // Only retry on “model missing” class errors; otherwise fail fast.
    if (!looksLikeMissingModelError(msg)) {
      throw new Error(msg || 'OpenAI API error');
    }
  }

  const msg = String(lastErr?.error?.message || lastErr?.error || 'OpenAI API error');
  throw new Error(msg);
}

