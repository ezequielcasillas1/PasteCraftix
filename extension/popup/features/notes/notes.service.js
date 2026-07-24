import {
  getIndexedDb,
  getIndexedDbPayloads,
} from '../../../bridges/storage/indexeddb.facade.js';
import {
  getTieredStore,
  isTieredStorageAvailable,
} from '../../../bridges/storage/tiered-storage.facade.js';

// ── dedupe helper ──────────────────────────────────────────────────────────

// Two notes can never legitimately share an `id`. When that happens we keep
// the most recently updated record; on ties a soft-deleted note wins so a
// pending delete cannot be silently resurrected by an older live copy.
function _pickPreferredNote(existing, candidate) {
  const existingMs = Number.isFinite(existing?.updatedAt) ? existing.updatedAt : 0;
  const candidateMs = Number.isFinite(candidate?.updatedAt) ? candidate.updatedAt : 0;
  if (candidateMs > existingMs) return candidate;
  if (candidateMs < existingMs) return existing;
  if (candidate?.deletedAt && !existing?.deletedAt) return candidate;
  return existing;
}

export function dedupeNotesById(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return [];
  const map = new Map();
  notes.forEach(note => {
    if (!note || note.id == null) return;
    const key = String(note.id);
    const existing = map.get(key);
    map.set(key, existing ? _pickPreferredNote(existing, note) : note);
  });
  return Array.from(map.values());
}

function _noteSortMs(note) {
  if (Number.isFinite(note?.updatedAt)) return note.updatedAt;
  if (Number.isFinite(note?.createdAt)) return note.createdAt;
  return 0;
}

function sortNotesByRecency(notes) {
  return [...notes].sort((a, b) => {
    const diff = _noteSortMs(b) - _noteSortMs(a);
    if (diff !== 0) return diff;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}

function _noteIdOrder(notes) {
  return notes.map(note => String(note?.id || '')).join('|');
}

// ── loadNotes ──────────────────────────────────────────────────────────────

async function _readNotesFromStorage() {
  const stored = await chrome.storage.local.get(['notes', 'notesViewMode', 'notesPageIndex', 'notesAiEnabled']);
  return {
    notes: Array.isArray(stored.notes) ? stored.notes : [],
    notesViewMode: stored.notesViewMode ?? 'notes',
    notesPageIndex: stored.notesPageIndex ?? 0,
    notesAiEnabled: stored.notesAiEnabled ?? false
  };
}

function _hasIdb(app) {
  return !!(app && app._idbReady && app.idb);
}

function _idbHasMoreNotes(idbNotes, currentNotes) {
  if (!Array.isArray(idbNotes)) return false;
  return idbNotes.length >= (currentNotes?.length || 0);
}

async function _loadDeletedNoteIdSet() {
  try {
    const { pc_deleted_notes } = await chrome.storage.local.get(['pc_deleted_notes']);
    const list = Array.isArray(pc_deleted_notes) ? pc_deleted_notes : [];
    return new Set(list.map((t) => String(t?.id)).filter(Boolean));
  } catch (_) {
    return new Set();
  }
}

function _filterTombstonedNotes(notes, deletedIds) {
  if (!deletedIds?.size) return Array.isArray(notes) ? notes : [];
  return (Array.isArray(notes) ? notes : []).filter(
    (n) => n?.id != null && !deletedIds.has(String(n.id))
  );
}

async function _resolveNotesFromIdb(app, currentNotes) {
  const deletedIds = await _loadDeletedNoteIdSet();
  const chromeNotes = _filterTombstonedNotes(currentNotes, deletedIds);
  if (!_hasIdb(app)) return chromeNotes;
  const idbNotes = await app.idb.getAllPayloads('notes');
  const idbFiltered = _filterTombstonedNotes(idbNotes, deletedIds);
  return _idbHasMoreNotes(idbFiltered, chromeNotes) ? idbFiltered : chromeNotes;
}

async function _seedDemoNotesIfEmpty(notes) {
  if (notes.length > 0) return notes;
  const demo = _buildDemoNotes();
  await chrome.storage.local.set({ notes: demo });
  console.log('🧪 Seeded 2 notes + 2 albums (PC 1.0)');
  return demo;
}

function _applyNotesPrefs(app, prefs) {
  app.notesViewMode = prefs.notesViewMode;
  app.notesPageIndex = typeof prefs.notesPageIndex === 'number' ? prefs.notesPageIndex : 0;
  app.notesAiEnabled = !!prefs.notesAiEnabled;

  const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
  if (viewAlbumsBtn) viewAlbumsBtn.classList.toggle('active', app.notesViewMode === 'albums');
  const notesAiToggle = document.getElementById('notesAiToggle');
  if (notesAiToggle) notesAiToggle.checked = app.notesAiEnabled;
}

export async function loadNotes(app) {
  await app._ensureIndexedDbReadyAndMigrate();

  const stored = await _readNotesFromStorage();
  let notes = await _resolveNotesFromIdb(app, stored.notes);
  notes = await _seedDemoNotesIfEmpty(notes);

  const beforeDedupe = notes.length;
  notes = dedupeNotesById(notes);
  if (notes.length !== beforeDedupe) {
    try { await chrome.storage.local.set({ notes }); } catch (_) {}
  }

  const beforeSortOrder = _noteIdOrder(notes);
  notes = sortNotesByRecency(notes);
  if (_noteIdOrder(notes) !== beforeSortOrder) {
    try { await chrome.storage.local.set({ notes }); } catch (_) {}
  }

  app.notes = notes;
  await _syncNotesToIdb(app);

  _applyNotesPrefs(app, stored);

  initializeTieredNotesStorage(app).catch(e => console.warn('Notes tiered storage init failed:', e));

  console.log(`📝 Loaded ${notes.length} notes`);
  return notes;
}

function _buildDemoNotes() {
  const now = Date.now();
  const N1 = now - 400000;
  const N2 = now - 300000;
  const A1 = now - 200000;
  const A2 = now - 100000;

  return [
    {
      id: N1, type: 'note',
      title: 'Welcome to PasteCraft',
      description: 'Getting started guide — delete anytime',
      body: 'PasteCraft auto-detects 20+ markup languages including Markdown, LaTeX, Mermaid diagrams, and code with syntax highlighting. Copy anything and it renders automatically!\n\nTry the preset categories to organize your clips, or create your own.',
      clips: [{ type: 'clip', id: now - 399000, text: '# Quick Notes\n\n## Today\'s Tasks\n- [ ] Review pull request\n- [x] Update dependencies\n- [ ] Write unit tests\n\n> **Tip:** These are examples — delete them anytime!', addedDate: now - 399000 }],
      images: [],
      urls: [{ type: 'url', id: now - 398000, url: 'https://pastecraft.com/docs', title: 'PasteCraft Documentation', addedDate: now - 398000 }],
      createdAt: N1, updatedAt: N1
    },
    {
      id: N2, type: 'note',
      title: 'Meeting Notes Template',
      description: 'Reusable meeting template — delete anytime',
      body: 'Use this as a starting point for meeting notes. Attach clips, links, and images to keep everything in one place.',
      clips: [{ type: 'clip', id: now - 299000, text: '# Meeting Notes — [Date]\n\n**Attendees:** [names]\n**Agenda:**\n1. Status updates\n2. Blockers\n3. Action items\n\n## Notes\n- \n\n## Action Items\n- [ ] [Owner] — [Task] — Due: [Date]', addedDate: now - 299000 }],
      images: [],
      urls: [],
      createdAt: N2, updatedAt: N2
    },
    {
      id: A1, type: 'album',
      title: 'Developer Toolkit',
      description: 'Code snippets & diagram references — delete anytime',
      body: 'A collection of useful developer clips. Albums group related notes together for quick access.',
      clips: [
        { type: 'clip', id: now - 199000, text: 'async function fetchJSON(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(res.statusText);\n    return await res.json();\n  } catch (err) {\n    console.error("Fetch failed:", err);\n    return null;\n  }\n}', addedDate: now - 199000 },
        { type: 'clip', id: now - 198000, text: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D', addedDate: now - 198000 }
      ],
      images: [],
      urls: [{ type: 'url', id: now - 197000, url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', title: 'MDN Web Docs', addedDate: now - 197000 }],
      noteRefs: [N1], sourceNoteIds: [N1],
      createdAt: A1, updatedAt: A1
    },
    {
      id: A2, type: 'album',
      title: 'Research & References',
      description: 'Formulas, links & templates — delete anytime',
      body: 'Collect research materials in albums. Group notes, clips, and links for any project or topic.',
      clips: [{ type: 'clip', id: now - 99000, text: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\n\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', addedDate: now - 99000 }],
      images: [],
      urls: [
        { type: 'url', id: now - 98000, url: 'https://www.overleaf.com/learn/latex/Mathematical_expressions', title: 'Overleaf - LaTeX Math Guide', addedDate: now - 98000 },
        { type: 'url', id: now - 97000, url: 'https://mermaid.js.org/intro/', title: 'Mermaid Docs', addedDate: now - 97000 }
      ],
      noteRefs: [N2], sourceNoteIds: [N2],
      createdAt: A2, updatedAt: A2
    }
  ];
}

// ── initializeTieredNotesStorage ───────────────────────────────────────────

export async function initializeTieredNotesStorage(app) {
  if (!isTieredStorageAvailable()) return;
  try {
    app.tieredNotesStore = getTieredStore('notes', {
      pageSize: 6,
      localStorageKey: 'notes',
      supabaseTable: 'notes',
      timestampField: 'updated_at'
    });
    await app.tieredNotesStore.initialize();
    app.tieredNotesStore.localCount = app.notes.length;

    if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
      const notesCount = await pasteCraftSupabase.getNotesCount().catch(() => 0);
      app.totalNotesCount = Math.max(notesCount, app.notes.length);
      app.tieredNotesStore.totalCount = app.totalNotesCount;
      console.log(`📝 Notes tiered storage: ${app.notes.length} local, ${app.totalNotesCount} total`);
    } else {
      app.totalNotesCount = app.notes.length;
    }
  } catch (e) {
    console.warn('Failed to initialize notes tiered storage:', e);
    app.totalNotesCount = app.notes.length;
  }
}

// ── getNoteContentForHash ──────────────────────────────────────────────────

export function getNoteContentForHash(note) {
  if (!note) return '';
  return `${String(note.title || '').trim()}|${String(note.description || '').trim()}|${String(note.body || '').trim()}`.toLowerCase();
}

// ── saveNotes ──────────────────────────────────────────────────────────────

function _hasQuotaText(value) {
  const msg = value?.message;
  if (!msg) return false;
  return msg.includes('QUOTA') || msg.includes('quota');
}

function _isQuotaError(storageError) {
  return _hasQuotaText(storageError) || _hasQuotaText(chrome.runtime.lastError);
}

function _shouldFallbackToIdbOnly(storageError, app) {
  return _isQuotaError(storageError) && _hasIdb(app);
}

async function _writeNotesToLocalStorage(app) {
  try {
    await PasteCraftCRUD.retryOperation(async () => {
      await chrome.storage.local.set({ notes: app.notes });
    });
    return false;
  } catch (storageError) {
    if (_shouldFallbackToIdbOnly(storageError, app)) {
      console.warn('⚠️ Chrome storage quota exceeded, using IndexedDB only for notes');
      return true;
    }
    throw storageError;
  }
}

async function _syncNotesToIdb(app) {
  if (!_hasIdb(app)) return;
  await app.idb.syncEntityFromLocalStorage('notes', app.notes);
}

async function _verifyIdbNotesSaved(app) {
  if (!_hasIdb(app)) return;
  const idbNotes = await app.idb.getAllPayloads('notes');
  if (!Array.isArray(idbNotes) || idbNotes.length !== app.notes.length) {
    throw new Error('Verification failed: IDB notes count mismatch');
  }
}

async function _verifyLocalNotesSaved(app) {
  const verification = await chrome.storage.local.get(['notes']);
  const verifiedNotes = Array.isArray(verification.notes) ? verification.notes : [];
  if (verifiedNotes.length !== app.notes.length) {
    throw new Error('Verification failed: notes count mismatch');
  }
}

async function _verifyNotesSaved(app, savedToIdbOnly) {
  if (savedToIdbOnly) {
    await _verifyIdbNotesSaved(app);
    return;
  }
  await _verifyLocalNotesSaved(app);
}

async function _rollbackNotes(app, snapshot) {
  app.notes = snapshot;
  try {
    await chrome.storage.local.set({ notes: app.notes });
  } catch (_) {
    // Ignore quota error on rollback
  }
  await _syncNotesToIdb(app);
}

export async function saveNotes(app) {
  let savedToIdbOnly = false;
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({ notes: app.notes }),
    stateSetter: async (newState) => {
      app.notes = Array.isArray(newState.notes) ? newState.notes : [];
    },
    stateKeys: ['notes'],
    mutateState: async (state) => {
      state.notes = sortNotesByRecency(dedupeNotesById(Array.isArray(state.notes) ? state.notes : []));
    },
    storageKeys: ['notes'],
    storageWriter: async () => {
      savedToIdbOnly = await _writeNotesToLocalStorage(app);
      await _syncNotesToIdb(app);
    },
    verifier: async () => {
      await _verifyNotesSaved(app, savedToIdbOnly);
      return true;
    },
    errorMessage: (error) => `Failed to save notes: ${error.message || 'Unknown error'}`,
    showToast: null,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to save notes');
  }

  console.log(`💾 Saved ${app.notes.length} notes${savedToIdbOnly ? ' (IDB only - quota exceeded)' : ''}`);
}

// ── saveNotesPrefs ─────────────────────────────────────────────────────────

export async function saveNotesPrefs(app) {
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      notesViewMode: app.notesViewMode,
      notesPageIndex: app.notesPageIndex,
      notesAiEnabled: app.notesAiEnabled,
    }),
    stateSetter: async () => {},
    stateKeys: ['notesViewMode', 'notesPageIndex', 'notesAiEnabled'],
    mutateState: async () => {},
    storageKeys: ['notesViewMode', 'notesPageIndex', 'notesAiEnabled'],
    buildStorageData: async (state) => ({
      notesViewMode: state.notesViewMode,
      notesPageIndex: state.notesPageIndex,
      notesAiEnabled: state.notesAiEnabled,
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async (meta, state) => {
      const stored = await chrome.storage.local.get(['notesViewMode', 'notesPageIndex', 'notesAiEnabled']);
      return (
        stored.notesViewMode === state.notesViewMode &&
        stored.notesPageIndex === state.notesPageIndex &&
        stored.notesAiEnabled === state.notesAiEnabled
      );
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to save note prefs: ${error.message || 'Unknown error'}`,
    showToast: null,
  });

  if (!result.success) throw new Error(result.error || 'Failed to save note prefs');
}

function _persistSingleNoteVerification(noteId) {
  return async () => {
    const verification = await chrome.storage.local.get(['notes']);
    const notes = Array.isArray(verification.notes) ? verification.notes : [];
    return notes.some((note) => note.id == noteId);
  };
}

function _buildNoteCrudUi(app) {
  return () => {
    app.renderNotes();
  };
}

function _buildNoteCrudToast(app) {
  return (msg, type) => {
    if (msg) app.showToast(msg, type);
  };
}

export async function createNote(app, noteData) {
  const result = await PasteCraftCRUD.createOperation({
    entity: noteData,
    stateGetter: () => ({ notes: app.notes }),
    stateSetter: async (newState) => {
      app.notes = Array.isArray(newState.notes) ? newState.notes : [];
      app.notesPageIndex = 0;
    },
    stateKeys: ['notes'],
    validator: (entity) => {
      if (!entity || entity.id == null) return { valid: false, error: 'Invalid note' };
      return { valid: true };
    },
    duplicateCheck: (entity, state) =>
      Array.isArray(state.notes) && state.notes.some((note) => note.id == entity.id),
    storageKeys: ['notes'],
    storageWriter: async (data) => {
      await chrome.storage.local.set({
        ...data,
        pc_local_updatedAt: Date.now(),
        notesViewMode: app.notesViewMode,
        notesPageIndex: app.notesPageIndex,
        notesAiEnabled: app.notesAiEnabled,
      });
      await _syncNotesToIdb(app);
    },
    addToArray: (items, entity) => sortNotesByRecency(dedupeNotesById([entity, ...items])),
    verifier: _persistSingleNoteVerification(noteData.id),
    uiUpdater: _buildNoteCrudUi(app),
    backgroundSync: async (entity) => {
      await pasteCraftSupabase.syncWithQueue('syncNotes', [PasteCraftCRUD.createSnapshot(entity)], pasteCraftSupabase.syncNotesToSupabase);
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to create note: ${error.message || 'Unknown error'}`,
    showToast: _buildNoteCrudToast(app),
  });

  if (!result.success) throw new Error(result.error || 'Failed to create note');
  return result;
}

export async function updateNote(app, noteId, noteData) {
  const result = await PasteCraftCRUD.updateOperation({
    entityId: noteId,
    updates: noteData,
    stateGetter: () => ({ notes: app.notes }),
    stateSetter: async (newState) => {
      app.notes = Array.isArray(newState.notes) ? sortNotesByRecency(dedupeNotesById(newState.notes)) : [];
    },
    stateKeys: ['notes'],
    validator: (entity) => {
      if (!entity || entity.id == null) return { valid: false, error: 'Invalid note' };
      return { valid: true };
    },
    storageKeys: ['notes'],
    storageWriter: async (data) => {
      await chrome.storage.local.set({
        ...data,
        pc_local_updatedAt: Date.now(),
        notesViewMode: app.notesViewMode,
        notesPageIndex: app.notesPageIndex,
        notesAiEnabled: app.notesAiEnabled,
      });
      await _syncNotesToIdb(app);
    },
    updateInArray: (items, entityId, updates) =>
      sortNotesByRecency(dedupeNotesById(items.map((item) => item.id == entityId ? { ...item, ...updates } : item))),
    verifier: _persistSingleNoteVerification(noteId),
    uiUpdater: _buildNoteCrudUi(app),
    backgroundSync: async (entity) => {
      await pasteCraftSupabase.syncWithQueue('syncNotes', [PasteCraftCRUD.createSnapshot(entity)], pasteCraftSupabase.syncNotesToSupabase);
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to update note: ${error.message || 'Unknown error'}`,
    showToast: _buildNoteCrudToast(app),
  });

  if (!result.success) throw new Error(result.error || 'Failed to update note');
  return result;
}

export async function mutateNote(app, noteId, mutator, options = {}) {
  const current = Array.isArray(app.notes) ? app.notes.find((note) => note.id == noteId) : null;
  if (!current) throw new Error('Note not found');

  const draft = PasteCraftCRUD.createSnapshot(current);
  const maybeNext = await mutator(draft, current);
  const next = maybeNext && typeof maybeNext === 'object' ? maybeNext : draft;
  if (!next || next.id == null) throw new Error('Invalid note mutation');

  const result = await updateNote(app, noteId, next);

  if (typeof options.afterUpdate === 'function') {
    await options.afterUpdate(result?.entity || next);
  }

  return result;
}

// ── lazyLoadNotesPage ──────────────────────────────────────────────────────

function _renderLazyOfflineState(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📡</div>
      <h3>You're offline</h3>
      <p>Connect to the internet to view older notes</p>
      <button class="btn-secondary" onclick="window.pasteCraftPopup.notesPageIndex = 0; window.pasteCraftPopup.renderNotes();">
        Go to first page
      </button>
    </div>
  `;
}

function _renderLazyLoadingIndicator(container) {
  container.innerHTML = `
    <div class="lazy-load-indicator">
      <div class="lazy-load-spinner"></div>
      <p>Loading notes...</p>
    </div>
  `;
}

function _renderLazyPagination(app, paginationEl, pageCount) {
  if (!paginationEl) return;
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

async function _renderRemoteNotesPage(app, startIndex, pageSize, container) {
  const remoteNotes = await pasteCraftSupabase.fetchNotesPage(startIndex, pageSize);
  if (remoteNotes && remoteNotes.length > 0) {
    container.innerHTML = remoteNotes.map(note => app._renderNoteCard(note)).join('');
    app._attachNoteCardListeners(container);
    return;
  }
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <h3>No more notes</h3>
      <p>You've reached the end of your notes</p>
    </div>
  `;
}

function _renderSignInPrompt(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">☁️</div>
      <h3>Sign in to view more</h3>
      <p>Older notes are stored in the cloud</p>
    </div>
  `;
}

function _renderLazyLoadError(container, error) {
  const isNetworkError = error.message?.includes('network') || error.message?.includes('fetch') || !navigator.onLine;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${isNetworkError ? '📡' : '⚠️'}</div>
      <h3>${isNetworkError ? 'Connection issue' : 'Failed to load'}</h3>
      <p>${isNetworkError ? 'Check your internet connection' : 'Please try again'}</p>
      <button class="btn-secondary" onclick="window.pasteCraftPopup.renderNotes();">
        Retry
      </button>
    </div>
  `;
}

function _isSupabaseAuthenticated() {
  return typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.();
}

async function _fetchAndRenderLazyPage(app, opts) {
  if (_isSupabaseAuthenticated()) {
    await _renderRemoteNotesPage(app, opts.startIndex, opts.pageSize, opts.container);
    return;
  }
  _renderSignInPrompt(opts.container);
}

export async function lazyLoadNotesPage(app, opts) {
  const { container, paginationEl, pageCount } = opts;

  if (!navigator.onLine) {
    _renderLazyOfflineState(container);
    return;
  }

  app._isLazyLoading = true;
  _renderLazyLoadingIndicator(container);
  _renderLazyPagination(app, paginationEl, pageCount);

  try {
    await _fetchAndRenderLazyPage(app, opts);
  } catch (e) {
    console.error('Failed to lazy load notes:', e);
    _renderLazyLoadError(container, e);
  } finally {
    app._isLazyLoading = false;
  }
}

// ── deleteNote ─────────────────────────────────────────────────────────────

export async function deleteNote(app, noteId) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note) return;

  const confirmed = confirm(`Delete "${note.title}"?`);
  if (!confirmed) return;

  const entityId = note.id;

  return await PasteCraftCRUD.deleteOperation({
    entityId,
    entityName: note.title,
    entityType: 'note',
    stateGetter: () => ({ notes: app.notes }),
    stateSetter: async (newState) => { app.notes = newState.notes; },
    stateKeys: ['notes'],
    validator: (entity, state) => {
      const exists = Array.isArray(state.notes) && state.notes.some(n => n.id == entity.id);
      return { valid: exists, error: exists ? null : 'Note not found' };
    },
    idempotencyCheck: (entityId, state) => {
      return !Array.isArray(state.notes) || !state.notes.some(n => n.id == entityId);
    },
    storageKeys: ['notes'],
    storageWriter: async (data) => { await chrome.storage.local.set(data); },
    idbStoreName: 'notes',
    tombstoneStorageKey: 'pc_deleted_notes',
    deleteFromArray: (items, entityId) => items.filter(n => n.id != entityId),
    updateRelatedEntities: (_state, _entity) => {},
    verifier: async (entityId) => {
      const verification = await chrome.storage.local.get(['notes', 'pc_deleted_notes']);
      const tombs = Array.isArray(verification.pc_deleted_notes) ? verification.pc_deleted_notes : [];
      const tombstoned = tombs.some((t) => t?.id == entityId);
      const notes = Array.isArray(verification.notes) ? verification.notes : [];
      const inChrome = notes.some((n) => n.id == entityId);
      let inIdb = false;
      try {
        if (getIndexedDb()) {
          const idbNotes = await getIndexedDbPayloads('notes');
          inIdb = Array.isArray(idbNotes) && idbNotes.some((n) => n.id == entityId);
        }
      } catch (_) {}
      if (tombstoned && !inChrome) return true;
      return !inChrome && !inIdb;
    },
    uiUpdater: () => { app.renderNotes(); },
    backgroundSync: async (_entity, deletedAt) => {
      if (app.idb && typeof app.idb.saveDeletedItem === 'function') {
        await app.idb.saveDeletedItem(note, 'notes').catch(e => console.error('Failed to save deleted note:', e));
      }
      await pasteCraftSupabase.syncWithQueue('syncDeletedNotes', [{
        ...note,
        deletedAt,
        updatedAt: deletedAt
      }], pasteCraftSupabase.syncDeletedNotesToSupabase);
      await pasteCraftSupabase.syncWithQueue('syncNotes', app.notes, pasteCraftSupabase.syncNotesToSupabase);
    },
    successMessage: (entity) => `✅ Note "${entity.name}" deleted`,
    errorMessage: (error) => `❌ Failed to delete note: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => app.showToast(msg, type)
  });
}
