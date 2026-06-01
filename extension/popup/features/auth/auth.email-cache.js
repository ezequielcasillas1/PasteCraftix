import {
  AUTH_STORAGE_KEYS,
  AUTH_EMAIL_CACHE_MAX,
  AUTH_EMAIL_SUGGESTION_LIMIT,
} from './auth.constants.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

function emailFromAccessToken(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return '';
    const payload = JSON.parse(atob(part));
    return normalizeEmail(payload?.email || '');
  } catch (_) {
    return '';
  }
}

export async function resolveStoredAccountEmails(extraEmails = []) {
  const emails = [...extraEmails];

  try {
    const res = await chrome.storage.local.get([AUTH_STORAGE_KEYS.SUPABASE_SESSION]);
    const payload = res?.[AUTH_STORAGE_KEYS.SUPABASE_SESSION];
    if (payload?.email) emails.push(payload.email);
    if (payload?.access_token) {
      const fromJwt = emailFromAccessToken(payload.access_token);
      if (fromJwt) emails.push(fromJwt);
    }
  } catch (_) {}

  try {
    const auth = pasteCraftSupabase?.client?.auth;
    if (auth && typeof auth.getSession === 'function') {
      const { data } = await Promise.race([
        auth.getSession(),
        new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 800)),
      ]);
      if (data?.session?.user?.email) emails.push(data.session.user.email);
    }
  } catch (_) {}

  try {
    const user = await pasteCraftSupabase.getCurrentUser();
    if (user?.email) emails.push(user.email);
  } catch (_) {}

  return [...new Set(emails.map(normalizeEmail).filter(isValidEmail))];
}

export async function rememberVerifiedEmailsFromSession(extraEmails = []) {
  const emails = await resolveStoredAccountEmails(extraEmails);
  for (const email of emails) {
    await rememberVerifiedEmail(email);
  }
  return emails.length;
}

function sanitizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && isValidEmail(normalizeEmail(entry.email)))
    .map((entry) => ({
      email: normalizeEmail(entry.email),
      lastUsedAt: Number(entry.lastUsedAt) || 0,
    }));
}

async function readCache() {
  try {
    const res = await chrome.storage.local.get([AUTH_STORAGE_KEYS.VERIFIED_EMAILS]);
    const raw = res?.[AUTH_STORAGE_KEYS.VERIFIED_EMAILS];
    return { entries: sanitizeEntries(raw?.entries) };
  } catch (_) {
    return { entries: [] };
  }
}

async function writeCache(entries) {
  try {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEYS.VERIFIED_EMAILS]: {
        entries: entries.slice(0, AUTH_EMAIL_CACHE_MAX),
        updatedAt: Date.now(),
      },
    });
  } catch (_) {}
}

export async function getVerifiedEmails() {
  const { entries } = await readCache();
  return entries
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((entry) => entry.email);
}

export async function getLastUsedVerifiedEmail() {
  const emails = await getVerifiedEmails();
  return emails[0] || '';
}

export async function rememberVerifiedEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return;

  const { entries } = await readCache();
  const now = Date.now();
  const next = [{ email, lastUsedAt: now }, ...entries.filter((entry) => entry.email !== email)];
  await writeCache(next);
}

export async function filterVerifiedEmails(query, limit = AUTH_EMAIL_SUGGESTION_LIMIT) {
  const needle = normalizeEmail(query);
  const emails = await getVerifiedEmails();
  if (!needle) return emails.slice(0, limit);
  return emails.filter((email) => email.includes(needle)).slice(0, limit);
}

export async function bootstrapVerifiedEmailCache() {
  const existing = await getVerifiedEmails();
  if (existing.length) return existing.length;

  const unique = await resolveStoredAccountEmails();
  for (const email of unique) {
    await rememberVerifiedEmail(email);
  }
  return unique.length;
}
