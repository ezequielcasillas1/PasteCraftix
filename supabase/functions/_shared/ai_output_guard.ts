/**
 * AI output guard — redact leaked secrets, strip system-prompt leaks,
 * OpenAI moderation for toxic/harmful text, cap length, log events.
 */

import { applyRedactionRules, logAiGuardEvent } from './ai_input_guard.ts';

export const AI_MAX_OUTPUT_CHARS = 16000;

const MODERATION_BLOCK_CATEGORIES = [
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
] as const;

/** Lines that look like echoed system instructions, not user content. */
const SYSTEM_LEAK_LINE = /^(?:\s*[-*]\s*)?(?:Rules:|Return STRICT JSON|You are a clipboard|REWRITE the snippet|Preserve facts|Do not add markdown|Array length MUST)/i;

export type GuardAiOutputOptions = {
  maxLen?: number;
  /** Run OpenAI /v1/moderations when key present (default: env AI_OUTPUT_MODERATION !== '0'). */
  moderate?: boolean;
  apiKey?: string;
};

function outputBlockedResponse(
  corsHeaders: Record<string, string>,
  message: string,
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: 'ai_output_blocked',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 },
  );
}

function stripSystemLeakLines(text: string): { text: string; stripped: boolean } {
  const lines = text.split('\n');
  const kept: string[] = [];
  let stripped = false;
  for (const line of lines) {
    if (SYSTEM_LEAK_LINE.test(line)) {
      stripped = true;
      continue;
    }
    kept.push(line);
  }
  return { text: kept.join('\n').trim(), stripped };
}

function moderationEnabled(): boolean {
  const off = (Deno.env.get('AI_OUTPUT_MODERATION') || '').toLowerCase();
  if (off === '0' || off === 'false' || off === 'off') return false;
  return true;
}

type ModerationResult = { flagged: boolean; categories: string[] };

export async function moderateTextWithOpenAI(
  apiKey: string,
  text: string,
): Promise<ModerationResult> {
  const input = String(text || '').slice(0, 32000);
  if (!input.trim()) return { flagged: false, categories: [] };

  const resp = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, model: 'omni-moderation-latest' }),
  });

  if (!resp.ok) {
    /* Fail open on moderation API errors — still redact below */
    return { flagged: false, categories: [] };
  }

  const data = await resp.json();
  const result = data?.results?.[0];
  if (!result?.flagged) return { flagged: false, categories: [] };

  const categories: string[] = [];
  const cats = result.categories || {};
  for (const key of MODERATION_BLOCK_CATEGORIES) {
    if (cats[key] === true) categories.push(key);
  }
  if (categories.length === 0 && result.flagged) {
    categories.push('flagged');
  }
  return { flagged: true, categories };
}

export type SanitizeAiOutputResult = {
  text: string;
  truncated: boolean;
  redactionKinds: string[];
  systemLeakStripped: boolean;
};

export function sanitizeAiOutputText(input: unknown, maxLen = AI_MAX_OUTPUT_CHARS): SanitizeAiOutputResult {
  let text = String(input ?? '');
  const { text: redacted, kinds: redactionKinds } = applyRedactionRules(text);
  text = redacted;

  const leak = stripSystemLeakLines(text);
  text = leak.text;
  const systemLeakStripped = leak.stripped;

  let truncated = false;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
    truncated = true;
  }

  return { text, truncated, redactionKinds, systemLeakStripped };
}

/**
 * Guard a single model response string (moderation + redaction + cap).
 * Returns Response to return to client, or sanitized text.
 */
export async function guardAiModelText(
  supabase: any,
  userId: string,
  text: string,
  route: string,
  corsHeaders: Record<string, string>,
  opts: GuardAiOutputOptions = {},
): Promise<string | Response> {
  const maxLen = opts.maxLen ?? AI_MAX_OUTPUT_CHARS;
  const openAiKey = opts.apiKey || Deno.env.get('OPENAI_API_KEY') || '';

  if (moderationEnabled() && openAiKey && opts.moderate !== false) {
    const mod = await moderateTextWithOpenAI(openAiKey, text);
    if (mod.flagged) {
      await logAiGuardEvent(supabase, userId, 'ai_output_moderation_blocked', {
        route,
        categories: mod.categories,
      });
      return outputBlockedResponse(
        corsHeaders,
        'AI response blocked: content did not pass safety checks. Try rephrasing your clip.',
      );
    }
  }

  const result = sanitizeAiOutputText(text, maxLen);
  const kinds = [...new Set(result.redactionKinds)];

  if (kinds.length) {
    await logAiGuardEvent(supabase, userId, 'ai_output_redacted', { route, kinds, count: kinds.length });
  }
  if (result.truncated) {
    await logAiGuardEvent(supabase, userId, 'ai_output_truncated', { route, maxLen });
  }
  if (result.systemLeakStripped) {
    await logAiGuardEvent(supabase, userId, 'ai_output_system_leak_stripped', { route });
  }

  return result.text;
}

/** Redact/sanitize each string after parse (no second moderation call). */
export async function guardAiOutputStrings(
  supabase: any,
  userId: string,
  texts: string[],
  route: string,
  maxLen = AI_MAX_OUTPUT_CHARS,
): Promise<string[]> {
  const out: string[] = [];
  const allKinds: string[] = [];
  let anyTruncated = false;
  let anyLeak = false;

  for (const raw of texts) {
    const result = sanitizeAiOutputText(raw, maxLen);
    if (result.redactionKinds.length) allKinds.push(...result.redactionKinds);
    if (result.truncated) anyTruncated = true;
    if (result.systemLeakStripped) anyLeak = true;
    out.push(result.text);
  }

  if (allKinds.length) {
    await logAiGuardEvent(supabase, userId, 'ai_output_redacted', {
      route,
      kinds: [...new Set(allKinds)],
      batch: true,
    });
  }
  if (anyTruncated) {
    await logAiGuardEvent(supabase, userId, 'ai_output_truncated', { route, batch: true });
  }
  if (anyLeak) {
    await logAiGuardEvent(supabase, userId, 'ai_output_system_leak_stripped', { route, batch: true });
  }

  return out;
}
