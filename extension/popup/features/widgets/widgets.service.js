import { WIDGETS_STORAGE_KEYS, WIDGET_MAX_ITEMS } from './widgets.constants.js';
import { normalizeWidgetRecord } from './widgets.parse.js';

async function _storageGet(keys) {
  return chrome.storage.local.get(keys);
}

async function _storageSet(payload) {
  return chrome.storage.local.set(payload);
}

export async function loadWidgets(app) {
  const key = WIDGETS_STORAGE_KEYS.ITEMS;
  const stored = await _storageGet([key]);
  const list = Array.isArray(stored[key]) ? stored[key] : [];
  let migrated = false;
  app.embedWidgets = list
    .filter((w) => w && typeof w === 'object' && w.id && w.embedRaw)
    .map((w) => {
      // Legacy blob/srcdoc → external (Chrome CSP blocks in-popup remote scripts).
      if ((w.mode === 'srcdoc' || w.mode === 'blob') && w.srcdoc) {
        migrated = true;
        return { ...w, mode: 'external' };
      }
      return w;
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (migrated) await saveWidgets(app);
  return app.embedWidgets;
}

export async function saveWidgets(app) {
  const key = WIDGETS_STORAGE_KEYS.ITEMS;
  const list = Array.isArray(app.embedWidgets) ? app.embedWidgets.slice(0, WIDGET_MAX_ITEMS) : [];
  app.embedWidgets = list;
  await _storageSet({ [key]: list });
  return list;
}

export async function upsertWidget(app, draft, editingId) {
  const result = normalizeWidgetRecord(draft, editingId || null);
  if (!result.ok) return result;

  const list = Array.isArray(app.embedWidgets) ? [...app.embedWidgets] : [];
  const idx = list.findIndex((w) => String(w.id) === String(result.widget.id));
  if (idx >= 0) {
    result.widget.createdAt = list[idx].createdAt || result.widget.createdAt;
    list[idx] = result.widget;
  } else {
    if (list.length >= WIDGET_MAX_ITEMS) {
      return { ok: false, error: `Gallery limit is ${WIDGET_MAX_ITEMS} widgets.` };
    }
    list.unshift(result.widget);
  }
  app.embedWidgets = list;
  await saveWidgets(app);
  return { ok: true, widget: result.widget };
}

export async function deleteWidget(app, widgetId) {
  const id = String(widgetId || '');
  app.embedWidgets = (app.embedWidgets || []).filter((w) => String(w.id) !== id);
  await saveWidgets(app);
  return true;
}

export function getWidgetById(app, widgetId) {
  return (app.embedWidgets || []).find((w) => String(w.id) === String(widgetId)) || null;
}
