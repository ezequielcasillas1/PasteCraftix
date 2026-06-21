/** Stable string key for clip IDs — normalizes legacy float ids (Date.now()+Math.random). */
export function getClipIdKey(id) {
  if (id == null || id === '') return '';
  if (typeof id === 'number') {
    if (Number.isInteger(id)) return String(id);
    if (id >= 1e12 && id < 1e16) return _normalizeFloatClipIdKey(id);
    return String(id);
  }
  const raw = String(id).trim();
  if (!raw) return '';
  const num = Number(raw);
  if (raw.includes('.') && Number.isFinite(num) && num >= 1e12 && num < 1e16) {
    return _normalizeFloatClipIdKey(num);
  }
  return raw;
}

function _normalizeFloatClipIdKey(num) {
  const rounded = Math.round(num * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

export function getClipTitle(clip) {
  return window.PCClipTitle ? window.PCClipTitle.getTitle(clip) : String(clip?.title || '').trim();
}

export function getClipFallbackTitle(clip, maxLength = 42) {
  return window.PCClipTitle
    ? window.PCClipTitle.getFallbackTitle(clip, maxLength)
    : String(clip?.text || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function getClipAttachment(clip, addedDate = Date.now()) {
  if (window.PCClipTitle) return window.PCClipTitle.makeAttachment(clip, addedDate);
  return { type: 'clip', id: clip?.id, title: String(clip?.title || ''), text: clip?.text || '', addedDate };
}

export function queueClipOp(app, fn) {
  const run = app._clipOpQueue.then(fn, fn);
  app._clipOpQueue = run.catch(() => {});
  return run;
}

function getClipPool(app, includeArchived = false) {
  const active = Array.isArray(app.clips) ? app.clips : [];
  if (!includeArchived) return active;
  const archived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  return [...active, ...archived];
}

function getSelectedSet(selection) {
  const selected = new Set(Array.from(selection).map(getClipIdKey));
  return selected.size > 0 ? selected : null;
}

function getDomSelectedIds(domSelector, selected) {
  return Array.from(document.querySelectorAll(domSelector))
    .map(el => getClipIdKey(el?.dataset?.clipId))
    .filter(id => id && selected.has(id));
}

function getFallbackSelectedIds(fallbackClips, selected) {
  return fallbackClips
    .map(clip => getClipIdKey(clip?.id))
    .filter(id => id && selected.has(id));
}

function getOrderedSelectedIds(selection, domSelector, fallbackClips) {
  const selected = selection ? getSelectedSet(selection) : null;
  if (!selected) return [];

  const domIds = getDomSelectedIds(domSelector, selected);
  return domIds.length > 0 ? domIds : getFallbackSelectedIds(fallbackClips, selected);
}

function toggleSelection(selection, clipId, itemElement, checkboxSelector) {
  const idKey = getClipIdKey(clipId);
  const isSelected = selection.has(idKey);
  const checkbox = itemElement.querySelector(checkboxSelector);

  if (isSelected) {
    selection.delete(idKey);
    itemElement.classList.remove('selected');
  } else {
    selection.add(idKey);
    itemElement.classList.add('selected');
  }

  if (checkbox) checkbox.checked = !isSelected;
}

function getSelectedClipObjectsByIds(ids, clips) {
  return ids
    .map(id => clips.find(c => getClipIdKey(c?.id) === id))
    .filter(Boolean);
}

export function getSelectedClipIdsInUiOrder(app) {
  return getOrderedSelectedIds(app.selectedChips, '#chipContainer .chip', getClipPool(app));
}

export function toggleChip(app, clipIdKey, chipElement) {
  toggleSelection(app.selectedChips, clipIdKey, chipElement, '.chip-checkbox');
  app.syncOptionToggles();
  app.updatePreview();
}

export function toggleSearchClip(app, clipId, itemElement) {
  toggleSelection(app.selectedSearchClips, clipId, itemElement, '.search-checkbox');
  app.updatePreviewFromSearchSelection();
  app.updateSearchBulkActions();
}

export function toggleCategoryClip(app, clipId, itemElement) {
  toggleSelection(app.selectedCategoryClips, clipId, itemElement, '.category-checkbox');
  app.updatePreviewFromSelection();
  app.updateCategoryBulkActions();
}

export function getSelectedClipIdKeys(app) {
  return Array.from(app.selectedChips).map(String).filter(Boolean);
}

export function getSelectedClipObjects(app) {
  const ids = getSelectedClipIdKeys(app);
  return getSelectedClipObjectsByIds(ids, getClipPool(app));
}

export function getSelectedCategoryClipIdKeys(app) {
  if (!app.selectedCategoryClips) return [];
  return Array.from(app.selectedCategoryClips).map(id => getClipIdKey(id)).filter(Boolean);
}

export function getSelectedCategoryClipObjects(app) {
  const ids = getSelectedCategoryClipIdKeys(app);
  if (ids.length === 0) return [];
  return getSelectedClipObjectsByIds(ids, getClipPool(app));
}

export function getSelectedCategoryClipIdsInUiOrder(app) {
  return getOrderedSelectedIds(
    app.selectedCategoryClips,
    '.category-item.expanded .category-clip',
    getClipPool(app, true),
  );
}

export function getSelectedSearchClipIdsInUiOrder(app) {
  return getOrderedSelectedIds(
    app.selectedSearchClips,
    '#searchResults .search-result-item',
    getClipPool(app, true),
  );
}

export function applyClipTextOptions(app, texts) {
  let processedTexts = [...texts];
  if (app.options.deduplicate) {
    processedTexts = [...new Set(processedTexts)];
  }
  if (app.options.sort) {
    processedTexts.sort();
  }
  if (app.options.uppercase) {
    processedTexts = processedTexts.map(text => text.toUpperCase());
  }
  const delimiters = {
    comma: ', ',
    newline: '\n',
    space: ' ',
    custom: document.getElementById('customDelimiter')?.value || ', ',
  };
  const delimiter = delimiters[app.delimiter] || delimiters.comma;
  return processedTexts.join(delimiter);
}

export function updatePreviewFromSelection(app) {
  if (app.currentTab !== 'categories') return;

  const previewArea = document.getElementById('previewArea');

  if (!app.selectedCategoryClips || app.selectedCategoryClips.size === 0) {
    if (!app.previewIsManual && app.previewLastAutoValue && previewArea) {
      previewArea.value = '';
      app.previewLastAutoValue = '';
    }
    app.updateCategoryBulkActions();
    return;
  }

  const allClips = [...app.clips, ...app.searchOnlyClips];
  const orderedSelectedIds = getSelectedCategoryClipIdsInUiOrder(app);
  const selectedClips = orderedSelectedIds
    .map((clipId) => allClips.find(clip => getClipIdKey(clip.id) === getClipIdKey(clipId)))
    .filter(Boolean);

  const formattedText = applyClipTextOptions(app, selectedClips.map(clip => clip.text));
  if (!previewArea) return;
  previewArea.value = formattedText;
  app.previewIsManual = false;
  app.previewLastAutoValue = formattedText;
  app.updateCategoryBulkActions();
}

export function getSelectedClipsText(app) {
  return getSelectedClipObjects(app).map(c => c.text).join('\n\n');
}

export function getSelectedCategoryClipsText(app) {
  return getSelectedCategoryClipObjects(app).map(c => c.text).join('\n\n');
}

/** Combined selected-clip ids for bulk actions, or single-clip fallback. */
export function getSelectedOrCurrentClipIdKeys(app, clip, context) {
  const currentId = clip ? getClipIdKey(clip.id) : '';

  if (context === 'clips') {
    const keys = getSelectedClipIdKeys(app);
    return keys.length ? keys : (currentId ? [currentId] : []);
  }

  if (context === 'categories') {
    const keys = getSelectedCategoryClipIdKeys(app);
    return keys.length ? keys : (currentId ? [currentId] : []);
  }

  if (context === 'search') {
    const keys = getSelectedSearchClipIdsInUiOrder(app)
      .map((id) => getClipIdKey(id))
      .filter(Boolean);
    return keys.length ? keys : (currentId ? [currentId] : []);
  }

  return currentId ? [currentId] : [];
}

export function getSelectedOrCurrentClipObjects(app, clip, context) {
  const ids = getSelectedOrCurrentClipIdKeys(app, clip, context);
  if (!ids.length) return [];
  return getSelectedClipObjectsByIds(ids, getClipPool(app, true));
}

/** Combined selected-clip text for AI actions, or single-clip fallback. */
export function getSelectedOrCurrentText(app, clipText, context) {
  const fallback = String(clipText || '');

  if (context === 'clips') {
    const keys = getSelectedClipIdKeys(app);
    if (!keys.length) return fallback;
    const text = getSelectedClipsText(app);
    return text || fallback;
  }

  if (context === 'categories') {
    const keys = getSelectedCategoryClipIdKeys(app);
    if (!keys.length) return fallback;
    const text = getSelectedCategoryClipsText(app);
    return text || fallback;
  }

  if (context === 'search') {
    const keys = getSelectedSearchClipIdsInUiOrder(app);
    if (!keys.length) return fallback;
    const allClips = [...(app.clips || []), ...(app.searchOnlyClips || [])];
    const text = keys
      .map((id) => allClips.find((c) => getClipIdKey(c?.id) === getClipIdKey(id))?.text)
      .filter(Boolean)
      .join('\n\n');
    return text || fallback;
  }

  return fallback;
}

export function clearAllSelections(app) {
  app.selectedChips?.clear?.();
  app.selectedCategoryClips?.clear?.();
  app.selectedSearchClips?.clear?.();

  app.updateQuickCopyButton?.();
  app.updateCategoryBulkActions?.();
  app.updateSearchBulkActions?.();

  if (app.currentTab === 'clips') app.renderChips?.();
  else if (app.currentTab === 'categories') app.renderCategories?.();
  else if (app.currentTab === 'search') app.renderSearchResults?.();
}

export function updatePreviewFromSearchSelection(app) {
  if (!app.selectedSearchClips || app.selectedSearchClips.size === 0) return;

  const previewArea = document.getElementById('previewArea');
  if (!previewArea) return;

  const allClips = [...app.clips, ...app.searchOnlyClips];
  const orderedIds = getSelectedSearchClipIdsInUiOrder(app);
  const selectedClips = orderedIds
    .map(id => allClips.find(c => getClipIdKey(c?.id) === getClipIdKey(id)))
    .filter(Boolean);

  if (selectedClips.length === 0) return;

  const formattedText = applyClipTextOptions(app, selectedClips.map(c => c.text));
  previewArea.value = formattedText;
  app.previewIsManual = false;
  app.previewLastAutoValue = formattedText;
}
