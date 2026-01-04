/**
 * Netlify Function: support-ticket
 * Sends support emails via Resend to PasteCraft inboxes.
 *
 * Required env vars:
 * - RESEND_API_KEY
 * - RESEND_FROM (e.g. "PasteCraft <support@pastecraft.com>" or "no-reply@pastecraft.com")
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 *
 * Optional env vars:
 * - SUPPORT_TICKET_COOLDOWN_SECONDS (default 60)
 */

const COOLDOWN_DEFAULT_SECONDS = 60;

// Best-effort in-memory rate limit (serverless cold starts may reset this)
const lastSentByUser = new Map(); // userId -> epochMs

const DESTINATION_BY_TYPE = {
  team: 'team@pastecraft.com',
  help: 'help@pastecraft.com',
  support: 'support@pastecraft.com',
  reportbugs: 'reportbugs@pastecraft.com',
  howcanweimprove: 'howcanweimprove@pastecraft.com',
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

async function getSupabaseUser({ supabaseUrl, supabaseAnonKey, accessToken }) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, text };
  }

  const user = await resp.json();
  return { ok: true, user };
}

async function sendViaResend({ resendApiKey, from, to, subject, text, replyTo }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyTo ? [replyTo] : undefined,
    }),
  });

  const raw = await resp.text().catch(() => '');
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_) {
    parsed = null;
  }

  if (!resp.ok) return { ok: false, status: resp.status, raw, parsed };
  return { ok: true, status: resp.status, parsed };
}

function clampString(value, maxLen) {
  const s = typeof value === 'string' ? value : '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY || '';
  const resendFrom = process.env.RESEND_FROM || '';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const cooldownSeconds = Number(process.env.SUPPORT_TICKET_COOLDOWN_SECONDS || COOLDOWN_DEFAULT_SECONDS);

  if (!resendApiKey || !resendFrom || !supabaseUrl || !supabaseAnonKey) {
    return json(500, { ok: false, error: 'Server not configured' });
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const tokenMatch = String(authHeader).match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch ? tokenMatch[1] : '';
  if (!accessToken) {
    return json(401, { ok: false, error: 'Missing authorization token' });
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const type = String(payload?.type || '').toLowerCase();
  const to = DESTINATION_BY_TYPE[type];
  if (!to) {
    return json(400, { ok: false, error: 'Invalid form type' });
  }

  const subjectInput = clampString(payload?.subject, 160).trim();
  const descriptionInput = clampString(payload?.description, 4000).trim();
  const extraFields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};

  if (!subjectInput || !descriptionInput) {
    return json(400, { ok: false, error: 'Subject and description are required' });
  }

  const userRes = await getSupabaseUser({ supabaseUrl, supabaseAnonKey, accessToken });
  if (!userRes.ok) {
    return json(401, { ok: false, error: 'Invalid session' });
  }

  const user = userRes.user || {};
  const userId = user.id || 'unknown';
  const userEmail = user.email || '';
  if (!userEmail) {
    return json(400, { ok: false, error: 'User email not found' });
  }

  const now = Date.now();
  const last = lastSentByUser.get(userId) || 0;
  if (cooldownSeconds > 0 && now - last < cooldownSeconds * 1000) {
    return json(429, { ok: false, error: 'Please wait before submitting again' });
  }

  const subject = `[${type}] ${subjectInput}`;

  const safeExtras = {};
  for (const [k, v] of Object.entries(extraFields)) {
    if (!k) continue;
    const key = clampString(k, 48);
    const val = clampString(typeof v === 'string' ? v : JSON.stringify(v), 500);
    safeExtras[key] = val;
  }

  const text = [
    `Type: ${type}`,
    `From: ${userEmail}`,
    `UserId: ${userId}`,
    ``,
    `Subject: ${subjectInput}`,
    ``,
    `Description:`,
    descriptionInput,
    ``,
    `Extra:`,
    Object.keys(safeExtras).length ? JSON.stringify(safeExtras, null, 2) : '{}',
  ].join('\n');

  const sendRes = await sendViaResend({
    resendApiKey,
    from: resendFrom,
    to,
    subject,
    text,
    replyTo: userEmail,
  });

  if (!sendRes.ok) {
    return json(502, { ok: false, error: 'Email send failed' });
  }

  lastSentByUser.set(userId, now);

  return json(200, { ok: true });
};


