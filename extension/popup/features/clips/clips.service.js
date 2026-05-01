import { CLIPS_STORAGE_KEYS, CLIPS_SYNC_QUEUE_KEYS } from './clips.constants.js';
import {
  getClipIdKey,
  getSelectedSearchClipIdsInUiOrder,
  queueClipOp,
} from './clips.state.js';

export async function deleteClipsByIdKeys(app, idKeys, {
  includeArchived = true,
  reason = 'delete:unknown',
  closeCategoryModal = false,
  clearSelection = true,
  rerender = true,
} = {}) {
  const ids = Array.isArray(idKeys) ? idKeys.map(k => String(k)).filter(Boolean) : [];
  if (ids.length === 0) return { requested: 0, deleted: 0, missing: 0 };
  const crud = window.PasteCraftCRUD;

  return queueClipOp(app, async () => {
    const idSet = new Set(ids);
    const beforeActive = Array.isArray(app.clips) ? app.clips.length : 0;
    const beforeArchived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips.length : 0;

    const nextClips = (Array.isArray(app.clips) ? app.clips : []).filter(c => !idSet.has(getClipIdKey(c?.id)));
    const nextArchived = includeArchived
      ? (Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : []).filter(c => !idSet.has(getClipIdKey(c?.id)))
      : (Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : []);

    const snapshot = {
      clips: crud.createSnapshot(app.clips),
      searchOnlyClips: crud.createSnapshot(app.searchOnlyClips),
    };

    const rollback = async () => {
      try {
        app.clips = snapshot.clips;
        app.searchOnlyClips = snapshot.searchOnlyClips;
        await crud.retryOperation(async () => {
          await chrome.storage.local.set({
            [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,
            [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,
            [CLIPS_STORAGE_KEYS.UPDATED_AT]: Date.now(),
          });
        });
        if (rerender) {
          app.renderChips();
          app.renderSearchResults();
          app.renderCategories();
        }
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    };

    try {
      const stillExists = [...nextClips, ...nextArchived].some(c => idSet.has(getClipIdKey(c?.id)));
      if (stillExists) {
        throw new Error('Clips still exist after filter operation');
      }

      app.clips = nextClips;
      app.searchOnlyClips = nextArchived;

      await crud.retryOperation(async () => {
        await chrome.storage.local.set({
          [CLIPS_STORAGE_KEYS.ACTIVE]: app.clips,
          [CLIPS_STORAGE_KEYS.ARCHIVED]: app.searchOnlyClips,
          [CLIPS_STORAGE_KEYS.UPDATED_AT]: Date.now(),
        });
      });

      const verification = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.ACTIVE, CLIPS_STORAGE_KEYS.ARCHIVED]);
      const verifiedClips = [
        ...(verification[CLIPS_STORAGE_KEYS.ACTIVE] || []),
        ...(includeArchived ? (verification[CLIPS_STORAGE_KEYS.ARCHIVED] || []) : []),
      ];
      const verifiedDeleted = !verifiedClips.some(c => idSet.has(getClipIdKey(c?.id)));
      if (!verifiedDeleted) {
        throw new Error('Verification failed: clips still exist in storage');
      }

      if (clearSelection) {
        ids.forEach(id => app.selectedChips.delete(id));
        app.selectedSearchClips.clear();
        app.selectedCategoryClips.clear();
      }
      if (closeCategoryModal) app.hideCategoryModal();
      if (rerender) {
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

      Promise.resolve()
        .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ACTIVE, app.clips, pasteCraftSupabase.syncClipsToSupabase))
        .catch(() => {});
      if (includeArchived) {
        Promise.resolve()
          .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ARCHIVED, app.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
          .catch(() => {});
      }

      const afterActive = app.clips.length;
      const afterArchived = app.searchOnlyClips.length;
      const deleted = (beforeActive - afterActive) + (includeArchived ? (beforeArchived - afterArchived) : 0);
      const missing = Math.max(0, idSet.size - deleted);
      return { requested: idSet.size, deleted, missing, reason };
    } catch (error) {
      console.error('❌ Clip deletion failed, rolling back:', error);
      await rollback();
      return { requested: idSet.size, deleted: 0, missing: idSet.size, reason };
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

export async function copyToClipboardFallback(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.log('📋 Clipboard API blocked, using fallback method...');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!success) throw new Error('execCommand copy failed');
    return true;
  } catch (e) {
    document.body.removeChild(textarea);
    throw e;
  }
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

export async function handleCategoryBulkCopy(app) {
  if (!app.selectedCategoryClips || app.selectedCategoryClips.size === 0) return;

  app.updatePreviewFromSelection();
  const previewArea = document.getElementById('previewArea');
  const textToCopy = previewArea ? previewArea.value : '';
  if (!textToCopy) return;

  const copyBtn = document.getElementById('categoryBulkCopyBtn');
  const originalText = copyBtn ? copyBtn.textContent : 'copy';

  try {
    await copyToClipboardFallback(textToCopy);
    if (copyBtn) {
      copyBtn.textContent = 'copied ✓';
      copyBtn.classList.add('success');
    }
    setTimeout(() => {
      if (copyBtn) {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('success');
      }
    }, 1400);
  } catch (error) {
    console.error('❌ Category bulk copy failed:', error);
    if (copyBtn) {
      copyBtn.textContent = 'failed';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1400);
    }
  }
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
  if (orderedIds.length <= 1) return;

  app.updatePreviewFromSearchSelection();
  const previewArea = document.getElementById('previewArea');
  const textToCopy = previewArea ? previewArea.value : '';
  if (!textToCopy) return;

  const copyBtn = document.getElementById('searchBulkCopyBtn');
  const originalText = copyBtn ? copyBtn.textContent : 'copy';

  try {
    await copyToClipboardFallback(textToCopy);
    if (copyBtn) {
      copyBtn.textContent = 'copied ✓';
      copyBtn.classList.add('success');
    }
    setTimeout(() => {
      if (copyBtn) {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('success');
      }
    }, 1400);
  } catch (error) {
    console.error('❌ Search bulk copy failed:', error);
    if (copyBtn) {
      copyBtn.textContent = 'failed';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1400);
    }
  }
}

export async function removeChip(app, clipIdKey) {
  const id = String(clipIdKey || '');
  if (!id) return;
  await deleteClipsByIdKeys(app, [id], {
    includeArchived: false,
    reason: 'delete:removeChip',
    closeCategoryModal: false,
    clearSelection: true,
    rerender: true,
  });
}

export async function copyClipToClipboard(app, text) {
  try {
    await navigator.clipboard.writeText(text);
    app.showToast('Copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}
