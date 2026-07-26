/** Pure helpers for building clip upsert payloads. */
import { getClipIdKey } from '../../shared/clip-id.js';
import { hashString } from './sync-clips.hash.js';

export function getClipText(clip) {
  return typeof clip === 'string' ? clip : (clip?.text ?? clip);
}

export function isForeignOriginClip(clip, deviceId) {
  const originDeviceId =
    typeof clip === 'object' && clip ? String(clip.origin_device_id || '').trim() : '';
  return Boolean(originDeviceId && originDeviceId !== deviceId);
}

export function readClipTimestamps(clip) {
  const ts = typeof clip === 'object' && clip ? (clip.timestamp ?? null) : null;
  const updatedAtMs =
    typeof clip === 'object' && clip
      ? (clip.updatedAt ?? clip.updated_at ?? ts)
      : ts;
  const deletedAtMs =
    typeof clip === 'object' && clip
      ? (clip.deletedAt ?? clip.deleted_at ?? null)
      : null;
  return { ts, updatedAtMs, deletedAtMs };
}

export function hasExplicitClipId(clip) {
  return Boolean(typeof clip === 'object' && clip && (clip.id ?? clip.clip_id ?? clip.clipId));
}

export function resolveRawClipId(clip, text, ts) {
  return (
    (typeof clip === 'object' && clip ? (clip.id ?? clip.clip_id ?? clip.clipId ?? null) : null) ??
    `legacy_${hashString(text)}_${Number.isFinite(ts) ? ts : 0}`
  );
}

export function allocateUniqueClipId(baseId, dupCounter) {
  const count = (dupCounter.get(baseId) || 0) + 1;
  dupCounter.set(baseId, count);
  return count === 1 ? baseId : `${baseId}__dup${count}`;
}

export function resolveClipDeviceId(clip, deviceId) {
  if (typeof clip === 'object' && clip) {
    const incomingDeviceId = String(clip.deviceId ?? clip.device_id ?? '').trim();
    if (incomingDeviceId) return incomingDeviceId;
  }
  return deviceId || null;
}

export function clipTitleForDb(clip) {
  return typeof clip === 'object' && clip
    ? String(clip.title || clip.clip_title || '').trim()
    : '';
}

export function clipCategoryForDb(clip) {
  return (typeof clip === 'object' && clip && clip.category) ? clip.category : 'Uncategorized';
}

export function toIsoOrNull(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function toIsoOrNow(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

export function toDbClipRow(clip, { userId, deviceId, clipId, text, ts, updatedAtMs, deletedAtMs }) {
  return {
    user_id: userId,
    clip_id: clipId,
    text: String(text),
    title: clipTitleForDb(clip),
    category: clipCategoryForDb(clip),
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    updated_at: toIsoOrNow(updatedAtMs),
    deleted_at: toIsoOrNull(deletedAtMs),
    device_id: resolveClipDeviceId(clip, deviceId),
    content_hash: hashString(text)
  };
}

export function isNewerDbClip(candidate, existing) {
  return !existing || (candidate.timestamp || 0) > (existing.timestamp || 0);
}

export function filterDbClipsAgainstTombstones(dbClips, tombstoned) {
  return dbClips.filter((c) => {
    const idStr = String(c.clip_id || '');
    const hasLocalTombstone = c.deleted_at != null;
    return !(tombstoned.has(idStr) && !hasLocalTombstone);
  });
}

/**
 * Normalize local clips into DB upsert rows (dedupe by clip_id, keep newest).
 */
export function buildDbClipsForUpsert(localClips, userId, deviceId) {
  const arr = Array.isArray(localClips) ? localClips : [];
  const seen = new Map();
  const dupCounter = new Map();
  let droppedNoText = 0;
  let droppedInvalid = 0;
  let droppedImported = 0;
  let inferredIds = 0;

  for (let i = 0; i < arr.length; i++) {
    const clip = arr[i];
    const text = getClipText(clip);
    if (!text) {
      droppedNoText++;
      continue;
    }

    if (isForeignOriginClip(clip, deviceId)) {
      droppedImported++;
      continue;
    }

    const { ts, updatedAtMs, deletedAtMs } = readClipTimestamps(clip);
    const rawId = resolveRawClipId(clip, text, ts);
    if (!hasExplicitClipId(clip)) inferredIds++;

    const baseId = getClipIdKey(rawId) || String(rawId);
    const clipId = allocateUniqueClipId(baseId, dupCounter);
    const db = toDbClipRow(clip, {
      userId,
      deviceId,
      clipId,
      text,
      ts,
      updatedAtMs,
      deletedAtMs
    });

    const existing = seen.get(clipId);
    if (isNewerDbClip(db, existing)) {
      seen.set(clipId, db);
    }
  }

  const out = Array.from(seen.values());
  out._pcStats = {
    inputCount: arr.length,
    outCount: out.length,
    droppedNoText,
    droppedInvalid,
    droppedImported,
    inferredIds
  };
  return out;
}
