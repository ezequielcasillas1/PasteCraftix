/**
 * Emits a structured usage event to stdout. Supabase's Logflare pipeline
 * captures every console.log from Edge Functions, so these lines are later
 * queryable via the Management API (function-edge-logs).
 *
 * Tag: PC_USAGE so admin queries can filter cheaply with REGEXP_CONTAINS.
 * Payload is a single-line JSON (no newlines) for easy regex extraction.
 */
export function logUsage(
  fn: string,
  action: string,
  userId: string | null,
  extra: Record<string, unknown> = {}
): void {
  try {
    const payload = {
      fn,
      action,
      user_id: userId || null,
      ts: new Date().toISOString(),
      ...extra,
    }
    // Prefix MUST stay 'PC_USAGE ' — admin queries look for that exact prefix.
    console.log('PC_USAGE ' + JSON.stringify(payload))
  } catch (_) {
    /* never let analytics break a request */
  }
}
