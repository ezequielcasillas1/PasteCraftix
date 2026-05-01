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
