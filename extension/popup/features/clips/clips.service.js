import { CLIPS_STORAGE_KEYS, CLIPS_SYNC_QUEUE_KEYS } from './clips.constants.js';
import {
  getClipIdKey,
  getSelectedSearchClipIdsInUiOrder,
  queueClipOp,
} from './clips.state.js';

function normalizeIdKeys(idKeys) {
  return Array.isArray(idKeys) ? idKeys.map(k => String(k)).filter(Boolean) : [];
}

function renderAfterClipMutation(app) {
  app.renderChips();
  app.renderSearchResults();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
  app.updatePreview();
  app.updateQuickCopyButton();
  app.updateCategoryBulkActions();
  app.updateSearchBulkActions();
  app.maybeRefreshRefactorizationPanel?.();
}

function buildLimitedClipState(activeClips, archivedClips, maxClips) {
  const sortedActive = [...(Array.isArray(activeClips) ? activeClips : [])]
    .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));

  if (sortedActive.length <= maxClips) {
    return {
      clips: sortedActive,
      searchOnlyClips: Array.isArray(archivedClips) ? archivedClips : [],
      archivedFromLimit: [],
    };
  }

  const archivedFromLimit = sortedActive.slice(maxClips);
  return {
    clips: sortedActive.slice(0, maxClips),
    searchOnlyClips: [...archivedFromLimit, ...(Array.isArray(archivedClips) ? archivedClips : [])],
    archivedFromLimit,
  };
}

async function persistClipState(data) {
  await chrome.storage.local.set({
    [CLIPS_STORAGE_KEYS.ACTIVE]: Array.isArray(data?.clips) ? data.clips : [],
    [CLIPS_STORAGE_KEYS.ARCHIVED]: Array.isArray(data?.searchOnlyClips) ? data.searchOnlyClips : [],
    [CLIPS_STORAGE_KEYS.UPDATED_AT]: Date.now(),
  });
  if (typeof window !== 'undefined' && window.pasteCraftIndexedDB?.syncEntityFromLocalStorage) {
    await window.pasteCraftIndexedDB.syncEntityFromLocalStorage(CLIPS_STORAGE_KEYS.ACTIVE, Array.isArray(data?.clips) ? data.clips : []);
  }
}

async function verifyDeletedClipIds(idSet, includeArchived, activeIdSet = idSet) {
  const verification = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.ACTIVE, CLIPS_STORAGE_KEYS.ARCHIVED]);
  const verifiedClips = [
    ...(verification[CLIPS_STORAGE_KEYS.ACTIVE] || []),
    ...(includeArchived ? (verification[CLIPS_STORAGE_KEYS.ARCHIVED] || []) : []),
  ];
  if (verifiedClips.some(c => idSet.has(getClipIdKey(c?.id)))) return false;

  if (activeIdSet?.size && typeof window !== 'undefined' && window.pasteCraftIndexedDB?.getAllPayloads) {
    try {
      const idbClips = await window.pasteCraftIndexedDB.getAllPayloads('clips');
      if (Array.isArray(idbClips) && idbClips.some((clip) => activeIdSet.has(getClipIdKey(clip?.id)))) {
        return false;
      }
    } catch (_) {}
  }

  return true;
}

async function verifyCreatedClipIds(idSet) {
  const verification = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.ACTIVE, CLIPS_STORAGE_KEYS.ARCHIVED]);
  const verifiedClips = [
    ...(verification[CLIPS_STORAGE_KEYS.ACTIVE] || []),
    ...(verification[CLIPS_STORAGE_KEYS.ARCHIVED] || []),
  ];
  return Array.from(idSet).every((id) => verifiedClips.some((clip) => getClipIdKey(clip?.id) === id));
}

function clearDeletedClipSelections(app, ids) {
  ids.forEach(id => app.selectedChips.delete(id));
  app.selectedSearchClips.clear();
  app.selectedCategoryClips.clear();
}

function notifyClipSaved(clips, autoShow = true) {
  if (!Array.isArray(clips) || clips.length === 0) return;
  try {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'clipSaved',
          clip: clips[0],
          autoShow,
        }).catch(() => {});
      });
    });
  } catch (_) {}
}

function syncClipCollections(app) {
  Promise.resolve()
    .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ACTIVE, app.clips, pasteCraftSupabase.syncClipsToSupabase))
    .catch(() => {});

  Promise.resolve()
    .then(() => pasteCraftSupabase.syncWithQueue(CLIPS_SYNC_QUEUE_KEYS.ARCHIVED, app.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
    .catch(() => {});
}

async function writeClipTombstones(entities, deletedAt) {
  const activeDeleted = entities.filter((entity) => entity?.source === 'active');
  const archivedDeleted = entities.filter((entity) => entity?.source === 'archived');

  const append = async (storageKey, items) => {
    if (!items.length) return;
    const existing = await chrome.storage.local.get([storageKey]);
    const prev = Array.isArray(existing?.[storageKey]) ? existing[storageKey] : [];
    const seen = new Set(prev.map((item) => String(item?.id || '')).filter(Boolean));
    const next = items
      .filter((item) => !seen.has(String(item?.id || '')))
      .map((item) => ({ ...item, deletedAt, updatedAt: deletedAt }));
    if (next.length > 0) {
      await chrome.storage.local.set({ [storageKey]: [...prev, ...next] });
    }
  };

  await append(CLIPS_STORAGE_KEYS.DELETED_ACTIVE, activeDeleted);
  await append(CLIPS_STORAGE_KEYS.DELETED_ARCHIVED, archivedDeleted);
}

function resolveDeletedClipEntities(app, ids, includeArchived, deletedAt) {
  const idSet = new Set(ids);
  const active = Array.isArray(app.clips) ? app.clips : [];
  const archived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  const entities = [];

  active.forEach((clip) => {
    if (!idSet.has(getClipIdKey(clip?.id))) return;
    entities.push({
      ...window.PasteCraftCRUD.createSnapshot(clip),
      id: getClipIdKey(clip?.id),
      deletedAt,
      updatedAt: deletedAt,
      source: 'active',
    });
  });

  if (includeArchived) {
    archived.forEach((clip) => {
      if (!idSet.has(getClipIdKey(clip?.id))) return;
      entities.push({
        ...window.PasteCraftCRUD.createSnapshot(clip),
        id: getClipIdKey(clip?.id),
        deletedAt,
        updatedAt: deletedAt,
        source: 'archived',
      });
    });
  }

  return entities;
}

export async function mutateClipCollections(app, mutator, {
  verifier = null,
  backgroundSync = null,
  uiUpdater = null,
  successMessage = '',
  errorMessage = 'Failed to update clips',
  showToast = null,
} = {}) {
  const result = await window.PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      clips: app.clips,
      searchOnlyClips: app.searchOnlyClips,
      currentPage: app.currentPage,
    }),
    stateSetter: async (newState) => {
      app.clips = Array.isArray(newState.clips) ? newState.clips : [];
      app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
      if (typeof newState.currentPage === 'number') app.currentPage = newState.currentPage;
    },
    stateKeys: ['clips', 'searchOnlyClips', 'currentPage'],
    validator: () => ({ valid: true }),
    mutateState: async (state) => mutator(state),
    storageKeys: ['clips', 'searchOnlyClips'],
    buildStorageData: async (state) => ({
      clips: state.clips,
      searchOnlyClips: state.searchOnlyClips,
      pc_local_updatedAt: Date.now(),
    }),
    storageWriter: async (data) => {
      await persistClipState(data);
    },
    verifier,
    uiUpdater: () => {
      if (typeof uiUpdater === 'function') uiUpdater();
    },
    backgroundSync,
    successMessage: () => successMessage,
    errorMessage: (error) => `${errorMessage}: ${error.message || 'Unknown error'}`,
    showToast: showToast
      ? (msg, type) => { if (msg) showToast(msg, type); }
      : null,
  });

  if (!result.success) {
    throw new Error(result.error || errorMessage);
  }
  return result;
}

export async function createClips(app, incomingClips, {
  successMessage = null,
  autoShowSavedClip = true,
} = {}) {
  const clipsToCreate = Array.isArray(incomingClips)
    ? incomingClips.filter((clip) => clip && clip.id != null && String(clip.text || '').trim())
    : [];

  if (clipsToCreate.length === 0) {
    return { success: false, createdCount: 0, archivedCount: 0, error: 'No valid clips to create' };
  }

  const createdIds = new Set(clipsToCreate.map((clip) => getClipIdKey(clip.id)));

  return queueClipOp(app, async () => {
    const result = await window.PasteCraftCRUD.saveOperation({
      stateGetter: () => ({
        clips: app.clips,
        searchOnlyClips: app.searchOnlyClips,
        currentPage: app.currentPage,
      }),
      stateSetter: async (newState) => {
        app.clips = Array.isArray(newState.clips) ? newState.clips : [];
        app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
        app.currentPage = typeof newState.currentPage === 'number' ? newState.currentPage : 0;
      },
      stateKeys: ['clips', 'searchOnlyClips', 'currentPage'],
      validator: () => ({ valid: true }),
      mutateState: async (state) => {
        const merged = buildLimitedClipState(
          [...clipsToCreate, ...(Array.isArray(state.clips) ? state.clips : [])],
          state.searchOnlyClips,
          app.maxClips,
        );
        state.clips = merged.clips;
        state.searchOnlyClips = merged.searchOnlyClips;
        state.currentPage = 0;
        return {
          createdClips: clipsToCreate.map((clip) => window.PasteCraftCRUD.createSnapshot(clip)),
          archivedFromLimit: merged.archivedFromLimit,
        };
      },
      storageKeys: ['clips', 'searchOnlyClips'],
      storageWriter: async (data) => {
        await persistClipState(data);
      },
      verifier: async () => verifyCreatedClipIds(createdIds),
      uiUpdater: () => {
        renderAfterClipMutation(app);
      },
      backgroundSync: async (_meta, state) => {
        syncClipCollections(app);
        notifyClipSaved(clipsToCreate, autoShowSavedClip);
      },
      successMessage: () => successMessage,
      errorMessage: (error) => `Failed to save clips: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => {
        if (msg) app.showToast(msg, type);
      },
    });

    return {
      ...result,
      createdCount: clipsToCreate.length,
      archivedCount: result.archivedFromLimit?.length || 0,
    };
  });
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

  return queueClipOp(app, async () => {
    const beforeEntities = resolveDeletedClipEntities(app, ids, includeArchived, Date.now());
    const activeDeletedIds = new Set(beforeEntities.filter((entity) => entity.source === 'active').map((entity) => String(entity.id)));

    const result = await window.PasteCraftCRUD.deleteManyOperation({
      entityIds: ids,
      entityType: 'clip',
      stateGetter: () => ({
        clips: app.clips,
        searchOnlyClips: app.searchOnlyClips,
      }),
      stateSetter: async (newState) => {
        app.clips = Array.isArray(newState.clips) ? newState.clips : [];
        app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
      },
      stateKeys: ['clips', 'searchOnlyClips'],
      validator: () => {
        const deleted = resolveDeletedClipEntities(app, ids, includeArchived, Date.now());
        return {
          valid: deleted.length > 0,
          error: 'Clip not found',
        };
      },
      idempotencyCheck: (entityIds) => resolveDeletedClipEntities(app, entityIds, includeArchived, Date.now()).length === 0,
      resolveEntities: (entityIds, _state, deletedAt) => resolveDeletedClipEntities(app, entityIds, includeArchived, deletedAt),
      storageKeys: ['clips', 'searchOnlyClips'],
      storageWriter: async (data) => {
        await persistClipState(data);
      },
      deleteFromArray: (items, idSet) => items.filter((clip) => !idSet.has(getClipIdKey(clip?.id))),
      itemIdGetter: (item) => getClipIdKey(item?.id),
      idbStoreName: 'clips',
      idbIdsResolver: () => Array.from(activeDeletedIds),
      writeTombstones: async (entities, deletedAt) => {
        await writeClipTombstones(entities, deletedAt);
      },
      verifier: async (entityIds) => verifyDeletedClipIds(new Set(entityIds), includeArchived, activeDeletedIds),
      uiUpdater: () => {
        if (clearSelection) clearDeletedClipSelections(app, ids);
        if (closeCategoryModal) app.hideCategoryModal();
        if (rerender) renderAfterClipMutation(app);
      },
      backgroundSync: async (entities) => {
        const activeDeleted = entities.filter((entity) => entity.source === 'active');
        const archivedDeleted = entities.filter((entity) => entity.source === 'archived');

        if (app.idb && typeof app.idb.saveDeletedItem === 'function') {
          await Promise.all(activeDeleted.map((clip) => app.idb.saveDeletedItem(clip, 'clips').catch(() => {})));
        }

        if (activeDeleted.length > 0) {
          await pasteCraftSupabase.syncWithQueue('syncDeletedClips', activeDeleted, pasteCraftSupabase.syncDeletedClipsToSupabase);
        }
        if (archivedDeleted.length > 0) {
          await pasteCraftSupabase.syncWithQueue('syncDeletedArchivedClips', archivedDeleted, pasteCraftSupabase.syncDeletedArchivedClipsToSupabase);
        }

        syncClipCollections(app);
      },
      successMessage: () => '',
      errorMessage: (error) => `Failed to delete clips: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => {
        if (msg) app.showToast(msg, type);
      },
    });

    if (!result.success) {
      return { requested: ids.length, deleted: 0, missing: ids.length, reason };
    }

    const deleted = Array.isArray(result.entities) ? result.entities.length : 0;
    const missing = Math.max(0, ids.length - deleted);
    return { requested: ids.length, deleted, missing, reason };
  });
}

export async function enforceClipLimit(app) {
  if (app.clips.length <= app.maxClips) return;

  console.log(`📦 Clip limit exceeded: ${app.clips.length}/${app.maxClips}. Moving oldest clips to search...`);
  let clipsToArchive = [];

  await mutateClipCollections(app, async (state) => {
    const sorted = [...(Array.isArray(state.clips) ? state.clips : [])]
      .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    clipsToArchive = sorted.slice(app.maxClips);
    state.clips = sorted.slice(0, app.maxClips);
    state.searchOnlyClips = [...clipsToArchive, ...(Array.isArray(state.searchOnlyClips) ? state.searchOnlyClips : [])];
  }, {
    verifier: async () => {
      const verification = await chrome.storage.local.get([CLIPS_STORAGE_KEYS.ACTIVE, CLIPS_STORAGE_KEYS.ARCHIVED]);
      const active = Array.isArray(verification[CLIPS_STORAGE_KEYS.ACTIVE]) ? verification[CLIPS_STORAGE_KEYS.ACTIVE] : [];
      return active.length <= app.maxClips;
    },
    errorMessage: 'Failed to enforce clip limit',
  });

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
