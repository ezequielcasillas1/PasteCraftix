/**
 * AI input guard — scrub secrets/PII, block prompt-injection, cap length, log events.
 */

export const AI_MAX_CLIP_CHARS = 8000;
export const AI_MAX_SUMMARY_CHARS = 12000;
export const AI_MAX_IMAGE_PROMPT_CHARS = 1500;
export const AI_MAX_NAME_CHARS = 80;

type RedactionRule = { kind: string; pattern: RegExp; replacement: string };

const REDACTION_RULES: RedactionRule[] = [
  { kind: 'openai_key', pattern: /\bsk-[a-zA-Z0-9]{20,}\b/g, replacement: '[REDACTED_KEY]' },
  { kind: 'stripe_key', pattern: /\bsk_(?:live|test)_[a-zA-Z0-9]{16,}\b/g, replacement: '[REDACTED_KEY]' },
  { kind: 'supabase_key', pattern: /\bsbp_[a-zA-Z0-9]{20,}\b/g, replacement: '[REDACTED_KEY]' },
  { kind: 'aws_key', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_KEY]' },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[REDACTED_TOKEN]' },
  { kind: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi, replacement: '[REDACTED_TOKEN]' },
  { kind: 'private_key', pattern: /-----BEGIN[\s\S]*?-----END[^\n-]*-----/g, replacement: '[REDACTED_KEY]' },
  { kind: 'db_uri', pattern: /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, replacement: '[REDACTED_URI]' },
  {
    kind: 'kv_secret',
    pattern: /\b(?:api[_-]?key|apikey|client[_-]?secret|secret[_-]?key|access[_-]?token|password)\s*[=:]\s*['"]?[a-zA-Z0-9_\-./]{12,}['"]?/gi,
    replacement: '[REDACTED_SECRET]',
  },
  { kind: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  { kind: 'credit_card', pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[REDACTED_CARD]' },
];

const INJECTION_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'ignore_instructions', pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+instructions/i },
  { id: 'disregard_prompt', pattern: /disregard\s+(?:your|the|all)\s+(?:system\s+)?(?:prompt|instructions)/i },
  { id: 'jailbreak', pattern: /\b(?:jailbreak|DAN\s+mode|developer\s+mode)\b/i },
  { id: 'reveal_prompt', pattern: /reveal\s+(?:your|the|hidden)\s+(?:system\s+)?(?:prompt|instructions)/i },
  { id: 'unrestricted_mode', pattern: /you\s+are\s+now\s+(?:in\s+)?(?:dan|evil|unrestricted)/i },
  { id: 'no_restrictions', pattern: /act\s+as\s+(?:if\s+you\s+)?(?:have|had)\s+no\s+(?:rules|restrictions|limits)/i },
  { id: 'system_override', pattern: /\bsystem\s*:\s*you\s+are\b/i },
];

export type SanitizeAiTextResult = {
  text: string;
  truncated: boolean;
  redactionKinds: string[];
  injectionMatch: string | null;
};

/** Redact secrets/PII patterns (shared with output guard). */
export function applyRedactionRules(text: string): { text: string; kinds: string[] } {
  const kinds: string[] = [];
  let out = text;
  for (const rule of REDACTION_RULES) {
    if (rule.pattern.test(out)) {
      kinds.push(rule.kind);
      out = out.replace(rule.pattern, rule.replacement);
    }
    rule.pattern.lastIndex = 0;
  }
  return { text: out, kinds };
}

export function sanitizeAiText(input: unknown, maxLen: number): SanitizeAiTextResult {
  let text = String(input ?? '');
  const { text: redacted, kinds: redactionKinds } = applyRedactionRules(text);
  text = redacted;

  let injectionMatch: string | null = null;
  for (const rule of INJECTION_PATTERNS) {
    if (rule.pattern.test(text)) {
      injectionMatch = rule.id;
      break;
    }
  }

  let truncated = false;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
    truncated = true;
  }

  return { text, truncated, redactionKinds, injectionMatch };
}

export async function logAiGuardEvent(
  supabase: any,
  userId: string,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: eventType,
      severity: eventType.includes('blocked') ? 'high' : 'medium',
      details,
      auto_banned: false,
    });
  } catch (_) {
    /* never block AI on logging failure */
  }
}

function blockedResponse(
  corsHeaders: Record<string, string>,
  message: string,
  status = 400,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
  );
}

export async function guardAiTexts(
  supabase: any,
  userId: string,
  texts: string[],
  route: string,
  corsHeaders: Record<string, string>,
  maxLen = AI_MAX_CLIP_CHARS,
): Promise<{ texts: string[] } | Response> {
  const out: string[] = [];
  const allRedactions: string[] = [];
  let anyTruncated = false;

  for (let i = 0; i < texts.length; i++) {
    const result = sanitizeAiText(texts[i], maxLen);
    if (result.injectionMatch) {
      await logAiGuardEvent(supabase, userId, 'ai_prompt_injection_blocked', {
        route,
        index: i,
        match: result.injectionMatch,
      });
      return blockedResponse(
        corsHeaders,
        'Request blocked: content matches disallowed AI manipulation patterns.',
        400,
      );
    }
    if (result.redactionKinds.length) allRedactions.push(...result.redactionKinds);
    if (result.truncated) anyTruncated = true;
    out.push(result.text);
  }

  if (allRedactions.length) {
    await logAiGuardEvent(supabase, userId, 'ai_input_redacted', {
      route,
      kinds: [...new Set(allRedactions)],
      count: allRedactions.length,
    });
  }
  if (anyTruncated) {
    await logAiGuardEvent(supabase, userId, 'ai_input_truncated', { route, maxLen });
  }

  return { texts: out };
}

export async function guardAiFields(
  supabase: any,
  userId: string,
  fields: Record<string, string>,
  route: string,
  corsHeaders: Record<string, string>,
  limits: Record<string, number>,
): Promise<Record<string, string> | Response> {
  const out: Record<string, string> = {};
  const allRedactions: string[] = [];
  let anyTruncated = false;

  for (const [key, value] of Object.entries(fields)) {
    const maxLen = limits[key] ?? AI_MAX_CLIP_CHARS;
    const result = sanitizeAiText(value, maxLen);
    if (result.injectionMatch) {
      await logAiGuardEvent(supabase, userId, 'ai_prompt_injection_blocked', {
        route,
        field: key,
        match: result.injectionMatch,
      });
      return blockedResponse(
        corsHeaders,
        'Request blocked: content matches disallowed AI manipulation patterns.',
        400,
      );
    }
    if (result.redactionKinds.length) allRedactions.push(...result.redactionKinds);
    if (result.truncated) anyTruncated = true;
    out[key] = result.text;
  }

  if (allRedactions.length) {
    await logAiGuardEvent(supabase, userId, 'ai_input_redacted', {
      route,
      kinds: [...new Set(allRedactions)],
      count: allRedactions.length,
    });
  }
  if (anyTruncated) {
    await logAiGuardEvent(supabase, userId, 'ai_input_truncated', { route });
  }

  return out;
}
