import { NOTES_DEFAULTS, NOTES_PAGE_SIZES } from './notes.constants.js';
import { getNoteContainerElements } from './notes.selectors.js';

// ── renderNotes ────────────────────────────────────────────────────────────

function _getSearchQuery() {
  const searchInput = document.getElementById('notesSearchInput');
  return searchInput ? searchInput.value.trim().toLowerCase() : '';
}

function _matchesSearch(note, query) {
  if (!query) return true;
  const title = (note.title || '').toLowerCase();
  const desc = (note.description || '').toLowerCase();
  const type = (note.type || '').toLowerCase();
  return title.includes(query) || desc.includes(query) || type.includes(query);
}

function _filterNotes(allNotes, query) {
  if (!query) return allNotes;
  return allNotes.filter(n => _matchesSearch(n, query));
}

function _resolveTotalNotes(app, filtered, query) {
  if (query) return filtered.length;
  return Math.max(app.totalNotesCount || 0, filtered.length);
}

function _renderSearchEmptyState(container, app, query) {
  container.innerHTML = `<div class="empty-state">
       <div class="empty-state-icon"><i data-lucide="search"></i></div>
       <h3>No results found</h3>
       <p>No notes or albums match "<strong>${app.escapeHtml(query)}</strong>"</p>
     </div>`;
}

function _renderNoNotesState(container) {
  container.innerHTML = `<div class="empty-state">
       <div class="empty-state-icon"><i data-lucide="notebook-pen"></i></div>
       <h3>No notes yet</h3>
       <p>Create a note or album to bundle your clips, images, and URLs</p>
       <div class="demo-hint">
         <span class="demo-step">📝 Take notes</span>
         <span class="demo-step">📚 Create albums</span>
         <span class="demo-step">📤 Export to PDF</span>
       </div>
     </div>`;
}

function _renderEmptyNotesState(container, paginationEl, app, query) {
  if (query) _renderSearchEmptyState(container, app, query);
  else _renderNoNotesState(container);
  if (paginationEl) paginationEl.style.display = 'none';
}

function _clampPageIndex(app, pageCount) {
  if (app.notesPageIndex < 0) app.notesPageIndex = 0;
  if (app.notesPageIndex > pageCount - 1) app.notesPageIndex = pageCount - 1;
}

function _shouldLazyLoad(app, query, start, filteredLength) {
  if (query) return false;
  if (start < filteredLength) return false;
  return !!app.tieredNotesStore?.needsLazyLoading();
}

function _renderNotesPage(app, container, pageItems) {
  container.innerHTML = pageItems.map(note => renderNoteCard(note, app)).join('');
}

export function renderNotes(app) {
  const { container, pagination: paginationEl } = getNoteContainerElements();
  if (!container) return;

  const isListView = !!container.classList?.contains('list-view');
  const allNotes = Array.isArray(app.notes) ? app.notes : [];
  const searchQuery = _getSearchQuery();
  const filtered = _filterNotes(allNotes, searchQuery);
  const totalNotes = _resolveTotalNotes(app, filtered, searchQuery);

  if (totalNotes === 0) {
    _renderEmptyNotesState(container, paginationEl, app, searchQuery);
    return;
  }

  const pageSize = isListView ? NOTES_PAGE_SIZES.LIST : NOTES_PAGE_SIZES.GRID;
  const pageCount = Math.max(1, Math.ceil(totalNotes / pageSize));
  _clampPageIndex(app, pageCount);
  const start = app.notesPageIndex * pageSize;

  if (_shouldLazyLoad(app, searchQuery, start, filtered.length)) {
    app._lazyLoadNotesPage(start, pageSize, container, paginationEl, pageCount);
    return;
  }

  const pageItems = filtered.slice(start, Math.min(start + pageSize, filtered.length));
  _renderNotesPage(app, container, pageItems);

  renderNotesPagination(app, paginationEl, pageCount);
  attachNoteCardListeners(app, container);
}

// ── renderNoteCard ─────────────────────────────────────────────────────────

function _safeArrayLen(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function _resolveNoteCounts(note) {
  if (note.type === 'album') {
    return { totalItems: _safeArrayLen(note.noteRefs) };
  }
  const clipCount = _safeArrayLen(note.clips);
  const imageCount = _safeArrayLen(note.images);
  const urlCount = _safeArrayLen(note.urls);
  return { totalItems: clipCount + imageCount + urlCount };
}

function _resolveNoteDisplayTitle(note) {
  const safeTitle = (note.title || '').trim();
  if (safeTitle) return safeTitle;
  return note.type === 'album' ? NOTES_DEFAULTS.UNTITLED_ALBUM : NOTES_DEFAULTS.UNTITLED_NOTE;
}

function _buildSendToAlbumButton(note) {
  if (note.type === 'album') return '';
  return `<button class="note-action-btn send-to-album-btn" data-note-id="${note.id}" title="Send/Create Album"><i data-lucide="folder-plus"></i></button>`;
}

function _buildNoteCardActions(note) {
  return `
    <button class="note-action-btn edit-note" data-note-id="${note.id}" title="Edit"><i data-lucide="pencil"></i></button>
    <button class="note-action-btn export-note-pdf" data-note-id="${note.id}" title="Export to PDF"><i data-lucide="file-down"></i></button>
    ${_buildSendToAlbumButton(note)}
    <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete"><i data-lucide="trash-2"></i></button>
  `;
}

function _formatNoteDate(note) {
  return new Date(note.createdAt).toLocaleDateString();
}

function _formatItemCountLabel(count) {
  return `${count} item${count !== 1 ? 's' : ''}`;
}

function _buildNoteDescriptionHtml(note, app) {
  const safeDesc = (note.description || '').trim();
  return safeDesc ? app.escapeHtml(safeDesc) : '<em>No description</em>';
}

export function renderNoteCard(note, app) {
  const { totalItems } = _resolveNoteCounts(note);
  const cardClass = note.type === 'album' ? 'note-card album' : 'note-card';
  const typeIcon = note.type === 'album' ? 'folder-open' : 'notebook';
  const displayTitle = _resolveNoteDisplayTitle(note);

  return `
    <div class="${cardClass}" data-note-id="${note.id}">
      <div class="note-card-header">
        <span class="note-card-type"><i data-lucide="${typeIcon}"></i></span>
        <div class="note-card-actions">${_buildNoteCardActions(note)}</div>
      </div>
      <h4 class="note-card-title">${app.escapeHtml(displayTitle)}</h4>
      <p class="note-card-description">${_buildNoteDescriptionHtml(note, app)}</p>
      <div class="note-card-footer">
        <span class="note-card-date">${_formatNoteDate(note)}</span>
        <span class="note-card-count">${_formatItemCountLabel(totalItems)}</span>
      </div>
    </div>
  `;
}

// ── renderNotesPagination ──────────────────────────────────────────────────

function renderNotesPagination(app, paginationEl, pageCount) {
  if (!paginationEl) return;
  if (pageCount <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  paginationEl.style.display = 'flex';
  paginationEl.innerHTML = Array.from({ length: pageCount }).map((_, idx) => {
    const active = idx === app.notesPageIndex ? 'active' : '';
    return `<button class="notes-page-btn ${active}" data-page="${idx}" title="Page ${idx}">${idx}</button>`;
  }).join('');

  paginationEl.querySelectorAll('.notes-page-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nextPage = parseInt(btn.dataset.page, 10);
      if (!Number.isNaN(nextPage)) {
        app.notesPageIndex = nextPage;
        await app.saveNotesPrefs();
        app.renderNotes();
      }
    });
  });
}

// ── attachNoteCardListeners ────────────────────────────────────────────────

function _resolveNoteIdFromActionBtn(btn) {
  return btn.dataset.noteId;
}

async function _handleSendToAlbum(app, noteId) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note) return;
  app.pendingNoteForAlbum = note;
  try { await app.loadNotes(); }
  catch (e) { console.warn('loadNotes before album picker failed:', e); }
  app.showAlbumPickerForNote();
}

function _routeNoteCardAction(app, e) {
  const actionBtn = e.target.closest('.note-action-btn');
  if (actionBtn) {
    e.stopPropagation();
    const noteId = _resolveNoteIdFromActionBtn(actionBtn);
    if (actionBtn.classList.contains('edit-note')) {
      const note = app.notes.find(n => n.id == noteId);
      if (note) app.openNoteEditor(note.type, noteId);
      return;
    }
    if (actionBtn.classList.contains('export-note-pdf')) { app.exportNoteToPDF(noteId); return; }
    if (actionBtn.classList.contains('delete-note')) { app.deleteNote(noteId); return; }
    if (actionBtn.classList.contains('send-to-album-btn')) { _handleSendToAlbum(app, noteId); return; }
    return;
  }
  const card = e.target.closest('.note-card');
  if (card) app.openNoteViewer(card.dataset.noteId);
}

export function attachNoteCardListeners(app, container) {
  if (container.dataset.notesDelegated === '1') return;
  container.dataset.notesDelegated = '1';
  container.addEventListener('click', (e) => _routeNoteCardAction(app, e));
}

// ── updateNoteAiControls ───────────────────────────────────────────────────

function _aiButtonsAvailable(els) {
  return !!(els.aiTitleBtn && els.aiDescBtn && els.bodyInput);
}

export function updateNoteAiControls(app) {
  const els = {
    aiTitleBtn: document.getElementById('aiTitleBtn'),
    aiDescBtn: document.getElementById('aiDescBtn'),
    bodyInput: document.getElementById('noteBodyInput')
  };
  if (!_aiButtonsAvailable(els)) return;

  const hasContent = !!els.bodyInput.value.trim();
  const shouldShow = !!app.notesAiEnabled;

  els.aiTitleBtn.style.display = shouldShow ? 'inline-flex' : 'none';
  els.aiDescBtn.style.display = shouldShow ? 'inline-flex' : 'none';
  els.aiTitleBtn.disabled = !hasContent;
  els.aiDescBtn.disabled = !hasContent;
}

// ── renderNoteAttachments ──────────────────────────────────────────────────

export function renderNoteAttachments(app) {
  const attachmentsList = document.getElementById('noteAttachmentsList');
  if (!attachmentsList) return;

  if (app.currentNoteAttachments.length === 0) {
    attachmentsList.innerHTML = '<p style="text-align: center; color: #9ca3af; font-size: 13px;">No attachments yet</p>';
    return;
  }

  attachmentsList.innerHTML = app.currentNoteAttachments.map((att, index) => {
    const icon = att.type === 'clip' ? '📋' : att.type === 'image' ? '🖼️' : '🔗';
    const text = att.type === 'url' ? att.url : (att.text?.substring(0, 50) + '...');
    const date = att.addedDate ? new Date(att.addedDate).toLocaleDateString() : '';
    return `
      <div class="attachment-item">
        <div class="attachment-info">
          <span>${icon}</span>
          <span class="attachment-text" title="${app.escapeHtml(text)}">${app.escapeHtml(text)}</span>
          ${date ? `<span class="attachment-date">${date}</span>` : ''}
        </div>
        <button class="attachment-remove" data-index="${index}">✕</button>
      </div>
    `;
  }).join('');

  attachmentsList.querySelectorAll('.attachment-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      app.currentNoteAttachments.splice(index, 1);
      app.renderNoteAttachments();
    });
  });
}
