function _hasValidAttachmentContext(ctx) {
  if (!ctx) return false;
  if (ctx.noteId == null) return false;
  return typeof ctx.attachmentIndex === 'number';
}

export function registerNotesEvents(app) {
  if (app._notesEventsRegistered) return;
  app._notesEventsRegistered = true;

  // Create note / album
  document.getElementById('createNoteBtn').addEventListener('click', () => app.openNoteEditor('note'));
  document.getElementById('createAlbumBtn').addEventListener('click', () => app.openNoteEditor('album'));

  // Notes info modal
  const notesInfoExpandBtn = document.getElementById('notesInfoExpandBtn');
  if (notesInfoExpandBtn) {
    notesInfoExpandBtn.addEventListener('click', () => {
      const modal = document.getElementById('notesInfoModal');
      if (modal) modal.style.display = 'flex';
    });
  }
  const closeNotesInfoModal = document.getElementById('closeNotesInfoModal');
  if (closeNotesInfoModal) {
    closeNotesInfoModal.addEventListener('click', () => {
      const modal = document.getElementById('notesInfoModal');
      if (modal) modal.style.display = 'none';
    });
  }
  const notesInfoModal = document.getElementById('notesInfoModal');
  if (notesInfoModal) {
    notesInfoModal.addEventListener('click', (e) => {
      if (e.target === notesInfoModal) notesInfoModal.style.display = 'none';
    });
  }

  // Notes search
  const notesSearchInput = document.getElementById('notesSearchInput');
  const notesSearchClear = document.getElementById('notesSearchClear');
  if (notesSearchInput) {
    notesSearchInput.addEventListener('input', () => {
      const val = notesSearchInput.value.trim();
      if (notesSearchClear) notesSearchClear.classList.toggle('visible', val.length > 0);
      app.notesPageIndex = 0;
      app.renderNotes();
    });
  }
  if (notesSearchClear) {
    notesSearchClear.addEventListener('click', () => {
      if (notesSearchInput) notesSearchInput.value = '';
      notesSearchClear.classList.remove('visible');
      app.notesPageIndex = 0;
      app.renderNotes();
    });
  }

  // View albums toggle
  const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
  if (viewAlbumsBtn) {
    viewAlbumsBtn.addEventListener('click', async () => {
      app.notesViewMode = app.notesViewMode === 'albums' ? 'notes' : 'albums';
      app.notesPageIndex = 0;
      viewAlbumsBtn.classList.toggle('active', app.notesViewMode === 'albums');
      await app.saveNotesPrefs();
      app.renderNotes();
    });
  }

  // AI toggle
  const notesAiToggle = document.getElementById('notesAiToggle');
  if (notesAiToggle) {
    notesAiToggle.addEventListener('change', async (e) => {
      app.notesAiEnabled = !!e.target.checked;
      await app.saveNotesPrefs();
      app.updateNoteAiControls();
    });
  }

  // Note editor actions
  document.getElementById('closeNoteEditor').addEventListener('click', () => app.closeNoteEditor());
  document.getElementById('cancelNoteEditor').addEventListener('click', () => app.closeNoteEditor());
  document.getElementById('saveNote').addEventListener('click', () => app.saveNote());

  document.getElementById('addClipToNote').addEventListener('click', () => {
    app.showClipPickerForNote();
  });

  // Clip picker
  document.getElementById('closeClipPicker').addEventListener('click', () => app.closeClipPicker());
  document.querySelectorAll('.clip-picker-tab').forEach(tab => {
    tab.addEventListener('click', () => app.switchClipPickerTab(tab.dataset.pickerTab));
  });
  document.getElementById('clipPickerSearchInput').addEventListener('input', (e) => app.searchClipsInPicker(e.target.value));
  document.getElementById('clipPickerAddBtn').addEventListener('click', () => app.addSelectedClipsToNote());

  document.getElementById('addImageToNote').addEventListener('click', () => {
    app.showImagePickerForNote();
  });

  document.getElementById('addURLToNote').addEventListener('click', () => {
    app.addURLToNote();
  });

  // AI title/desc buttons
  const aiTitleBtn = document.getElementById('aiTitleBtn');
  if (aiTitleBtn) aiTitleBtn.addEventListener('click', async () => app.generateNoteTitleFromContent());
  const aiDescBtn = document.getElementById('aiDescBtn');
  if (aiDescBtn) aiDescBtn.addEventListener('click', async () => app.generateNoteDescriptionFromContent());

  const noteBodyInput = document.getElementById('noteBodyInput');
  if (noteBodyInput) noteBodyInput.addEventListener('input', () => app.updateNoteAiControls());

  // Album picker
  document.getElementById('closeAlbumPicker').addEventListener('click', () => app.closeAlbumPicker());
  document.getElementById('createNewAlbumFromPicker').addEventListener('click', () => {
    app.createdFromPicker = true;
    app.closeAlbumPicker();
    app.openNoteEditor('album', null, true);
  });
  document.getElementById('backToAlbumPicker').addEventListener('click', () => {
    app.closeNoteEditor();
    app.showAlbumPicker();
  });
  document.getElementById('albumPickerSearch').addEventListener('input', (e) => app.filterAlbumPicker(e.target.value));

  // Notes header view toggle
  const notesHeader = document.querySelector('.notes-header');
  if (notesHeader) {
    notesHeader.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.view-toggle-btn');
      if (toggleBtn) {
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        toggleBtn.classList.add('active');
        const view = toggleBtn.dataset.view;
        const container = document.getElementById('notesContainer');
        if (container) {
          if (view === 'list') container.classList.add('list-view');
          else container.classList.remove('list-view');
          app.renderNotes();
        }
      }
    });
  }

  // Note viewer
  document.getElementById('closeNoteViewer').addEventListener('click', () => app.closeNoteViewer());
  document.getElementById('closeNoteViewerBtn').addEventListener('click', () => app.closeNoteViewer());

  const noteViewerBackBtn = document.getElementById('noteViewerBackBtn');
  if (noteViewerBackBtn) {
    noteViewerBackBtn.addEventListener('click', () => {
      if (app.noteViewerParentAlbumId) {
        const albumId = app.noteViewerParentAlbumId;
        app.noteViewerParentAlbumId = null;
        app.openNoteViewer(albumId);
      }
    });
  }

  document.getElementById('editNoteFromViewer').addEventListener('click', () => {
    const noteId = app.currentViewerNoteId;
    app.closeNoteViewer();
    if (noteId) {
      const note = app.notes.find(n => n.id == noteId);
      app.openNoteEditor(note?.type || 'note', noteId);
    }
  });

  document.getElementById('copyNoteContent').addEventListener('click', () => {
    const content = document.getElementById('noteViewerContent')?.textContent;
    if (content) { navigator.clipboard.writeText(content); app.showToast('Content copied!'); }
  });

  document.getElementById('copyAllAttachments').addEventListener('click', () => app.copyAllNoteAttachments());

  // Album attachment viewer
  const albumAttachmentBackBtn = document.getElementById('albumAttachmentBackBtn');
  if (albumAttachmentBackBtn) albumAttachmentBackBtn.addEventListener('click', () => app.closeAlbumAttachmentViewer());

  const closeAlbumAttachmentViewerBtn = document.getElementById('closeAlbumAttachmentViewer');
  if (closeAlbumAttachmentViewerBtn) closeAlbumAttachmentViewerBtn.addEventListener('click', () => app.closeAlbumAttachmentViewer());

  const albumAttachmentOpenInPopupBtn = document.getElementById('albumAttachmentOpenInPopupBtn');
  if (albumAttachmentOpenInPopupBtn) {
    albumAttachmentOpenInPopupBtn.addEventListener('click', () => {
      const ctx = app.currentAlbumAttachmentContext;
      if (_hasValidAttachmentContext(ctx)) {
        app.openAlbumAttachmentInEdgePopup(ctx.noteId, ctx.attachmentIndex);
      }
    });
  }

  // Modal overlay closes
  document.getElementById('noteEditorModal').addEventListener('click', (e) => {
    if (e.target.id === 'noteEditorModal') app.closeNoteEditor();
  });
  document.getElementById('albumPickerModal').addEventListener('click', (e) => {
    if (e.target.id === 'albumPickerModal') app.closeAlbumPicker();
  });
  document.getElementById('clipPickerModal').addEventListener('click', (e) => {
    if (e.target.id === 'clipPickerModal') app.closeClipPicker();
  });
  document.getElementById('noteViewerModal').addEventListener('click', (e) => {
    if (e.target.id === 'noteViewerModal') app.closeNoteViewer();
  });

  const albumAttachmentViewerModal = document.getElementById('albumAttachmentViewerModal');
  if (albumAttachmentViewerModal) {
    albumAttachmentViewerModal.addEventListener('click', (e) => {
      if (e.target.id === 'albumAttachmentViewerModal') app.closeAlbumAttachmentViewer();
    });
  }

  // Album source note overlay
  const albumSourceNoteBackBtn = document.getElementById('albumSourceNoteBackBtn');
  if (albumSourceNoteBackBtn) {
    albumSourceNoteBackBtn.addEventListener('click', () => app.closeAlbumSourceNoteOverlay());
  }
  const albumSourceNoteBackFooterBtn = document.getElementById('albumSourceNoteBackFooterBtn');
  if (albumSourceNoteBackFooterBtn) {
    albumSourceNoteBackFooterBtn.addEventListener('click', () => app.closeAlbumSourceNoteOverlay());
  }

  const albumSourceNoteEditBtn = document.getElementById('albumSourceNoteEditBtn');
  if (albumSourceNoteEditBtn) {
    albumSourceNoteEditBtn.addEventListener('click', () => app.editAlbumSourceNoteFromOverlay());
  }

  const closeAlbumSourceNoteModalBtn = document.getElementById('closeAlbumSourceNoteModal');
  if (closeAlbumSourceNoteModalBtn) closeAlbumSourceNoteModalBtn.addEventListener('click', () => app.closeAlbumSourceNoteOverlay());

  const albumSourceNoteCopyContentBtn = document.getElementById('albumSourceNoteCopyContent');
  if (albumSourceNoteCopyContentBtn) {
    albumSourceNoteCopyContentBtn.addEventListener('click', () => {
      const content = document.getElementById('albumSourceNoteBody')?.textContent;
      if (content) { navigator.clipboard.writeText(content); app.showToast('Content copied!'); }
    });
  }

  const albumSourceNoteModal = document.getElementById('albumSourceNoteModal');
  if (albumSourceNoteModal) {
    albumSourceNoteModal.addEventListener('click', (e) => {
      if (e.target.id === 'albumSourceNoteModal') app.closeAlbumSourceNoteOverlay();
    });
  }
}
