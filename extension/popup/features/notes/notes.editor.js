import { createNote, mutateNote, updateNote } from './notes.service.js';
import {
  collectAlbumInterlayings,
  flatAttachmentsToAlbumBuckets,
  syncAlbumRefMetadata
} from './notes.album-interlayings.crud.js';
import { artifactToNotesClip } from '../../shared/ai-output-bridge.js';

// ── openNoteEditor ─────────────────────────────────────────────────────────

function _getNoteEditorElements() {
  return {
    modal: document.getElementById('noteEditorModal'),
    titleInput: document.getElementById('noteTitleInput'),
    descInput: document.getElementById('noteDescriptionInput'),
    bodyInput: document.getElementById('noteBodyInput'),
    attachmentsList: document.getElementById('noteAttachmentsList'),
    attachmentsSection: document.getElementById('noteEditorAttachmentsSection'),
    editorType: document.getElementById('noteEditorType'),
    aiToggle: document.getElementById('notesAiToggle'),
    saveBtn: document.getElementById('saveNote')
  };
}

function _toggleBackToAlbumPicker(app, showBack) {
  if (showBack) app.showBackToAlbumPicker();
  else app.hideBackToAlbumPicker();
}

function _collectExistingAttachments(note) {
  if (note.type === 'album') return collectAlbumInterlayings(note);
  return [
    ...(note.clips || []).map((c) => ({ ...c, type: c.type || 'clip' })),
    ...(note.images || []).map((i) => ({ ...i, type: 'image' })),
    ...(note.urls || []).map((u) => ({ ...u, type: u.type || 'url' })),
  ];
}

function _populateExistingNoteFields(app, els, note) {
  app.currentNoteType = note.type;
  els.titleInput.value = note.title;
  els.descInput.value = note.description;
  els.bodyInput.value = note.body;
  app.currentNoteAttachments = _collectExistingAttachments(note);
  els.editorType.textContent = note.type === 'album' ? 'Edit Album' : 'Edit Note';
}

function _populateBlankNoteFields(app, els, type) {
  els.titleInput.value = '';
  els.descInput.value = '';
  els.bodyInput.value = '';
  app.currentNoteAttachments = [];
  els.editorType.textContent = type === 'album' ? 'New Album' : 'New Note';
}

function _populateNoteEditorFields(app, els, type, noteId) {
  if (!noteId) {
    _populateBlankNoteFields(app, els, type);
    return;
  }
  const note = app.notes.find(n => n.id == noteId);
  if (note) {
    _populateExistingNoteFields(app, els, note);
    return;
  }
  _populateBlankNoteFields(app, els, type);
}

function _applyEditorMode(app, els) {
  if (els.aiToggle) els.aiToggle.checked = app.notesAiEnabled;
  if (els.attachmentsSection) {
    els.attachmentsSection.style.display = 'block';
  }
  if (els.saveBtn) {
    els.saveBtn.textContent = app.currentNoteType === 'album' ? 'Save Album' : 'Save Note';
  }
}

function _renderEditorAttachmentList(app, els) {
  app.renderNoteAttachments();
}

export async function openNoteEditor(app, type = 'note', noteId = null, showBack = false) {
  app.currentNoteType = type;
  app.currentNoteId = noteId;
  app.currentNoteAttachments = [];

  const els = _getNoteEditorElements();
  _toggleBackToAlbumPicker(app, showBack);
  _populateNoteEditorFields(app, els, type, noteId);
  _applyEditorMode(app, els);
  _renderEditorAttachmentList(app, els);
  app.updateNoteAiControls();
  els.modal.style.display = 'flex';
  try {
    await app.notesFeature?.imagePicker?.consumePendingNoteImageAttach?.(app);
  } catch (_) {}
}

// ── closeNoteEditor ────────────────────────────────────────────────────────

export function closeNoteEditor(app) {
  document.getElementById('noteEditorModal').style.display = 'none';
  app.currentNoteId = null;
  app.currentNoteType = 'note';
  app.currentNoteAttachments = [];
  app.hideBackToAlbumPicker();
  if (typeof app.returnToAlbumViewerAfterEditor === 'function') {
    app.returnToAlbumViewerAfterEditor();
  }
}

// ── saveNote ───────────────────────────────────────────────────────────────

function _readNoteEditorInputs() {
  return {
    title: document.getElementById('noteTitleInput').value.trim(),
    description: document.getElementById('noteDescriptionInput').value.trim(),
    body: document.getElementById('noteBodyInput').value.trim()
  };
}

function _filterAttachmentsByType(attachments, type) {
  return attachments.filter(a => a.type === type);
}

function _buildNoteContentByType(app, existing) {
  if (app.currentNoteType === 'album') {
    const buckets = flatAttachmentsToAlbumBuckets(app.currentNoteAttachments);
    const albumDraft = {
      type: 'album',
      clips: buckets.clips,
      images: buckets.images,
      urls: buckets.urls,
      noteRefs: Array.isArray(existing?.noteRefs) ? existing.noteRefs : [],
      sourceNoteIds: Array.isArray(existing?.sourceNoteIds) ? existing.sourceNoteIds : []
    };
    syncAlbumRefMetadata(albumDraft);
    return {
      clips: albumDraft.clips,
      images: albumDraft.images,
      urls: albumDraft.urls,
      noteRefs: albumDraft.noteRefs,
      sourceNoteIds: albumDraft.sourceNoteIds
    };
  }
  return {
    clips: _filterAttachmentsByType(app.currentNoteAttachments, 'clip'),
    images: _filterAttachmentsByType(app.currentNoteAttachments, 'image'),
    urls: _filterAttachmentsByType(app.currentNoteAttachments, 'url')
  };
}

function _resolveCreatedAt(app, existing) {
  if (!app.currentNoteId) return Date.now();
  return existing?.createdAt || Date.now();
}

function _buildNoteData(app, inputs, existing) {
  return {
    id: app.currentNoteId || Date.now(),
    type: app.currentNoteType,
    title: inputs.title,
    description: inputs.description,
    body: inputs.body,
    ..._buildNoteContentByType(app, existing),
    createdAt: _resolveCreatedAt(app, existing),
    updatedAt: Date.now()
  };
}

function _commitNoteToList(app, noteData) {
  if (app.currentNoteId) {
    const index = app.notes.findIndex(n => n.id == app.currentNoteId);
    if (index !== -1) app.notes[index] = noteData;
    return;
  }
  app.notes.unshift(noteData);
  app.notesPageIndex = 0;
}

function _refreshAlbumsIfNote(app, noteData) {
  if (noteData.type !== 'album') app.refreshAlbumsForNote(noteData);
}

function _maybeReopenAlbumPicker(app) {
  if (!app.createdFromPicker) return;
  app.createdFromPicker = false;
  app.showAlbumPicker();
}

function _scheduleNotesSync(app) {
  try {
    Promise.resolve()
      .then(() => pasteCraftSupabase.syncWithQueue('syncNotes', app.notes, pasteCraftSupabase.syncNotesToSupabase))
      .catch(() => {});
  } catch (_) {}
}

export async function saveNote(app) {
  if (app._noteSaveInProgress) return;
  app._noteSaveInProgress = true;

  const isUpdate = !!app.currentNoteId;
  const inputs = _readNoteEditorInputs();
  const existing = app.currentNoteId ? app.notes.find(n => n.id == app.currentNoteId) : null;
  const noteData = _buildNoteData(app, inputs, existing);
  const saveBtn = document.getElementById('saveNote');
  if (saveBtn) saveBtn.disabled = true;

  try {
    try { _refreshAlbumsIfNote(app, noteData); }
    catch (e) { console.warn('refreshAlbumsForNote failed:', e); }

    try {
      if (isUpdate) {
        await updateNote(app, app.currentNoteId, noteData);
      } else {
        await createNote(app, noteData);
      }
    } catch (e) {
      console.error('Failed to persist note:', e);
      app.showToast('Failed to save note');
      return;
    }

    app.renderNotes();
    app.closeNoteEditor();

    _maybeReopenAlbumPicker(app);
    app.showToast(isUpdate ? 'Note updated!' : 'Note created!');
  } finally {
    app._noteSaveInProgress = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ── generateNoteTitleFromContent ───────────────────────────────────────────

function _getAiTitleElements() {
  return {
    bodyInput: document.getElementById('noteBodyInput'),
    titleInput: document.getElementById('noteTitleInput'),
    aiTitleBtn: document.getElementById('aiTitleBtn')
  };
}

function _getAiDescElements() {
  return {
    bodyInput: document.getElementById('noteBodyInput'),
    descInput: document.getElementById('noteDescriptionInput'),
    aiDescBtn: document.getElementById('aiDescBtn')
  };
}

function _allElementsPresent(els) {
  return Object.values(els).every(Boolean);
}

function _stripQuotes(value) {
  return (value || '').trim().replace(/^["'""]+|["'""]+$/g, '');
}

async function _hasPremiumSummary(app) {
  if (!app.currentUser) return true;
  return await pasteCraftSupabase.checkPremiumAccess(app.currentUser.id, 'summary');
}

async function _generateAiSummary(content, prompt) {
  return pasteCraftSupabase.generateSummary(content.substring(0, 3000), prompt);
}

function _emitNoteAiArtifact(app, payload) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  app.emitAiTaskOutput(payload);
}

export async function generateNoteTitleFromContent(app) {
  const els = _getAiTitleElements();
  if (!_allElementsPresent(els)) return;

  const content = els.bodyInput.value.trim();
  if (!content) { app.showToast('Add content first'); app.updateNoteAiControls(); return; }

  if (!await _hasPremiumSummary(app)) return;

  try {
    els.aiTitleBtn.disabled = true;
    const result = await _generateAiSummary(content, 'Generate a short note title (max 6 words). Return ONLY the title, no quotes.');
    const cleaned = _stripQuotes(result);
    if (cleaned) {
      els.titleInput.value = cleaned;
      _emitNoteAiArtifact(app, {
        source: 'notes.editor',
        taskType: 'note-title',
        title: 'AI Note Title',
        sourceText: content,
        question: 'Generate note title',
        outputText: cleaned,
      });
    }
    app.showToast('Title generated');
  } catch (e) {
    console.error('Failed to generate title:', e);
    app.showToast('Failed to generate title');
  } finally {
    els.aiTitleBtn.disabled = false;
    app.updateNoteAiControls();
  }
}

// ── generateNoteDescriptionFromContent ────────────────────────────────────

export async function generateNoteDescriptionFromContent(app) {
  const els = _getAiDescElements();
  if (!_allElementsPresent(els)) return;

  const content = els.bodyInput.value.trim();
  if (!content) { app.showToast('Add content first'); app.updateNoteAiControls(); return; }

  if (!await _hasPremiumSummary(app)) return;

  try {
    els.aiDescBtn.disabled = true;
    const result = await _generateAiSummary(content, 'Generate a one-sentence description for this note (max 140 characters). Return ONLY the description.');
    const cleaned = _stripQuotes(result);
    if (cleaned) {
      els.descInput.value = cleaned;
      _emitNoteAiArtifact(app, {
        source: 'notes.editor',
        taskType: 'note-description',
        title: 'AI Note Description',
        sourceText: content,
        question: 'Generate note description',
        outputText: cleaned,
      });
    }
    app.showToast('Description generated');
  } catch (e) {
    console.error('Failed to generate description:', e);
    app.showToast('Failed to generate description');
  } finally {
    els.aiDescBtn.disabled = false;
    app.updateNoteAiControls();
  }
}

// ── Clip Picker ────────────────────────────────────────────────────────────

export function showClipPickerForNote(app) {
  if (app.clips.length === 0 && app.searchOnlyClips.length === 0) {
    app.showToast('No clips available. Create some clips first!');
    return;
  }
  app.selectedPickerClips.clear();
  app.updateClipPickerFooter();
  const modal = document.getElementById('clipPickerModal');
  if (modal) {
    modal.style.display = 'flex';
    app.switchClipPickerTab('clips');
    app.renderClipPickerRecentClips();
  }
}

export function closeClipPicker(app) {
  const modal = document.getElementById('clipPickerModal');
  if (modal) { modal.style.display = 'none'; app.selectedPickerClips.clear(); }
}

export function updateClipPickerFooter(app) {
  const countEl = document.getElementById('clipPickerSelectionCount');
  const addBtn = document.getElementById('clipPickerAddBtn');
  if (countEl) {
    const count = app.selectedPickerClips.size;
    countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
  }
  if (addBtn) addBtn.disabled = app.selectedPickerClips.size === 0;
}

function _findPickerCheckbox(itemElement) {
  return itemElement.querySelector('.clip-picker-checkbox, .clip-picker-checkbox-sm, .search-checkbox, .category-checkbox');
}

function _setPickerSelection(itemElement, isSelected) {
  itemElement.classList.toggle('selected', isSelected);
  const checkbox = _findPickerCheckbox(itemElement);
  if (checkbox) checkbox.checked = isSelected;
}

export function togglePickerClip(app, clipId, itemElement) {
  if (app.selectedPickerClips.has(clipId)) {
    app.selectedPickerClips.delete(clipId);
    _setPickerSelection(itemElement, false);
  } else {
    app.selectedPickerClips.add(clipId);
    _setPickerSelection(itemElement, true);
  }
  app.updateClipPickerFooter();
}

export function normalizePickerText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function createPickerSearchRowHTML(app, clip) {
  const category = clip.category || 'Uncategorized';
  const timeAgo = app.getTimeAgo(clip.timestamp);
  const normalized = normalizePickerText(clip.text);
  const truncatedText = normalized.length > 110 ? normalized.substring(0, 110) + '...' : normalized;
  const isSelected = app.selectedPickerClips.has(clip.id);
  const alreadyAdded = app.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);

  return `
    <div class="search-result-item ${isSelected ? 'selected' : ''} ${alreadyAdded ? 'already-added' : ''}" data-clip-id="${clip.id}">
      <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
      <div class="search-result-content">
        <div class="search-result-text">${app.escapeHtml(truncatedText)}</div>
        <div class="search-result-meta">
          <span class="search-result-category">${app.escapeHtml(category)}</span>
          <span>${timeAgo}</span>
          ${alreadyAdded ? '<span class="already-added-badge">✓ Added</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

function _resolveMarkupBadge(clip) {
  const meta = (clip.meta && typeof clip.meta === 'object') ? clip.meta : null;
  return (typeof PCMarkup !== 'undefined') ? PCMarkup.getMarkupBadgeForClip(clip.text, meta) : '';
}

function _truncatePickerChipText(text) {
  return text.length > 30 ? text.substring(0, 30) + '...' : text;
}

function _buildChipInnerHtml(app, clip, ctx) {
  return `
    <input type="checkbox" class="chip-checkbox" ${ctx.isSelected ? 'checked' : ''} ${ctx.alreadyAdded ? 'disabled' : ''}>
    ${ctx.badge}
    <span class="chip-text" title="${app.escapeHtml(ctx.normalized)}">${app.escapeHtml(ctx.truncated)}</span>
    <span class="chip-time">${ctx.timeAgo}</span>
    ${ctx.alreadyAdded ? '<span class="already-added-badge-sm">✓</span>' : ''}
  `;
}

function _wirePickerChipEvents(app, chip, clip) {
  const checkbox = chip.querySelector('.chip-checkbox');
  checkbox.addEventListener('click', (e) => { e.stopPropagation(); app.togglePickerClip(clip.id, chip); });
  chip.addEventListener('click', (e) => {
    if (!e.target.classList.contains('chip-checkbox')) app.togglePickerClip(clip.id, chip);
  });
}

export function createPickerChipElement(app, clip) {
  const chip = document.createElement('div');
  chip.className = 'chip animate-slide-in';
  chip.dataset.clipId = clip.id;

  const normalized = normalizePickerText(clip.text);
  const ctx = {
    timeAgo: app.getTimeAgo(clip.timestamp),
    normalized,
    truncated: _truncatePickerChipText(normalized),
    isSelected: app.selectedPickerClips.has(clip.id),
    alreadyAdded: app.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id),
    badge: _resolveMarkupBadge(clip)
  };

  chip.innerHTML = _buildChipInnerHtml(app, clip, ctx);

  if (ctx.isSelected) chip.classList.add('selected');
  if (ctx.alreadyAdded) chip.classList.add('already-added');
  if (!ctx.alreadyAdded) _wirePickerChipEvents(app, chip, clip);

  return chip;
}

export function attachPickerSearchRowHandlers(app, container) {
  container.querySelectorAll('.search-result-item').forEach(item => {
    if (item.classList.contains('already-added')) return;
    const checkbox = item.querySelector('.search-checkbox');
    checkbox.addEventListener('click', (e) => { e.stopPropagation(); app.togglePickerClip(item.dataset.clipId, item); });
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('search-checkbox')) app.togglePickerClip(item.dataset.clipId, item);
    });
  });
}

function _setPickerTabActive(tabName) {
  document.querySelectorAll('.clip-picker-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.pickerTab === tabName);
  });
}

function _hidePickerTabContents() {
  document.querySelectorAll('.clip-picker-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
}

function _showPickerTabContent(tabName) {
  const target = document.getElementById(`clipPicker${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
  if (target) { target.classList.add('active'); target.style.display = 'block'; }
}

function _runTabSpecificAction(app, tabName) {
  if (tabName === 'clips') { app.renderClipPickerRecentClips(); return; }
  if (tabName === 'categories') { app.renderClipPickerCategories(); return; }
  if (tabName !== 'search') return;
  const searchInput = document.getElementById('clipPickerSearchInput');
  if (searchInput) searchInput.value = '';
  app.renderClipPickerSearchResults([]);
}

export function switchClipPickerTab(app, tabName) {
  _setPickerTabActive(tabName);
  _hidePickerTabContents();
  _showPickerTabContent(tabName);
  _runTabSpecificAction(app, tabName);
}

export function renderClipPickerRecentClips(app) {
  const container = document.getElementById('clipPickerRecentList');
  if (!container) return;
  const recentClips = app.clips.slice(0, 20);
  if (recentClips.length === 0) {
    container.innerHTML = `<div class="clip-picker-empty"><div class="clip-picker-empty-icon"><i data-lucide="clipboard"></i></div><p>No recent clips available</p></div>`;
    return;
  }
  container.innerHTML = '';
  recentClips.forEach(clip => container.appendChild(app.createPickerChipElement(clip)));
}

export function searchClipsInPicker(app, query) {
  const allClips = [...app.clips, ...app.searchOnlyClips];
  if (!query.trim()) { app.renderClipPickerSearchResults([]); return; }
  const lowerQuery = query.toLowerCase();
  const results = allClips.filter(clip =>
    (clip.text || '').toLowerCase().includes(lowerQuery) ||
    (clip.category && clip.category.toLowerCase().includes(lowerQuery))
  );
  app.renderClipPickerSearchResults(results.slice(0, 50));
}

export function renderClipPickerSearchResults(app, results) {
  const container = document.getElementById('clipPickerSearchList');
  if (!container) return;
  if (results.length === 0) {
    container.innerHTML = `<div class="clip-picker-empty"><div class="clip-picker-empty-icon"><i data-lucide="search"></i></div><p>No clips found matching your search</p></div>`;
    return;
  }
  container.innerHTML = results.map(clip => app.createPickerSearchRowHTML(clip)).join('');
  app.attachPickerSearchRowHandlers(container);
}

export function renderClipPickerCategories(app) {
  const container = document.getElementById('clipPickerCategoriesList');
  if (!container) return;

  const allClips = [...app.clips, ...app.searchOnlyClips];
  const categories = app.categories || [];
  const uncategorizedClips = allClips.filter(c => (c.category || 'Uncategorized') === 'Uncategorized');

  const pickerCategories = [
    { id: 'uncategorized', name: 'Uncategorized', icon: '📁', clips: uncategorizedClips },
    ...categories.map(c => ({
      id: c.id, name: c.name, icon: c.icon || '📁',
      clips: allClips.filter(cl => cl.category === c.name)
    }))
  ].filter(c => c.clips.length > 0);

  if (pickerCategories.length === 0) {
    container.innerHTML = `<div class="clip-picker-empty"><div class="clip-picker-empty-icon"><i data-lucide="folder"></i></div><p>No clips found in categories</p></div>`;
    return;
  }

  container.innerHTML = pickerCategories.map(cat => {
    const dropdownId = `picker-dropdown-${cat.id}`;
    const clipsHtml = cat.clips.slice(0, 25).map(clip => {
      const timeAgo = app.getTimeAgo(clip.timestamp);
      const normalized = normalizePickerText(clip.text);
      const truncatedText = normalized.length > 60 ? normalized.substring(0, 60) + '...' : normalized;
      const isSelected = app.selectedPickerClips.has(clip.id);
      const alreadyAdded = app.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);
      return `
        <div class="category-clip ${isSelected ? 'selected' : ''} ${alreadyAdded ? 'already-added' : ''}" data-clip-id="${clip.id}">
          <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
          <div class="category-clip-content">
            <div class="category-clip-text">${app.escapeHtml(truncatedText)}</div>
            <div class="category-clip-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="category-item" data-picker-category-id="${cat.id}">
        <div class="category-header">
          <div class="category-info">
            <div class="category-icon">${app.escapeHtml(cat.icon)}</div>
            <div class="category-details"><h4>${app.escapeHtml(cat.name)}</h4><p>${cat.clips.length} clips</p></div>
          </div>
          <div class="category-header-actions"><span class="category-expand-icon">▶</span></div>
        </div>
        <div class="category-dropdown" id="${dropdownId}">
          ${clipsHtml || '<div class="category-clip" style="text-align:center;color:#9ca3af;padding:16px;">No clips in this category</div>'}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.category-item .category-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.category-item');
      const dropdown = item.querySelector('.category-dropdown');
      const isExpanded = item.classList.contains('expanded');
      container.querySelectorAll('.category-item.expanded').forEach(other => {
        if (other !== item) {
          other.classList.remove('expanded');
          other.querySelector('.category-dropdown')?.classList.remove('expanded');
        }
      });
      item.classList.toggle('expanded', !isExpanded);
      dropdown.classList.toggle('expanded', !isExpanded);
    });
  });

  container.querySelectorAll('.category-clip').forEach(row => {
    if (row.classList.contains('already-added')) return;
    const checkbox = row.querySelector('.category-checkbox');
    checkbox.addEventListener('click', (e) => { e.stopPropagation(); app.togglePickerClip(row.dataset.clipId, row); });
    row.addEventListener('click', (e) => {
      if (!e.target.classList.contains('category-checkbox')) app.togglePickerClip(row.dataset.clipId, row);
    });
  });
}

function _processSelectedClips(app, allClips) {
  let addedCount = 0;
  let skippedCount = 0;
  app.selectedPickerClips.forEach(clipId => {
    const clip = allClips.find(c => c.id == clipId);
    if (!clip) return;
    const alreadyAdded = app.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clipId);
    if (alreadyAdded) { skippedCount++; return; }
    app.currentNoteAttachments.push({ type: 'clip', id: clip.id, text: clip.text, addedDate: Date.now() });
    addedCount++;
  });
  return { addedCount, skippedCount };
}

function _formatAddSelectedToast(addedCount, skippedCount) {
  const parts = [];
  if (addedCount > 0) parts.push(addedCount === 1 ? '✅ 1 clip added' : `✅ ${addedCount} clips added`);
  if (skippedCount > 0) parts.push(skippedCount === 1 ? '(1 already added)' : `(${skippedCount} already added)`);
  return parts.join(' ');
}

export function addSelectedClipsToNote(app) {
  if (app.selectedPickerClips.size === 0) { app.showToast('No clips selected'); return; }
  const allClips = [...app.clips, ...app.searchOnlyClips];
  const { addedCount, skippedCount } = _processSelectedClips(app, allClips);

  app.renderNoteAttachments();
  app.closeClipPicker();
  app.showToast(_formatAddSelectedToast(addedCount, skippedCount));
}

export { showImagePickerForNote } from './notes.image-picker.js';

export function addURLToNote(app) {
  const url = prompt('Enter URL:');
  if (url && url.trim()) {
    app.currentNoteAttachments.push({ type: 'url', id: Date.now(), url: url.trim(), title: url.trim(), addedDate: Date.now() });
    app.renderNoteAttachments();
    app.showToast('URL added to note');
  }
}

export function exportNoteToPDF(app, noteId) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note) return;

  let content = `${note.title}\n\n${note.description}\n\n${note.body}\n\n`;
  if (note.clips?.length > 0) {
    content += '\nCLIPS:\n';
    note.clips.forEach((clip, i) => { content += `${i + 1}. ${clip.text}\n`; });
  }
  if (note.urls?.length > 0) {
    content += '\nLINKS:\n';
    note.urls.forEach((url, i) => { content += `${i + 1}. ${url.url}\n`; });
  }

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  app.showToast('Note exported as text file');
}

// ── addCurrentClipToNote ───────────────────────────────────────────────────

async function _addBulkClipsToNote(app, note) {
  const now = Date.now();
  const count = app.pendingBulkClipsForNotes.length;
  const pendingClips = app.pendingBulkClipsForNotes.slice();
  await mutateNote(app, note.id, (draft) => {
    if (!Array.isArray(draft.clips)) draft.clips = [];
    pendingClips.forEach((clip) => {
      if (_isDuplicateAiArtifactAttachment(draft, clip)) return;
      draft.clips.push(app._clipAttachment(clip, now));
    });
    draft.updatedAt = now;
    app.refreshAlbumsForNote(draft);
    return draft;
  });

  app.closeAlbumPicker();
  app.pendingBulkClipsForNotes = null;
  app.selectedChips.clear();
  app.updateQuickCopyButton();
  app.renderChips();
  app.showToast(`${count} clip${count === 1 ? '' : 's'} added to "${note.title}"`);
}

function _hasPendingBulkClips(app) {
  return Array.isArray(app.pendingBulkClipsForNotes) && app.pendingBulkClipsForNotes.length > 0;
}

function _resolveSingleClipToAdd(app) {
  if (app.pendingClipForNotes) return app.pendingClipForNotes;
  if (app.clips.length === 0) return null;
  return app.clips[0];
}

function _isDuplicateAiArtifactAttachment(draft, clip) {
  if (!clip || !clip.__aiArtifactHash) return false;
  const clipId = String(clip.id || '');
  return Array.isArray(draft.clips) && draft.clips.some((entry) => String(entry?.id || '') === clipId);
}

export async function addCurrentClipToNote(app, noteId) {
  const note = app.notes.find(n => n.id == noteId);
  if (!note) return;

  if (_hasPendingBulkClips(app)) {
    await _addBulkClipsToNote(app, note);
    return;
  }

  const clipToAdd = _resolveSingleClipToAdd(app);
  if (!clipToAdd) { app.showToast('No clips to add'); return; }
  const isAiArtifact = !!clipToAdd.__aiArtifactHash;
  const alreadyExists = isAiArtifact && Array.isArray(note.clips)
    && note.clips.some((entry) => String(entry?.id || '') === String(clipToAdd.id || ''));

  const now = Date.now();
  await mutateNote(app, note.id, (draft) => {
    if (!Array.isArray(draft.clips)) draft.clips = [];
    if (_isDuplicateAiArtifactAttachment(draft, clipToAdd)) {
      return draft;
    }
    draft.clips.push(app._clipAttachment(clipToAdd, now));
    draft.updatedAt = now;
    app.refreshAlbumsForNote(draft);
    return draft;
  });

  app.closeAlbumPicker();
  app.pendingClipForNotes = null;
  if (isAiArtifact) {
    if (alreadyExists) {
      app.showToast(`"${note.title}" already contains this AI output`);
      return;
    }
    app.clearAiTaskOutputArtifact?.();
    app.showToast(`AI output saved to "${note.title}"`);
    return;
  }
  app.showToast(`Clip added to "${note.title}"`);
}

export async function saveCurrentAiOutputToNotes(app) {
  const artifact = app.getAiTaskOutputArtifact?.();
  if (!artifact) {
    app.showToast('No AI output ready to save', 'error');
    return;
  }

  const clip = artifactToNotesClip(artifact);
  if (!clip) {
    app.showToast('AI output is empty', 'error');
    return;
  }

  await app.loadNotes?.();
  app.pendingBulkClipsForNotes = null;
  app.pendingClipForNotes = clip;
  app.showAlbumPicker?.();
  app.showToast('Select a note or album for this AI output');
}
