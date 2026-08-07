/**
 * Notes adapter for shared image annotate — picker Edit fullscreen + album pop-out.
 * Persists via chrome.storage so saves survive popup close.
 * UI/tools live in extension/shared/image-annotate.js (no clips/ imports).
 */

import { canAnnotateImageSrc, closeImageAnnotate, openImageAnnotate } from '../../../shared/image-annotate.js';
import {
  openAnnotateFullscreenWindow,
  resolveExtensionPageUrl,
} from '../../../shared/image-annotate-window.js';
import {
  resolveInterlayingAtFlatIndex,
} from './notes.album-interlayings.crud.js';

export const PENDING_NOTE_IMAGE_ATTACH_KEY = 'pcPendingNoteImageAttach';
const SESSION_PREFIX = 'pcNoteAnnotateSession:';

function isStandaloneNoteAnnotatePage() {
  try {
    return /note-image-annotate\.html/i.test(String(location?.pathname || ''));
  } catch (_) {
    return false;
  }
}

function sessionStorageKey(sessionId) {
  return `${SESSION_PREFIX}${sessionId}`;
}

async function putAnnotateSession(payload) {
  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const key = sessionStorageKey(sessionId);
  await chrome.storage.session.set({ [key]: { ...payload, sessionId, createdAt: Date.now() } });
  return sessionId;
}

async function getAnnotateSession(sessionId) {
  const key = sessionStorageKey(sessionId);
  const row = await chrome.storage.session.get(key);
  return row?.[key] || null;
}

async function clearAnnotateSession(sessionId) {
  if (!sessionId) return;
  try {
    await chrome.storage.session.remove(sessionStorageKey(sessionId));
  } catch (_) {}
}

function resolveNoteAnnotateUrl(sessionId) {
  return resolveExtensionPageUrl(
    'note-image-annotate.html',
    `session=${encodeURIComponent(String(sessionId))}`,
  );
}

function serializeCandidate(candidate) {
  return {
    id: candidate?.id ?? null,
    clipId: candidate?.clipId ?? null,
    src: String(candidate?.src || ''),
    mime: candidate?.mime || 'image/png',
    label: candidate?.label || 'Image',
    sourceKind: candidate?.sourceKind || 'image',
    sourceLabel: candidate?.sourceLabel || '',
  };
}

function usesDataUrlOnly(att) {
  return !!(att?.dataUrl && !att?.url && !att?.src);
}

function usesSrcField(att) {
  return !!(att?.src && !att?.url);
}

function buildAnnotatedImagePatch(att, dataUrl) {
  if (usesDataUrlOnly(att)) return { dataUrl, mime: 'image/png' };
  if (usesSrcField(att)) return { src: dataUrl, mime: 'image/png' };
  return { dataUrl, mime: 'image/png' };
}

async function persistPickerAttachResult(session, outUrl) {
  await chrome.storage.local.set({
    [PENDING_NOTE_IMAGE_ATTACH_KEY]: {
      noteId: session.noteId ?? null,
      candidate: session.candidate || {},
      dataUrl: outUrl,
      at: Date.now(),
    },
  });
  try {
    chrome.runtime.sendMessage({ action: 'pcNoteImageAnnotated' }).catch(() => {});
  } catch (_) {}
}

async function persistAlbumImageResult(session, outUrl) {
  const noteId = session.noteId;
  const flatIndex = Number(session.attachmentIndex);
  const { notes } = await chrome.storage.local.get(['notes']);
  const list = Array.isArray(notes) ? notes : [];
  const noteIdx = list.findIndex((n) => n && n.id == noteId);
  if (noteIdx < 0) throw new Error('Note not found');

  const note = { ...list[noteIdx] };
  const loc = resolveInterlayingAtFlatIndex(note, flatIndex);
  if (!loc?.att || loc.att.type !== 'image') throw new Error('Image attachment not found');

  const patch = buildAnnotatedImagePatch(loc.att, outUrl);
  const images = Array.isArray(note.images) ? [...note.images] : [];
  if (loc.bucket !== 'images' || loc.bucketIndex < 0 || loc.bucketIndex >= images.length) {
    throw new Error('Image bucket index invalid');
  }
  images[loc.bucketIndex] = { ...images[loc.bucketIndex], ...patch };
  note.images = images;
  note.updatedAt = Date.now();
  list[noteIdx] = note;
  await chrome.storage.local.set({ notes: list });
  try {
    chrome.runtime.sendMessage({ action: 'pcNoteImageAnnotated', noteId }).catch(() => {});
  } catch (_) {}
}

async function persistSessionSave(sessionId, session, outUrl) {
  if (!canAnnotateImageSrc(outUrl)) return;
  if (session.mode === 'album-image') {
    await persistAlbumImageResult(session, outUrl);
  } else {
    await persistPickerAttachResult(session, outUrl);
  }
  await clearAnnotateSession(sessionId);
}

function annotateOptionsForNotes(ui, sessionId, session) {
  const pageMode = isStandaloneNoteAnnotatePage();
  return {
    dataUrl: session.dataUrl,
    ui,
    saveBehavior: pageMode ? 'bake' : 'close',
    awaitResult: !pageMode,
    onSave: async (outUrl) => {
      await persistSessionSave(sessionId, session, outUrl);
      ui?.showToast?.('Annotation saved', 'success');
      if (pageMode) {
        try { window.close(); } catch (_) {}
      }
    },
    onCancel: pageMode
      ? () => {
          clearAnnotateSession(sessionId);
          try { window.close(); } catch (_) {}
        }
      : null,
  };
}

/** Boot standalone note annotate page (?session=…). */
export async function openNoteImageAnnotateFromSession(ui, sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return { ok: false, error: 'missing_session' };
  const session = await getAnnotateSession(id);
  if (!session || !canAnnotateImageSrc(session.dataUrl)) {
    return { ok: false, error: 'invalid_session' };
  }
  const result = await openImageAnnotate(annotateOptionsForNotes(ui, id, session));
  return { ok: Boolean(result?.ok || result?.cancelled || isStandaloneNoteAnnotatePage()) };
}

export function closeNoteImageAnnotate() {
  closeImageAnnotate();
}

/** Pop out fullscreen annotate for notes image picker → Edit & Add. */
export async function popOutPickerImageAnnotate(app, candidate) {
  const src = String(candidate?.src || '').trim();
  if (!canAnnotateImageSrc(src)) {
    app?.showToast?.('Select one image that can be edited (capture/upload)', 'error');
    return { ok: false };
  }
  const sessionId = await putAnnotateSession({
    mode: 'picker-attach',
    dataUrl: src,
    candidate: serializeCandidate(candidate),
    noteId: app?.currentNoteId ?? null,
  });
  return openAnnotateFullscreenWindow(resolveNoteAnnotateUrl(sessionId), app);
}

/** Pop out fullscreen annotate for an album image attachment. */
export async function popOutAlbumImageAnnotate(app, { noteId, attachmentIndex, dataUrl }) {
  const src = String(dataUrl || '').trim();
  if (!canAnnotateImageSrc(src)) {
    app?.showToast?.('Only embedded images can be annotated', 'error');
    return { ok: false };
  }
  if (noteId == null || attachmentIndex == null) {
    app?.showToast?.('No image to annotate', 'error');
    return { ok: false };
  }
  const sessionId = await putAnnotateSession({
    mode: 'album-image',
    dataUrl: src,
    noteId,
    attachmentIndex: Number(attachmentIndex),
  });
  return openAnnotateFullscreenWindow(resolveNoteAnnotateUrl(sessionId), app);
}
