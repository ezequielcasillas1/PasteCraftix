import {
  resolveInterlayingAtFlatIndex,
  updateAlbumInterlaying
} from './notes.album-interlayings.crud.js';

const MODAL_ID = 'albumInterlayingEditorModal';

function _getEditorElements() {
  return {
    modal: document.getElementById(MODAL_ID),
    titleHeading: document.getElementById('albumInterlayingEditorTitle'),
    titleGroup: document.getElementById('albumInterlayingTitleGroup'),
    titleInput: document.getElementById('albumInterlayingTitleInput'),
    contentGroup: document.getElementById('albumInterlayingContentGroup'),
    contentInput: document.getElementById('albumInterlayingContentInput'),
    urlGroup: document.getElementById('albumInterlayingUrlGroup'),
    urlLabel: document.getElementById('albumInterlayingUrlLabel'),
    urlInput: document.getElementById('albumInterlayingUrlInput')
  };
}

function _resolveImageSrc(att) {
  return String(att?.url || att?.src || att?.dataUrl || '');
}

function _resolveClipTitle(app, att) {
  const liveClip = att?.id != null ? app._findClipLocationById(att.id)?.clip : null;
  const source = liveClip || att;
  return source?.title || app._clipTitle?.(source) || '';
}

function _configureFieldsForType(app, els, att) {
  const type = att.type;
  const typeLabels = { clip: 'Edit Clip', url: 'Edit Link', image: 'Edit Image' };
  if (els.titleHeading) els.titleHeading.textContent = typeLabels[type] || 'Edit Attachment';

  if (type === 'clip') {
    els.titleGroup.style.display = '';
    els.contentGroup.style.display = '';
    els.urlGroup.style.display = 'none';
    if (els.titleInput) els.titleInput.value = _resolveClipTitle(app, att);
    if (els.contentInput) els.contentInput.value = att.text || '';
    return;
  }

  if (type === 'url') {
    els.titleGroup.style.display = '';
    els.contentGroup.style.display = 'none';
    els.urlGroup.style.display = '';
    if (els.urlLabel) els.urlLabel.textContent = 'URL';
    if (els.titleInput) els.titleInput.value = att.title || '';
    if (els.urlInput) els.urlInput.value = att.url || '';
    return;
  }

  els.titleGroup.style.display = 'none';
  els.contentGroup.style.display = 'none';
  els.urlGroup.style.display = '';
  if (els.urlLabel) els.urlLabel.textContent = 'Image URL';
  if (els.urlInput) els.urlInput.value = _resolveImageSrc(att);
}

function _buildPatch(app, att, els) {
  if (att.type === 'clip') {
    const title = (els.titleInput?.value || '').trim();
    const text = els.contentInput?.value ?? '';
    const patch = { text };
    if (title) patch.title = title;
    else if ('title' in att) patch.title = '';
    return patch;
  }

  if (att.type === 'url') {
    const url = (els.urlInput?.value || '').trim();
    if (!url) throw new Error('URL is required');
    return {
      url,
      title: (els.titleInput?.value || '').trim() || url
    };
  }

  const src = (els.urlInput?.value || '').trim();
  if (!src) throw new Error('Image URL is required');
  if (att.dataUrl && !att.url && !att.src) return { dataUrl: src };
  if (att.src && !att.url) return { src };
  return { url: src };
}

function _refreshAlbumViewerIfOpen(app, albumId) {
  if (app.currentViewerNoteId == albumId) app.openNoteViewer(albumId);
  app.renderNotes();
}

export function openAlbumInterlayingEditor(app, albumId, flatIndex) {
  const album = app.notes.find(n => n.id == albumId && n.type === 'album');
  if (!album) {
    app.showToast('Album not found');
    return;
  }

  const loc = resolveInterlayingAtFlatIndex(album, flatIndex);
  if (!loc?.att) {
    app.showToast('Item not found');
    return;
  }

  const els = _getEditorElements();
  if (!els.modal) return;

  app._albumInterlayingEditorContext = { albumId, flatIndex, attType: loc.att.type };
  _configureFieldsForType(app, els, loc.att);
  els.modal.style.display = 'flex';
  els.modal.style.zIndex = '10001';
  (els.titleInput || els.urlInput || els.contentInput)?.focus?.();
}

export function closeAlbumInterlayingEditor(app) {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.style.display = 'none';
    modal.style.zIndex = '';
  }
  app._albumInterlayingEditorContext = null;
}

export async function saveAlbumInterlayingEditor(app) {
  const ctx = app._albumInterlayingEditorContext;
  if (!ctx) return;

  const album = app.notes.find(n => n.id == ctx.albumId && n.type === 'album');
  const loc = album ? resolveInterlayingAtFlatIndex(album, ctx.flatIndex) : null;
  if (!loc?.att) {
    app.showToast('Item not found');
    closeAlbumInterlayingEditor(app);
    return;
  }

  const els = _getEditorElements();
  let patch;
  try {
    patch = _buildPatch(app, loc.att, els);
  } catch (err) {
    app.showToast(err.message || 'Invalid input');
    return;
  }

  try {
    await updateAlbumInterlaying(app, ctx.albumId, ctx.flatIndex, patch, {
      afterUpdate: () => _refreshAlbumViewerIfOpen(app, ctx.albumId)
    });
    closeAlbumInterlayingEditor(app);
    app.showToast('Attachment updated');
  } catch (err) {
    console.error('saveAlbumInterlayingEditor failed:', err);
    app.showToast('Could not save changes');
  }
}
