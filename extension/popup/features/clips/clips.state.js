export function getClipIdKey(id) {
  return String(id ?? '');
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

  console.log('🔄 Updating preview from selection:', app.selectedCategoryClips?.size || 0, 'clips selected');

  const previewArea = document.getElementById('previewArea');

  if (!app.selectedCategoryClips || app.selectedCategoryClips.size === 0) {
    if (!app.previewIsManual && app.previewLastAutoValue && previewArea) {
      previewArea.value = '';
      app.previewLastAutoValue = '';
    }
    console.log('📄 Preview cleared - no clips selected');
    app.updateCategoryBulkActions();
    return;
  }

  const allClips = [...app.clips, ...app.searchOnlyClips];
  console.log('🔍 All clips available:', allClips.map(c => ({ id: c.id, text: c.text.substring(0, 20) })));
  console.log('🎯 Selected clip IDs:', Array.from(app.selectedCategoryClips));

  const orderedSelectedIds = getSelectedCategoryClipIdsInUiOrder(app);
  const selectedClips = orderedSelectedIds
    .map((clipId) => {
      const found = allClips.find(clip => getClipIdKey(clip.id) === getClipIdKey(clipId));
      console.log(`🔎 Looking for clip ${clipId} (${typeof clipId}), found:`, found ? found.text.substring(0, 20) : 'NOT FOUND');
      return found;
    })
    .filter(Boolean);

  console.log('📋 Found selected clips:', selectedClips.length);
  const formattedText = applyClipTextOptions(app, selectedClips.map(clip => clip.text));
  if (!previewArea) return;
  previewArea.value = formattedText;
  app.previewIsManual = false;
  app.previewLastAutoValue = formattedText;
  console.log('✅ Preview updated with formatted text:', formattedText.substring(0, 50) + '...');
  app.updateCategoryBulkActions();
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
