import {
  CUSTOM_SEARCH_CLIP_PLACEHOLDER,
  CUSTOM_SEARCH_MAX_ITEMS,
  CUSTOM_SEARCH_MAX_NAME_LENGTH,
  CUSTOM_SEARCH_MAX_QUERY_LENGTH,
  CUSTOM_SEARCH_MAX_TEMPLATE_LENGTH,
  CUSTOM_SEARCH_MAX_USAGE_LOG,
  CUSTOM_SEARCH_STORAGE_KEY,
  CUSTOM_SEARCH_USAGE_KEY,
} from './clips.custom-search.constants.js';

const UNSAFE_SCHEME_RE = /(?:javascript|data|vbscript):/gi;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeCustomSearchTemplate(template) {
  const cleaned = normalizeWhitespace(String(template || '').replace(UNSAFE_SCHEME_RE, ''));
  return cleaned.slice(0, CUSTOM_SEARCH_MAX_TEMPLATE_LENGTH);
}

export function sanitizeCustomSearchName(name) {
  const cleaned = normalizeWhitespace(String(name || '').replace(UNSAFE_SCHEME_RE, ''));
  return cleaned.slice(0, CUSTOM_SEARCH_MAX_NAME_LENGTH);
}

export function sanitizeCustomSearchQuery(query) {
  const cleaned = normalizeWhitespace(String(query || '').replace(UNSAFE_SCHEME_RE, ''));
  return cleaned.slice(0, CUSTOM_SEARCH_MAX_QUERY_LENGTH);
}

export function templateUsesClipPlaceholder(template) {
  return sanitizeCustomSearchTemplate(template).includes(CUSTOM_SEARCH_CLIP_PLACEHOLDER);
}

export function buildQueryFromTemplate(template, clipText) {
  const safeTemplate = sanitizeCustomSearchTemplate(template);
  const safeClip = sanitizeCustomSearchQuery(clipText);
  if (!safeTemplate) return safeClip;

  const placeholder = CUSTOM_SEARCH_CLIP_PLACEHOLDER;
  if (safeTemplate.includes(placeholder)) {
    return sanitizeCustomSearchQuery(safeTemplate.split(placeholder).join(safeClip || ''));
  }

  return safeTemplate;
}

export function buildGoogleSearchUrl(query) {
  const safeQuery = sanitizeCustomSearchQuery(query);
  if (!safeQuery) return '';
  return `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}`;
}

function normalizeCustomSearchEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = sanitizeCustomSearchName(raw.name);
  const template = sanitizeCustomSearchTemplate(raw.template);
  if (!id || !name || !template) return null;
  return {
    id,
    name,
    template,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

export async function loadCustomSearches() {
  try {
    const stored = await chrome.storage.local.get([CUSTOM_SEARCH_STORAGE_KEY]);
    const raw = stored?.[CUSTOM_SEARCH_STORAGE_KEY];
    if (!Array.isArray(raw)) return [];
    return raw
      .map(normalizeCustomSearchEntry)
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn('[custom-search] Failed to load saved searches:', error);
    return [];
  }
}

export async function ensureCustomSearchesLoaded(app) {
  if (Array.isArray(app.customSearches)) return app.customSearches;
  app.customSearches = await loadCustomSearches();
  return app.customSearches;
}

function setCustomSearchesOnApp(app, items) {
  app.customSearches = Array.isArray(items) ? items : [];
}

async function persistCustomSearches(items) {
  await chrome.storage.local.set({
    [CUSTOM_SEARCH_STORAGE_KEY]: items,
    pc_local_updatedAt: Date.now(),
  });
}

export async function logCustomSearchUsage(action, details = {}) {
  try {
    const stored = await chrome.storage.local.get([CUSTOM_SEARCH_USAGE_KEY]);
    const prev = Array.isArray(stored?.[CUSTOM_SEARCH_USAGE_KEY]) ? stored[CUSTOM_SEARCH_USAGE_KEY] : [];
    const entry = {
      action: String(action || 'search'),
      templateId: details.templateId ? String(details.templateId) : null,
      name: details.name ? sanitizeCustomSearchName(details.name) : null,
      at: Date.now(),
    };
    const next = [entry, ...prev].slice(0, CUSTOM_SEARCH_MAX_USAGE_LOG);
    await chrome.storage.local.set({ [CUSTOM_SEARCH_USAGE_KEY]: next });
  } catch (error) {
    console.warn('[custom-search] Usage log failed:', error);
  }
}

function validateCustomSearchInput(name, template, state, excludeId = null) {
  const safeName = sanitizeCustomSearchName(name);
  const safeTemplate = sanitizeCustomSearchTemplate(template);
  if (!safeName) return { valid: false, error: 'Name is required' };
  if (!safeTemplate) return { valid: false, error: 'Website URL is required' };
  const items = Array.isArray(state.customSearches) ? state.customSearches : [];
  const duplicate = items.some((item) => {
    if (!item || excludeId && String(item.id) === String(excludeId)) return false;
    return item.name.toLowerCase() === safeName.toLowerCase();
  });
  if (duplicate) return { valid: false, error: 'A saved search with that name already exists' };
  if (!excludeId && items.length >= CUSTOM_SEARCH_MAX_ITEMS) {
    return { valid: false, error: `You can save up to ${CUSTOM_SEARCH_MAX_ITEMS} custom searches` };
  }
  return { valid: true, name: safeName, template: safeTemplate };
}

export async function createCustomSearch(app, { name, template }, options = {}) {
  const silent = !!options.silent;
  await ensureCustomSearchesLoaded(app);
  const now = Date.now();
  const entity = {
    id: `cs_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeCustomSearchName(name),
    template: sanitizeCustomSearchTemplate(template),
    createdAt: now,
    updatedAt: now,
  };

  const result = await PasteCraftCRUD.createOperation({
    entity,
    stateGetter: () => ({ customSearches: app.customSearches || [] }),
    stateSetter: async (state) => setCustomSearchesOnApp(app, state.customSearches),
    stateKeys: ['customSearches'],
    validator: (entry, state) => validateCustomSearchInput(entry.name, entry.template, state),
    duplicateCheck: (entry, state) =>
      Array.isArray(state.customSearches) &&
      state.customSearches.some((item) => item.name.toLowerCase() === entry.name.toLowerCase()),
    storageKeys: ['customSearches'],
    storageWriter: async (data) => {
      await persistCustomSearches(data.customSearches);
    },
    addToArray: (items, entry) => [entry, ...items],
    verifier: async (entry) => {
      const items = await loadCustomSearches();
      return items.some((item) => item.id === entry.id);
    },
    successMessage: () => (silent ? '' : 'Custom search saved'),
    errorMessage: (error) => `Failed to save custom search: ${error?.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (!silent && msg) app.showToast?.(msg, type);
    },
  });

  if (result.success) {
    await logCustomSearchUsage('create', { templateId: entity.id, name: entity.name });
  }
  return result;
}

export async function updateCustomSearch(app, id, { name, template }, options = {}) {
  const silent = !!options.silent;
  await ensureCustomSearchesLoaded(app);
  const entityId = String(id || '').trim();
  if (!entityId) {
    app.showToast?.('Invalid custom search', 'error');
    return { success: false, error: 'Invalid custom search' };
  }

  const result = await PasteCraftCRUD.updateOperation({
    entityId,
    updates: {
      name: sanitizeCustomSearchName(name),
      template: sanitizeCustomSearchTemplate(template),
      updatedAt: Date.now(),
    },
    stateGetter: () => ({ customSearches: app.customSearches || [] }),
    stateSetter: async (state) => setCustomSearchesOnApp(app, state.customSearches),
    stateKeys: ['customSearches'],
    validator: (entry, state) => validateCustomSearchInput(entry.name, entry.template, state, entityId),
    storageKeys: ['customSearches'],
    storageWriter: async (data) => {
      await persistCustomSearches(data.customSearches);
    },
    updateInArray: (items, targetId, updates) =>
      items.map((item) => (String(item.id) === String(targetId) ? { ...item, ...updates } : item)),
    verifier: async (targetId, updates) => {
      const items = await loadCustomSearches();
      const found = items.find((item) => String(item.id) === String(targetId));
      return !!found && found.name === updates.name && found.template === updates.template;
    },
    successMessage: () => (silent ? '' : 'Custom search updated'),
    errorMessage: (error) => `Failed to update custom search: ${error?.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (!silent && msg) app.showToast?.(msg, type);
    },
  });

  if (result.success) {
    await logCustomSearchUsage('update', { templateId: entityId, name: sanitizeCustomSearchName(name) });
  }
  return result;
}

export async function deleteCustomSearch(app, id, options = {}) {
  const silent = !!options.silent;
  await ensureCustomSearchesLoaded(app);
  const entityId = String(id || '').trim();
  if (!entityId) {
    app.showToast?.('Invalid custom search', 'error');
    return { success: false, error: 'Invalid custom search' };
  }

  const existing = (app.customSearches || []).find((item) => String(item.id) === entityId);

  const result = await PasteCraftCRUD.deleteOperation({
    entityId,
    entityName: existing?.name || 'Custom search',
    entityType: 'customSearch',
    stateGetter: () => ({ customSearches: app.customSearches || [] }),
    stateSetter: async (state) => setCustomSearchesOnApp(app, state.customSearches),
    stateKeys: ['customSearches'],
    idempotencyCheck: (targetId, state) =>
      !Array.isArray(state.customSearches) ||
      !state.customSearches.some((item) => String(item.id) === String(targetId)),
    storageKeys: ['customSearches'],
    storageWriter: async (data) => {
      await persistCustomSearches(data.customSearches);
    },
    deleteFromArray: (items, targetId) =>
      items.filter((item) => String(item.id) !== String(targetId)),
    verifier: async (targetId) => {
      const items = await loadCustomSearches();
      return !items.some((item) => String(item.id) === String(targetId));
    },
    successMessage: () => (silent ? '' : 'Custom search deleted'),
    errorMessage: (error) => `Failed to delete custom search: ${error?.message || 'Unknown error'}`,
    showToast: (msg, type) => {
      if (!silent && msg) app.showToast?.(msg, type);
    },
  });

  if (result.success) {
    await logCustomSearchUsage('delete', { templateId: entityId, name: existing?.name || null });
  }
  return result;
}

export function getCustomSearchById(app, id) {
  const targetId = String(id || '').trim();
  if (!targetId) return null;
  return (app.customSearches || []).find((item) => String(item.id) === targetId) || null;
}
