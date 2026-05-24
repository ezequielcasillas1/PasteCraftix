import { recordClipDeletionTombstones } from '../../../shared/clip-tombstones.js';
import { CLIPS_STORAGE_KEYS, CLIPS_SYNC_QUEUE_KEYS } from './clips.constants.js';
import {
  getClipIdKey,
  getSelectedSearchClipIdsInUiOrder,
  queueClipOp,
} from './clips.state.js';

function normalizeIdKeys(idKeys) {
  return Array.isArray(idKeys) ? idKeys.map(k => String(k)).filter(Boolean) : [];
}

function getStoredClipArrays(app) {
  return {
    active: Array.isArray(app.clips) ? app.clips : [],
    archived: Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [],
  };
}

function createDeleteState(app, ids, includeArchived, crud) {
  const idSet = new Set(ids);
  const { active, archived } = getStoredClipArrays(app);
  const nextClips = active.filter(c => !idSet.has(getClipIdKey(c?.id)));
  const nextArchived = includeArchived ? archived.filter(c => !idSet.has(getClipIdKey(c?.id))) : archived;

  const removedActiveIds = active
    .filter((c) => idSet.has(getClipIdKey(c?.id)))
    .map((c) => ({
      id: getClipIdKey(c.id),
      text: String(c?.text || '').trim() || '(deleted)',
      category: c?.category || 'Uncategorized',
      timestamp: c?.timestamp || Date.now(),
    }));
  const removedArchivedIds = includeArchived
    ? archived
      .filter((c) => idSet.has(getClipIdKey(c?.id)))
      .map((c) => ({
        id: getClipIdKey(c.id),
        text: String(c?.text || '').trim() || '(deleted)',
        category: c?.category || 'Uncategorized',
        timestamp: c?.timestamp || Date.now(),
      }))
    : [];

  return {
    idSet,
    beforeActive: active.length,
    beforeArchived: archived.length,
    removedActiveIds,
    removedArchivedIds,
    nextClips,
    nextArchived,
    snapshot: {
      clips: crud.createSnapshot(app.clips),
      searchOnlyClips: crud.createSnapshot(app.searchOnlyClips),
    },
  };
}

function containsDeletedClipId(clips, idSet) {
  return clips.some(c => idSet.has(getClipIdKey(c?.id)));
}

async function persistClipArrays(app, crud) {
  await crud.retryOperation(async () => {
    await chrome.storage.local.set({
      [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,
      [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,
      [CLIPS_STORAGE_KEYS.UPDATED_AT]: Date.now(),
    });
  });
}

function renderAfterDeletion(app) {
  app.renderChips();
  app.renderSearchResults();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
  app.updatePreview();
  app.updateQuickCopyButton();
  app.updateCategoryBulkActions();
  app.updateSearchBulkActions();
}

async function rollbackClipDeletion(app, crud, snapshot, rerender) {
  try {
    app.clips = snapshot.clips;
    app.searchOnlyClips = snapshot.searchOnlyClips;
    await persistClipArrays(app, crud);
    if (rerender) {
      app.renderChips();
      app.renderSearchResults();
      app.renderCategories();
    }
  } catch (rollbackError) {
    console.error('❌ Rollback failed:', rollbackError);
  }
}

async function verifyDeletedClipIds(idSet, includeArchived) {
  const verification = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.ACTIVE, CLIPS_STORAGE_KEYS.ARCHIVED]);
  const verifiedClips = [
    ...(verification[CLIPS_STORAGE_KEYS.ACTIVE] || []),
    ...(includeArchived ? (verification[CLIPS_STORAGE_KEYS.ARCHIVED] || []) : []),
  ];
  return !verifiedClips.some(c => idSet.has(getClipIdKey(c?.id)));
}

function clearDeletedClipSelections(app, ids) {
  ids.forEach(id => app.selectedChips.delete(id));
  app.selectedSearchClips.clear();
  app.selectedCategoryClips.clear();
}

function syncDeletedClipState(app, includeArchived, removedActiveIds = [], removedArchivedIds = []) {
  Promise.resolve()
    .then(() => recordClipDeletionTombstones({
      activeIds: removedActiveIds,
      archivedIds: removedArchivedIds,
    }))
    .catch((err) => console.warn('⚠️ Clip tombstone sync failed:', err?.message || err));

  Promise.resolve()
    .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ACTIVE, app.clips, pasteCraftSupabase.syncClipsToSupabase))
    .catch(() => {});

  if (!includeArchived) return;

  Promise.resolve()
    .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ARCHIVED, app.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
    .catch(() => {});
}

function getDeletionResult(state, app, includeArchived, reason) {
  const afterActive = app.clips.length;
  const afterArchived = app.searchOnlyClips.length;
  const deleted = (state.beforeActive - afterActive) + (includeArchived ? (state.beforeArchived - afterArchived) : 0);
  const missing = Math.max(0, state.idSet.size - deleted);
  return { requested: state.idSet.size, deleted, missing, reason };
}

async function applyClipDeletion(app, crud, state, options) {
  const { includeArchived, clearSelection, closeCategoryModal, rerender, ids } = options;

  if (containsDeletedClipId([...state.nextClips, ...state.nextArchived], state.idSet)) {
    throw new Error('Clips still exist after filter operation');
  }

  app.clips = state.nextClips;
  app.searchOnlyClips = state.nextArchived;
  await persistClipArrays(app, crud);

  if (!(await verifyDeletedClipIds(state.idSet, includeArchived))) {
    throw new Error('Verification failed: clips still exist in storage');
  }

  if (clearSelection) clearDeletedClipSelections(app, ids);
  if (closeCategoryModal) app.hideCategoryModal();
  if (rerender) renderAfterDeletion(app);
}

export async function deleteClipsByIdKeys(app, idKeys, {
  includeArchived = true,
  reason = 'delete:unknown',
  closeCategoryModal = false,
  clearSelection = true,
  rerender = true,
} = {}) {
  const ids = normalizeIdKeys(idKeys);
  if (ids.length === 0) return { requested: 0, deleted: 0, missing: 0 };
  const crud = window.PasteCraftCRUD;

  return queueClipOp(app, async () => {
    const state = createDeleteState(app, ids, includeArchived, crud);

    try {
      await applyClipDeletion(app, crud, state, {
        includeArchived,
        clearSelection,
        closeCategoryModal,
        rerender,
        ids,
      });
      syncDeletedClipState(
        app,
        includeArchived,
        state.removedActiveIds,
        state.removedArchivedIds,
      );
      return getDeletionResult(state, app, includeArchived, reason);
    } catch (error) {
      console.error('❌ Clip deletion failed, rolling back:', error);
      await rollbackClipDeletion(app, crud, state.snapshot, rerender);
      return { requested: state.idSet.size, deleted: 0, missing: state.idSet.size, reason };
    }
  });
}

export async function enforceClipLimit(app) {
  if (app.clips.length <= app.maxClips) return;

  console.log(`📦 Clip limit exceeded: ${app.clips.length}/${app.maxClips}. Moving oldest clips to search...`);
  app.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const clipsToArchive = app.clips.slice(app.maxClips);
  app.clips = app.clips.slice(0, app.maxClips);
  app.searchOnlyClips = [...clipsToArchive, ...app.searchOnlyClips];

  await chrome.storage.local.set({
    [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,
    [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,
  });
  if (app._idbReady && app.idb) {
    await app.idb.syncEntityFromLocalStorage(CLIPS_STORAGE_KEYS.ACTIVE, app.clips);
  }

  console.log(`✅ Archived ${clipsToArchive.length} clips to search. Active: ${app.clips.length}, Archived: ${app.searchOnlyClips.length}`);
}

function copyViaBackground(text) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.id) {
      reject(new Error('Extension context invalidated'));
      return;
    }
    chrome.runtime.sendMessage(
      { action: 'pcCopyText', text: String(text || '') },
      (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (resp?.success) {
          resolve(true);
          return;
        }
        reject(new Error(resp?.error || 'Copy failed'));
      },
    );
  });
}

export async function copyToClipboardFallback(text) {
  const value = String(text || '');

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (success) return true;
  } catch (e) {
    if (textarea.parentNode) document.body.removeChild(textarea);
  }

  if (chrome?.runtime?.id) {
    return copyViaBackground(value);
  }

  await navigator.clipboard.writeText(value);
  return true;
}

export async function copyToClipboard(app) {
  const previewArea = document.getElementById('previewArea');
  const copyBtn = document.getElementById('copyBtn');
  if (!previewArea.value) return;

  try {
    await copyToClipboardFallback(previewArea.value);
    copyBtn.textContent = 'Copied! ✓';
    copyBtn.classList.add('success');
    if (app.selectedChips.size >= 5) app.showConfetti();
    setTimeout(() => {
      copyBtn.textContent = 'Copy Crafted Output';
      copyBtn.classList.remove('success');
    }, 2000);
  } catch (error) {
    console.error('Copy failed:', error);
    copyBtn.textContent = 'Copy Failed';
    setTimeout(() => {
      copyBtn.textContent = 'Copy Crafted Output';
    }, 2000);
  }
}

export async function handleQuickCopy(app) {
  const quickCopyBtn = document.getElementById('quickCopyBtn');
  if (app.selectedChips.size === 0) return;

  app.updatePreview();
  const previewArea = document.getElementById('previewArea');
  const textToCopy = previewArea ? String(previewArea.value || '') : '';
  if (!textToCopy) {
    app.selectedChips.clear();
    app.updateQuickCopyButton();
    return;
  }

  try {
    await copyToClipboardFallback(textToCopy);
    console.log('✅ Quick Copy - Successfully copied to clipboard!');
    const originalHTML = quickCopyBtn.innerHTML;
    quickCopyBtn.innerHTML = `
      <span class="btn-icon">✓</span>
      <span class="btn-text">Copied!</span>
    `;
    quickCopyBtn.classList.add('success');
    if (app.selectedChips.size >= 5) app.showConfetti();
    setTimeout(() => {
      quickCopyBtn.innerHTML = originalHTML;
      quickCopyBtn.classList.remove('success');
    }, 2000);
  } catch (error) {
    console.error('❌ Quick copy failed:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    const originalHTML = quickCopyBtn.innerHTML;
    quickCopyBtn.innerHTML = `
      <span class="btn-icon">✗</span>
      <span class="btn-text">Failed</span>
    `;
    setTimeout(() => {
      quickCopyBtn.innerHTML = originalHTML;
    }, 2000);
  }
}

export async function handleQuickDelete(app) {
  const quickDeleteBtn = document.getElementById('quickDeleteBtn');
  if (!quickDeleteBtn) return;

  const ids = Array.from(app.selectedChips || []).map(String).filter(Boolean);
  if (ids.length <= 1) return;
  if (!confirm(`Delete ${ids.length} selected clip${ids.length === 1 ? '' : 's'}?`)) return;

  const result = await deleteClipsByIdKeys(app, ids, {
    includeArchived: false,
    reason: 'delete:handleQuickDelete',
    closeCategoryModal: false,
    clearSelection: true,
    rerender: true,
  });
  app.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
}

function resetBulkCopyButton(copyBtn, originalText) {
  if (!copyBtn) return;
  copyBtn.textContent = originalText;
  copyBtn.classList.remove('success');
}

function showBulkCopySuccess(copyBtn, originalText) {
  if (copyBtn) {
    copyBtn.textContent = 'copied ✓';
    copyBtn.classList.add('success');
  }
  setTimeout(() => resetBulkCopyButton(copyBtn, originalText), 1400);
}

function showBulkCopyFailure(copyBtn, originalText) {
  if (!copyBtn) return;
  copyBtn.textContent = 'failed';
  setTimeout(() => resetBulkCopyButton(copyBtn, originalText), 1400);
}

async function handleBulkCopy(app, {
  hasSelection,
  updatePreview,
  buttonId,
  errorLabel,
}) {
  if (!hasSelection()) return;

  updatePreview();
  const previewArea = document.getElementById('previewArea');
  const textToCopy = previewArea ? previewArea.value : '';
  if (!textToCopy) return;

  const copyBtn = document.getElementById(buttonId);
  const originalText = copyBtn ? copyBtn.textContent : 'copy';

  try {
    await copyToClipboardFallback(textToCopy);
    showBulkCopySuccess(copyBtn, originalText);
  } catch (error) {
    console.error(`❌ ${errorLabel} bulk copy failed:`, error);
    showBulkCopyFailure(copyBtn, originalText);
  }
}

export async function handleCategoryBulkCopy(app) {
  await handleBulkCopy(app, {
    hasSelection: () => Boolean(app.selectedCategoryClips?.size),
    updatePreview: () => app.updatePreviewFromSelection(),
    buttonId: 'categoryBulkCopyBtn',
    errorLabel: 'Category',
  });
}

export async function handleCategoryBulkDelete(app) {
  const count = app.selectedCategoryClips ? app.selectedCategoryClips.size : 0;
  if (count === 0) return;
  if (!confirm(`Delete ${count} selected clip${count === 1 ? '' : 's'}?`)) return;

  const ids = Array.from(app.selectedCategoryClips || []).map(id => getClipIdKey(id));
  const result = await deleteClipsByIdKeys(app, ids, {
    includeArchived: true,
    reason: 'delete:handleCategoryBulkDelete',
    closeCategoryModal: false,
    clearSelection: true,
    rerender: true,
  });

  const previewArea = document.getElementById('previewArea');
  if (previewArea) previewArea.value = '';
  app.previewIsManual = false;
  app.previewLastAutoValue = '';
  app.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
}

export async function handleSearchBulkCopy(app) {
  const orderedIds = getSelectedSearchClipIdsInUiOrder(app);
  await handleBulkCopy(app, {
    hasSelection: () => orderedIds.length > 1,
    updatePreview: () => app.updatePreviewFromSearchSelection(),
    buttonId: 'searchBulkCopyBtn',
    errorLabel: 'Search',
  });
}

export async function removeChip(app, clipIdKey) {
  const id = String(clipIdKey || '');
  if (!id) return;
  const result = await deleteClipsByIdKeys(app, [id], {
    includeArchived: false,
    reason: 'delete:removeChip',
    closeCategoryModal: false,
    clearSelection: true,
    rerender: true,
  });
  if (result.deleted > 0) {
    app.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`, 'success');
  }
}

export async function copyClipToClipboard(app, text) {
  try {
    await copyToClipboardFallback(text);
    app.showToast('Content copied!');
  } catch (error) {
    console.error('Failed to copy:', error);
    app.showToast('Copy failed');
  }
}
