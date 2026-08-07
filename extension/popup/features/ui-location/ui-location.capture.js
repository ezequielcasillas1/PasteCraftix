/** @forward-slice Build popup location snapshot from open overlays. */

import {
  UI_LOCATION_DRAFT_MAX_CHARS,
  UI_LOCATION_KINDS,
  UI_LOCATION_VERSION,
} from './ui-location.constants.js';

function _isVisible(el) {
  if (!el) return false;
  const style = el.style?.display;
  if (style === 'none') return false;
  if (style === 'flex' || style === 'block') return true;
  try {
    return window.getComputedStyle(el).display !== 'none';
  } catch (_) {
    return false;
  }
}

function _capDraft(text) {
  const s = String(text ?? '');
  if (s.length <= UI_LOCATION_DRAFT_MAX_CHARS) return s;
  return s.slice(0, UI_LOCATION_DRAFT_MAX_CHARS);
}

function _captureNoteViewer(app, stack) {
  const modal = document.getElementById('noteViewerModal');
  const noteId = app.currentViewerNoteId;
  if (!_isVisible(modal) || noteId == null) return;
  stack.push({ kind: UI_LOCATION_KINDS.NOTE_VIEWER, noteId });
}

function _captureNoteEditor(app, stack) {
  const modal = document.getElementById('noteEditorModal');
  if (!_isVisible(modal)) return;

  const backBtn = document.getElementById('backToAlbumPicker');
  const showBack = !!(backBtn && backBtn.style.display !== 'none' && _isVisible(backBtn));

  stack.push({
    kind: UI_LOCATION_KINDS.NOTE_EDITOR,
    noteId: app.currentNoteId ?? null,
    type: app.currentNoteType || 'note',
    showBack,
    drafts: {
      title: _capDraft(document.getElementById('noteTitleInput')?.value),
      description: _capDraft(document.getElementById('noteDescriptionInput')?.value),
      body: _capDraft(document.getElementById('noteBodyInput')?.value),
    },
  });
}

function _hasAlbumAttachmentContext(ctx) {
  return !!(ctx && ctx.noteId != null);
}

function _captureAlbumAttachment(app, stack) {
  const modal = document.getElementById('albumAttachmentViewerModal');
  const ctx = app.currentAlbumAttachmentContext;
  if (!_isVisible(modal) || !_hasAlbumAttachmentContext(ctx)) return;
  const attachmentIndex = Number(ctx.attachmentIndex);
  if (Number.isNaN(attachmentIndex)) return;
  stack.push({
    kind: UI_LOCATION_KINDS.ALBUM_ATTACHMENT,
    noteId: ctx.noteId,
    attachmentIndex,
  });
}

function _hasOpenClipViewer(modal, clip) {
  return _isVisible(modal) && !!(clip && clip.id != null);
}

function _captureClipViewer(app, stack) {
  const modal = document.getElementById('clipViewerModal');
  const clip = app.currentClipViewerClip;
  if (!_hasOpenClipViewer(modal, clip)) return;

  const editing = !!app._clipViewerEditing;
  const frame = {
    kind: UI_LOCATION_KINDS.CLIP_VIEWER,
    clipId: clip.id,
    sourceContext: app.clipViewerSourceContext || 'clips',
    editing,
    showingRaw: !!app._clipViewerShowingRaw,
  };

  if (editing) {
    const draft = document.getElementById('clipViewerEditTextarea')?.value;
    if (draft != null) frame.draftText = _capDraft(draft);
  }

  stack.push(frame);
}

function _captureSettings(stack) {
  const modal = document.getElementById('settingsModal');
  if (!_isVisible(modal)) return;
  stack.push({ kind: UI_LOCATION_KINDS.SETTINGS });
}

export function captureUiLocation(app) {
  const stack = [];
  _captureNoteViewer(app, stack);
  _captureNoteEditor(app, stack);
  _captureAlbumAttachment(app, stack);
  _captureClipViewer(app, stack);
  _captureSettings(stack);

  return {
    v: UI_LOCATION_VERSION,
    tab: app.currentTab || 'clips',
    aiSubTab: app._currentAiLabSubTab || 'summary',
    stack,
    savedAt: Date.now(),
  };
}
