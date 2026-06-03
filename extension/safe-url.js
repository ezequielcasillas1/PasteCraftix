const ALLOWED_EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export function resolveSafeExternalUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
