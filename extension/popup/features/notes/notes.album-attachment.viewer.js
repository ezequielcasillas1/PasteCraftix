import {
  collectAlbumInterlayings,
  resolveInterlayingAtFlatIndex,
  updateAlbumInterlaying,
} from './notes.album-interlayings.crud.js';
import { resolveSafeExternalUrl } from '../../../safe-url.js';
import { canAnnotateImageSrc, openImageAnnotate } from '../../../shared/image-annotate.js';
import { openGoogleSearchMenu } from '../clips/clips.action-menu.js';
import { getClipIdKey } from '../clips/clips.state.js';
import { popOutAlbumImageAnnotate } from './notes.image-annotate.js';
import { notifyUiLocationChanged } from '../ui-location/ui-location.service.js';
import { joinClipsForSummary } from '../../../shared/clip-source.js';

const SOURCE_CONTEXT = 'album';

function getViewerElements() {
  return {
    modal: document.getElementById('albumAttachmentViewerModal'),
    titleEl: document.getElementById('albumAttachmentViewerTitle'),
    metaSection: document.getElementById('albumAttachmentViewerNoteMeta'),
    albumTitle: document.getElementById('albumAttachmentViewerAlbumTitle'),
    albumDesc: document.getElementById('albumAttachmentViewerAlbumDesc'),
    body: document.getElementById('albumAttachmentViewerBody'),
    openBtn: document.getElementById('albumAttachmentOpenInPopupBtn'),
    aiFooter: document.getElementById('albumAttachmentViewerFooter'),
    annotateBtn: document.getElementById('albumAttachmentAnnotateBtn'),
  };
}

function attachmentImageSrc(att) {
  return String(att?.dataUrl || att?.url || att?.src || '').trim();
}

function usesDataUrlOnly(att) {
  return !!(att.dataUrl && !att.url && !att.src);
}

function usesSrcField(att) {
  return !!(att.src && !att.url);
}

function buildAnnotatedImagePatch(att, dataUrl) {
  if (usesDataUrlOnly(att)) return { dataUrl, mime: 'image/png' };
  if (usesSrcField(att)) return { src: dataUrl, mime: 'image/png' };
  return { dataUrl, mime: 'image/png' };
}

function setAnnotateButtonVisible(els, visible) {
  if (!els.annotateBtn) return;
  els.annotateBtn.style.display = visible ? 'inline-flex' : 'none';
}

function canShowAnnotateForAttachment(att) {
  return att?.type === 'image' && canAnnotateImageSrc(attachmentImageSrc(att));
}

function syncViewerToolbar(app, els, att) {
  const showAi = att.type === 'clip' || !!String(app.currentAlbumAttachmentClip?.text || '').trim();
  const showAnnotate = canShowAnnotateForAttachment(att);
  setAiToolbarVisible(els, showAi || showAnnotate);
  setAnnotateButtonVisible(els, showAnnotate);
  refreshLucideIcons(els.aiFooter);
}

function viewerElsValid(els) {
  const required = [els.modal, els.titleEl, els.metaSection, els.albumTitle, els.albumDesc, els.body];
  return required.every(Boolean);
}

function resolveAttachmentClip(app, att) {
  if (!att) return null;
  if (att.type === 'clip') {
    const live = app._findClipLocationById?.(att.id)?.clip;
    return live || { id: att.id, text: att.text || '' };
  }
  if (att.type === 'url') {
    return { id: att.id, text: att.url || '', meta: { kind: 'url', url: att.url || '' } };
  }
  if (att.type === 'image') {
    const src = att.dataUrl || att.url || att.src || '';
    return { id: att.id, text: src, meta: { kind: 'image', image: { dataUrl: src } } };
  }
  return null;
}

function resolveAttachmentOverlayTitle(app, att) {
  if (att.type === 'image') return 'Image';
  if (att.type !== 'clip') return 'Link';
  const liveClip = app._findClipLocationById?.(att.id)?.clip;
  const clipTitle = app._clipTitle?.(liveClip || att);
  return clipTitle || 'Clip';
}

function renderAttachmentImageBody(app, att, body) {
  const src = String(att.dataUrl || att.url || att.src || '').trim();
  if (!src) {
    body.textContent = 'Image attachment is missing a source.';
    return;
  }
  const safeSrc = app.escapeHtml(src);
  const canAnnotate = canAnnotateImageSrc(src);
  const annotateActions = canAnnotate
    ? `
      <div class="clip-viewer-image-actions clip-viewer-image-actions--top">
        <button type="button" class="pc-annotate-open-btn pc-annotate-open-btn--primary" data-action="album-attachment-popout">Pop out full screen</button>
      </div>
    `
    : '';
  const annotateFooter = canAnnotate
    ? `
      <div class="clip-viewer-image-actions">
        <button type="button" class="pc-annotate-open-btn" data-action="album-attachment-annotate">Annotate here · Draw / Text</button>
      </div>
    `
    : '';
  body.innerHTML = `
    ${annotateActions}
    <img class="clip-viewer-image" ${canAnnotate ? 'data-action="album-attachment-annotate" title="Annotate here"' : ''} src="${safeSrc}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb; cursor:${canAnnotate ? 'pointer' : 'default'};" />
    ${annotateFooter}
  `;
}

function renderAttachmentLinkBody(app, att, body) {
  const url = att.url || '';
  const safeHref = resolveSafeExternalUrl(url);
  const displayUrl = app.escapeHtml(url);
  const linkHtml = safeHref
    ? `<a href="${app.escapeHtml(safeHref)}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${displayUrl}</a>`
    : `<span style="word-break:break-all; color:#374151;">${displayUrl}</span>`;
  const schemeNote = safeHref
    ? ''
    : '<div style="color:#b45309; font-size:13px;">This link uses an unsupported URL scheme.</div>';
  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="font-weight:600; color:#111827;">Link</div>
      ${linkHtml}
      ${schemeNote}
      <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
    </div>
  `;
}

function renderAttachmentBody(app, att, body) {
  if (att.type === 'clip') {
    body.textContent = att.text || '';
    return;
  }
  if (att.type === 'image') {
    renderAttachmentImageBody(app, att, body);
    return;
  }
  renderAttachmentLinkBody(app, att, body);
}

function refreshLucideIcons(root) {
  if (!root) return;
  window.renderLucideIcons?.(root);
}

function setAiToolbarVisible(els, visible) {
  if (els.aiFooter) els.aiFooter.style.display = visible ? 'flex' : 'none';
}

function captureViewerContext(app) {
  const clip = app.currentAlbumAttachmentClip;
  const text = clip && clip.text != null ? String(clip.text) : '';
  const idKey = clip ? getClipIdKey(clip) : '';
  const idKeys = idKey ? [idKey] : [];
  return { clip, text, idKeys, clipObjects: clip ? [clip] : [] };
}

function closeViewerThen(app, fn) {
  const ctx = captureViewerContext(app);
  close(app);
  return fn(ctx);
}

function switchToAiTab() {
  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelector('[data-tab="ai"]')?.classList.add('active');
  document.getElementById('aiTab')?.classList.add('active');
}

export function open(app, noteId, attachmentIndex) {
  const note = app.notes.find((n) => n.id == noteId);
  if (!note) return;

  const allAttachments = collectAlbumInterlayings(note);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  const els = getViewerElements();
  if (!viewerElsValid(els)) return;

  app.currentAlbumAttachmentContext = { noteId, attachmentIndex };
  app.currentAlbumAttachmentClip = resolveAttachmentClip(app, att);

  const isAlbum = note.type === 'album';
  const safeTitle = (note.title || '').trim() || (isAlbum ? 'Untitled Album' : 'Untitled Note');
  const safeDesc = (note.description || '').trim();
  els.metaSection.style.display = 'block';
  const metaHeading = els.metaSection.querySelector('.note-viewer-section-title');
  if (metaHeading) metaHeading.textContent = isAlbum ? 'Album' : 'Note';
  els.albumTitle.textContent = safeTitle;
  els.albumDesc.textContent = safeDesc || '';

  els.titleEl.textContent = resolveAttachmentOverlayTitle(app, att);
  if (els.openBtn) els.openBtn.style.display = 'inline-flex';

  renderAttachmentBody(app, att, els.body);
  syncViewerToolbar(app, els, att);

  els.modal.style.display = 'flex';
  notifyUiLocationChanged(app);
}

export function close(app) {
  const modal = document.getElementById('albumAttachmentViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentAlbumAttachmentContext = null;
  app.currentAlbumAttachmentClip = null;
  notifyUiLocationChanged(app, true);
}

export function runAiSummary(app) {
  closeViewerThen(app, ({ text, clipObjects }) => {
    const trimmed = joinClipsForSummary(clipObjects) || String(text || '').trim();
    if (!trimmed) {
      app.showToast?.('No clip text to summarize', 'error');
      return;
    }
    app.showSummaryModal?.(trimmed);
  });
}

export function runAiBreakdown(app) {
  closeViewerThen(app, ({ text }) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      app.showToast?.('No clip text to break down', 'error');
      return;
    }
    app.showBreakdownModal?.(trimmed);
  });
}

export function openGoogleSearchActions(app) {
  const anchor = document.getElementById('albumAttachmentGoogleSearchBtn');
  const clip = app.currentAlbumAttachmentClip;
  if (!anchor || !clip) return;
  openGoogleSearchMenu(app, { anchor, clip, context: SOURCE_CONTEXT });
}

export function runAiRefactorization(app) {
  closeViewerThen(app, ({ idKeys }) => {
    if (!idKeys.length) {
      app.showToast?.('No clip to refactor', 'error');
      return;
    }
    switchToAiTab();
    app.activateRefactorizationSection?.();
    app._refactorizationSelected = new Set(idKeys.map(String));
    app.renderRefactorizationPanel?.();
  });
}

export async function runAiCraftClips(app) {
  const { idKeys } = captureViewerContext(app);
  close(app);
  if (!idKeys.length) {
    app.showToast?.('No clip to craft', 'error');
    return;
  }
  await app.magicFormat?.();
  app._magicSelected = new Set(idKeys.map(String));
  app._renderMagicPage?.(0);
  app._updateMagicSelectedCount?.();
}

export function runSendToCategories(app) {
  closeViewerThen(app, ({ clip, idKeys }) => {
    if (!idKeys.length) {
      app.showToast?.('No clip to categorize', 'error');
      return;
    }
    app.pendingBulkClipIds = null;
    app.pendingText = clip?.text ?? '';
    app.pendingClipId = idKeys[0];
    app.showCategoryModal?.(true);
  });
}

export async function runSendToNotes(app) {
  closeViewerThen(app, async ({ clipObjects }) => {
    if (!clipObjects.length) {
      app.showToast?.('No clip to send to notes', 'error');
      return;
    }
    await app.loadNotes?.();
    app.pendingBulkClipsForNotes = null;
    app.pendingClipForNotes = clipObjects[0];
    app.showAlbumPicker?.();
  });
}

function resolveCurrentImageAttachment(app) {
  const ctx = app.currentAlbumAttachmentContext;
  if (!ctx) return null;
  const note = app.notes?.find((n) => n.id == ctx.noteId);
  const loc = note ? resolveInterlayingAtFlatIndex(note, ctx.attachmentIndex) : null;
  if (!loc?.att || loc.att.type !== 'image') return null;
  return { ctx, att: loc.att };
}

function refreshAlbumAfterImagePatch(app, noteId) {
  if (app.currentViewerNoteId == noteId) app.openNoteViewer?.(noteId);
  app.renderNotes?.();
}

async function persistAnnotatedImage(app, ctx, att, dataUrl) {
  const patch = buildAnnotatedImagePatch(att, dataUrl);
  await updateAlbumInterlaying(app, ctx.noteId, ctx.attachmentIndex, patch, {
    afterUpdate: () => refreshAlbumAfterImagePatch(app, ctx.noteId),
  });
  app.currentAlbumAttachmentClip = resolveAttachmentClip(app, { ...att, ...patch, type: 'image' });
  open(app, ctx.noteId, ctx.attachmentIndex);
}

async function openAnnotateEditor(app, src) {
  return openImageAnnotate({
    dataUrl: src,
    ui: app,
    awaitResult: true,
    saveBehavior: 'close',
  });
}

function isAnnotateSaveOk(result) {
  return !!(result?.ok && canAnnotateImageSrc(result.dataUrl));
}

function toastAnnotateGateFailure(app, resolved, src) {
  if (!resolved) {
    app.showToast?.('No image to annotate', 'error');
    return true;
  }
  if (!canAnnotateImageSrc(src)) {
    app.showToast?.('Only embedded images can be annotated', 'error');
    return true;
  }
  return false;
}

async function saveAnnotateResult(app, resolved, result) {
  if (!isAnnotateSaveOk(result)) {
    if (!result?.cancelled) app.showToast?.('Annotate cancelled');
    return;
  }
  try {
    await persistAnnotatedImage(app, resolved.ctx, resolved.att, result.dataUrl);
    app.showToast?.('✅ Image annotated');
  } catch (err) {
    console.error('runAnnotate failed:', err);
    app.showToast?.('Could not save annotated image', 'error');
  }
}

/** Annotate the current album image attachment via shared/image-annotate.js. */
export async function runAnnotate(app) {
  const resolved = resolveCurrentImageAttachment(app);
  const src = attachmentImageSrc(resolved?.att);
  if (toastAnnotateGateFailure(app, resolved, src)) return;
  const result = await openAnnotateEditor(app, src);
  await saveAnnotateResult(app, resolved, result);
}

/** Pop out fullscreen annotate for the current album image (persists on Save). */
export async function runAnnotatePopOut(app) {
  const resolved = resolveCurrentImageAttachment(app);
  const src = attachmentImageSrc(resolved?.att);
  if (toastAnnotateGateFailure(app, resolved, src)) return;
  await popOutAlbumImageAnnotate(app, {
    noteId: resolved.ctx.noteId,
    attachmentIndex: resolved.ctx.attachmentIndex,
    dataUrl: src,
  });
}

/** Refresh album viewer after fullscreen annotate wrote storage. */
export async function refreshAfterExternalAnnotate(app) {
  const ctx = app.currentAlbumAttachmentContext;
  if (!ctx) return;
  try {
    await app.loadNotes?.();
  } catch (_) {}
  open(app, ctx.noteId, ctx.attachmentIndex);
  app.renderNotes?.();
}
