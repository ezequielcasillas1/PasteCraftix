/**
 * Stable string key for clip IDs.
 * Normalizes legacy float ids from Date.now()+Math.random().
 */

function normalizeFloatClipIdKey(num) {
  const rounded = Math.round(num * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

export function getClipIdKey(id) {
  if (id == null || id === '') return '';
  if (typeof id === 'number') {
    if (Number.isInteger(id)) return String(id);
    if (id >= 1e12 && id < 1e16) return normalizeFloatClipIdKey(id);
    return String(id);
  }
  const raw = String(id).trim();
  if (!raw) return '';
  const num = Number(raw);
  if (raw.includes('.') && Number.isFinite(num) && num >= 1e12 && num < 1e16) {
    return normalizeFloatClipIdKey(num);
  }
  return raw;
}
