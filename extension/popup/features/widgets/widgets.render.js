import {
  WIDGET_SELECTORS,
  WIDGET_SIZE_HEIGHTS,
  WIDGET_SOURCE_CATALOG,
} from './widgets.constants.js';
import {
  applyIframePlan,
  escapeHtml,
  isExternalWidget,
  normalizeWidgetRecord,
  revokeIframeBlobUrl,
  sandboxForMode,
} from './widgets.parse.js';

function _el(id) {
  return document.getElementById(id);
}

function _heightFor(size) {
  return WIDGET_SIZE_HEIGHTS[size] || WIDGET_SIZE_HEIGHTS.md;
}

function _sourceHint(widget) {
  const raw = widget?.embedRaw || '';
  if (/livecoinwatch|lcw-widget/i.test(raw)) return 'Live Coin Watch';
  if (/coingecko/i.test(raw)) return 'CoinGecko';
  if (/vunelix/i.test(raw)) return 'Vunelix';
  if (/nowprice/i.test(raw)) return 'NowPrice';
  if (/indify/i.test(raw)) return 'Indify';
  try {
    const m = raw.match(/https?:\/\/([^/\s"']+)/i);
    return m ? m[1] : 'Script widget';
  } catch {
    return 'Script widget';
  }
}

function _externalBodyHtml(widget, height) {
  const id = escapeHtml(String(widget.id));
  const source = escapeHtml(_sourceHint(widget));
  return `
    <div class="pc-widget-external" style="min-height:${height}px;" data-widget-external="${id}">
      <div class="pc-widget-external-icon"><i data-lucide="external-link"></i></div>
      <p class="pc-widget-external-title">Live preview opens in a browser tab</p>
      <p class="pc-widget-external-blurb">Chrome blocks third-party scripts inside the extension. ${source} opens as a data-page tab (not an extension page) so the widget can load.</p>
      <button type="button" class="create-note-btn pc-widget-open-btn" data-action="open-widget" data-widget-id="${id}">
        <i data-lucide="play" style="margin-right:6px;"></i>
        <span>Open live widget</span>
      </button>
    </div>`;
}

function _iframeBodyHtml(widget, height, title, id) {
  return `
    <div class="pc-widget-frame-wrap" style="height:${height}px;">
      <iframe
        class="pc-widget-frame"
        title="${title}"
        loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="${sandboxForMode(widget.mode)}"
        data-widget-frame="${id}"
      ></iframe>
    </div>`;
}

function _cardHtml(widget) {
  const h = _heightFor(widget.size);
  const title = escapeHtml(widget.title || 'Widget');
  const id = escapeHtml(String(widget.id));
  const external = isExternalWidget(widget);
  const body = external ? _externalBodyHtml(widget, h) : _iframeBodyHtml(widget, h, title, id);
  const openBtn = external
    ? `<button type="button" class="pc-widget-icon-btn" data-action="open-widget" data-widget-id="${id}" title="Open live" aria-label="Open live widget">
            <i data-lucide="external-link"></i>
          </button>`
    : '';
  return `
    <article class="pc-widget-card" data-widget-id="${id}" data-widget-mode="${escapeHtml(widget.mode || '')}">
      <header class="pc-widget-card-head">
        <h4 class="pc-widget-card-title" title="${title}">${title}</h4>
        <div class="pc-widget-card-actions">
          ${openBtn}
          <button type="button" class="pc-widget-icon-btn" data-action="edit-widget" data-widget-id="${id}" title="Edit" aria-label="Edit widget">
            <i data-lucide="pencil"></i>
          </button>
          <button type="button" class="pc-widget-icon-btn pc-widget-icon-btn--danger" data-action="delete-widget" data-widget-id="${id}" title="Remove" aria-label="Remove widget">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </header>
      ${body}
    </article>`;
}

function _emptyHtml() {
  return `
    <div class="empty-state" id="${WIDGET_SELECTORS.EMPTY}">
      <div class="empty-state-icon"><i data-lucide="layout-dashboard"></i></div>
      <h3>No widgets yet</h3>
      <p>Paste an <strong>iframe</strong> embed for in-popup preview, or a script widget (Live Coin Watch) and open it live in a tab.</p>
      <div class="demo-hint">
        <span class="demo-step">1 Copy embed</span>
        <span class="demo-step">2 Save</span>
        <span class="demo-step">3 Open live</span>
      </div>
    </div>`;
}

export function renderWidgetsGallery(app) {
  const gallery = _el(WIDGET_SELECTORS.GALLERY);
  if (!gallery) return;

  const list = Array.isArray(app.embedWidgets) ? app.embedWidgets : [];
  if (list.length === 0) {
    gallery.querySelectorAll('iframe.pc-widget-frame').forEach((f) => revokeIframeBlobUrl(f));
    gallery.innerHTML = _emptyHtml();
    window.renderLucideIconsForActiveTab?.('widgets', 'widgets-empty', { immediate: true });
    return;
  }

  gallery.querySelectorAll('iframe.pc-widget-frame').forEach((f) => revokeIframeBlobUrl(f));
  gallery.innerHTML = `<div class="pc-widgets-grid">${list.map(_cardHtml).join('')}</div>`;
  list.forEach((widget) => {
    if (isExternalWidget(widget)) return;
    const frame = gallery.querySelector(`[data-widget-frame="${CSS.escape(String(widget.id))}"]`);
    applyIframePlan(frame, widget);
  });
  window.renderLucideIconsForActiveTab?.('widgets', 'widgets-gallery', { immediate: true });
}

export function renderSourcesList() {
  const host = _el(WIDGET_SELECTORS.SOURCES_LIST);
  if (!host) return;
  host.innerHTML = WIDGET_SOURCE_CATALOG.map((src) => `
    <a class="pc-widget-source-card" href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" data-action="open-source">
      <span class="pc-widget-source-name">${escapeHtml(src.name)}</span>
      <span class="pc-widget-source-cat">${escapeHtml(src.category)}</span>
      <span class="pc-widget-source-blurb">${escapeHtml(src.blurb)}</span>
    </a>
  `).join('');
}

export function setAddPanelOpen(open) {
  const panel = _el(WIDGET_SELECTORS.PANEL);
  if (!panel) return;
  panel.hidden = !open;
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

export function setSourcesPanelOpen(open) {
  const panel = _el(WIDGET_SELECTORS.SOURCES_PANEL);
  if (!panel) return;
  panel.hidden = !open;
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) renderSourcesList();
}

function _setInputValue(id, value) {
  const node = _el(id);
  if (node) node.value = value;
}

export function fillAddForm(widget) {
  const w = widget || {};
  showFormError('');
  _setInputValue(WIDGET_SELECTORS.EDITING_ID, w.id ? String(w.id) : '');
  _setInputValue(WIDGET_SELECTORS.TITLE_INPUT, w.title || '');
  _setInputValue(WIDGET_SELECTORS.EMBED_INPUT, w.embedRaw || '');
  _setInputValue(WIDGET_SELECTORS.SIZE_SELECT, w.size || 'md');
  clearPreview();
  if (w.embedRaw) updatePreviewFromForm();
}

export function clearPreview() {
  const frame = _el(WIDGET_SELECTORS.PREVIEW);
  const wrap = _el(WIDGET_SELECTORS.PREVIEW_WRAP);
  if (frame) {
    revokeIframeBlobUrl(frame);
    frame.removeAttribute('src');
    frame.removeAttribute('srcdoc');
    frame.hidden = false;
  }
  wrap?.querySelector('.pc-widget-external-preview')?.remove();
}

export function showFormError(message) {
  const err = _el(WIDGET_SELECTORS.ERROR);
  if (!err) return;
  err.hidden = !message;
  err.textContent = message || '';
}

export function updatePreviewFromForm() {
  const embed = _el(WIDGET_SELECTORS.EMBED_INPUT);
  const size = _el(WIDGET_SELECTORS.SIZE_SELECT);
  const wrap = _el(WIDGET_SELECTORS.PREVIEW_WRAP);
  const frame = _el(WIDGET_SELECTORS.PREVIEW);
  if (!embed || !frame || !wrap) return;

  const result = normalizeWidgetRecord({
    title: 'Preview',
    size: size?.value || 'md',
    embedRaw: embed.value,
  });
  if (!result.ok) {
    showFormError(result.error);
    clearPreview();
    return;
  }
  showFormError('');
  wrap.style.height = `${_heightFor(result.widget.size)}px`;
  wrap.querySelector('.pc-widget-external-preview')?.remove();

  if (isExternalWidget(result.widget)) {
    frame.hidden = true;
    frame.removeAttribute('src');
    const tip = document.createElement('div');
    tip.className = 'pc-widget-external pc-widget-external-preview';
    tip.innerHTML = `
      <p class="pc-widget-external-title">Script widget detected</p>
      <p class="pc-widget-external-blurb">Chrome CSP blocks Live Coin Watch–style scripts inside the popup. Save, then use <strong>Open live widget</strong>.</p>`;
    wrap.appendChild(tip);
    return;
  }

  frame.hidden = false;
  applyIframePlan(frame, result.widget);
}

export function readAddFormDraft() {
  return {
    title: _el(WIDGET_SELECTORS.TITLE_INPUT)?.value || '',
    embedRaw: _el(WIDGET_SELECTORS.EMBED_INPUT)?.value || '',
    size: _el(WIDGET_SELECTORS.SIZE_SELECT)?.value || 'md',
  };
}

export function readEditingId() {
  return _el(WIDGET_SELECTORS.EDITING_ID)?.value || '';
}
