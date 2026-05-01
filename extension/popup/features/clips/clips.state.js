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

export function getSelectedClipIdsInUiOrder(app) {
  if (!app.selectedChips || app.selectedChips.size === 0) return [];

  const selected = new Set(Array.from(app.selectedChips).map(String));
  const ordered = [];

  const domChips = document.querySelectorAll('#chipContainer .chip');
  if (domChips && domChips.length > 0) {
    domChips.forEach(el => {
      const id = el?.dataset?.clipId;
      if (id && selected.has(id)) ordered.push(id);
    });
  }

  if (ordered.length === 0) {
    app.clips.forEach(c => {
      const id = getClipIdKey(c?.id);
      if (selected.has(id)) ordered.push(id);
    });
  }

  return ordered;
}

export function toggleChip(app, clipIdKey, chipElement) {
  const checkbox = chipElement.querySelector('.chip-checkbox');
  if (app.selectedChips.has(clipIdKey)) {
    app.selectedChips.delete(clipIdKey);
    chipElement.classList.remove('selected');
    if (checkbox) checkbox.checked = false;
  } else {
    app.selectedChips.add(clipIdKey);
    chipElement.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  }
  app.syncOptionToggles();
  app.updatePreview();
}

export function toggleSearchClip(app, clipId, itemElement) {
  const checkbox = itemElement.querySelector('.search-checkbox');
  const idKey = getClipIdKey(clipId);
  if (app.selectedSearchClips.has(idKey)) {
    app.selectedSearchClips.delete(idKey);
    itemElement.classList.remove('selected');
    if (checkbox) checkbox.checked = false;
  } else {
    app.selectedSearchClips.add(idKey);
    itemElement.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  }
  app.updatePreviewFromSearchSelection();
  app.updateSearchBulkActions();
}

export function toggleCategoryClip(app, clipId, itemElement) {
  const checkbox = itemElement.querySelector('.category-checkbox');
  const idKey = getClipIdKey(clipId);
  if (app.selectedCategoryClips.has(idKey)) {
    app.selectedCategoryClips.delete(idKey);
    itemElement.classList.remove('selected');
    if (checkbox) checkbox.checked = false;
  } else {
    app.selectedCategoryClips.add(idKey);
    itemElement.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  }
  app.updatePreviewFromSelection();
  app.updateCategoryBulkActions();
}

export function getSelectedClipIdKeys(app) {
  return Array.from(app.selectedChips).map(String).filter(Boolean);
}

export function getSelectedClipObjects(app) {
  const ids = getSelectedClipIdKeys(app);
  return ids
    .map(id => app.clips.find(c => getClipIdKey(c?.id) === id))
    .filter(Boolean);
}

export function getSelectedCategoryClipIdKeys(app) {
  if (!app.selectedCategoryClips) return [];
  return Array.from(app.selectedCategoryClips).map(id => getClipIdKey(id)).filter(Boolean);
}

export function getSelectedCategoryClipObjects(app) {
  const ids = getSelectedCategoryClipIdKeys(app);
  if (ids.length === 0) return [];
  const pool = Array.isArray(app.clips) ? app.clips : [];
  return ids
    .map(id => pool.find(c => getClipIdKey(c?.id) === id))
    .filter(Boolean);
}

export function getSelectedCategoryClipIdsInUiOrder(app) {
  if (!app.selectedCategoryClips || app.selectedCategoryClips.size === 0) return [];

  const selected = app.selectedCategoryClips;
  const ordered = [];
  const domClips = document.querySelectorAll('.category-item.expanded .category-clip');
  if (domClips && domClips.length > 0) {
    domClips.forEach(el => {
      const id = getClipIdKey(el.dataset.clipId);
      if (selected.has(id)) ordered.push(id);
    });
  }

  if (ordered.length === 0) {
    const allClips = [...app.clips, ...app.searchOnlyClips];
    allClips.forEach(c => {
      const id = getClipIdKey(c?.id);
      if (selected.has(id)) ordered.push(id);
    });
  }

  return ordered;
}

export function getSelectedSearchClipIdsInUiOrder(app) {
  if (!app.selectedSearchClips || app.selectedSearchClips.size === 0) return [];

  const selected = app.selectedSearchClips;
  const ordered = [];
  const domItems = document.querySelectorAll('#searchResults .search-result-item');
  if (domItems && domItems.length > 0) {
    domItems.forEach(el => {
      const id = getClipIdKey(el.dataset.clipId);
      if (selected.has(id)) ordered.push(id);
    });
  }

  if (ordered.length === 0) {
    const allClips = [...app.clips, ...app.searchOnlyClips];
    allClips.forEach(c => {
      const id = getClipIdKey(c?.id);
      if (selected.has(id)) ordered.push(id);
    });
  }

  return ordered;
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
  console.log('🔄 Updating preview from selection:', app.selectedCategoryClips?.size || 0, 'clips selected');

  if (!app.selectedCategoryClips || app.selectedCategoryClips.size === 0) {
    if (!app.previewIsManual && app.previewLastAutoValue) {
      document.getElementById('previewArea').value = '';
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
  document.getElementById('previewArea').value = formattedText;
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
