import { WIDGET_SELECTORS } from './widgets.constants.js';
import { deleteWidget, getWidgetById, upsertWidget } from './widgets.service.js';
import { openWidgetInTab } from './widgets.parse.js';
import {
  clearPreview,
  fillAddForm,
  readAddFormDraft,
  readEditingId,
  renderWidgetsGallery,
  setAddPanelOpen,
  setSourcesPanelOpen,
  showFormError,
  updatePreviewFromForm,
} from './widgets.render.js';

function _el(id) {
  return document.getElementById(id);
}

function openAddPanel(app, widget) {
  setSourcesPanelOpen(false);
  fillAddForm(widget || null);
  setAddPanelOpen(true);
  _el(WIDGET_SELECTORS.TITLE_INPUT)?.focus();
}

function closeAddPanel() {
  const active = document.activeElement;
  if (active && _el(WIDGET_SELECTORS.PANEL)?.contains(active)) {
    active.blur?.();
  }
  setAddPanelOpen(false);
  fillAddForm(null);
  clearPreview();
}

async function saveFromForm(app) {
  const draft = readAddFormDraft();
  const editingId = readEditingId() || null;
  const result = await upsertWidget(app, draft, editingId);
  if (!result.ok) {
    showFormError(result.error);
    return;
  }
  closeAddPanel();
  renderWidgetsGallery(app);
  app.showToast?.(editingId ? 'Widget updated' : 'Widget saved — use Open live for script widgets');
}

function bindToolbar(app) {
  _el(WIDGET_SELECTORS.ADD_BTN)?.addEventListener('click', () => openAddPanel(app, null));
  _el(WIDGET_SELECTORS.SOURCES_BTN)?.addEventListener('click', () => {
    setAddPanelOpen(false);
    setSourcesPanelOpen(true);
  });
  _el(WIDGET_SELECTORS.SOURCES_CLOSE)?.addEventListener('click', () => setSourcesPanelOpen(false));
  _el(WIDGET_SELECTORS.PANEL_CLOSE)?.addEventListener('click', () => closeAddPanel());
  _el(WIDGET_SELECTORS.CANCEL_BTN)?.addEventListener('click', () => closeAddPanel());
  _el(WIDGET_SELECTORS.SAVE_BTN)?.addEventListener('click', async () => {
    await saveFromForm(app);
  });
}

function bindFormPreview() {
  const embed = _el(WIDGET_SELECTORS.EMBED_INPUT);
  const size = _el(WIDGET_SELECTORS.SIZE_SELECT);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => updatePreviewFromForm(), 280);
  };
  embed?.addEventListener('input', schedule);
  size?.addEventListener('change', () => updatePreviewFromForm());
}

async function handleGalleryAction(app, action, id) {
  if (!id) return;
  if (action === 'open-widget') {
    const widget = getWidgetById(app, id);
    if (!widget) return;
    const opened = openWidgetInTab(widget);
    if (!opened.ok) {
      app.showToast?.(opened.error || 'Could not open widget');
      return;
    }
    app.showToast?.('Opened live widget in a new tab');
    return;
  }
  if (action === 'edit-widget') {
    const widget = getWidgetById(app, id);
    if (widget) openAddPanel(app, widget);
    return;
  }
  if (action !== 'delete-widget') return;
  if (!window.confirm('Remove this widget from your gallery?')) return;
  await deleteWidget(app, id);
  renderWidgetsGallery(app);
  app.showToast?.('Widget removed');
}

function bindGalleryDelegation(app) {
  const gallery = _el(WIDGET_SELECTORS.GALLERY);
  if (!gallery || gallery.dataset.pcWidgetsBound === '1') return;
  gallery.dataset.pcWidgetsBound = '1';

  gallery.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-action]');
    if (!btn) return;
    void handleGalleryAction(app, btn.dataset.action, btn.dataset.widgetId);
  });
}

export function initWidgetsEventListeners(app) {
  if (app._widgetsEventsBound) return;
  app._widgetsEventsBound = true;
  bindToolbar(app);
  bindFormPreview();
  bindGalleryDelegation(app);
}
