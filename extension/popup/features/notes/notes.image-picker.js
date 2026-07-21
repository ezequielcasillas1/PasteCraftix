/**
 * Notes image picker — lists selectable images for note/album attachments.
 * Sources: Image Picker / Spot captures, note library images, local upload + URL.
 * Annotate (draw/text) via shared/image-annotate.js — no clips/ imports.
 */
import {
  clipImageSourceLabel,
  isImageBearingClip,
  resolveClipImageSrc,
} from '../../../shared/clip-images.js';
import { canAnnotateImageSrc, openImageAnnotate } from '../../../shared/image-annotate.js';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function _ensurePickerState(app) {
  if (!(app.selectedPickerImages instanceof Set)) app.selectedPickerImages = new Set();
  if (!Array.isArray(app.imagePickerCatalog)) app.imagePickerCatalog = [];
}

function _escape(app, value) {
  return typeof app.escapeHtml === 'function' ? app.escapeHtml(String(value ?? '')) : String(value ?? '');
}

function _imageSrcOf(att) {
  if (!att || typeof att !== 'object') return '';
  return String(att.dataUrl || att.url || att.src || '').trim();
}

function _sameClipId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function _isImageAlreadyOnNote(app, candidate) {
  const list = Array.isArray(app.currentNoteAttachments) ? app.currentNoteAttachments : [];
  const candidateSrc = String(candidate.src || '').trim();
  return list.some((att) => {
    if (att?.type !== 'image') return false;
    if (_sameClipId(candidate.clipId, att.clipId)) return true;
    const existing = _imageSrcOf(att);
    return !!(existing && candidateSrc && existing === candidateSrc);
  });
}

function _allClips(app) {
  const main = Array.isArray(app.clips) ? app.clips : [];
  const search = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  const byId = new Map();
  for (const clip of [...main, ...search]) {
    if (clip?.id == null) continue;
    byId.set(String(clip.id), clip);
  }
  return [...byId.values()];
}

function _sourceKindForClip(clip) {
  const source = clip?.meta?.captureSource;
  if (source === 'image-picker' || source === 'spot') return source;
  if (clip?.meta?.kind === 'image') return 'upload-clip';
  return 'clip-image';
}

function _clipCandidate(clip, resolved) {
  const label = String(clip.text || 'Image clip').replace(/\s+/g, ' ').trim().slice(0, 80);
  return {
    id: `clip:${clip.id}`,
    clipId: clip.id,
    src: resolved.src,
    mime: resolved.mime,
    label: label || 'Image clip',
    sourceKind: _sourceKindForClip(clip),
    sourceLabel: clipImageSourceLabel(clip),
    timestamp: clip.timestamp || clip.createdAt || 0,
  };
}

async function _collectCaptureCandidates(app) {
  const clips = _allClips(app).filter(isImageBearingClip);
  const out = [];
  for (const clip of clips) {
    const resolved = await resolveClipImageSrc(clip);
    if (resolved.src) out.push(_clipCandidate(clip, resolved));
  }
  out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return out;
}

function _noteImageLabel(note, img) {
  return String(img.text || img.title || note.title || 'Note image').slice(0, 80);
}

function _libraryCandidate(note, img, idx) {
  const src = _imageSrcOf(img);
  if (!src) return null;
  const imageKey = img.id != null ? img.id : idx;
  return {
    id: `note:${note.id}:${imageKey}`,
    clipId: img.clipId ?? null,
    src,
    mime: img.mime || 'image/png',
    label: _noteImageLabel(note, img),
    sourceKind: 'note-library',
    sourceLabel: `From note: ${String(note.title || 'Untitled').slice(0, 40)}`,
    timestamp: img.addedDate || note.updatedAt || 0,
  };
}

function _shouldScanNoteForImages(note, currentId) {
  return !!(note && note.id != currentId && Array.isArray(note.images));
}

function _collectNoteLibraryCandidates(app) {
  const notes = Array.isArray(app.notes) ? app.notes : [];
  const currentId = app.currentNoteId;
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    if (!_shouldScanNoteForImages(note, currentId)) continue;
    note.images.forEach((img, idx) => {
      const candidate = _libraryCandidate(note, img, idx);
      if (!candidate || seen.has(candidate.src)) return;
      seen.add(candidate.src);
      out.push(candidate);
    });
  }
  out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return out;
}

function _catalogByTab(app, tab) {
  const all = Array.isArray(app.imagePickerCatalog) ? app.imagePickerCatalog : [];
  if (tab === 'notes') return all.filter((c) => c.sourceKind === 'note-library');
  return all.filter((c) => c.sourceKind !== 'note-library');
}

function _selectedAnnotatableCandidate(app) {
  _ensurePickerState(app);
  if (app.selectedPickerImages.size !== 1) return null;
  const imageId = [...app.selectedPickerImages][0];
  const candidate = app.imagePickerCatalog.find((c) => c.id === imageId);
  if (!candidate || _isImageAlreadyOnNote(app, candidate)) return null;
  if (!canAnnotateImageSrc(candidate.src)) return null;
  return candidate;
}

function _updateFooter(app) {
  _ensurePickerState(app);
  const countEl = document.getElementById('imagePickerSelectionCount');
  const addBtn = document.getElementById('imagePickerAddBtn');
  const editBtn = document.getElementById('imagePickerEditAddBtn');
  const count = app.selectedPickerImages.size;
  if (countEl) countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
  if (addBtn) addBtn.disabled = count === 0;
  if (editBtn) editBtn.disabled = !_selectedAnnotatableCandidate(app);
}

function _cardHtml(app, item) {
  const already = _isImageAlreadyOnNote(app, item);
  const selected = app.selectedPickerImages.has(item.id);
  const classes = [
    'image-picker-card',
    selected ? 'selected' : '',
    already ? 'already-added' : '',
  ].filter(Boolean).join(' ');
  return `
    <button type="button" class="${classes}" data-action="toggle-image-picker-item" data-image-id="${_escape(app, item.id)}" ${already ? 'aria-disabled="true" disabled' : ''}>
      <span class="image-picker-thumb-wrap">
        <img class="image-picker-thumb" src="${_escape(app, item.src)}" alt="" loading="lazy" />
      </span>
      <span class="image-picker-card-meta">
        <span class="image-picker-card-label">${_escape(app, item.label)}</span>
        <span class="image-picker-card-source">${_escape(app, item.sourceLabel)}</span>
        ${already ? '<span class="already-added-badge">✓ Added</span>' : ''}
      </span>
    </button>
  `;
}

function _renderList(app, containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="image-picker-empty">No images available in this source.</p>';
    return;
  }
  container.innerHTML = `<div class="image-picker-grid" role="list">${items.map((item) => _cardHtml(app, item)).join('')}</div>`;
}

function _activeTab() {
  const active = document.querySelector('#imagePickerModal .image-picker-tab.active');
  return active?.dataset?.pickerTab || 'captures';
}

export function switchImagePickerTab(app, tabName) {
  const tab = tabName === 'notes' || tabName === 'upload' ? tabName : 'captures';
  document.querySelectorAll('#imagePickerModal .image-picker-tab').forEach((el) => {
    const on = el.dataset.pickerTab === tab;
    el.classList.toggle('active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('#imagePickerModal .image-picker-tab-content').forEach((el) => {
    el.classList.toggle('active', el.id === `imagePicker${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`);
  });
  if (tab === 'captures') _renderList(app, 'imagePickerCapturesList', _catalogByTab(app, 'captures'));
  if (tab === 'notes') _renderList(app, 'imagePickerNotesList', _catalogByTab(app, 'notes'));
}

export function toggleImagePickerItem(app, imageId) {
  _ensurePickerState(app);
  const item = app.imagePickerCatalog.find((c) => c.id === imageId);
  if (!item || _isImageAlreadyOnNote(app, item)) return;
  if (app.selectedPickerImages.has(imageId)) app.selectedPickerImages.delete(imageId);
  else app.selectedPickerImages.add(imageId);
  _updateFooter(app);
  switchImagePickerTab(app, _activeTab());
}

function _srcFieldForAttachment(src) {
  if (src.startsWith('data:image/')) return { dataUrl: src };
  if (src.startsWith('http://') || src.startsWith('https://')) return { url: src };
  return { src };
}

function _attachmentFromCandidate(candidate) {
  const src = String(candidate.src || '');
  return {
    type: 'image',
    id: Date.now() + Math.floor(Math.random() * 1000),
    clipId: candidate.clipId ?? undefined,
    text: candidate.label || 'Image',
    mime: candidate.mime || 'image/png',
    source: candidate.sourceKind || 'image',
    addedDate: Date.now(),
    ..._srcFieldForAttachment(src),
  };
}

function _formatAddToast(added, skipped) {
  const parts = [];
  if (added > 0) parts.push(added === 1 ? '✅ 1 image added' : `✅ ${added} images added`);
  if (skipped > 0) parts.push(skipped === 1 ? '(1 already added)' : `(${skipped} already added)`);
  return parts.join(' ') || 'No images added';
}

function _pushAttachment(app, candidate, overrides = {}) {
  if (!Array.isArray(app.currentNoteAttachments)) app.currentNoteAttachments = [];
  app.currentNoteAttachments.push(_attachmentFromCandidate({ ...candidate, ...overrides }));
}

export function addSelectedImagesToNote(app) {
  _ensurePickerState(app);
  if (app.selectedPickerImages.size === 0) {
    app.showToast('No images selected');
    return;
  }
  let added = 0;
  let skipped = 0;
  app.selectedPickerImages.forEach((imageId) => {
    const candidate = app.imagePickerCatalog.find((c) => c.id === imageId);
    if (!candidate) return;
    if (_isImageAlreadyOnNote(app, candidate)) {
      skipped += 1;
      return;
    }
    _pushAttachment(app, candidate);
    added += 1;
  });
  app.renderNoteAttachments();
  closeImagePicker(app);
  app.showToast(_formatAddToast(added, skipped));
}

async function _annotateCandidateSrc(app, dataUrl) {
  return openImageAnnotate({
    dataUrl,
    ui: app,
    awaitResult: true,
    saveBehavior: 'close',
  });
}

function _attachEditedCandidate(app, candidate, dataUrl) {
  const next = { ...candidate, src: dataUrl, mime: 'image/png' };
  if (_isImageAlreadyOnNote(app, next)) {
    app.showToast('Image already added');
    return false;
  }
  _pushAttachment(app, candidate, {
    src: dataUrl,
    mime: 'image/png',
    sourceKind: candidate.sourceKind || 'annotated',
  });
  app.renderNoteAttachments();
  closeImagePicker(app);
  app.showToast('✅ Image edited and added');
  return true;
}

/** Open shared annotate editor for one selected data:image, then attach on Save. */
export async function editAndAddSelectedImageToNote(app) {
  const candidate = _selectedAnnotatableCandidate(app);
  if (!candidate) {
    app.showToast('Select one image that can be edited (capture/upload)');
    return;
  }
  const result = await _annotateCandidateSrc(app, candidate.src);
  if (!result?.ok || !canAnnotateImageSrc(result.dataUrl)) {
    if (!result?.cancelled) app.showToast('Edit cancelled');
    return;
  }
  _attachEditedCandidate(app, candidate, result.dataUrl);
}

function _readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function _isValidImageFile(file) {
  return !!(file && String(file.type || '').startsWith('image/'));
}

function _resolveUploadAnnotateResult(annotated, originalDataUrl) {
  if (annotated?.ok && canAnnotateImageSrc(annotated.dataUrl)) {
    return { src: annotated.dataUrl, edited: true };
  }
  if (annotated?.cancelled) return { src: '', edited: false };
  return { src: originalDataUrl, edited: false };
}

function _uploadCandidate(file, src, edited) {
  return {
    id: `upload:${Date.now()}`,
    src,
    mime: edited ? 'image/png' : (file.type || 'image/png'),
    label: file.name || 'Uploaded image',
    sourceKind: edited ? 'upload-annotated' : 'upload',
    sourceLabel: 'Upload',
  };
}

async function _annotateThenAttachUpload(app, file, dataUrl) {
  const annotated = await openImageAnnotate({
    dataUrl,
    ui: app,
    awaitResult: true,
    saveBehavior: 'close',
  });
  const { src, edited } = _resolveUploadAnnotateResult(annotated, dataUrl);
  if (!src) {
    app.showToast('Upload cancelled');
    return;
  }
  const candidate = _uploadCandidate(file, src, edited);
  if (_isImageAlreadyOnNote(app, candidate)) {
    app.showToast('Image already added');
    return;
  }
  _pushAttachment(app, candidate);
  app.renderNoteAttachments();
  closeImagePicker(app);
  app.showToast(edited ? '✅ Image edited and uploaded' : '✅ Image uploaded to note');
}

export async function uploadImageToNote(app, file) {
  if (!_isValidImageFile(file)) {
    app.showToast('Please choose an image file');
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    app.showToast('Image is too large (max 4MB)');
    return;
  }
  try {
    const dataUrl = await _readFileAsDataUrl(file);
    if (!dataUrl.startsWith('data:image/')) {
      app.showToast('Could not read image');
      return;
    }
    await _annotateThenAttachUpload(app, file, dataUrl);
  } catch (_) {
    app.showToast('Could not upload image');
  }
}

function _isAllowedImageUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
}

export function addImageUrlToNote(app, rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    app.showToast('Enter an image URL');
    return;
  }
  if (!_isAllowedImageUrl(url)) {
    app.showToast('Use http(s) or data:image URL');
    return;
  }
  const candidate = {
    id: `url:${url.slice(0, 64)}`,
    src: url,
    mime: 'image/png',
    label: url.length > 60 ? `${url.slice(0, 60)}…` : url,
    sourceKind: 'image-url',
    sourceLabel: 'Image URL',
  };
  if (_isImageAlreadyOnNote(app, candidate)) {
    app.showToast('Image already added');
    return;
  }
    _pushAttachment(app, candidate);
    app.renderNoteAttachments();
    closeImagePicker(app);
    app.showToast('✅ Image URL added to note');
}

export function closeImagePicker(app) {
  const modal = document.getElementById('imagePickerModal');
  if (modal) modal.style.display = 'none';
  _ensurePickerState(app);
  app.selectedPickerImages.clear();
  app.imagePickerCatalog = [];
  _updateFooter(app);
}

export async function showImagePickerForNote(app) {
  _ensurePickerState(app);
  app.selectedPickerImages.clear();
  const captures = await _collectCaptureCandidates(app);
  const library = _collectNoteLibraryCandidates(app);
  app.imagePickerCatalog = [...captures, ...library];
  const modal = document.getElementById('imagePickerModal');
  if (!modal) {
    app.showToast('Image picker unavailable');
    return;
  }
  modal.style.display = 'flex';
  _updateFooter(app);
  switchImagePickerTab(app, 'captures');
  const urlInput = document.getElementById('imagePickerUrlInput');
  if (urlInput) urlInput.value = '';
  const fileInput = document.getElementById('imagePickerFileInput');
  if (fileInput) fileInput.value = '';
}

const PICKER_ACTIONS = Object.freeze({
  'close-image-picker': (app) => { closeImagePicker(app); },
  'image-picker-tab': (app, target) => { switchImagePickerTab(app, target.dataset.pickerTab); },
  'toggle-image-picker-item': (app, target) => { toggleImagePickerItem(app, target.dataset.imageId); },
  'add-selected-images': (app) => { addSelectedImagesToNote(app); },
  'edit-add-selected-image': (app) => { editAndAddSelectedImageToNote(app); },
  'add-image-url': (app) => {
    const input = document.getElementById('imagePickerUrlInput');
    addImageUrlToNote(app, input?.value);
  },
});

export function handleImagePickerClick(app, event) {
  const modal = document.getElementById('imagePickerModal');
  const target = event.target.closest('[data-action]');
  if (!target || !modal?.contains(target)) return false;
  const handler = PICKER_ACTIONS[target.dataset.action];
  if (!handler) return false;
  Promise.resolve(handler(app, target)).catch(() => {});
  return true;
}

export function handleImagePickerFileChange(app, event) {
  const file = event?.target?.files?.[0];
  if (file) uploadImageToNote(app, file);
}
