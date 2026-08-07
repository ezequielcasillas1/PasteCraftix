/** @forward-slice Apply saved popup location stack after data load. */

import { findClipAcrossCollections } from '../clips/clips.refactor-resolver.js';
import { restorePopupTab } from '../app/popup.tab-lifecycle.js';
import { UI_LOCATION_KINDS } from './ui-location.constants.js';
import { isRememberUiLocationEnabled, readUiLocation } from './ui-location.service.js';

function _findNote(app, noteId) {
  if (noteId == null) return null;
  return (app.notes || []).find((n) => n && n.id == noteId) || null;
}

async function _restoreNoteViewer(app, frame) {
  const note = _findNote(app, frame.noteId);
  if (!note) return false;
  if (typeof app.openNoteViewer === 'function') {
    await app.openNoteViewer(frame.noteId);
    return true;
  }
  const album = app.notesFeature?.album;
  if (album?.openNoteViewer) {
    await album.openNoteViewer(app, frame.noteId);
    return true;
  }
  return false;
}

async function _openNoteEditorApi(app, type, noteId, showBack) {
  if (typeof app.openNoteEditor === 'function') {
    await app.openNoteEditor(type, noteId, showBack);
    return true;
  }
  if (app.notesFeature?.editor?.openNoteEditor) {
    await app.notesFeature.editor.openNoteEditor(app, type, noteId, showBack);
    return true;
  }
  return false;
}

function _applyNoteEditorDrafts(drafts) {
  const d = drafts || {};
  const titleEl = document.getElementById('noteTitleInput');
  const descEl = document.getElementById('noteDescriptionInput');
  const bodyEl = document.getElementById('noteBodyInput');
  if (titleEl && d.title != null) titleEl.value = String(d.title);
  if (descEl && d.description != null) descEl.value = String(d.description);
  if (bodyEl && d.body != null) bodyEl.value = String(d.body);
}

async function _restoreNoteEditor(app, frame) {
  const type = frame.type === 'album' ? 'album' : 'note';
  const noteId = frame.noteId ?? null;
  if (noteId != null && !_findNote(app, noteId)) return false;
  if (!(await _openNoteEditorApi(app, type, noteId, !!frame.showBack))) return false;
  _applyNoteEditorDrafts(frame.drafts);
  return true;
}

async function _restoreAlbumAttachment(app, frame) {
  const note = _findNote(app, frame.noteId);
  if (!note) return false;
  const idx = Number(frame.attachmentIndex);
  if (Number.isNaN(idx)) return false;

  if (typeof app.openAlbumAttachmentViewerModal === 'function') {
    app.openAlbumAttachmentViewerModal(frame.noteId, idx);
    return true;
  }
  const viewer = app.notesFeature?.albumAttachmentViewer;
  if (viewer?.open) {
    viewer.open(app, frame.noteId, idx);
    return true;
  }
  return false;
}

function _applyClipViewerRawMode(app) {
  app._clipViewerShowingRaw = true;
  const renderedEl = document.getElementById('clipViewerRendered');
  const rawEl = document.getElementById('clipViewerRaw');
  const toggleBtn = document.getElementById('clipViewerToggleRaw');
  if (renderedEl) renderedEl.style.display = 'none';
  if (rawEl) rawEl.style.display = 'block';
  if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'true');
}

function _applyClipViewerEditDraft(viewer, app, frame) {
  if (!frame.editing || !viewer.enterEditMode) return;
  viewer.enterEditMode(app);
  if (frame.draftText == null) return;
  const editTextarea = document.getElementById('clipViewerEditTextarea');
  if (!editTextarea) return;
  editTextarea.value = String(frame.draftText);
  try {
    const len = editTextarea.value.length;
    editTextarea.setSelectionRange(len, len);
  } catch (_) {}
}

async function _restoreClipViewer(app, frame) {
  const clip = findClipAcrossCollections(app, frame.clipId);
  if (!clip) return false;

  const viewer = app.clipsFeature?.viewer;
  if (!viewer?.open) return false;

  await viewer.open(app, clip, frame.sourceContext || 'clips');
  if (frame.showingRaw && !frame.editing) _applyClipViewerRawMode(app);
  _applyClipViewerEditDraft(viewer, app, frame);
  return true;
}

async function _restoreSettings(app) {
  if (typeof app.showSettingsModal === 'function') {
    await app.showSettingsModal();
    return true;
  }
  if (app.settingsFeature?.render?.showSettingsModal) {
    await app.settingsFeature.render.showSettingsModal();
    return true;
  }
  return false;
}

async function _restoreFrame(app, frame) {
  if (!frame || typeof frame !== 'object') return false;
  switch (frame.kind) {
    case UI_LOCATION_KINDS.NOTE_VIEWER:
      return _restoreNoteViewer(app, frame);
    case UI_LOCATION_KINDS.NOTE_EDITOR:
      return _restoreNoteEditor(app, frame);
    case UI_LOCATION_KINDS.ALBUM_ATTACHMENT:
      return _restoreAlbumAttachment(app, frame);
    case UI_LOCATION_KINDS.CLIP_VIEWER:
      return _restoreClipViewer(app, frame);
    case UI_LOCATION_KINDS.SETTINGS:
      return _restoreSettings(app);
    default:
      return false;
  }
}

export async function restoreUiLocationStack(app, snapshot) {
  const stack = Array.isArray(snapshot?.stack) ? snapshot.stack : [];
  for (const frame of stack) {
    try {
      await _restoreFrame(app, frame);
    } catch (err) {
      console.warn('[UiLocation] restore frame failed:', frame?.kind, err);
    }
  }
}

export async function restoreUiLocation(app) {
  if (!isRememberUiLocationEnabled(app)) {
    await restorePopupTab(app, 'clips').catch(() => {});
    return { restored: false, reason: 'disabled' };
  }

  const snapshot = await readUiLocation();
  if (!snapshot) {
    return { restored: false, reason: 'empty' };
  }

  app._uiLocationRestoring = true;
  try {
    const tab = snapshot.tab || 'clips';
    await restorePopupTab(app, tab).catch(() => {});

    if (tab === 'ai' && snapshot.aiSubTab) {
      app._currentAiLabSubTab = snapshot.aiSubTab;
    }

    await restoreUiLocationStack(app, snapshot);
    return { restored: true, snapshot };
  } finally {
    app._uiLocationRestoring = false;
  }
}
