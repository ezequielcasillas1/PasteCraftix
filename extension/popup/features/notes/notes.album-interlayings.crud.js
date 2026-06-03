import { mutateNote } from './notes.service.js';

// ── Read ───────────────────────────────────────────────────────────────────

export function collectAlbumInterlayings(note) {
  if (!note) return [];
  return [
    ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
    ...(note.images || []).map(i => ({ ...i, type: 'image' })),
    ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
  ];
}

export function countAlbumInterlayings(note) {
  if (!note || note.type !== 'album') return 0;
  const refs = Array.isArray(note.noteRefs) ? note.noteRefs.length : 0;
  const attachmentCount =
    (Array.isArray(note.clips) ? note.clips.length : 0) +
    (Array.isArray(note.images) ? note.images.length : 0) +
    (Array.isArray(note.urls) ? note.urls.length : 0);
  return refs > 0 ? refs : attachmentCount;
}

export function resolveInterlayingAtFlatIndex(album, flatIndex) {
  if (!album || album.type !== 'album' || !Number.isFinite(flatIndex)) return null;
  const clips = Array.isArray(album.clips) ? album.clips : [];
  const images = Array.isArray(album.images) ? album.images : [];
  const urls = Array.isArray(album.urls) ? album.urls : [];
  let idx = flatIndex;
  if (idx < clips.length) {
    return { att: { ...clips[idx], type: 'clip' }, bucket: 'clips', bucketIndex: idx, flatIndex };
  }
  idx -= clips.length;
  if (idx < images.length) {
    return { att: { ...images[idx], type: 'image' }, bucket: 'images', bucketIndex: idx, flatIndex };
  }
  idx -= images.length;
  if (idx < urls.length) {
    return { att: { ...urls[idx], type: 'url' }, bucket: 'urls', bucketIndex: idx, flatIndex };
  }
  return null;
}

export function flatAttachmentsToAlbumBuckets(flatAttachments) {
  const list = Array.isArray(flatAttachments) ? flatAttachments : [];
  const stripType = (item) => {
    if (!item || typeof item !== 'object') return item;
    const { type, ...rest } = item;
    return rest;
  };
  return {
    clips: list.filter(a => a?.type === 'clip').map(stripType),
    images: list.filter(a => a?.type === 'image').map(stripType),
    urls: list.filter(a => a?.type === 'url').map(stripType)
  };
}

export function albumBucketsToFlatAttachments(note) {
  return collectAlbumInterlayings(note);
}

// ── Album draft helpers (Create / Update / Delete on draft) ────────────────

export function ensureAlbumCollections(album) {
  if (!album.clips) album.clips = [];
  if (!album.urls) album.urls = [];
  if (!album.images) album.images = [];
  if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
  if (!Array.isArray(album.noteRefs)) album.noteRefs = [];
}

export function syncAlbumRefMetadata(album) {
  if (!album || album.type !== 'album') return album;
  ensureAlbumCollections(album);
  const idsPresent = new Set();
  for (const arr of [album.clips, album.urls, album.images]) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item?.sourceNoteId != null) idsPresent.add(item.sourceNoteId);
    }
  }
  album.sourceNoteIds = album.sourceNoteIds.filter(id => idsPresent.has(id));
  for (const id of idsPresent) {
    if (!album.sourceNoteIds.includes(id)) album.sourceNoteIds.push(id);
  }
  album.noteRefs = album.noteRefs.filter(id => idsPresent.has(id));
  for (const id of idsPresent) {
    if (!album.noteRefs.includes(id)) album.noteRefs.push(id);
  }
  return album;
}

function _appendSourceBodyAsClip(album, sourceNote) {
  if (!sourceNote.body || !String(sourceNote.body).trim()) return;
  album.clips.push({
    type: 'clip',
    id: Date.now() + Math.random(),
    title: sourceNote.title || 'Note content',
    text: `[From: ${sourceNote.title || 'Untitled Note'}]\n\n${sourceNote.body}`,
    addedDate: Date.now(),
    sourceNoteId: sourceNote.id
  });
}

function _mergeSourceArrayIntoAlbum(targetArray, sourceArray, sourceNoteId) {
  if (!Array.isArray(sourceArray) || sourceArray.length === 0) return;
  const now = Date.now();
  targetArray.push(...sourceArray.map(item => ({ ...item, addedDate: now, sourceNoteId })));
}

export function mergeSourceNoteIntoAlbumDraft(album, sourceNote) {
  if (!album || !sourceNote) return album;
  ensureAlbumCollections(album);
  const sourceNoteId = sourceNote.id;
  if (!album.sourceNoteIds.includes(sourceNoteId)) album.sourceNoteIds.push(sourceNoteId);
  if (!album.noteRefs.includes(sourceNoteId)) album.noteRefs.push(sourceNoteId);
  _appendSourceBodyAsClip(album, sourceNote);
  _mergeSourceArrayIntoAlbum(album.clips, sourceNote.clips, sourceNoteId);
  _mergeSourceArrayIntoAlbum(album.urls, sourceNote.urls, sourceNoteId);
  _mergeSourceArrayIntoAlbum(album.images, sourceNote.images, sourceNoteId);
  syncAlbumRefMetadata(album);
  return album;
}

export function removeInterlayingAtFlatIndex(album, flatIndex) {
  const loc = resolveInterlayingAtFlatIndex(album, flatIndex);
  if (!loc) return album;
  ensureAlbumCollections(album);
  const arr = album[loc.bucket];
  if (!Array.isArray(arr)) return album;
  album[loc.bucket] = arr.filter((_, i) => i !== loc.bucketIndex);
  syncAlbumRefMetadata(album);
  return album;
}

export function patchInterlayingAtFlatIndex(album, flatIndex, patch) {
  const loc = resolveInterlayingAtFlatIndex(album, flatIndex);
  if (!loc || !patch || typeof patch !== 'object') return album;
  ensureAlbumCollections(album);
  const arr = album[loc.bucket];
  if (!Array.isArray(arr) || !arr[loc.bucketIndex]) return album;
  arr[loc.bucketIndex] = { ...arr[loc.bucketIndex], ...patch };
  syncAlbumRefMetadata(album);
  return album;
}

export function applyFlatAttachmentsToAlbumDraft(album, flatAttachments, existing) {
  ensureAlbumCollections(album);
  const buckets = flatAttachmentsToAlbumBuckets(flatAttachments);
  album.clips = buckets.clips;
  album.urls = buckets.urls;
  album.images = buckets.images;
  if (existing) {
    if (Array.isArray(existing.noteRefs)) album.noteRefs = [...existing.noteRefs];
    if (Array.isArray(existing.sourceNoteIds)) album.sourceNoteIds = [...existing.sourceNoteIds];
  }
  syncAlbumRefMetadata(album);
  return album;
}

// ── Persisted CRUD (mutateNote) ────────────────────────────────────────────

async function _mutateAlbumInterlayings(app, albumId, mutator, options = {}) {
  return mutateNote(app, albumId, (draft) => {
    if (!draft || draft.type !== 'album') return draft;
    return mutator(draft);
  }, options);
}

export async function createAlbumInterlayingsFromSourceNote(app, albumId, sourceNote) {
  if (!sourceNote || sourceNote.type === 'album') {
    throw new Error('Invalid source note for album');
  }
  return _mutateAlbumInterlayings(app, albumId, (draft) => {
    mergeSourceNoteIntoAlbumDraft(draft, sourceNote);
    draft.updatedAt = Date.now();
    return draft;
  });
}

export async function deleteAlbumInterlaying(app, albumId, flatIndex, options = {}) {
  const idx = Number(flatIndex);
  if (!Number.isFinite(idx) || idx < 0) throw new Error('Invalid interlaying index');
  return _mutateAlbumInterlayings(app, albumId, (draft) => {
    removeInterlayingAtFlatIndex(draft, idx);
    draft.updatedAt = Date.now();
    return draft;
  }, options);
}

export async function updateAlbumInterlaying(app, albumId, flatIndex, patch, options = {}) {
  const idx = Number(flatIndex);
  if (!Number.isFinite(idx) || idx < 0) throw new Error('Invalid interlaying index');
  return _mutateAlbumInterlayings(app, albumId, (draft) => {
    patchInterlayingAtFlatIndex(draft, idx, patch);
    draft.updatedAt = Date.now();
    return draft;
  }, options);
}

export async function replaceAlbumInterlayings(app, albumId, flatAttachments, options = {}) {
  const existing = Array.isArray(app.notes) ? app.notes.find(n => n.id == albumId) : null;
  return _mutateAlbumInterlayings(app, albumId, (draft) => {
    applyFlatAttachmentsToAlbumDraft(draft, flatAttachments, existing);
    draft.updatedAt = Date.now();
    return draft;
  }, options);
}

export function readAlbumInterlayingSourceNoteId(album, flatIndex) {
  const loc = resolveInterlayingAtFlatIndex(album, flatIndex);
  return loc?.att?.sourceNoteId ?? null;
}
