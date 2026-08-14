/** Pure helpers for local/remote clip merge (newest wins + tombstones). */
import { getClipIdKey } from '../../shared/clip-id.js';
import { hashString } from './sync-clips.hash.js';

export function bumpDeletedAt(deletedById, key, when) {
  if (!key) return;
  const prev = deletedById.get(key) || 0;
  if (when > prev) deletedById.set(key, when);
}

export function rememberDeletedClipId(deletedById, id, when) {
  const key = getClipIdKey(id);
  const raw = id != null ? String(id) : '';
  bumpDeletedAt(deletedById, key, when);
  if (raw && raw !== key) bumpDeletedAt(deletedById, raw, when);
}

export function lookupDeletedClipAt(deletedById, id) {
  const key = getClipIdKey(id);
  const raw = id != null ? String(id) : '';
  if (key && deletedById.has(key)) return deletedById.get(key);
  if (raw && deletedById.has(raw)) return deletedById.get(raw);
  return null;
}

export function ingestRemoteDeletedIds(remoteClips, deletedById) {
  remoteClips.forEach((clip) => {
    if (clip?.id == null || !clip?.deletedAt) return;
    rememberDeletedClipId(deletedById, clip.id, clip.deletedAt);
  });
}

export function applyLocalTombstoneEntries(localTombs, deletedById) {
  const tombs = Array.isArray(localTombs) ? localTombs : [];
  tombs.forEach((t) => {
    if (t?.id == null || t?.id === '') return;
    const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
    rememberDeletedClipId(deletedById, t.id, when);
  });
}

async function readLocalDeletedClips() {
  const local = await new Promise((resolve) => {
    chrome.storage.local.get(['pc_deleted_clips'], (res) => resolve(res || {}));
  });
  return Array.isArray(local?.pc_deleted_clips) ? local.pc_deleted_clips : [];
}

export async function ingestLocalTombstones(deletedById) {
  try {
    const localTombs = await readLocalDeletedClips();
    applyLocalTombstoneEntries(localTombs, deletedById);
  } catch (_) {
    /* non-fatal */
  }
}

export function clipUpdatedAtMs(clip) {
  return Number.isFinite(clip?.updatedAt) ? clip.updatedAt : (clip?.timestamp || 0);
}

export function contentKeyForMerge(clip) {
  if (!clip) return '';
  const text = String(clip.text || '');
  const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
  const bucket = Math.floor(ts / 3000);
  const cat = clip.category != null ? String(clip.category) : '';
  return `${hashString(text)}:${bucket}:${cat}`;
}

export function isClipSupersededByTombstone(clip, deletedById) {
  const deletedAt = lookupDeletedClipAt(deletedById, clip?.id);
  if (!deletedAt) return false;
  return deletedAt >= clipUpdatedAtMs(clip);
}

export function shouldPreferIncomingClip(prev, clip) {
  if (!prev) return true;
  const clipUpdatedAt = clipUpdatedAtMs(clip);
  const prevUpdatedAt = clipUpdatedAtMs(prev);
  if (clipUpdatedAt > prevUpdatedAt) return true;
  if (clipUpdatedAt !== prevUpdatedAt) return false;
  return (clip.timestamp || 0) > (prev.timestamp || 0);
}

/** Keep local image/capture meta when the preferred row has none (DB clips have no meta column). */
export function carryForwardClipMeta(prev, incoming) {
  if (!incoming) return incoming;
  const prevMeta = prev?.meta && typeof prev.meta === 'object' ? prev.meta : null;
  if (!prevMeta) return incoming;
  const nextMeta = incoming.meta && typeof incoming.meta === 'object' ? incoming.meta : null;
  if (!nextMeta) return { ...incoming, meta: prevMeta };
  const prevImg = prevMeta.image && typeof prevMeta.image === 'object' ? prevMeta.image : null;
  const nextImg = nextMeta.image && typeof nextMeta.image === 'object' ? nextMeta.image : null;
  if (prevImg && !nextImg) {
    return { ...incoming, meta: { ...nextMeta, image: prevImg } };
  }
  const prevUrl = typeof prevImg?.srcUrl === 'string' ? prevImg.srcUrl.trim() : '';
  const nextUrl = typeof nextImg?.srcUrl === 'string' ? nextImg.srcUrl.trim() : '';
  if (prevUrl.startsWith('https://') && !nextUrl.startsWith('https://')) {
    return {
      ...incoming,
      meta: {
        ...nextMeta,
        image: {
          ...(nextImg || {}),
          srcUrl: prevUrl,
          hasImage: true,
          storagePath: prevImg.storagePath || nextImg?.storagePath,
        },
      },
    };
  }
  if (prevMeta.captureSource && !nextMeta.captureSource) {
    return { ...incoming, meta: { ...nextMeta, captureSource: prevMeta.captureSource } };
  }
  return incoming;
}

export function addClipToContentMerge(clip, deletedById, contentMerged) {
  if (!clip || !clip.text) return;
  if (isClipSupersededByTombstone(clip, deletedById)) return;
  const k = contentKeyForMerge(clip);
  const prev = contentMerged.get(k);
  if (shouldPreferIncomingClip(prev, clip)) {
    contentMerged.set(k, carryForwardClipMeta(prev, clip));
  }
}

export async function mergeClips(localClips, remoteClips) {
  const contentMerged = new Map();
  const deletedById = new Map();

  ingestRemoteDeletedIds(remoteClips, deletedById);
  await ingestLocalTombstones(deletedById);

  localClips.forEach((clip) => addClipToContentMerge(clip, deletedById, contentMerged));
  remoteClips.forEach((clip) => addClipToContentMerge(clip, deletedById, contentMerged));

  return Array.from(contentMerged.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );
}
