import {
  getClipTitle,
  getSelectedOrCurrentText,
  getSelectedOrCurrentClipIdKeys,
  getSelectedOrCurrentClipObjects,
} from './clips.state.js';
import { openGoogleSearchMenu } from './clips.action-menu.js';
import { getTimeAgo } from './clips.render.js';
import { copyClipToClipboard } from './clips.service.js';
import { formatClipViewerPlainText } from '../ai-lab/ai-lab.summary.js';
import { isImageBearingClip, resolveClipImageSrc } from '../../../shared/clip-images.js';
import { collectClipSources, joinClipBodiesForSummary } from '../../../shared/clip-source.js';
import { getClipIdKey } from '../../../shared/clip-id.js';
import {
  looksLikeLatexSource,
  looksLikeRenderedMathPlain,
  resolveClipboardMarkupText,
} from '../../../shared/clipboard-markup.js';
import { openClipImageAnnotate, popOutClipImageAnnotate } from './clips.image-annotate.js';
import { updateClipTextById } from './clips.text.js';
import {
  applyClipViewerCharacterCount,
  ensureClipViewerCharacterCountEl,
} from './clips.viewer-count.js';
import {
  applyStudyListEnter,
  applyStudyListFormat,
  detectStudyListStyle,
  isStudyListStyle,
  LIST_STYLES,
  resolveStudyListMarkupHint,
  shouldRenderStudyLists,
  toMarkdownStudyLists,
} from './clips.viewer-lists.js';
import {
  ensureRefactorResolverData,
  findClipAcrossCollections,
  resolveRefactorContext,
} from './clips.refactor-resolver.js';
import { notifyUiLocationChanged } from '../ui-location/ui-location.service.js';

const CLIP_VIEWER_SOURCE_CONTEXTS = new Set(['clips', 'search', 'categories']);

const CLIP_VIEWER_EDIT_HIDE_IDS = [
  'clipViewerAiSummaryBtn',
  'clipViewerAiBreakdownBtn',
  'clipViewerGoogleSearchBtn',
  'clipViewerAiRefactorBtn',
  'clipViewerAiCraftBtn',
  'clipViewerSendCategoriesBtn',
  'clipViewerSendNotesBtn',
  'clipViewerToggleRaw',
  'editClipViewerBtn',
  'copyClipViewerBtn',
  'closeClipViewerBtn',
];

function normalizeClipViewerSourceContext(sourceContext) {
  return CLIP_VIEWER_SOURCE_CONTEXTS.has(sourceContext) ? sourceContext : 'clips';
}

function getClipViewerAiText(app) {
  const clip = app.currentClipViewerClip;
  const clipText = clip && clip.text != null ? String(clip.text) : '';
  const context = app.clipViewerSourceContext || 'clips';
  if (typeof app.getSelectedOrCurrentText === 'function') {
    return app.getSelectedOrCurrentText(clipText, context);
  }
  return getSelectedOrCurrentText(app, clipText, context);
}

function captureClipViewerContext(app) {
  const clip = app.currentClipViewerClip;
  const context = app.clipViewerSourceContext || 'clips';
  const text = getClipViewerAiText(app);
  const idKeys = getSelectedOrCurrentClipIdKeys(app, clip, context);
  const clipObjects = getSelectedOrCurrentClipObjects(app, clip, context);
  return { clip, context, text, idKeys, clipObjects };
}

function closeClipViewerThen(app, fn) {
  const ctx = captureClipViewerContext(app);
  hide(app);
  return fn(ctx);
}

function switchToAiTab() {
  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelector('[data-tab="ai"]')?.classList.add('active');
  document.getElementById('aiTab')?.classList.add('active');
}

function getClipViewerElements() {
  return {
    modal: document.getElementById('clipViewerModal'),
    titleEl: document.getElementById('clipViewerTitleText'),
    metaEl: document.getElementById('clipViewerMeta'),
    bodyEl: document.getElementById('clipViewerBody'),
    renderedEl: document.getElementById('clipViewerRendered'),
    rawEl: document.getElementById('clipViewerRaw'),
    editPanel: document.getElementById('clipViewerEditPanel'),
    editTextarea: document.getElementById('clipViewerEditTextarea'),
    htmlDetails: document.getElementById('clipViewerHtmlDetails'),
    htmlPre: document.getElementById('clipViewerHtml'),
    toggleBtn: document.getElementById('clipViewerToggleRaw'),
    editBtn: document.getElementById('editClipViewerBtn'),
    saveEditBtn: document.getElementById('saveClipViewerEditBtn'),
    cancelEditBtn: document.getElementById('cancelClipViewerEditBtn'),
  };
}

function setClipViewerEditChrome(editing) {
  CLIP_VIEWER_EDIT_HIDE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (editing) {
      if (el.dataset.pcEditPrevDisplay == null) {
        el.dataset.pcEditPrevDisplay = el.style.display || '';
      }
      el.style.display = 'none';
      el.disabled = true;
      return;
    }
    if (el.dataset.pcEditPrevDisplay != null) {
      el.style.display = el.dataset.pcEditPrevDisplay;
      delete el.dataset.pcEditPrevDisplay;
    }
    el.disabled = false;
  });

  const { saveEditBtn, cancelEditBtn } = getClipViewerElements();
  if (saveEditBtn) {
    saveEditBtn.style.display = editing ? '' : 'none';
    saveEditBtn.disabled = false;
  }
  if (cancelEditBtn) {
    cancelEditBtn.style.display = editing ? '' : 'none';
    cancelEditBtn.disabled = false;
  }
}

function exitEditModeUi(app) {
  const { renderedEl, rawEl, editPanel, editTextarea, htmlDetails } = getClipViewerElements();
  app._clipViewerEditing = false;
  if (editPanel) editPanel.style.display = 'none';
  if (editTextarea) editTextarea.value = '';
  if (renderedEl) {
    renderedEl.style.display = app._clipViewerShowingRaw ? 'none' : 'block';
  }
  if (rawEl) {
    rawEl.style.display = app._clipViewerShowingRaw ? 'block' : 'none';
  }
  if (htmlDetails && htmlDetails.dataset.pcEditPrevDisplay != null) {
    htmlDetails.style.display = htmlDetails.dataset.pcEditPrevDisplay;
    delete htmlDetails.dataset.pcEditPrevDisplay;
  }
  setClipViewerEditChrome(false);
}

function buildRefactorSectionHtml(app, label, text) {
  const content = formatClipViewerPlainText.call(app, text);
  return `
    <section class="clip-viewer-refactor-section">
      <div class="clip-viewer-section-label">${app.escapeHtml(label)}</div>
      <div class="clip-viewer-refactor-section-body">${content}</div>
    </section>`;
}

function renderRefactorDualContent(app, renderedEl, rawEl, refactorPair) {
  if (!renderedEl || !refactorPair) return;

  const beforeLabel = refactorPair.isFormatCompare ? 'Before (original)' : 'Original clip';
  const afterLabel = refactorPair.isFormatCompare ? 'After (AI Formatted)' : 'Refactored clip';

  renderedEl.innerHTML = `
    <div class="clip-viewer-refactor-dual">
      ${buildRefactorSectionHtml(app, beforeLabel, refactorPair.originalText)}
      ${buildRefactorSectionHtml(app, afterLabel, refactorPair.refactoredText)}
    </div>`;
  renderedEl.style.display = 'block';

  if (rawEl) {
    rawEl.textContent = '';
    rawEl.style.display = 'none';
  }
}

function recoverClipTextForMarkup(clip) {
  const original = clip && clip.text != null ? String(clip.text) : '';
  const meta = clip && clip.meta && typeof clip.meta === 'object' ? clip.meta : null;
  const html = typeof meta?.html === 'string' ? meta.html : '';
  if (!html || looksLikeLatexSource(original)) {
    return { text: original, meta };
  }
  const htmlLooksMath =
    /application\/x-tex|math\/tex|class=["'][^"']*katex|data-latex=/i.test(html);
  if (!htmlLooksMath && !looksLikeRenderedMathPlain(original)) {
    return { text: original, meta };
  }
  const resolved = resolveClipboardMarkupText(original, html);
  if (!resolved.usedHtmlTex) return { text: original, meta };
  const nextMeta = resolved.markupHint
    ? { ...meta, markupHint: meta?.markupHint || resolved.markupHint }
    : meta;
  return { text: resolved.text, meta: nextMeta };
}

function buildClipViewerContext(clip) {
  const recovered = recoverClipTextForMarkup(clip);
  const text = recovered.text;
  const meta = recovered.meta;
  const clipTitle = getClipTitle(clip);
  let markupType =
    typeof PCMarkup !== 'undefined' ? PCMarkup.detectMarkupType(text, meta) : 'text';
  if (markupType === 'text' && shouldRenderStudyLists(text) && typeof PCMarkup !== 'undefined') {
    markupType = 'markdown';
  }
  return { text, meta, clipTitle, markupType };
}

function resolveClipViewerTitle(clipTitle, meta) {
  const trimmed = clipTitle ? String(clipTitle).trim() : '';
  if (trimmed) return trimmed;
  if (meta && meta.kind === 'image') return 'Clip viewer · Image';
  if (meta && meta.kind === 'url') return 'Clip viewer · Link';
  return 'Clip viewer';
}

function renderClipViewerMeta(app, metaEl, meta, markupType, clip) {
  if (!metaEl) return;
  const bits = [];
  if (meta && meta.kind) {
    bits.push(
      `<span class="clip-viewer-meta-item"><strong>Type:</strong> ${app.escapeHtml(meta.kind)}</span>`,
    );
  }
  if (markupType !== 'text') {
    bits.push(
      `<span class="clip-viewer-meta-item"><strong>Format:</strong> ${app.escapeHtml(markupType.toUpperCase())}</span>`,
    );
  }
  if (meta && meta.sourcePageUrl) {
    const escapedUrl = app.escapeHtml(meta.sourcePageUrl);
    bits.push(
      `<span class="clip-viewer-meta-item clip-viewer-meta-from" title="${escapedUrl}"><strong>From:</strong> ${escapedUrl}</span>`,
    );
  }
  if (clip && typeof clip.timestamp === 'number') {
    bits.push(
      `<span class="clip-viewer-meta-item"><strong>Saved:</strong> ${app.escapeHtml(getTimeAgo(clip.timestamp))}</span>`,
    );
  }

  metaEl.innerHTML = bits.length
    ? bits.join('<span class="clip-viewer-meta-sep" aria-hidden="true">·</span>')
    : '';
  // Always show meta row — the character count chip lives inside it.
  ensureClipViewerCharacterCountEl();
  metaEl.style.display = 'flex';
}

function readCurrentClipViewerText(app) {
  const { editTextarea } = getClipViewerElements();
  if (app?._clipViewerEditing && editTextarea) return editTextarea.value;
  if (app?.currentClipViewerClip) return buildClipViewerContext(app.currentClipViewerClip).text;
  return '';
}

export function syncCharacterCount(app) {
  const el = ensureClipViewerCharacterCountEl();
  if (!el) return null;
  return applyClipViewerCharacterCount(el, readCurrentClipViewerText(app));
}

function bindClipViewerCountLive(app) {
  const { editTextarea } = getClipViewerElements();
  if (!editTextarea || editTextarea.dataset.pcCharCountBound === '1') return;
  editTextarea.dataset.pcCharCountBound = '1';
  const refresh = () => {
    if (!app._clipViewerEditing) return;
    syncCharacterCount(app);
  };
  editTextarea.addEventListener('input', refresh);
  editTextarea.addEventListener('change', refresh);
}

function extractClipViewerSource(meta) {
  let srcHtml = '';
  let url = '';
  let imgSrc = '';

  if (meta) {
    if (typeof meta.html === 'string' && meta.html.trim()) srcHtml = meta.html;
    if (typeof meta.url === 'string' && meta.url.trim()) url = meta.url.trim();
    if (meta.image && typeof meta.image === 'object') {
      imgSrc = (meta.image.dataUrl || meta.image.srcUrl || '').trim();
    }
  }

  return { srcHtml, url, imgSrc };
}

async function resolveClipViewerImageSrc(clip, meta) {
  const { imgSrc } = extractClipViewerSource(meta);
  const inlineRenderable =
    imgSrc &&
    (imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'));
  if (inlineRenderable) return imgSrc;
  try {
    const resolved = await resolveClipImageSrc(clip);
    const src = resolved?.src || '';
    if (src) return src;
  } catch (_) {}
  return imgSrc || '';
}

function updateStudyToolbarPressed(text, selectionStart, selectionEnd) {
  const style = detectStudyListStyle(text, selectionStart, selectionEnd);
  const bulletBtn = document.getElementById('clipViewerBulletBtn');
  const dotBtn = document.getElementById('clipViewerDotBtn');
  const numberedBtn = document.getElementById('clipViewerNumberedBtn');
  if (bulletBtn) bulletBtn.setAttribute('aria-pressed', style === LIST_STYLES.BULLET ? 'true' : 'false');
  if (dotBtn) dotBtn.setAttribute('aria-pressed', style === LIST_STYLES.DOT ? 'true' : 'false');
  if (numberedBtn) numberedBtn.setAttribute('aria-pressed', style === LIST_STYLES.NUMBERED ? 'true' : 'false');
}

function writeStudyListToTextarea(result) {
  const textarea = document.getElementById('clipViewerEditTextarea');
  if (!textarea || !result) return;
  textarea.value = result.text;
  textarea.focus();
  try {
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  } catch (_) {
    // Non-fatal
  }
  updateStudyToolbarPressed(result.text, result.selectionStart, result.selectionEnd);
}

export function applyStudyList(app, style) {
  if (!isStudyListStyle(style)) return;
  const wasEditing = !!app._clipViewerEditing;
  if (!wasEditing) enterEditMode(app);

  const textarea = document.getElementById('clipViewerEditTextarea');
  if (!textarea) return;

  const start = wasEditing ? textarea.selectionStart : 0;
  const end = wasEditing ? textarea.selectionEnd : textarea.value.length;
  writeStudyListToTextarea(applyStudyListFormat(textarea.value, start, end, style));
}

function bindStudyFormatToolbar(app) {
  const toolbar = document.getElementById('clipViewerStudyToolbar');
  if (!toolbar || toolbar.dataset.pcStudyBound === '1') return;
  toolbar.dataset.pcStudyBound = '1';
  toolbar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-list-style]');
    if (!btn || !toolbar.contains(btn)) return;
    event.preventDefault();
    applyStudyList(app, btn.getAttribute('data-list-style'));
  });
}

function bindStudyListTextarea() {
  const textarea = document.getElementById('clipViewerEditTextarea');
  if (!textarea || textarea.dataset.pcStudyBound === '1') return;
  textarea.dataset.pcStudyBound = '1';
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (textarea.selectionStart !== textarea.selectionEnd) return;
    const result = applyStudyListEnter(textarea.value, textarea.selectionStart);
    if (!result) return;
    event.preventDefault();
    writeStudyListToTextarea(result);
  });
  const syncPressed = () => {
    updateStudyToolbarPressed(textarea.value, textarea.selectionStart, textarea.selectionEnd);
  };
  textarea.addEventListener('keyup', syncPressed);
  textarea.addEventListener('click', syncPressed);
}

function rememberImageBearingMeta(clip) {
  if (!clip || typeof clip !== 'object') return;
  if (!clip.meta || typeof clip.meta !== 'object') clip.meta = {};
  if (!clip.meta.image || typeof clip.meta.image !== 'object') clip.meta.image = {};
  clip.meta.image.hasImage = true;
  if (!clip.meta.kind) clip.meta.kind = 'image';
}

function buildClipViewerHeaderParts(app, text, meta, url, imgSrc) {
  const headerParts = [];
  let resolvedUrl = url;

  if (!resolvedUrl) {
    const raw = String(text || '').trim();
    if (/^https?:\/\/\S+$/i.test(raw)) resolvedUrl = raw;
  }

  if (resolvedUrl) {
    const safeUrl = app.escapeHtml(resolvedUrl);
    headerParts.push(`
        <div class="clip-viewer-link-card">
          <div class="clip-viewer-section-label">Link</div>
          <a data-pc-open-url="1" href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>
        </div>
      `);
  }

  const isRenderableImageSrc =
    imgSrc &&
    (imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'));

  if (imgSrc && !isRenderableImageSrc) {
    headerParts.push(
      '<div class="clip-viewer-note">Image preview unavailable (non-renderable source).</div>',
    );
  } else if (imgSrc && isRenderableImageSrc) {
    headerParts.push(`
      <div class="clip-viewer-image-actions clip-viewer-image-actions--top">
        <button type="button" class="pc-annotate-open-btn pc-annotate-open-btn--primary" data-action="clip-image-popout">Pop out full screen</button>
      </div>
    `);
    headerParts.push(
      `<img class="clip-viewer-image" data-action="clip-image-annotate" src="${app.escapeHtml(imgSrc)}" alt="Clip image" title="Annotate here" />`,
    );
    headerParts.push(`
      <div class="clip-viewer-image-actions">
        <button type="button" class="pc-annotate-open-btn" data-action="clip-image-annotate">Annotate here · Draw / Text</button>
      </div>
    `);
    if (meta && meta.image && meta.image.tooLarge) {
      headerParts.push(
        '<div class="clip-viewer-note">Image payload too large to embed; showing what is available.</div>',
      );
    }
    if (meta && meta.image && meta.image.exportFailed) {
      headerParts.push(
        '<div class="clip-viewer-note">Image export blocked by the page (canvas/security restrictions).</div>',
      );
    }
  } else if (meta && meta.image && (meta.image.tooLarge || meta.image.hasImage)) {
    headerParts.push(
      '<div class="clip-viewer-note">Image not found in local store. Capture again with Image Picker.</div>',
    );
  }

  return headerParts;
}

function renderClipViewerMainContent(
  app,
  renderedEl,
  text,
  meta,
  markupType,
  headerParts,
  safeText,
) {
  const hasMarkup = markupType !== 'text' && typeof PCMarkup !== 'undefined';
  if (!renderedEl) return hasMarkup;

  if (hasMarkup) {
    const rendered = PCMarkup.renderMarkup(toMarkdownStudyLists(text), meta, { type: markupType });
    if (rendered && typeof rendered.then === 'function') {
      renderedEl.innerHTML =
        headerParts.join('') + '<div class="clip-viewer-note">Rendering diagram...</div>';
      rendered
        .then((rHtml) => {
          renderedEl.innerHTML = headerParts.join('') + rHtml;
        })
        .catch(() => {
          renderedEl.innerHTML =
            headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`;
        });
    } else {
      renderedEl.innerHTML = headerParts.join('') + rendered;
    }
    renderedEl.style.display = 'block';
    return hasMarkup;
  }

  renderedEl.innerHTML =
    headerParts.join('') + formatClipViewerPlainText.call(app, text);
  renderedEl.style.display = 'block';
  return hasMarkup;
}

function renderClipViewerRawContent(rawEl, text) {
  if (!rawEl) return;
  rawEl.textContent = text;
  rawEl.style.display = 'none';
}

function setLucideIconOnButton(btn, iconName) {
  if (!btn || !iconName) return;
  btn.querySelector('svg.lucide')?.remove();
  let iconEl = btn.querySelector('i[data-lucide]');
  if (!iconEl) {
    iconEl = document.createElement('i');
    btn.insertBefore(iconEl, btn.firstChild);
  }
  iconEl.setAttribute('data-lucide', iconName);
  window.renderLucideIcons?.(btn);
}

function updateToggleRawPresentation(toggleBtn, showingRaw) {
  if (!toggleBtn) return;
  const tipEl = toggleBtn.querySelector('.pc-tip');
  if (tipEl) tipEl.textContent = showingRaw ? 'View Rendered' : 'View Raw';
  toggleBtn.setAttribute('aria-label', showingRaw ? 'View rendered' : 'View raw');
  setLucideIconOnButton(toggleBtn, showingRaw ? 'eye' : 'file-text');
}

function bindClipViewerToggle(app, toggleBtn, hasMarkup) {
  if (!toggleBtn) return;
  if (!hasMarkup) {
    toggleBtn.style.display = 'none';
    return;
  }

  toggleBtn.style.display = '';
  updateToggleRawPresentation(toggleBtn, false);

  if (toggleBtn.dataset.pcToggleBound === '1') return;
  toggleBtn.dataset.pcToggleBound = '1';
  toggleBtn.addEventListener('click', () => {
    app._clipViewerShowingRaw = !app._clipViewerShowingRaw;
    const renderedEl = document.getElementById('clipViewerRendered');
    const rawEl = document.getElementById('clipViewerRaw');
    const activeToggleBtn = document.getElementById('clipViewerToggleRaw');

    if (app._clipViewerShowingRaw) {
      if (renderedEl) renderedEl.style.display = 'none';
      if (rawEl) rawEl.style.display = 'block';
    } else {
      if (renderedEl) renderedEl.style.display = 'block';
      if (rawEl) rawEl.style.display = 'none';
    }
    updateToggleRawPresentation(activeToggleBtn, app._clipViewerShowingRaw);
  });
}

function bindClipViewerLinkHandler(app, bodyEl) {
  try {
    if (app._clipViewerLinkHandlerAttached || !bodyEl) return;
    bodyEl.addEventListener('click', (e) => {
      const popOutBtn = e?.target?.closest?.('[data-action="clip-image-popout"]');
      if (popOutBtn && bodyEl.contains(popOutBtn)) {
        e.preventDefault();
        popOutClipImageAnnotate(app, { clipId: app.currentClipViewerClip?.id });
        return;
      }
      const annotateBtn = e?.target?.closest?.('[data-action="clip-image-annotate"]');
      if (annotateBtn && bodyEl.contains(annotateBtn)) {
        e.preventDefault();
        const clip = app.currentClipViewerClip;
        const img = bodyEl.querySelector('img.clip-viewer-image');
        openClipImageAnnotate(app, {
          clipId: clip?.id,
          dataUrl: img?.getAttribute('src') || '',
        }).catch(() => {});
        return;
      }
      const link = e && e.target ? e.target.closest('a[data-pc-open-url="1"]') : null;
      if (!link) return;
      e.preventDefault();
      const targetUrl = String(link.getAttribute('href') || '').trim();
      if (!targetUrl) return;
      chrome.tabs.create({ url: targetUrl, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      });
    });
    app._clipViewerLinkHandlerAttached = true;
  } catch (e) {
    // Non-fatal
  }
}

function renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml) {
  if (!htmlDetails || !htmlPre) return;
  if (srcHtml) {
    htmlPre.textContent = String(srcHtml);
    htmlDetails.style.display = 'block';
    return;
  }
  htmlPre.textContent = '';
  htmlDetails.style.display = 'none';
}

export async function open(app, clip, sourceContext = 'clips') {
  const {
    modal,
    titleEl,
    metaEl,
    bodyEl,
    renderedEl,
    rawEl,
    htmlDetails,
    htmlPre,
    toggleBtn,
  } = getClipViewerElements();

  if (!modal || !titleEl || !bodyEl) {
    return;
  }

  exitEditModeUi(app);

  await ensureRefactorResolverData(app);

  const canonicalClip = findClipAcrossCollections(app, clip?.id) || clip;
  app.currentClipViewerClip = canonicalClip || null;
  app.clipViewerSourceContext = normalizeClipViewerSourceContext(sourceContext);
  app._clipViewerShowingRaw = false;

  const { text, meta, clipTitle, markupType } = buildClipViewerContext(canonicalClip);
  const refactorPair = resolveRefactorContext(app, canonicalClip);
  app._clipViewerRefactorPair = refactorPair;

  titleEl.textContent = resolveClipViewerTitle(clipTitle, meta);
  const safeText = app.escapeHtml(text);
  const { srcHtml, url } = extractClipViewerSource(meta);
  const imgSrc = await resolveClipViewerImageSrc(canonicalClip, meta);
  if (imgSrc && canonicalClip) rememberImageBearingMeta(canonicalClip);
  const displayMeta = canonicalClip?.meta && typeof canonicalClip.meta === 'object' ? canonicalClip.meta : meta;
  renderClipViewerMeta(app, metaEl, displayMeta, markupType, canonicalClip);
  const headerParts = buildClipViewerHeaderParts(app, text, displayMeta, url, imgSrc);

  let hasMarkup = false;
  if (refactorPair) {
    renderRefactorDualContent(app, renderedEl, rawEl, refactorPair);
    if (toggleBtn) toggleBtn.style.display = 'none';
  } else {
    hasMarkup = renderClipViewerMainContent(
      app,
      renderedEl,
      text,
      meta,
      markupType,
      headerParts,
      safeText,
    );
    renderClipViewerRawContent(rawEl, text);
    bindClipViewerToggle(app, toggleBtn, hasMarkup);
  }

  bindClipViewerLinkHandler(app, bodyEl);
  bindStudyFormatToolbar(app);
  updateStudyToolbarPressed(text, 0, text.length);
  renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml);
  bindClipViewerCountLive(app);
  syncCharacterCount(app);

  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
  notifyUiLocationChanged(app);
}

export function hide(app) {
  exitEditModeUi(app);
  const modal = document.getElementById('clipViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentClipViewerClip = null;
  app.clipViewerSourceContext = null;
  app._clipViewerRefactorPair = null;
  syncCharacterCount(app);
  notifyUiLocationChanged(app, true);
}

export async function refreshIfOpen(app, clipId) {
  const openClip = app.currentClipViewerClip;
  if (!openClip) return false;
  if (getClipIdKey(openClip.id) !== getClipIdKey(clipId)) return false;

  const modal = document.getElementById('clipViewerModal');
  if (!modal || modal.style.display === 'none') return false;

  const fresh = findClipAcrossCollections(app, clipId) || openClip;
  const sourceContext = app.clipViewerSourceContext || 'clips';
  await open(app, fresh, sourceContext);
  return true;
}

export function enterEditMode(app) {
  const clip = app.currentClipViewerClip;
  if (!clip) {
    app.showToast?.('No clip to edit', 'error');
    return;
  }

  const { renderedEl, rawEl, editPanel, editTextarea, htmlDetails } = getClipViewerElements();
  if (!editPanel || !editTextarea) return;

  const { text } = buildClipViewerContext(clip);
  app._clipViewerEditing = true;

  if (renderedEl) renderedEl.style.display = 'none';
  if (rawEl) rawEl.style.display = 'none';
  if (htmlDetails) {
    if (htmlDetails.dataset.pcEditPrevDisplay == null) {
      htmlDetails.dataset.pcEditPrevDisplay = htmlDetails.style.display || '';
    }
    htmlDetails.style.display = 'none';
  }

  editTextarea.value = text;
  editPanel.style.display = 'flex';
  setClipViewerEditChrome(true);
  bindStudyListTextarea();
  updateStudyToolbarPressed(text, 0, text.length);
  window.renderLucideIcons?.(document.getElementById('clipViewerModal'));
  editTextarea.focus();
  try {
    const len = editTextarea.value.length;
    editTextarea.setSelectionRange(len, len);
  } catch (_) {
    // Non-fatal (some hosts reject setSelectionRange)
  }
  bindClipViewerCountLive(app);
  syncCharacterCount(app);
  notifyUiLocationChanged(app);
}

export async function saveEdit(app) {
  const clip = app.currentClipViewerClip;
  if (!clip || !app._clipViewerEditing) return false;

  const { editTextarea } = getClipViewerElements();
  if (!editTextarea) return false;

  const nextText = String(editTextarea.value ?? '');
  const markupHint = resolveStudyListMarkupHint(clip?.meta?.markupHint, nextText);
  const updated = await updateClipTextById(
    app,
    clip.id,
    nextText,
    markupHint ? { markupHint } : {},
  );
  const nextClip = updated || findClipAcrossCollections(app, clip.id);
  if (!nextClip) return false;

  app.currentClipViewerClip = nextClip;
  const sourceContext = app.clipViewerSourceContext || 'clips';
  exitEditModeUi(app);
  await open(app, nextClip, sourceContext);
  app.showToast?.('Clip updated');
  notifyUiLocationChanged(app, true);
  return true;
}

export function cancelEdit(app) {
  if (!app._clipViewerEditing) return;
  exitEditModeUi(app);
  syncCharacterCount(app);
  window.renderLucideIcons?.(document.getElementById('clipViewerModal'));
  notifyUiLocationChanged(app, true);
}

async function resolveViewerSummaryImage(objects) {
  if (!Array.isArray(objects) || objects.length !== 1 || !isImageBearingClip(objects[0])) {
    return '';
  }
  try {
    const resolved = await resolveClipImageSrc(objects[0]);
    return resolved?.src || '';
  } catch (_) {
    return '';
  }
}

export async function runAiSummary(app) {
  await closeClipViewerThen(app, async ({ text, clip, clipObjects }) => {
    const objects = Array.isArray(clipObjects) && clipObjects.length
      ? clipObjects
      : (clip ? [clip] : []);

    const imageBase64 = await resolveViewerSummaryImage(objects);
    const fromClips = joinClipBodiesForSummary(objects);
    let trimmed = fromClips || String(text || '').trim();
    if (!trimmed && !imageBase64) {
      app.showToast?.('No clip text to summarize', 'error');
      return;
    }
    await app.showSummaryModal?.(trimmed, {
      ...(imageBase64 ? { imageBase64 } : {}),
      sources: collectClipSources(objects),
      clips: objects,
    });
  });
}

export function runAiBreakdown(app) {
  closeClipViewerThen(app, ({ text }) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      app.showToast?.('No clip text to break down', 'error');
      return;
    }
    app.showBreakdownModal?.(trimmed);
  });
}

export function openGoogleSearchActions(app) {
  const anchor = document.getElementById('clipViewerGoogleSearchBtn');
  const clip = app.currentClipViewerClip;
  if (!anchor || !clip) return;
  openGoogleSearchMenu(app, {
    anchor,
    clip,
    context: app.clipViewerSourceContext || 'clips',
  });
}

export function runAiRefactorization(app) {
  closeClipViewerThen(app, ({ idKeys }) => {
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
  const { idKeys } = captureClipViewerContext(app);
  hide(app);
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
  closeClipViewerThen(app, ({ clip, idKeys }) => {
    if (!idKeys.length) {
      app.showToast?.('No clip to categorize', 'error');
      return;
    }
    if (idKeys.length > 1) {
      app.pendingBulkClipIds = idKeys;
      app.pendingText = null;
      app.pendingClipId = null;
    } else {
      app.pendingBulkClipIds = null;
      app.pendingText = clip?.text ?? '';
      app.pendingClipId = idKeys[0];
    }
    app.showCategoryModal?.(true);
  });
}

export async function runSendToNotes(app) {
  closeClipViewerThen(app, async ({ clipObjects }) => {
    await app.queueClipsForNotes?.(clipObjects);
  });
}

export async function copyText(app) {
  const clip = app.currentClipViewerClip;
  if (!clip) return;
  const imageElement =
    typeof document !== 'undefined'
      ? document.querySelector('#clipViewerModal .clip-viewer-image, .clip-viewer-image')
      : null;
  await copyClipToClipboard(app, clip, { imageElement: imageElement || undefined });
}

