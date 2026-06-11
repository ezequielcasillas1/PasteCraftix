import {
  collectAlbumInterlayings,
  countAlbumInterlayings,
  createAlbumInterlayingsFromSourceNote,
  deleteAlbumInterlaying,
  syncAlbumRefMetadata
} from './notes.album-interlayings.crud.js';
import * as albumAttachmentViewer from './notes.album-attachment.viewer.js';
import { resolveSafeExternalUrl } from '../../../safe-url.js';

function _arrayHasItemWithId(arr, id) {
  if (!Array.isArray(arr)) return false;
  return arr.some(item => item && item.id == id);
}

function _noteContainsAttachmentId(note, attId) {
  return _arrayHasItemWithId(note.clips, attId) ||
    _arrayHasItemWithId(note.urls, attId) ||
    _arrayHasItemWithId(note.images, attId);
}

function _findSourceNoteForAttachment(notes, att) {
  if (!att || att.id == null) return null;
  return (notes || []).find(n => {
    if (!n || n.type === 'album') return false;
    return _noteContainsAttachmentId(n, att.id);
  }) || null;
}

function _resolveSourceNote(notes, att) {
  if (!att) return null;
  const direct = att.sourceNoteId ? (notes || []).find(n => n && n.id == att.sourceNoteId) : null;
  return direct || _findSourceNoteForAttachment(notes, att);
}

// ── openNoteViewer ─────────────────────────────────────────────────────────

function _getViewerElements() {
  return {
    modal: document.getElementById('noteViewerModal'),
    icon: document.getElementById('noteViewerIcon'),
    titleText: document.getElementById('noteViewerTitleText'),
    backBtn: document.getElementById('noteViewerBackBtn'),
    descSection: document.getElementById('noteViewerDescSection'),
    descText: document.getElementById('noteViewerDesc'),
    contentText: document.getElementById('noteViewerContent'),
    attachSection: document.getElementById('noteViewerAttachmentsSection'),
    attachList: document.getElementById('noteViewerAttachments'),
    copyAllBtn: document.getElementById('copyAllAttachments'),
    attachmentsTitle: document.getElementById('noteViewerAttachmentsTitle')
  };
}

function _resolveViewerTitle(note, isAlbum) {
  const safeTitle = (note.title || '').trim();
  if (safeTitle) return safeTitle;
  return isAlbum ? 'Untitled Album' : 'Untitled Note';
}

function _shouldShowBackButton(app, isAlbum) {
  return !!(app.noteViewerParentAlbumId && !isAlbum);
}

function _setViewerHeader(app, els, note, isAlbum) {
  els.icon.textContent = isAlbum ? '📚' : '📝';
  els.titleText.textContent = _resolveViewerTitle(note, isAlbum);
  if (els.backBtn) {
    els.backBtn.style.display = _shouldShowBackButton(app, isAlbum) ? 'inline-flex' : 'none';
  }
  if (isAlbum) app.noteViewerParentAlbumId = null;
}

function _setViewerDescription(els, note) {
  const safeDesc = (note.description || '').trim();
  if (safeDesc) {
    els.descSection.style.display = 'block';
    els.descText.textContent = safeDesc;
    return;
  }
  els.descSection.style.display = 'none';
}

function _applyAlbumViewerHeader(els, isAlbum) {
  if (!isAlbum) return;
  if (els.attachmentsTitle) els.attachmentsTitle.textContent = 'Notes';
  if (els.copyAllBtn) els.copyAllBtn.style.display = 'none';
}

function _resolveAttachmentIcon(att) {
  if (att.type === 'clip') return '📋';
  if (att.type === 'image') return '🖼️';
  return '🔗';
}

function _resolveAttachmentText(att) {
  if (att.type === 'url') return att.url || '';
  return (att.text || '').substring(0, 80);
}

function _truncateForDisplay(text, max = 80) {
  return text.length > max ? text + '...' : text;
}

function _buildAttachmentInnerHtml(app, att) {
  const text = _resolveAttachmentText(att);
  const displayText = _truncateForDisplay(text);
  const liveClip = att.type === 'clip' ? app._findClipLocationById(att.id)?.clip : null;
  const clipForTitle = liveClip || att;
  const clipTitle = att.type === 'clip' ? app._clipTitle(clipForTitle) : '';
  if (clipTitle) {
    return `<div class="viewer-attachment-title" title="${app.escapeHtml(clipTitle)}">${app.escapeHtml(clipTitle)}</div><div class="viewer-attachment-subtext" title="${app.escapeHtml(text)}">${app.escapeHtml(displayText)}</div>`;
  }
  return `<div class="viewer-attachment-text" title="${app.escapeHtml(text)}">${app.escapeHtml(displayText)}</div>`;
}

function _buildAlbumAttachmentRow(app, att, idx) {
  const attIcon = _resolveAttachmentIcon(att);
  const attachmentHtml = _buildAttachmentInnerHtml(app, att);
  const sourceNote = _resolveSourceNote(app.notes, att);
  const fromTitle = sourceNote ? ((sourceNote.title || '').trim() || 'Untitled Note') : 'Album';
  const metaLine = `<div style="margin-top:6px; font-size:11px; color:#6b7280; line-height:1.25;"><div><strong style="color:#4b5563;">From:</strong> ${app.escapeHtml(fromTitle)}</div></div>`;
  return `
    <div class="viewer-attachment-item viewer-attachment-openable" data-index="${idx}" role="button" tabindex="0">
      <div class="viewer-attachment-info">
        <span class="viewer-attachment-icon">${attIcon}</span>
        <div style="min-width:0;">${attachmentHtml}${metaLine}</div>
      </div>
      <div class="viewer-attachment-actions">
        <button class="btn-edit-album-interlaying" data-index="${idx}" type="button">Edit</button>
        <button class="btn-delete-album-interlaying" data-index="${idx}" type="button">Delete</button>
        <button class="btn-copy-album-attachment" data-index="${idx}" type="button">Copy</button>
        <button class="btn-open-album-attachment" data-index="${idx}" type="button" title="Open attachment" style="border:none; background:transparent; cursor:pointer; color:#9ca3af; font-size:18px; line-height:1; padding:0 2px;">›</button>
      </div>
    </div>
  `;
}

function _buildNoteAttachmentRow(app, att, idx) {
  const attIcon = _resolveAttachmentIcon(att);
  const attachmentHtml = _buildAttachmentInnerHtml(app, att);
  return `
    <div class="viewer-attachment-item">
      <div class="viewer-attachment-info">
        <span class="viewer-attachment-icon">${attIcon}</span>
        <div style="min-width:0;">${attachmentHtml}</div>
      </div>
      <div class="viewer-attachment-actions">
        <button class="btn-copy-attachment" data-index="${idx}" type="button">Copy</button>
      </div>
    </div>
  `;
}

function _buildAttachmentsHtml(app, allAttachments, isAlbum) {
  const rowBuilder = isAlbum ? _buildAlbumAttachmentRow : _buildNoteAttachmentRow;
  return allAttachments.map((att, idx) => rowBuilder(app, att, idx)).join('');
}

function _resolveAlbumCopyText(att) {
  if (att.type === 'url') return att.url;
  if (att.type === 'image') return att.url || att.src || att.dataUrl;
  return att.text;
}

function _resolveNoteCopyText(att) {
  return att.type === 'url' ? att.url : att.text;
}

function _wireCopyButtons(app, ctx) {
  ctx.attachList.querySelectorAll(ctx.selector).forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (ctx.stopPropagation) e.stopPropagation();
      const att = ctx.allAttachments[parseInt(btn.dataset.index, 10)];
      if (!att) return;
      const copyText = ctx.resolveText(att);
      if (copyText) { navigator.clipboard.writeText(copyText); app.showToast('Attachment copied!'); }
    });
  });
}

function _attachAlbumInterlayingCrudHandlers(app, attachList, albumId) {
  attachList.querySelectorAll('.btn-edit-album-interlaying').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(idx)) editAlbumInterlayingFromViewer(app, albumId, idx);
    });
  });
  attachList.querySelectorAll('.btn-delete-album-interlaying').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(idx)) deleteAlbumInterlayingFromViewer(app, albumId, idx);
    });
  });
}

function _attachAlbumOpenHandlers(app, attachList, albumId) {
  attachList.querySelectorAll('.btn-open-album-attachment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(idx)) app.openAlbumAttachment(albumId, idx);
    });
  });
}

function _isActivationKey(key) {
  return key === 'Enter' || key === ' ';
}

function _attachAlbumOpenableHandlers(app, attachList, allAttachments, albumId) {
  attachList.querySelectorAll('.viewer-attachment-openable').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.viewer-attachment-actions')) return;
      const idx = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(idx)) app.openAlbumAttachmentViewerModal(albumId, idx);
    });
    item.addEventListener('keydown', (e) => {
      if (!_isActivationKey(e.key)) return;
      e.preventDefault();
      const idx = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(idx)) app.openAlbumAttachmentViewerModal(albumId, idx);
    });
  });
}

function _wireAlbumViewerEvents(app, ctx) {
  _wireCopyButtons(app, {
    attachList: ctx.attachList,
    selector: '.btn-copy-album-attachment',
    allAttachments: ctx.allAttachments,
    resolveText: _resolveAlbumCopyText,
    stopPropagation: true
  });
  _attachAlbumInterlayingCrudHandlers(app, ctx.attachList, ctx.albumId);
  _attachAlbumOpenHandlers(app, ctx.attachList, ctx.albumId);
  _attachAlbumOpenableHandlers(app, ctx.attachList, ctx.allAttachments, ctx.albumId);
}

function _wireNoteViewerEvents(app, ctx) {
  _wireCopyButtons(app, {
    attachList: ctx.attachList,
    selector: '.btn-copy-attachment',
    allAttachments: ctx.allAttachments,
    resolveText: _resolveNoteCopyText
  });
}

function _wireViewerAttachmentEvents(app, ctx) {
  if (ctx.isAlbum) {
    _wireAlbumViewerEvents(app, ctx);
    return;
  }
  _wireNoteViewerEvents(app, ctx);
}

function _renderEmptyAttachmentsState(els) {
  els.attachSection.style.display = 'none';
  if (els.copyAllBtn) els.copyAllBtn.style.display = '';
}

function _renderViewerAttachments(app, ctx) {
  const { els, allAttachments, isAlbum, albumId } = ctx;
  if (allAttachments.length === 0) {
    _renderEmptyAttachmentsState(els);
    return;
  }
  els.attachSection.style.display = 'block';
  if (els.copyAllBtn) els.copyAllBtn.style.display = isAlbum ? 'none' : '';
  els.attachList.innerHTML = _buildAttachmentsHtml(app, allAttachments, isAlbum);
  _wireViewerAttachmentEvents(app, { attachList: els.attachList, allAttachments, isAlbum, albumId });
}

export function openNoteViewer(app, noteId) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note) return;

  app.currentViewerNoteId = noteId;
  const isAlbum = note.type === 'album';
  const allAttachments = collectAlbumInterlayings(note);
  const els = _getViewerElements();

  const editFromViewerBtn = document.getElementById('editNoteFromViewer');
  if (editFromViewerBtn) editFromViewerBtn.textContent = isAlbum ? 'Edit Album' : 'Edit Note';

  _setViewerHeader(app, els, note, isAlbum);
  _setViewerDescription(els, note);
  els.contentText.textContent = note.body || 'No content';
  _applyAlbumViewerHeader(els, isAlbum);
  _renderViewerAttachments(app, { els, allAttachments, isAlbum, albumId: noteId });

  els.modal.style.display = 'flex';
}

// ── closeNoteViewer ────────────────────────────────────────────────────────

export function closeNoteViewer(app) {
  document.getElementById('noteViewerModal').style.display = 'none';
  app.currentViewerNoteId = null;
  app.noteViewerParentAlbumId = null;
}

// ── getAlbumAttachmentOpenMode ─────────────────────────────────────────────

export function getAlbumAttachmentOpenMode(app) {
  return app.albumAttachmentOpenMode === 'overlay' || app.albumAttachmentOpenMode === 'edgePopup'
    ? app.albumAttachmentOpenMode
    : 'edgePopup';
}

// ── openAlbumAttachment ────────────────────────────────────────────────────

export function openAlbumAttachment(app, noteId, attachmentIndex) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note || note.type !== 'album') return;

  const allAttachments = collectAlbumInterlayings(note);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  app.currentAlbumAttachmentContext = { noteId, attachmentIndex };

  const mode = app.getAlbumAttachmentOpenMode();
  if (mode === 'overlay') {
    app.openAlbumAttachmentViewerModal(noteId, attachmentIndex);
    return;
  }
  app.openAlbumAttachmentInEdgePopup(noteId, attachmentIndex);
}

// ── openAlbumAttachmentInEdgePopup ─────────────────────────────────────────

function _isRepoLoaderManifest() {
  const mf = chrome.runtime?.getManifest?.();
  if (!mf) return false;
  const name = String(mf.name || '');
  const desc = String(mf.description || '');
  if (name.includes('Repo Loader')) return true;
  if (desc.includes('repo root')) return true;
  return desc.includes('Actual extension lives in /extension');
}

function _resolveAttachmentViewerUrl(noteId, attachmentIndex) {
  const viewerPath = _isRepoLoaderManifest() ? 'extension/attachment-viewer.html' : 'attachment-viewer.html';
  return chrome.runtime.getURL(viewerPath) +
    `?noteId=${encodeURIComponent(String(noteId))}&index=${encodeURIComponent(String(attachmentIndex))}`;
}

function _openInPopupWindow(app, url, consoleError, toastMessage) {
  try {
    chrome.runtime.sendMessage({ action: 'pcOpenPopupWindow', url, width: 980, height: 720 });
    return;
  } catch (e) {
    try {
      chrome.windows.create({ url, type: 'popup', width: 980, height: 720, focused: true });
    } catch (e2) {
      console.error(consoleError, e2);
      app.showToast(toastMessage);
    }
  }
}

export function openAlbumAttachmentInEdgePopup(app, noteId, attachmentIndex) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note || note.type !== 'album') return;

  const allAttachments = collectAlbumInterlayings(note);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  if (att.type === 'url' && att.url) {
    const safeUrl = resolveSafeExternalUrl(att.url);
    if (!safeUrl) {
      app.showToast('Unsupported link scheme');
      return;
    }
    _openInPopupWindow(app, safeUrl, 'Failed to open URL in popup:', 'Could not open link');
    return;
  }

  const viewerUrl = _resolveAttachmentViewerUrl(noteId, attachmentIndex);
  _openInPopupWindow(app, viewerUrl, 'Failed to open attachment viewer popup:', 'Could not open attachment');
}

// ── Album attachment viewer modal ───────────────────────────────────────────

export function openAlbumAttachmentViewerModal(app, noteId, attachmentIndex) {
  return albumAttachmentViewer.open(app, noteId, attachmentIndex);
}

export function closeAlbumAttachmentViewer(app) {
  return albumAttachmentViewer.close(app);
}

export function openAlbumAttachmentOverlay(app, note, att) {
  const noteId = note?.id;
  if (noteId == null || !att) return;
  const allAttachments = collectAlbumInterlayings(note);
  const idx = allAttachments.findIndex((entry) => entry.id == att.id && entry.type === att.type);
  if (idx >= 0) openAlbumAttachmentViewerModal(app, noteId, idx);
}

// ── openAlbumSourceNoteOverlay ─────────────────────────────────────────────

function _getAlbumSourceNoteElements() {
  return {
    modal: document.getElementById('albumSourceNoteModal'),
    titleText: document.getElementById('albumSourceNoteTitleText'),
    descSection: document.getElementById('albumSourceNoteDescSection'),
    descText: document.getElementById('albumSourceNoteDesc'),
    body: document.getElementById('albumSourceNoteBody'),
    clipsSection: document.getElementById('albumSourceNoteClipsSection'),
    clipsList: document.getElementById('albumSourceNoteClips'),
    urlsSection: document.getElementById('albumSourceNoteUrlsSection'),
    urlsList: document.getElementById('albumSourceNoteUrls'),
    imagesSection: document.getElementById('albumSourceNoteImagesSection'),
    imagesList: document.getElementById('albumSourceNoteImages')
  };
}

function _albumSourceElsValid(els) {
  return Object.values(els).every(Boolean);
}

function _setAlbumSourceMeta(els, sourceNote) {
  const safeTitle = (sourceNote.title || '').trim();
  els.titleText.textContent = safeTitle || 'Untitled Note';

  const safeDesc = (sourceNote.description || '').trim();
  if (safeDesc) {
    els.descSection.style.display = 'block';
    els.descText.textContent = safeDesc;
  } else {
    els.descSection.style.display = 'none';
  }

  els.body.textContent = (sourceNote.body || '').trim() || 'No content';
}

function _imageSrc(img) {
  if (!img) return '';
  return String(img.url || img.src || img.dataUrl || '');
}

function _truncateLong(text, max = 120) {
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function _buildSourceClipRow(app, c, idx) {
  const text = (c && c.text) ? String(c.text) : '';
  const display = _truncateLong(text);
  const liveClip = app._findClipLocationById(c?.id)?.clip;
  const clipTitle = app._clipTitle(liveClip || c);
  const clipHtml = clipTitle
    ? `<div class="viewer-attachment-title" title="${app.escapeHtml(clipTitle)}">${app.escapeHtml(clipTitle)}</div><div class="viewer-attachment-subtext" title="${app.escapeHtml(text)}">${app.escapeHtml(display)}</div>`
    : `<span class="viewer-attachment-text" title="${app.escapeHtml(text)}">${app.escapeHtml(display)}</span>`;
  return `
    <div class="viewer-attachment-item" data-type="clip" data-index="${idx}">
      <div class="viewer-attachment-info"><span class="viewer-attachment-icon">📋</span><div style="min-width:0;">${clipHtml}</div></div>
      <div class="viewer-attachment-actions"><button class="btn-copy-source-note-attachment" data-type="clip" data-index="${idx}" type="button">Copy</button></div>
    </div>
  `;
}

function _buildSimpleSourceRow(app, rowCtx) {
  const { type, icon, value, idx } = rowCtx;
  const display = _truncateLong(value);
  return `
    <div class="viewer-attachment-item" data-type="${type}" data-index="${idx}">
      <div class="viewer-attachment-info"><span class="viewer-attachment-icon">${icon}</span><span class="viewer-attachment-text" title="${app.escapeHtml(value)}">${app.escapeHtml(display)}</span></div>
      <div class="viewer-attachment-actions"><button class="btn-copy-source-note-attachment" data-type="${type}" data-index="${idx}" type="button">Copy</button></div>
    </div>
  `;
}

function _buildSourceUrlRow(app, u, idx) {
  const url = (u && u.url) ? String(u.url) : '';
  return _buildSimpleSourceRow(app, { type: 'url', icon: '🔗', value: url, idx });
}

function _buildSourceImageRow(app, img, idx) {
  return _buildSimpleSourceRow(app, { type: 'image', icon: '🖼️', value: _imageSrc(img), idx });
}

function _renderSourceLists(app, els, sources) {
  els.clipsSection.style.display = sources.clips.length > 0 ? 'block' : 'none';
  els.urlsSection.style.display = sources.urls.length > 0 ? 'block' : 'none';
  els.imagesSection.style.display = sources.images.length > 0 ? 'block' : 'none';

  els.clipsList.innerHTML = sources.clips.map((c, idx) => _buildSourceClipRow(app, c, idx)).join('');
  els.urlsList.innerHTML = sources.urls.map((u, idx) => _buildSourceUrlRow(app, u, idx)).join('');
  els.imagesList.innerHTML = sources.images.map((img, idx) => _buildSourceImageRow(app, img, idx)).join('');
}

function _resolveSourceCopyText(type, idx, sources) {
  if (type === 'clip') return sources.clips[idx]?.text ? String(sources.clips[idx].text) : '';
  if (type === 'url') return sources.urls[idx]?.url ? String(sources.urls[idx].url) : '';
  if (type === 'image') return _imageSrc(sources.images[idx]);
  return '';
}

function _wireSourceNoteCopyHandlers(app, modal, sources) {
  modal.querySelectorAll('.btn-copy-source-note-attachment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const idx = parseInt(btn.dataset.index, 10);
      if (Number.isNaN(idx)) return;
      const copyText = _resolveSourceCopyText(type, idx, sources);
      if (copyText) { navigator.clipboard.writeText(copyText); app.showToast('Attachment copied!'); }
    });
  });
}

function _extractSourceArrays(sourceNote) {
  return {
    clips: Array.isArray(sourceNote.clips) ? sourceNote.clips : [],
    urls: Array.isArray(sourceNote.urls) ? sourceNote.urls : [],
    images: Array.isArray(sourceNote.images) ? sourceNote.images : []
  };
}

export function openAlbumSourceNoteOverlay(app, sourceNoteId, albumId) {
  const sourceNote = app.notes.find(n => n && n.id == sourceNoteId && n.type !== 'album');
  if (!sourceNote) { app.showToast('Source note not found'); return; }

  const els = _getAlbumSourceNoteElements();
  if (!_albumSourceElsValid(els)) return;

  app.currentAlbumSourceNoteContext = { sourceNoteId, albumId };
  _setAlbumSourceMeta(els, sourceNote);

  const sources = _extractSourceArrays(sourceNote);
  _renderSourceLists(app, els, sources);
  _wireSourceNoteCopyHandlers(app, els.modal, sources);

  els.modal.style.display = 'flex';
}

// ── closeAlbumSourceNoteOverlay ────────────────────────────────────────────

export function closeAlbumSourceNoteOverlay(app, options = {}) {
  const ctx = app.currentAlbumSourceNoteContext;
  const modal = document.getElementById('albumSourceNoteModal');
  if (modal) modal.style.display = 'none';
  app.currentAlbumSourceNoteContext = null;
  if (options.reopenAlbumViewer !== false && ctx?.albumId != null) {
    openNoteViewer(app, ctx.albumId);
  }
}

// ── copyAllNoteAttachments ─────────────────────────────────────────────────

export function copyAllNoteAttachments(app) {
  const note = app.notes.find(n => n.id == app.currentViewerNoteId);
  if (!note) return;
  const allText = [
    ...(note.clips || []).map(c => c.text || ''),
    ...(note.urls || []).map(u => u.url || '')
  ].filter(t => t).join('\n\n');
  if (allText) { navigator.clipboard.writeText(allText); app.showToast('All attachments copied!'); }
  else { app.showToast('No attachments to copy'); }
}

// ── Album Picker ───────────────────────────────────────────────────────────

export function showAlbumPicker(app) {
  const modal = document.getElementById('albumPickerModal');
  app.renderAlbumPicker();
  modal.style.display = 'flex';
}

export function showAlbumPickerForNote(app) {
  const modal = document.getElementById('albumPickerModal');
  app.renderAlbumPicker();
  modal.style.display = 'flex';
}

export function closeAlbumPicker(app) {
  document.getElementById('albumPickerModal').style.display = 'none';
  app.pendingNoteForAlbum = null;
  app.pendingBulkClipsForNotes = null;
}

export function showBackToAlbumPicker(app) {
  const backBtn = document.getElementById('backToAlbumPicker');
  if (backBtn) backBtn.style.display = 'block';
}

export function hideBackToAlbumPicker(app) {
  const backBtn = document.getElementById('backToAlbumPicker');
  if (backBtn) backBtn.style.display = 'none';
}

function _filterAlbumPickerNotes(app, searchTerm) {
  const showOnlyAlbums = !!app.pendingNoteForAlbum;
  const base = showOnlyAlbums ? app.notes.filter(n => n.type === 'album') : app.notes;
  if (!searchTerm) return { filtered: base, showOnlyAlbums };

  const term = searchTerm.toLowerCase();
  const filtered = base.filter(n =>
    n.title.toLowerCase().includes(term) || n.description.toLowerCase().includes(term)
  );
  return { filtered, showOnlyAlbums };
}

function _safeArrayLen(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function _albumPickerItemCount(note) {
  if (note.type === 'album') return countAlbumInterlayings(note);
  return _safeArrayLen(note.clips) + _safeArrayLen(note.images) + _safeArrayLen(note.urls);
}

function _buildAlbumPickerRow(app, note) {
  const pickerTypeIcon = note.type === 'album' ? 'folder-open' : 'notebook';
  const itemCount = _albumPickerItemCount(note);
  const itemClass = note.type === 'album' ? 'album-picker-item album' : 'album-picker-item';
  return `
    <div class="${itemClass}" data-note-id="${note.id}">
      <div class="album-picker-info">
        <span class="album-picker-icon"><i data-lucide="${pickerTypeIcon}"></i></span>
        <div class="album-picker-details">
          <div class="album-picker-title">${app.escapeHtml(note.title)}</div>
          <div class="album-picker-meta">${itemCount} items</div>
        </div>
      </div>
    </div>
  `;
}

function _wireAlbumPickerClicks(app, list) {
  list.querySelectorAll('.album-picker-item').forEach(item => {
    item.addEventListener('click', async () => {
      const noteId = item.dataset.noteId;
      if (app.pendingNoteForAlbum) await app.addNoteToAlbum(noteId);
      else await app.addCurrentClipToNote(noteId);
    });
  });
}

export function renderAlbumPicker(app, searchTerm = '') {
  const list = document.getElementById('albumPickerList');
  const { filtered, showOnlyAlbums } = _filterAlbumPickerNotes(app, searchTerm);

  if (filtered.length === 0) {
    list.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 20px;">No ${showOnlyAlbums ? 'albums' : 'notes'} found</p>`;
    return;
  }

  list.innerHTML = filtered.map(note => _buildAlbumPickerRow(app, note)).join('');
  _wireAlbumPickerClicks(app, list);
}

export function filterAlbumPicker(app, searchTerm) {
  app.renderAlbumPicker(searchTerm);
}

// ── Album interlaying viewer actions (CRUD) ────────────────────────────────

function _refreshAlbumViewerIfOpen(app, albumId) {
  if (app.currentViewerNoteId == albumId) openNoteViewer(app, albumId);
  app.renderNotes();
}

export async function deleteAlbumInterlayingFromViewer(app, albumId, flatIndex) {
  try {
    await deleteAlbumInterlaying(app, albumId, flatIndex, {
      afterUpdate: () => _refreshAlbumViewerIfOpen(app, albumId)
    });
    app.showToast('Removed from album');
  } catch (e) {
    console.error('deleteAlbumInterlaying failed:', e);
    app.showToast('Could not remove item');
  }
}

export function editAlbumInterlayingFromViewer(app, albumId, flatIndex) {
  app.openAlbumInterlayingEditor(albumId, flatIndex);
}

export function editAlbumSourceNoteFromOverlay(app) {
  const ctx = app.currentAlbumSourceNoteContext;
  if (!ctx?.sourceNoteId) return;
  app._albumEditorReturnId = ctx.albumId ?? null;
  app.closeAlbumSourceNoteOverlay(app, { reopenAlbumViewer: false });
  document.getElementById('noteViewerModal').style.display = 'none';
  app.openNoteEditor('note', ctx.sourceNoteId, false);
}

export function returnToAlbumViewerAfterEditor(app) {
  const albumId = app._albumEditorReturnId;
  app._albumEditorReturnId = null;
  if (albumId == null) return;
  openNoteViewer(app, albumId);
}

// ── refreshAlbumsForNote ──────────────────────────────────────────────────

function _collectSourceAttachmentIds(sourceNote) {
  const ids = new Set();
  (sourceNote.clips || []).forEach(c => { if (c && c.id != null) ids.add(c.id); });
  (sourceNote.urls || []).forEach(u => { if (u && u.id != null) ids.add(u.id); });
  (sourceNote.images || []).forEach(i => { if (i && i.id != null) ids.add(i.id); });
  return ids;
}

function _albumIsLinkedToSource(album, sourceNoteId, sourceAttachmentIds) {
  const containsSourceNoteId = (arr) =>
    Array.isArray(arr) && arr.some(x => x && x.sourceNoteId == sourceNoteId);
  const containsAnyAttachmentId = (arr) =>
    Array.isArray(arr) && arr.some(x => x && sourceAttachmentIds.has(x.id));
  return (
    containsSourceNoteId(album.clips) ||
    containsSourceNoteId(album.urls) ||
    containsSourceNoteId(album.images) ||
    containsAnyAttachmentId(album.clips) ||
    containsAnyAttachmentId(album.urls) ||
    containsAnyAttachmentId(album.images)
  );
}

function _stripPreviousSourceContent(album, sourceNoteId, sourceAttachmentIds, bodyPrefix) {
  album.clips = album.clips.filter(c => {
    if (!c) return false;
    if (c.sourceNoteId == sourceNoteId) return false;
    if (sourceAttachmentIds.has(c.id)) return false;
    if (typeof c.text === 'string' && c.text.startsWith(bodyPrefix)) return false;
    return true;
  });
  album.urls = album.urls.filter(u => {
    if (!u) return false;
    if (u.sourceNoteId == sourceNoteId) return false;
    if (sourceAttachmentIds.has(u.id)) return false;
    return true;
  });
  album.images = album.images.filter(i => {
    if (!i) return false;
    if (i.sourceNoteId == sourceNoteId) return false;
    if (sourceAttachmentIds.has(i.id)) return false;
    return true;
  });
}

function _reCopySourceContent(album, sourceNote, sourceNoteId, bodyPrefix, now) {
  if (sourceNote.body && sourceNote.body.trim()) {
    album.clips.push({
      type: 'clip',
      id: now + Math.random(),
      text: `${bodyPrefix}\n\n${sourceNote.body}`,
      addedDate: now,
      sourceNoteId
    });
  }
  if (sourceNote.clips?.length > 0) {
    album.clips.push(...sourceNote.clips.map(c => ({ ...c, addedDate: now, sourceNoteId })));
  }
  if (sourceNote.urls?.length > 0) {
    album.urls.push(...sourceNote.urls.map(u => ({ ...u, addedDate: now, sourceNoteId })));
  }
  if (sourceNote.images?.length > 0) {
    album.images.push(...sourceNote.images.map(i => ({ ...i, addedDate: now, sourceNoteId })));
  }
}

export function refreshAlbumsForNote(app, sourceNote) {
  if (!sourceNote || sourceNote.type === 'album') return;

  const sourceNoteId = sourceNote.id;
  const safeTitle = (sourceNote.title || '').trim();
  const displayTitle = safeTitle ? safeTitle : 'Untitled Note';
  const bodyPrefix = `[From: ${displayTitle}]`;

  const sourceAttachmentIds = _collectSourceAttachmentIds(sourceNote);
  const updatedAlbumIds = new Set();

  for (const album of (app.notes || [])) {
    if (!album || album.type !== 'album') continue;
    if (!_albumIsLinkedToSource(album, sourceNoteId, sourceAttachmentIds)) continue;

    if (!Array.isArray(album.clips)) album.clips = [];
    if (!Array.isArray(album.urls)) album.urls = [];
    if (!Array.isArray(album.images)) album.images = [];

    _stripPreviousSourceContent(album, sourceNoteId, sourceAttachmentIds, bodyPrefix);

    const now = Date.now();
    _reCopySourceContent(album, sourceNote, sourceNoteId, bodyPrefix, now);
    syncAlbumRefMetadata(album);

    album.updatedAt = now;

    updatedAlbumIds.add(album.id);
  }

  if (app.currentViewerNoteId && updatedAlbumIds.has(app.currentViewerNoteId)) {
    app.openNoteViewer(app.currentViewerNoteId);
  }
}

export async function addNoteToAlbum(app, albumId) {
  const album = app.notes.find(n => n.id == albumId && n.type === 'album');
  const sourceNote = app.pendingNoteForAlbum;
  if (!album || !sourceNote) return;

  await createAlbumInterlayingsFromSourceNote(app, album.id, sourceNote);

  app.closeAlbumPicker();
  app.pendingNoteForAlbum = null;
  app.showToast(`Note added to album "${album.title}"`);
  app.renderNotes();
}
