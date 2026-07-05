/** @forward-slice notes — refresh open note UI after clip content/title edit */
import { getClipIdKey } from '../../../shared/clip-id.js';
import { collectAlbumInterlayings } from './notes.album-interlayings.crud.js';
import { openNoteViewer } from './notes.album.js';
import { renderNoteAttachments } from './notes.render.js';
import * as albumAttachmentViewer from './notes.album-attachment.viewer.js';

function noteContainsClipId(note, idKey) {
  if (!note || !idKey) return false;
  if (note.type === 'album') {
    return collectAlbumInterlayings(note).some(
      (att) => att.type === 'clip' && getClipIdKey(att.id) === idKey,
    );
  }
  return (note.clips || []).some((c) => getClipIdKey(c?.id) === idKey);
}

function isNoteEditorOpen() {
  const modal = document.getElementById('noteEditorModal');
  return !!(modal && modal.style.display !== 'none');
}

function isNoteViewerOpen(app) {
  const modal = document.getElementById('noteViewerModal');
  return !!(modal && modal.style.display !== 'none' && app.currentViewerNoteId != null);
}

function syncEditorAttachments(app, idKey, patch) {
  if (!isNoteEditorOpen() || !Array.isArray(app.currentNoteAttachments)) return;

  let changed = false;
  app.currentNoteAttachments = app.currentNoteAttachments.map((att) => {
    if (att.type !== 'clip' || getClipIdKey(att.id) !== idKey) return att;
    changed = true;
    const next = { ...att };
    if (patch.text !== undefined) next.text = patch.text;
    if (patch.title !== undefined) next.title = patch.title;
    return next;
  });

  if (changed) renderNoteAttachments(app);
}

function refreshNoteViewerIfNeeded(app, idKey) {
  if (!isNoteViewerOpen(app)) return;
  const note = app.notes.find((n) => n.id == app.currentViewerNoteId);
  if (!noteContainsClipId(note, idKey)) return;
  openNoteViewer(app, app.currentViewerNoteId);
}

export function refreshOpenViewsForClipEdit(app, clipId, patch = {}) {
  const idKey = getClipIdKey(clipId);
  if (!idKey) return;

  refreshNoteViewerIfNeeded(app, idKey);
  syncEditorAttachments(app, idKey, patch);
  void albumAttachmentViewer.refreshIfOpen(app, clipId);
}
