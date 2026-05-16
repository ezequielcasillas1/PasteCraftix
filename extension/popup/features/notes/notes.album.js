// ── shared helpers ─────────────────────────────────────────────────────────

function _collectNoteAttachments(note, allNotes = []) {
  if (note.type === 'album') {
    if (!Array.isArray(note.sourceNoteIds)) return [];
    return note.sourceNoteIds
      .map(id => allNotes.find(n => n.id == id))
      .filter(Boolean)
      .map(n => ({ ...n, isReferencedNote: true }));
  }
  return [
    ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
    ...(note.images || []).map(i => ({ ...i, type: 'image' })),
    ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
  ];
}

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

function _resolveSourceNoteIdForAttachment(app, att) {
  if (att.sourceNoteId != null) return att.sourceNoteId;
  if (att.id == null) return null;
  const inferred = _findSourceNoteForAttachment(app.notes, att);
  return inferred ? inferred.id : null;
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
  if (att.isReferencedNote) {
    const title = (att.title || '').trim() || 'Untitled Note';
    const desc = (att.description || '').trim();
    const descHtml = desc ? `<div class="viewer-attachment-subtext" title="${app.escapeHtml(desc)}">${app.escapeHtml(_truncateForDisplay(desc))}</div>` : '';
    
    return `
      <div class="viewer-attachment-item viewer-attachment-openable" data-index="${idx}" role="button" tabindex="0">
        <div class="viewer-attachment-info">
          <span class="viewer-attachment-icon">📝</span>
          <div style="min-width:0;">
            <div class="viewer-attachment-title" title="${app.escapeHtml(title)}">${app.escapeHtml(title)}</div>
            ${descHtml}
          </div>
        </div>
        <div class="viewer-attachment-actions">
          <button class="btn-open-album-attachment" data-index="${idx}" type="button" title="Open note" style="border:none; background:transparent; cursor:pointer; color:#9ca3af; font-size:18px; line-height:1; padding:0 2px;">›</button>
        </div>
      </div>
    `;
  }

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

function _attachAlbumOpenHandlers(app, attachList, albumId) {
  attachList.querySelectorAll('.btn-open-album-attachment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(idx)) app.openAlbumAttachment(albumId, idx);
    });
  });
}

function _openAlbumSourceFromIndex(app, allAttachments, idx, albumId) {
  const att = allAttachments[idx];
  if (!att) return;
  if (att.isReferencedNote) {
    app.noteViewerParentAlbumId = albumId;
    app.openNoteViewer(att.id);
    return;
  }
  const sourceNoteId = _resolveSourceNoteIdForAttachment(app, att);
  if (sourceNoteId == null) { app.showToast('No source note for this item'); return; }
  app.openAlbumSourceNoteOverlay(sourceNoteId, albumId);
}

function _isActivationKey(key) {
  return key === 'Enter' || key === ' ';
}

function _attachAlbumOpenableHandlers(app, attachList, allAttachments, albumId) {
  attachList.querySelectorAll('.viewer-attachment-openable').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(idx)) _openAlbumSourceFromIndex(app, allAttachments, idx, albumId);
    });
    item.addEventListener('keydown', (e) => {
      if (!_isActivationKey(e.key)) return;
      e.preventDefault();
      const idx = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(idx)) _openAlbumSourceFromIndex(app, allAttachments, idx, albumId);
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
  const allAttachments = _collectNoteAttachments(note, app.notes);
  const els = _getViewerElements();

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

  const allAttachments = _collectNoteAttachments(note, app.notes);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  if (att.isReferencedNote) {
    app.noteViewerParentAlbumId = noteId;
    app.openNoteViewer(att.id);
    return;
  }

  app.currentAlbumAttachmentContext = { noteId, attachmentIndex };

  const mode = app.getAlbumAttachmentOpenMode();
  if (mode === 'overlay') { app.openAlbumAttachmentOverlay(note, att); return; }
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

  const allAttachments = _collectNoteAttachments(note);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  if (att.type === 'url' && att.url) {
    _openInPopupWindow(app, att.url, 'Failed to open URL in popup:', 'Could not open link');
    return;
  }

  const viewerUrl = _resolveAttachmentViewerUrl(noteId, attachmentIndex);
  _openInPopupWindow(app, viewerUrl, 'Failed to open attachment viewer popup:', 'Could not open attachment');
}

// ── openAlbumAttachmentOverlay ─────────────────────────────────────────────

function _getAlbumAttachmentViewerElements() {
  return {
    modal: document.getElementById('albumAttachmentViewerModal'),
    titleEl: document.getElementById('albumAttachmentViewerTitle'),
    metaSection: document.getElementById('albumAttachmentViewerNoteMeta'),
    albumTitle: document.getElementById('albumAttachmentViewerAlbumTitle'),
    albumDesc: document.getElementById('albumAttachmentViewerAlbumDesc'),
    body: document.getElementById('albumAttachmentViewerBody'),
    openBtn: document.getElementById('albumAttachmentOpenInPopupBtn')
  };
}

function _albumAttachmentViewerElsValid(els) {
  const required = [els.modal, els.titleEl, els.metaSection, els.albumTitle, els.albumDesc, els.body];
  return required.every(Boolean);
}

function _resolveAttachmentOverlayTitle(app, att) {
  if (att.type === 'image') return 'Image';
  if (att.type !== 'clip') return 'Link';
  const liveClip = app._findClipLocationById(att.id)?.clip;
  const clipTitle = app._clipTitle(liveClip || att);
  return clipTitle || 'Clip';
}

function _renderAttachmentImageBody(app, att, body) {
  const src = att.dataUrl || att.url || att.src || '';
  body.innerHTML = src
    ? `<img src="${app.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`
    : 'Image attachment is missing a source.';
}

function _renderAttachmentLinkBody(app, att, body) {
  const url = att.url || '';
  const safeUrl = app.escapeHtml(url);
  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="font-weight:600; color:#111827;">Link</div>
      <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
      <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
    </div>
  `;
}

function _renderAttachmentBody(app, att, body) {
  if (att.type === 'clip') {
    body.textContent = att.text || '';
    return;
  }
  if (att.type === 'image') {
    _renderAttachmentImageBody(app, att, body);
    return;
  }
  _renderAttachmentLinkBody(app, att, body);
}

export function openAlbumAttachmentOverlay(app, note, att) {
  const els = _getAlbumAttachmentViewerElements();
  if (!_albumAttachmentViewerElsValid(els)) return;

  const safeTitle = (note.title || '').trim() || 'Untitled Album';
  const safeDesc = (note.description || '').trim();
  els.metaSection.style.display = 'block';
  els.albumTitle.textContent = safeTitle;
  els.albumDesc.textContent = safeDesc || '';

  els.titleEl.textContent = _resolveAttachmentOverlayTitle(app, att);
  if (els.openBtn) els.openBtn.style.display = 'inline-flex';

  _renderAttachmentBody(app, att, els.body);
  els.modal.style.display = 'flex';
}

// ── closeAlbumAttachmentViewer ─────────────────────────────────────────────

export function closeAlbumAttachmentViewer(app) {
  const modal = document.getElementById('albumAttachmentViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentAlbumAttachmentContext = null;
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

export function closeAlbumSourceNoteOverlay(app) {
  const modal = document.getElementById('albumSourceNoteModal');
  if (modal) modal.style.display = 'none';
  app.currentAlbumSourceNoteContext = null;
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
  if (note.type === 'album') return _safeArrayLen(note.noteRefs);
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

// ── addNoteToAlbum ─────────────────────────────────────────────────────────

function _ensureAlbumCollections(album) {
  if (!album.clips) album.clips = [];
  if (!album.urls) album.urls = [];
  if (!album.images) album.images = [];
  if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
}

function _addSourceNoteIdToAlbum(album, sourceNoteId) {
  if (!album.sourceNoteIds.includes(sourceNoteId)) {
    album.sourceNoteIds.push(sourceNoteId);
  }
}

function _appendSourceBodyAsClip(album, sourceNote) {
  if (!sourceNote.body || !sourceNote.body.trim()) return;
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

function _mergeSourceContentIntoAlbum(album, sourceNote) {
  // No longer duplicating content into albums
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
  return Array.isArray(album.sourceNoteIds) && album.sourceNoteIds.includes(sourceNoteId);
}

function _stripPreviousSourceContent(album, sourceNoteId, sourceAttachmentIds, bodyPrefix) {
  // No longer duplicating content into albums
}

function _reCopySourceContent(album, sourceNote, sourceNoteId, bodyPrefix, now) {
  // No longer duplicating content into albums
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

    album.updatedAt = now;
    if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
    if (!album.sourceNoteIds.includes(sourceNoteId)) album.sourceNoteIds.push(sourceNoteId);

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

  _ensureAlbumCollections(album);
  _addSourceNoteIdToAlbum(album, sourceNote.id);
  _mergeSourceContentIntoAlbum(album, sourceNote);

  album.updatedAt = Date.now();
  await app.saveNotes();
  await pasteCraftSupabase.syncWithQueue('syncNotes', [PasteCraftCRUD.createSnapshot(album)], pasteCraftSupabase.syncNotesToSupabase);
  app.closeAlbumPicker();
  app.pendingNoteForAlbum = null;
  app.showToast(`Note added to album "${album.title}"`);
  app.renderNotes();
}
