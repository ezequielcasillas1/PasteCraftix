import {
  CUSTOM_SEARCH_CLIP_PLACEHOLDER,
  CUSTOM_SEARCH_SITE_PREFIX,
  CUSTOM_SEARCH_URL_INPUT_PLACEHOLDER,
} from './clips.custom-search.constants.js';
import {
  buildGoogleSearchUrl,
  buildQueryFromTemplate,
  createCustomSearch,
  deleteCustomSearch,
  ensureCustomSearchesLoaded,
  logCustomSearchUsage,
  sanitizeCustomSearchName,
  sanitizeCustomSearchQuery,
  sanitizeCustomSearchTemplate,
  updateCustomSearch,
} from './clips.custom-search.service.js';

const MODAL_ID = 'customSearchModal';
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const TLD_RE = /\S+\.[a-z]{2,}\b/i;

function getModalElements() {
  return {
    modal: document.getElementById(MODAL_ID),
    nameInput: document.getElementById('customSearchNameInput'),
    templateInput: document.getElementById('customSearchTemplateInput'),
    previewEl: document.getElementById('customSearchPreview'),
    queryPreviewEl: document.getElementById('customSearchQueryPreview'),
    listEl: document.getElementById('customSearchSavedList'),
    searchNowBtn: document.getElementById('customSearchNowBtn'),
    saveBtn: document.getElementById('customSearchSaveBtn'),
    editingLabel: document.getElementById('customSearchEditingLabel'),
    domainHintEl: document.getElementById('customSearchDomainHint'),
    selHintEl: document.getElementById('customSearchSelHint'),
  };
}

/**
 * Returns the full template value with site: prefix.
 * Strips any manually-typed site: from input before re-prepending to avoid duplication.
 */
function getFullTemplateValue(rawValue) {
  const v = String(rawValue || '').trim();
  if (!v) return '';
  const withoutPrefix = v.startsWith(CUSTOM_SEARCH_SITE_PREFIX) ? v.slice(CUSTOM_SEARCH_SITE_PREFIX.length) : v;
  return `${CUSTOM_SEARCH_SITE_PREFIX}${withoutPrefix}`;
}

/**
 * Strips site: prefix from a stored template for display in the input field.
 */
function stripSitePrefix(template) {
  const t = String(template || '');
  return t.startsWith(CUSTOM_SEARCH_SITE_PREFIX) ? t.slice(CUSTOM_SEARCH_SITE_PREFIX.length) : t;
}

function getClipTextFromContext(app) {
  const ctx = app._customSearchContext;
  if (!ctx) return '';
  const clip = ctx.clip;
  const text = app.getSelectedOrCurrentText?.(clip?.text ?? '', ctx.context) ?? String(clip?.text ?? '');
  return sanitizeCustomSearchQuery(text);
}

function updatePreview(app) {
  const { templateInput, previewEl, queryPreviewEl } = getModalElements();
  if (!previewEl || !templateInput) return;

  previewEl.style.display = 'block';
  if (queryPreviewEl) queryPreviewEl.style.display = 'block';

  let clipText = '';
  try {
    clipText = getClipTextFromContext(app);
  } catch (_) {
    // Fall through with empty clip text so the fallback message always renders
  }

  const fullTemplate = getFullTemplateValue(templateInput.value);
  const query = buildQueryFromTemplate(fullTemplate, clipText);

  // Preview shows clip text for highlight/copy/drag — never the resolved Google query
  previewEl.textContent = clipText || 'No clip text available — open Custom Search from a clip first.';
  if (queryPreviewEl) {
    queryPreviewEl.textContent = query || 'Type a website to see your Google search query.';
  }
}

function updateDomainHint(app) {
  const { templateInput, domainHintEl } = getModalElements();
  if (!domainHintEl || !templateInput) return;
  const val = templateInput.value.trim();
  if (val && TLD_RE.test(val)) {
    domainHintEl.textContent =
      'Domain ready — optionally highlight text in Select from clip, then click anywhere to add it.';
    domainHintEl.style.display = 'block';
  } else {
    domainHintEl.style.display = 'none';
  }
}

function renderSavedList(app) {
  const { listEl } = getModalElements();
  if (!listEl) return;

  const items = Array.isArray(app.customSearches) ? app.customSearches : [];
  if (!items.length) {
    listEl.innerHTML = '<p class="custom-search-empty" role="status">No saved searches yet.</p>';
    return;
  }

  listEl.innerHTML = items.map((item) => `
    <div class="custom-search-saved-item" data-id="${item.id}">
      <div class="custom-search-saved-meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(formatTemplateForDisplay(item.template))}</span>
      </div>
      <div class="custom-search-saved-actions">
        <button type="button" class="btn-secondary custom-search-edit-btn" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name)}">Edit</button>
        <button type="button" class="btn-secondary custom-search-delete-btn" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Hide legacy {clip} token in saved-search list display only. */
function formatTemplateForDisplay(template) {
  return String(template || '')
    .split(CUSTOM_SEARCH_CLIP_PLACEHOLDER)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function resetForm(app) {
  const { nameInput, templateInput, editingLabel, saveBtn, domainHintEl, selHintEl } = getModalElements();
  app._customSearchEditingId = null;
  app._customSearchPreviewSel = null;
  if (nameInput) nameInput.value = '';
  if (templateInput) templateInput.value = '';
  if (editingLabel) editingLabel.textContent = '';
  if (saveBtn) saveBtn.textContent = 'Save search';
  if (domainHintEl) domainHintEl.style.display = 'none';
  if (selHintEl) selHintEl.style.display = 'none';
  updatePreview(app);
}

function fillFormForEdit(app, item) {
  const { nameInput, templateInput, editingLabel, saveBtn } = getModalElements();
  app._customSearchEditingId = item?.id || null;
  app._customSearchPreviewSel = null;
  if (nameInput) nameInput.value = item?.name || '';
  if (templateInput) {
    // Strip site: prefix — displayed visually by the .url-prefix span
    templateInput.value = stripSitePrefix(item?.template || '');
  }
  if (editingLabel) editingLabel.textContent = item?.name ? `Editing: ${item.name}` : '';
  if (saveBtn) saveBtn.textContent = 'Update search';
  updatePreview(app);
  updateDomainHint(app);
  nameInput?.focus();
}

function trapFocus(modal) {
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideModalFromApp(modal._pcApp);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  modal._pcFocusTrap = handleKeyDown;
  document.addEventListener('keydown', handleKeyDown, true);
}

function releaseFocusTrap(modal) {
  if (modal?._pcFocusTrap) {
    document.removeEventListener('keydown', modal._pcFocusTrap, true);
    modal._pcFocusTrap = null;
  }
}

function hideModalFromApp(app) {
  const { modal } = getModalElements();
  if (!modal) return;
  modal.style.display = 'none';
  releaseFocusTrap(modal);
  app._customSearchContext = null;
  app._customSearchEditingId = null;
  app._customSearchPreviewSel = null;
  modal._pcApp = null;
}

export function hideModal(app) {
  hideModalFromApp(app);
}

export async function showModal(app, { clip = null, context = 'clips', editId = null } = {}) {
  const { modal, nameInput, templateInput } = getModalElements();
  if (!modal) return;

  app._customSearchContext = clip ? { clip, context } : null;
  await ensureCustomSearchesLoaded(app);
  renderSavedList(app);

  if (editId) {
    const item = (app.customSearches || []).find((entry) => String(entry.id) === String(editId));
    if (item) fillFormForEdit(app, item);
    else resetForm(app);
  } else {
    resetForm(app);
    if (templateInput) templateInput.placeholder = CUSTOM_SEARCH_URL_INPUT_PLACEHOLDER;
  }

  modal.style.display = 'flex';
  modal._pcApp = app;
  trapFocus(modal);
  (nameInput || templateInput)?.focus();
  updatePreview(app);
}

async function runSearch(app, { templateId = null, template = null, name = null } = {}) {
  const clipText = getClipTextFromContext(app);
  const query = buildQueryFromTemplate(template, clipText);
  if (!query) {
    app.showToast?.('Enter a search query', 'error');
    return false;
  }

  const url = buildGoogleSearchUrl(query);
  if (!url) {
    app.showToast?.('Invalid search query', 'error');
    return false;
  }

  await logCustomSearchUsage('search', { templateId, name });
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (tabId != null) {
        chrome.tabs.update(tabId, { url }, () => {
          if (chrome.runtime.lastError) window.open(url, '_blank', 'noopener,noreferrer');
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  } catch (error) {
    console.error('[custom-search] Failed to navigate active tab:', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}

async function handleSave(app) {
  const { nameInput, templateInput } = getModalElements();
  const name = sanitizeCustomSearchName(nameInput?.value);
  const template = sanitizeCustomSearchTemplate(getFullTemplateValue(templateInput?.value || ''));
  const editingId = app._customSearchEditingId;

  const result = editingId
    ? await updateCustomSearch(app, editingId, { name, template })
    : await createCustomSearch(app, { name, template });

  if (!result.success) return;
  renderSavedList(app);
  resetForm(app);
}

async function handleSearchNow(app) {
  const { templateInput } = getModalElements();
  const template = sanitizeCustomSearchTemplate(getFullTemplateValue(templateInput?.value || ''));
  const editingId = app._customSearchEditingId;
  const existing = editingId
    ? (app.customSearches || []).find((item) => String(item.id) === String(editingId))
    : null;
  const opened = await runSearch(app, {
    templateId: existing?.id || null,
    template,
    name: existing?.name || null,
  });
  if (opened) hideModal(app);
}

function insertPreviewSelection(app) {
  const { templateInput, selHintEl } = getModalElements();
  if (!app._customSearchPreviewSel || !templateInput) return;
  const cur = templateInput.value;
  const sep = cur && !cur.endsWith(' ') ? ' ' : '';
  templateInput.value = cur + sep + app._customSearchPreviewSel;
  app._customSearchPreviewSel = null;
  if (selHintEl) selHintEl.style.display = 'none';
  updatePreview(app);
  updateDomainHint(app);
  templateInput.focus();
}

export function registerCustomSearchModalEvents(app) {
  if (app._customSearchModalEventsAttached) return;

  const { modal, nameInput, templateInput, searchNowBtn, saveBtn, listEl, previewEl, selHintEl } =
    getModalElements();
  if (!modal) return;

  document.getElementById('closeCustomSearchModal')?.addEventListener('click', () => hideModal(app));
  document.getElementById('cancelCustomSearchModal')?.addEventListener('click', () => hideModal(app));
  document.getElementById('customSearchForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  modal.addEventListener('click', (event) => {
    // Backdrop → close modal
    if (event.target?.id === MODAL_ID) {
      hideModal(app);
      return;
    }
    // Drag-to-insert: insert stored preview selection on any non-button, non-preview click
    if (
      app._customSearchPreviewSel &&
      !event.target?.closest('button') &&
      !event.target?.closest('#customSearchPreview')
    ) {
      insertPreviewSelection(app);
    }
  });

  nameInput?.addEventListener('input', () => updatePreview(app));

  templateInput?.addEventListener('input', () => {
    // Strip any manually-typed site: prefix since it is shown visually
    if (templateInput.value.toLowerCase().startsWith(CUSTOM_SEARCH_SITE_PREFIX)) {
      const cursor = templateInput.selectionStart;
      templateInput.value = templateInput.value.slice(CUSTOM_SEARCH_SITE_PREFIX.length);
      const restored = Math.max(0, cursor - CUSTOM_SEARCH_SITE_PREFIX.length);
      templateInput.setSelectionRange(restored, restored);
    }
    updatePreview(app);
    updateDomainHint(app);
  });

  // Preview selection capture for drag-to-insert
  previewEl?.addEventListener('mouseup', () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel) {
      app._customSearchPreviewSel = sel;
      if (selHintEl) {
        const label = sel.length > 50 ? `${sel.slice(0, 50)}\u2026` : sel;
        selHintEl.textContent = `Selected: \u201c${label}\u201d \u2014 click anywhere to add it`;
        selHintEl.style.display = 'block';
      }
    } else {
      app._customSearchPreviewSel = null;
      if (selHintEl) selHintEl.style.display = 'none';
    }
  });

  searchNowBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    await handleSearchNow(app);
  });

  saveBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    await handleSave(app);
  });

  listEl?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.custom-search-edit-btn');
    if (editBtn) {
      event.preventDefault();
      const item = (app.customSearches || []).find((entry) => String(entry.id) === String(editBtn.dataset.id));
      if (item) fillFormForEdit(app, item);
      return;
    }

    const deleteBtn = event.target.closest('.custom-search-delete-btn');
    if (deleteBtn) {
      event.preventDefault();
      const id = deleteBtn.dataset.id;
      const item = (app.customSearches || []).find((entry) => String(entry.id) === String(id));
      if (!item) return;
      const confirmed = confirm(`Delete saved search "${item.name}"?`);
      if (!confirmed) return;
      const result = await deleteCustomSearch(app, id);
      if (!result.success) return;
      if (String(app._customSearchEditingId) === String(id)) resetForm(app);
      renderSavedList(app);
    }
  });

  app._customSearchModalEventsAttached = true;
}
