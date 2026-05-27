import { getClipTitle } from './clips.state.js';
import { getTimeAgo } from './clips.render.js';
import { copyClipToClipboard } from './clips.service.js';
import { formatClipViewerPlainText } from '../ai-lab/ai-lab.summary.js';
import { bindSafeLinkClick } from '../../../shared/safe-open-url.js';

function getClipViewerElements() {
  return {
    modal: document.getElementById('clipViewerModal'),
    titleEl: document.getElementById('clipViewerTitle'),
    metaEl: document.getElementById('clipViewerMeta'),
    bodyEl: document.getElementById('clipViewerBody'),
    renderedEl: document.getElementById('clipViewerRendered'),
    rawEl: document.getElementById('clipViewerRaw'),
    htmlDetails: document.getElementById('clipViewerHtmlDetails'),
    htmlPre: document.getElementById('clipViewerHtml'),
    toggleBtn: document.getElementById('clipViewerToggleRaw'),
  };
}

function buildClipViewerContext(clip) {
  const text = clip && clip.text != null ? String(clip.text) : '';
  const meta = clip && clip.meta && typeof clip.meta === 'object' ? clip.meta : null;
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
  if (meta && meta.kind) bits.push(`<strong>Type:</strong> ${app.escapeHtml(meta.kind)}`);
  if (markupType !== 'text') {
    bits.push(`<strong>Format:</strong> ${app.escapeHtml(markupType.toUpperCase())}`);
  }
  if (meta && meta.sourcePageUrl) {
    bits.push(`<strong>From:</strong> ${app.escapeHtml(meta.sourcePageUrl)}`);
  }
  if (clip && typeof clip.timestamp === 'number') {
    bits.push(
      `<strong>Saved:</strong> ${app.escapeHtml(getTimeAgo(clip.timestamp))}`,
    );
  }

  if (bits.length) {
    metaEl.innerHTML = bits.join('<br>');
    metaEl.style.display = 'block';
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

function buildClipViewerHeaderParts(app, text, meta, url, imgSrc) {
  const headerParts = [];
  let resolvedUrl = url;

  if (!resolvedUrl) {
    const raw = String(text || '').trim();
    if (/^https?:\/\/\S+$/i.test(raw)) resolvedUrl = raw;
  }

  if (resolvedUrl) {
    const safeUrl = app.escapeHtml(resolvedUrl);
    const linkHtml =
      typeof PCSanitize !== 'undefined' && typeof PCSanitize.buildSafeUrlDisplayHtml === 'function'
        ? PCSanitize.buildSafeUrlDisplayHtml(resolvedUrl, app.escapeHtml.bind(app))
        : /^https?:\/\//i.test(resolvedUrl)
          ? `<a data-pc-open-url="1" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`
          : `<span class="pc-url-display">${safeUrl}</span>`;
    headerParts.push(`
        <div class="clip-viewer-link-card">
          <div class="clip-viewer-section-label">Link</div>
          ${linkHtml}
        </div>
      `);
  }

  const isRenderableImageSrc =
    imgSrc &&
    (typeof PCSanitize !== 'undefined' && typeof PCSanitize.isAllowedImageSrc === 'function'
      ? PCSanitize.isAllowedImageSrc(imgSrc)
      : imgSrc.startsWith('data:image/') ||
        imgSrc.startsWith('http://') ||
        imgSrc.startsWith('https://'));

  if (imgSrc && !isRenderableImageSrc) {
    headerParts.push(
      '<div class="clip-viewer-note">Image preview unavailable (non-renderable source).</div>',
    );
  } else if (imgSrc && isRenderableImageSrc) {
    headerParts.push(
      `<img class="clip-viewer-image" src="${app.escapeHtml(imgSrc)}" alt="Clip image" />`,
    );
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
          const safeHtml =
            typeof PCSanitize !== 'undefined' && typeof PCSanitize.strictSanitize === 'function'
              ? PCSanitize.strictSanitize(rHtml)
              : rHtml;
          renderedEl.innerHTML = headerParts.join('') + safeHtml;
        })
        .catch(() => {
          renderedEl.innerHTML =
            headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`;
        });
    } else {
      const safeRendered =
        typeof PCSanitize !== 'undefined' && typeof PCSanitize.strictSanitize === 'function'
          ? PCSanitize.strictSanitize(rendered)
          : rendered;
      renderedEl.innerHTML = headerParts.join('') + safeRendered;
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

function bindClipViewerToggle(app, toggleBtn, hasMarkup) {
  if (!toggleBtn) return;
  if (!hasMarkup) {
    toggleBtn.style.display = 'none';
    return;
  }

  toggleBtn.style.display = '';
  const toggleLabel = toggleBtn.querySelector('span:last-child');
  if (toggleLabel) toggleLabel.textContent = 'View Raw';
  const newBtn = toggleBtn.cloneNode(true);
  if (!toggleBtn.parentNode) return;
  toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
  newBtn.addEventListener('click', () => {
    app._clipViewerShowingRaw = !app._clipViewerShowingRaw;
    const renderedEl = document.getElementById('clipViewerRendered');
    const rawEl = document.getElementById('clipViewerRaw');
    const activeToggleBtn = document.getElementById('clipViewerToggleRaw');
    const activeLabel = activeToggleBtn
      ? activeToggleBtn.querySelector('span:last-child')
      : null;
    if (app._clipViewerShowingRaw) {
      if (renderedEl) renderedEl.style.display = 'none';
      if (rawEl) rawEl.style.display = 'block';
      if (activeLabel) activeLabel.textContent = 'View Rendered';
    } else {
      if (renderedEl) renderedEl.style.display = 'block';
      if (rawEl) rawEl.style.display = 'none';
      if (activeLabel) activeLabel.textContent = 'View Raw';
    }
  });
}

function bindClipViewerLinkHandler(app, bodyEl) {
  try {
    if (app._clipViewerLinkHandlerAttached || !bodyEl) return;
    bindSafeLinkClick(bodyEl);
    app._clipViewerLinkHandlerAttached = true;
  } catch (_) {
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

export function open(app, clip) {
  const { modal, titleEl, metaEl, bodyEl, renderedEl, rawEl, htmlDetails, htmlPre, toggleBtn } =
    getClipViewerElements();

  if (!modal || !titleEl || !bodyEl) return;

  app.currentClipViewerClip = clip || null;
  app._clipViewerShowingRaw = false;

  const { text, meta, clipTitle, markupType } = buildClipViewerContext(clip);
  titleEl.textContent = resolveClipViewerTitle(clipTitle, meta);
  renderClipViewerMeta(app, metaEl, meta, markupType, clip);

  const safeText = app.escapeHtml(text);
  const { srcHtml, url, imgSrc } = extractClipViewerSource(meta);
  const headerParts = buildClipViewerHeaderParts(app, text, meta, url, imgSrc);
  const hasMarkup = renderClipViewerMainContent(
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
  bindClipViewerLinkHandler(app, bodyEl);
  renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml);

  modal.style.display = 'flex';
}

export function hide(app) {
  const modal = document.getElementById('clipViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentClipViewerClip = null;
}

export async function copyText(app) {
  const clip = app.currentClipViewerClip;
  const text = clip && clip.text != null ? String(clip.text) : '';
  if (!text) return;
  await copyClipToClipboard(app, text);
}
