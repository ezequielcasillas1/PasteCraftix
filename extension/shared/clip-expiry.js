/** Clip auto-expire: duration + weekday scheduling and storage purge helpers. */

export const CLIP_EXPIRY_ALARM = 'pc-clip-expiry';
export const MAX_CLIP_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

export const CLIP_EXPIRY_PRESETS = Object.freeze([
  { key: '30m', label: '30 minutes', durationMs: 30 * 60 * 1000 },
  { key: '1h', label: '1 hour', durationMs: 60 * 60 * 1000 },
  { key: '2h', label: '2 hours', durationMs: 2 * 60 * 60 * 1000 },
  { key: '5h', label: '5 hours', durationMs: 5 * 60 * 60 * 1000 },
]);

export const WEEKDAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/**
 * Expiry formula (relative duration + weekday anchor):
 * - base = now + durationMs
 * - No weekday: expiresAt = base
 * - Weekday W: candidate = next calendar W (strictly after today) at time-of-day from base;
 *   expiresAt = max(base, candidate), capped to end of that weekday 23:59:59.999
 */
export function computeExpiresAt(durationMs, weekday, nowMs = Date.now()) {
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_CLIP_EXPIRY_MS) return null;

  const base = nowMs + duration;
  if (weekday == null || weekday === '') return base;

  const w = Number(weekday);
  if (!Number.isFinite(w) || w < 0 || w > 6) return base;

  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayDow = todayStart.getDay();

  let daysAhead = (w - todayDow + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;

  const targetDate = new Date(todayStart);
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const baseDate = new Date(base);
  const candidate = new Date(targetDate);
  candidate.setHours(
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds(),
  );

  let expiresAt = candidate.getTime() < base ? base : candidate.getTime();

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  if (expiresAt > endOfDay.getTime()) expiresAt = endOfDay.getTime();

  return expiresAt;
}

export function parseCustomDuration(value, unit) {
  const n = Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Enter a positive number' };
  }
  const mult = unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
  const durationMs = n * mult;
  if (durationMs > MAX_CLIP_EXPIRY_MS) {
    return { ok: false, error: 'Maximum expiry is 365 days' };
  }
  return { ok: true, durationMs };
}

export function getFutureWeekdayOptions(nowMs = Date.now()) {
  const todayDow = new Date(nowMs).getDay();
  return WEEKDAY_LABELS
    .map((label, index) => ({ value: index, label }))
    .filter((opt) => opt.value !== todayDow);
}

export function formatExpiresAt(expiresAtMs) {
  if (!Number.isFinite(expiresAtMs)) return '';
  try {
    return new Date(expiresAtMs).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return new Date(expiresAtMs).toLocaleString();
  }
}

/** Human-readable countdown until expiresAt (e.g. "2h 14m 5s"). */
export function formatCountdownRemaining(expiresAtMs, nowMs = Date.now()) {
  if (!Number.isFinite(expiresAtMs)) return '';
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return 'Expired';

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}d ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function getExpirePresetLabel(presetKey) {
  if (!presetKey) return '';
  if (presetKey === 'custom') return 'Custom duration';
  const preset = CLIP_EXPIRY_PRESETS.find((p) => p.key === presetKey);
  return preset?.label || presetKey;
}

export function clipHasActiveExpiry(clip, nowMs = Date.now()) {
  const exp = clip?.expiresAt;
  return Number.isFinite(exp) && exp > nowMs;
}

export function getNextExpiryTime(clips, archived, nowMs = Date.now()) {
  let next = null;
  for (const clip of [...(clips || []), ...(archived || [])]) {
    const exp = clip?.expiresAt;
    if (Number.isFinite(exp) && exp > nowMs) {
      if (next === null || exp < next) next = exp;
    }
  }
  return next;
}

/** Idempotent: remove clips whose expiresAt <= now from chrome.storage.local. */
export async function purgeExpiredClipsFromStorage(nowMs = Date.now()) {
  const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  const clips = Array.isArray(result.clips) ? result.clips : [];
  const archived = Array.isArray(result.searchOnlyClips) ? result.searchOnlyClips : [];

  const isExpired = (clip) => Number.isFinite(clip?.expiresAt) && clip.expiresAt <= nowMs;

  const nextClips = clips.filter((c) => !isExpired(c));
  const nextArchived = archived.filter((c) => !isExpired(c));
  const purged = (clips.length - nextClips.length) + (archived.length - nextArchived.length);

  if (purged === 0) return { purged: 0, activeRemoved: 0, archivedRemoved: 0 };

  await chrome.storage.local.set({
    clips: nextClips,
    searchOnlyClips: nextArchived,
    pc_local_updatedAt: Date.now(),
  });

  return {
    purged,
    activeRemoved: clips.length - nextClips.length,
    archivedRemoved: archived.length - nextArchived.length,
  };
}

export async function scheduleClipExpiryAlarm() {
  if (!chrome?.alarms?.create) return;
  const { clips, searchOnlyClips } = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  const next = getNextExpiryTime(clips, searchOnlyClips);
  await chrome.alarms.clear(CLIP_EXPIRY_ALARM);
  if (!next) return;
  chrome.alarms.create(CLIP_EXPIRY_ALARM, { when: next });
}
