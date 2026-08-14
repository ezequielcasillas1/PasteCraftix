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
import { isImageBearingClip, resolveClipImageSrc, readDebugAf03f9 } from '../../../shared/clip-images.js';
import { joinClipsForSummary } from '../../../shared/clip-source.js';
import { getClipIdKey } from '../../../shared/clip-id.js';
import {
  looksLikeLatexSource,
  looksLikeRenderedMathPlain,
  resolveClipboardMarkupText,
} from '../../../shared/clipboard-markup.js';
import { openClipImageAnnotate, popOutClipImageAnnotate } from './clips.image-annotate.js';
import { updateClipTextById } from './clips.text.js';
import {
  ensureRefactorResolverData,
  findClipAcrossCollections,
  resolveRefactorContext,
} from './clips.refactor-resolver.js';
import { notifyUiLocationChanged } from '../ui-location/ui-location.service.js';

const CLIP_VIEWER_SOURCE_CONTEXTS = new Set(['clips', 'search', 'categories']);

// #region agent log
function pcDebugLog(hypothesisId, location, message, data) {
  const payload = {
    sessionId: 'af03f9',
    runId: 'post-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.warn('[PasteCraft:debug:af03f9] ' + JSON.stringify(payload));
  fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'af03f9' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

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
  const markupType =
    typeof PCMarkup !== 'undefined' ? PCMarkup.detectMarkupType(text, meta) : 'text';
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

  if (bits.length) {
    metaEl.innerHTML = bits.join('<span class="clip-viewer-meta-sep" aria-hidden="true">·</span>');
    metaEl.style.display = 'flex';
    return;
  }
  metaEl.textContent = '';
  metaEl.style.display = 'none';
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
  if (inlineRenderable) {
    // #region agent log
    pcDebugLog('H1', 'clips.viewer.js:resolveClipViewerImageSrc', 'inline renderable src', {
      srcKind: imgSrc.slice(0, 12),
      srcLen: imgSrc.length,
      skippedSideStore: true,
    });
    // #endregion
    return imgSrc;
  }
  try {
    const resolved = await resolveClipImageSrc(clip);
    const src = resolved?.src || '';
    // #region agent log
    pcDebugLog('H1', 'clips.viewer.js:resolveClipViewerImageSrc', 'always side-store lookup', {
      found: !!src,
      srcLen: src.length,
      srcKind: src ? src.slice(0, 16) : '',
      kind: meta?.kind || null,
      hasImage: meta?.image?.hasImage === true,
      captureSource: meta?.captureSource || null,
      clipIdType: typeof clip?.id,
    });
    // #endregion
    if (src) return src;
  } catch (_) {}
  return imgSrc || '';
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
    const rendered = PCMarkup.renderMarkup(text, meta, { type: markupType });
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

  // #region agent log
  pcDebugLog('H3', 'clips.viewer.js:open', 'clip viewer state snapshot', {
    clipIdType: typeof canonicalClip?.id,
    idKey: getClipIdKey(canonicalClip?.id),
    hasMeta: !!(meta && typeof meta === 'object'),
    kind: meta?.kind || null,
    captureSource: meta?.captureSource || null,
    hasImageFlag: meta?.image?.hasImage === true,
    tooLarge: meta?.image?.tooLarge === true,
    dataUrlLen: typeof meta?.image?.dataUrl === 'string' ? meta.image.dataUrl.length : 0,
    srcUrlLen: typeof meta?.image?.srcUrl === 'string' ? meta.image.srcUrl.length : 0,
    textLen: String(text || '').length,
    titleLen: String(clipTitle || '').length,
    usedCanonical: !!(clip?.id != null && findClipAcrossCollections(app, clip?.id)),
    hasRefactorPair: !!refactorPair,
  });
  try {
    const bag = await chrome.storage.local.get(null);
    const keys = Object.keys(bag || {});
    const imgKeys = keys.filter((k) => k.startsWith('pc_clip_img_v1_'));
    const pendingKeys = keys.filter((k) => k.startsWith('pc_pending_clip_img_'));
    const captureKeys = keys.filter((k) => k.startsWith('pc_capture_shot_'));
    const idKey = getClipIdKey(canonicalClip?.id);
    const rawId = canonicalClip?.id != null ? String(canonicalClip.id) : '';
    const matchKeys = imgKeys.filter((k) => (idKey && k.includes(idKey)) || (rawId && k.includes(rawId)));
    let bytesInUse = 0;
    try {
      bytesInUse = await chrome.storage.local.getBytesInUse(null);
    } catch (_) {}
    const saveTrace = await readDebugAf03f9();
    pcDebugLog('H2', 'clips.viewer.js:open', 'side-store key scan', {
      imgKeyCount: imgKeys.length,
      pendingCount: pendingKeys.length,
      captureShotCount: captureKeys.length,
      matchCount: matchKeys.length,
      matchSuffixes: matchKeys.map((k) => k.slice(-28)),
      idKey,
      bytesInUse,
      saveTrace: saveTrace.slice(-6).map((e) => ({
        hypothesisId: e.hypothesisId,
        location: e.location,
        message: e.message,
        data: e.data,
      })),
    });
  } catch (_) {}
  // #endregion

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
  renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml);

  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
  notifyUiLocationChanged(app);

  // #region agent log
  {
    const img = renderedEl?.querySelector?.('img.clip-viewer-image');
    const bodyCs = bodyEl ? getComputedStyle(bodyEl) : null;
    const imgCs = img ? getComputedStyle(img) : null;
    pcDebugLog('H4', 'clips.viewer.js:open', 'post-render image/dom', {
      usedRefactorPath: !!refactorPair,
      headerPartCount: headerParts.length,
      imgSrcLen: imgSrc ? imgSrc.length : 0,
      imgSrcKind: imgSrc ? imgSrc.slice(0, 16) : '',
      hasImgEl: !!img,
      imgClientH: img?.clientHeight ?? 0,
      imgClientW: img?.clientWidth ?? 0,
      imgDisplay: imgCs?.display || null,
      imgMaxH: imgCs?.maxHeight || null,
      bodyOverflow: bodyCs?.overflow || null,
      bodyClientH: bodyEl?.clientHeight ?? 0,
    });
    if (img) {
      img.addEventListener('load', () => {
        pcDebugLog('H5', 'clips.viewer.js:open', 'img load', {
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          clientH: img.clientHeight,
        });
      });
      img.addEventListener('error', () => {
        pcDebugLog('H5', 'clips.viewer.js:open', 'img error', {
          srcKind: String(img.getAttribute('src') || '').slice(0, 16),
        });
      });
    }
  }
  // #endregion
}

export function hide(app) {
  exitEditModeUi(app);
  const modal = document.getElementById('clipViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentClipViewerClip = null;
  app.clipViewerSourceContext = null;
  app._clipViewerRefactorPair = null;
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
  window.renderLucideIcons?.(document.getElementById('clipViewerModal'));
  editTextarea.focus();
  try {
    const len = editTextarea.value.length;
    editTextarea.setSelectionRange(len, len);
  } catch (_) {
    // Non-fatal (some hosts reject setSelectionRange)
  }
  notifyUiLocationChanged(app);
}

export async function saveEdit(app) {
  const clip = app.currentClipViewerClip;
  if (!clip || !app._clipViewerEditing) return false;

  const { editTextarea } = getClipViewerElements();
  if (!editTextarea) return false;

  const nextText = String(editTextarea.value ?? '');
  const updated = await updateClipTextById(app, clip.id, nextText);
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
    const fromClips = joinClipsForSummary(objects);
    let trimmed = fromClips || String(text || '').trim();
    if (!trimmed && !imageBase64) {
      app.showToast?.('No clip text to summarize', 'error');
      return;
    }
    await app.showSummaryModal?.(trimmed, imageBase64 ? { imageBase64 } : undefined);
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

