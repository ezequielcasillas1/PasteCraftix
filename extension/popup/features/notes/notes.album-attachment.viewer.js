import { collectAlbumInterlayings } from './notes.album-interlayings.crud.js';
import { resolveSafeExternalUrl } from '../../../safe-url.js';
import { openGoogleSearchMenu } from '../clips/clips.action-menu.js';
import { getClipIdKey } from '../clips/clips.state.js';

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
  };
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
  const src = att.dataUrl || att.url || att.src || '';
  body.innerHTML = src
    ? `<img src="${app.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`
    : 'Image attachment is missing a source.';
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
  if (!note || note.type !== 'album') return;

  const allAttachments = collectAlbumInterlayings(note);
  const att = allAttachments[attachmentIndex];
  if (!att) return;

  const els = getViewerElements();
  if (!viewerElsValid(els)) return;

  app.currentAlbumAttachmentContext = { noteId, attachmentIndex };
  app.currentAlbumAttachmentClip = resolveAttachmentClip(app, att);

  const safeTitle = (note.title || '').trim() || 'Untitled Album';
  const safeDesc = (note.description || '').trim();
  els.metaSection.style.display = 'block';
  els.albumTitle.textContent = safeTitle;
  els.albumDesc.textContent = safeDesc || '';

  els.titleEl.textContent = resolveAttachmentOverlayTitle(app, att);
  if (els.openBtn) els.openBtn.style.display = 'inline-flex';

  renderAttachmentBody(app, att, els.body);
  setAiToolbarVisible(els, att.type === 'clip' || !!String(app.currentAlbumAttachmentClip?.text || '').trim());
  refreshLucideIcons(els.aiFooter);

  els.modal.style.display = 'flex';
}

export function close(app) {
  const modal = document.getElementById('albumAttachmentViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentAlbumAttachmentContext = null;
  app.currentAlbumAttachmentClip = null;
}

export function runAiSummary(app) {
  closeViewerThen(app, ({ text }) => {
    const trimmed = String(text || '').trim();
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
