import { CATEGORIES_DEFAULTS } from './categories.constants.js';
import { createClips, mutateClipCollections } from '../clips/clips.service.js';
import { getClipIdKey } from '../clips/clips.state.js';
import { getIndexedDb } from '../../../bridges/storage/indexeddb.facade.js';

// ── createCategory ─────────────────────────────────────────────────────────

export async function createCategory(app, name, icon, options = {}) {
  const originButtonId = options?.originButtonId || null;
  app.setActionButtonLoading(originButtonId, true, 'Creating...');

  const now = Date.now();
  const category = {
    id: Date.now(),
    name: String(name || '').trim(),
    icon: String(icon || CATEGORIES_DEFAULTS.ICON),
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await window.PasteCraftCRUD.createOperation({
    entity: category,
    stateGetter: () => ({ categories: app.categories }),
    stateSetter: async (newState) => { app.categories = newState.categories; },
    stateKeys: ['categories'],
    validator: (entity, state) => {
      if (!entity.name) return { valid: false, error: 'Category name is required' };
      const dup = Array.isArray(state.categories) &&
        state.categories.some(c => c.name.toLowerCase() === entity.name.toLowerCase());
      return { valid: !dup, error: dup ? 'Category already exists' : null };
    },
    duplicateCheck: (entity, state) =>
      Array.isArray(state.categories) &&
      state.categories.some(c => c.name.toLowerCase() === entity.name.toLowerCase()),
    storageKeys: ['categories'],
    storageWriter: async (data) => {
      await chrome.storage.local.set({ ...data, pc_local_updatedAt: Date.now() });
    },
    addToArray: (items, entity) => [...items, entity],
    verifier: async (entity) => {
      const { categories } = await chrome.storage.local.get(['categories']);
      return Array.isArray(categories) && categories.some(c => c.id === entity.id);
    },
    uiUpdater: () => {
      app.renderCategories();
      app.updateCategoryFilter();
      app.updateManualInputCategories();
      const modal = document.getElementById('categoryModal');
      if (modal && modal.style.display === 'flex') app.populateCategoryOptions();
    },
    backgroundSync: async () => {
      await window.pasteCraftSupabase.syncCategoriesToSupabase(app.categories);
    },
    successMessage: (entity) => (options?.silent ? '' : `✅ Category "${entity.name}" created`),
    errorMessage: (error) => (options?.silent ? '' : `❌ Failed to create category: ${error.message || 'Unknown error'}`),
    showToast: (msg, type) => {
      if (options?.silent || !msg) return;
      app.showToast(msg, type);
    },
  });
  } finally {
    app.setActionButtonLoading(originButtonId, false);
  }
}

// ── editCategory ───────────────────────────────────────────────────────────

export async function editCategory(app, category) {
  if (!category || !category.id) return;
  const newName = prompt('Enter new category name:', category.name);
  if (!newName || !newName.trim()) return;
  const newIcon = prompt('Enter new category icon:', category.icon) || category.icon;
  const trimmedName = newName.trim();
  const oldName = category.name;
  if (trimmedName === oldName && newIcon === category.icon) return;
  const now = Date.now();

  return await window.PasteCraftCRUD.updateOperation({
    entityId: category.id,
    updates: { name: trimmedName, icon: newIcon, updatedAt: now },
    stateGetter: () => ({ categories: app.categories, clips: app.clips }),
    stateSetter: async (newState) => {
      app.categories = newState.categories;
      app.clips = newState.clips;
    },
    stateKeys: ['categories', 'clips'],
    validator: (entity, state) => {
      if (!entity.name) return { valid: false, error: 'Category name is required' };
      const dup = Array.isArray(state.categories) &&
        state.categories.some(c => c.id !== category.id && c.name.toLowerCase() === entity.name.toLowerCase());
      return { valid: !dup, error: dup ? 'Another category already uses that name' : null };
    },
    storageKeys: ['categories', 'clips'],
    storageWriter: async (data) => {
      await chrome.storage.local.set({ ...data, pc_local_updatedAt: Date.now() });
    },
    updateInArray: (items, entityId, updates) =>
      items.map(item => {
        if (item && item.id === entityId && 'icon' in item) return { ...item, ...updates };
        if (item && item.category === oldName) return { ...item, category: updates.name };
        return item;
      }),
    uiUpdater: () => {
      app.renderCategories();
      app.updateCategoryFilter();
      app.updateManualInputCategories();
      app.renderChips();
    },
    backgroundSync: async () => {
      try {
        await window.pasteCraftSupabase.syncCategoriesToSupabase(app.categories);
        await window.pasteCraftSupabase.syncClipsToSupabase(app.clips);
      } catch (err) {
        console.error('⚠️ Failed to sync category edit:', err);
      }
    },
    successMessage: (entity) => `✅ Category renamed to "${entity.name}"`,
    errorMessage: (error) => `❌ Failed to edit category: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => app.showToast(msg, type),
  });
}

// ── deleteCategory helpers ─────────────────────────────────────────────────

function buildDeleteCategoryOpts(app, category) {
  return {
    entityId: category.id,
    entityName: category.name,
    entityType: 'category',
    stateGetter: () => ({
      categories: app.categories,
      clips: app.clips,
      searchOnlyClips: app.searchOnlyClips,
    }),
    stateSetter: async (newState) => {
      app.categories = newState.categories;
      app.clips = newState.clips;
      app.searchOnlyClips = newState.searchOnlyClips;
    },
    stateKeys: ['categories', 'clips', 'searchOnlyClips'],
    validator: (entity, state) => {
      const exists = Array.isArray(state.categories) && state.categories.some(c => c.id === entity.id);
      return { valid: exists, error: exists ? null : 'Category not found' };
    },
    idempotencyCheck: (entityId, state) =>
      !Array.isArray(state.categories) || !state.categories.some(c => c.id === entityId),
    storageKeys: ['categories', 'clips', 'searchOnlyClips'],
    storageWriter: async (data) => { await chrome.storage.local.set(data); },
    idbStoreName: 'categories',
    tombstoneStorageKey: 'pc_deleted_categories',
    deleteFromArray: (items, entityId) => items.filter(item => item.id !== entityId),
    updateRelatedEntities: (state, entity) => {
      state.clips.forEach(c => { if (c.category === entity.name) c.category = CATEGORIES_DEFAULTS.UNCATEGORIZED; });
      state.searchOnlyClips.forEach(c => { if (c.category === entity.name) c.category = CATEGORIES_DEFAULTS.UNCATEGORIZED; });
    },
    verifier: async (entityId) => {
      const { categories } = await chrome.storage.local.get(['categories']);
      const inChrome = Array.isArray(categories) && categories.some(c => c.id === entityId);
      if (inChrome) return false;
      try {
        const idb = getIndexedDb();
        if (idb) {
          const idbCats = await idb.getAll('categories');
          if (Array.isArray(idbCats) && idbCats.some(c => String(c?.id) === String(entityId))) return false;
        }
      } catch (_) {}
      return true;
    },
    uiUpdater: () => {
      app.renderCategories();
      app.updateCategoryFilter();
      app.updateManualInputCategories();
      app.renderChips();
    },
    backgroundSync: async (entity, deletedAt) => {
      try { await window.pasteCraftSupabase.deleteCategoryFromSupabase(String(category?.id ?? '')); } catch (_) {}
      await window.pasteCraftSupabase.syncWithQueue('syncDeletedCategories', [{
        ...category, deletedAt, updatedAt: deletedAt,
      }], window.pasteCraftSupabase.syncDeletedCategoriesToSupabase);
      await window.pasteCraftSupabase.syncCategoriesToSupabase(app.categories);
      await window.pasteCraftSupabase.syncClipsToSupabase(app.clips);
    },
    successMessage: (entity) => `✅ Category "${entity.name}" deleted`,
    errorMessage: (error) => `❌ Failed to delete category: ${error.message || 'Unknown error'}`,
    showToast: (msg, type) => app.showToast(msg, type),
  };
}

export async function deleteCategory(app, category) {
  if (!category || !category.id || !category.name) {
    app.showToast('❌ Invalid category - cannot delete', 'error');
    return;
  }
  const exists = Array.isArray(app.categories) && app.categories.some(c => c.id === category.id);
  if (!exists) {
    app.showToast('✅ Category already deleted', 'success');
    return;
  }
  const ok = confirm(`Delete category "${category.name}"? Clips will be moved to "Uncategorized".`);
  if (!ok) return;

  return await window.PasteCraftCRUD.deleteOperation(buildDeleteCategoryOpts(app, category));
}

// ── saveTextWithCategory helpers ───────────────────────────────────────────

function checkBulkCapacity(app, ids, targetCategory) {
  if (targetCategory === CATEGORIES_DEFAULTS.UNCATEGORIZED) return true;
  const allClips = [...app.clips, ...app.searchOnlyClips];
  const existing = allClips.filter(c => c.category === targetCategory && !ids.includes(getClipIdKey(c?.id))).length;
  return existing + ids.length <= CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY;
}

function bulkReassignClips(app, ids, targetCategory, updatedAt) {
  const changedActiveClips = [];
  const changedArchivedClips = [];
  let moved = 0;

  ids.forEach(idKey => {
    const ai = app.clips.findIndex(c => getClipIdKey(c?.id) === idKey);
    if (ai >= 0) {
      app.clips[ai] = { ...app.clips[ai], category: targetCategory, updatedAt };
      changedActiveClips.push(window.PasteCraftCRUD.createSnapshot(app.clips[ai]));
      moved += 1;
      return;
    }
    const ri = app.searchOnlyClips.findIndex(c => getClipIdKey(c?.id) === idKey);
    if (ri >= 0) {
      app.searchOnlyClips[ri] = { ...app.searchOnlyClips[ri], category: targetCategory, updatedAt };
      changedArchivedClips.push(window.PasteCraftCRUD.createSnapshot(app.searchOnlyClips[ri]));
      moved += 1;
    }
  });

  return { changedActiveClips, changedArchivedClips, moved };
}

function syncBulkReassignment(changedActiveClips, changedArchivedClips) {
  if (changedActiveClips.length > 0) {
    Promise.resolve()
      .then(() => window.pasteCraftSupabase.syncWithQueue('syncClips', changedActiveClips, window.pasteCraftSupabase.syncClipsToSupabase))
      .catch(err => console.error('Failed to sync bulk category update (active):', err));
  }
  if (changedArchivedClips.length > 0) {
    Promise.resolve()
      .then(() => window.pasteCraftSupabase.syncWithQueue('syncArchivedClips', changedArchivedClips, window.pasteCraftSupabase.syncArchivedClipsToSupabase))
      .catch(err => console.error('Failed to sync bulk category update (archived):', err));
  }
}

async function handleBulkReassignment(app) {
  const targetCategory = app.selectedCategoryForSave;
  const ids = app.pendingBulkClipIds.slice();
  const updatedAt = Date.now();

  if (!checkBulkCapacity(app, ids, targetCategory)) {
    app.showToast(`Category "${targetCategory}" can't fit ${ids.length} more clips (${CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY} max).`);
    return;
  }

  let changedActiveClips = [];
  let changedArchivedClips = [];
  let moved = 0;

  await mutateClipCollections(app, async (state) => {
    const draftApp = {
      ...app,
      clips: Array.isArray(state.clips) ? state.clips : [],
      searchOnlyClips: Array.isArray(state.searchOnlyClips) ? state.searchOnlyClips : [],
    };
    const changed = bulkReassignClips(draftApp, ids, targetCategory, updatedAt);
    state.clips = draftApp.clips;
    state.searchOnlyClips = draftApp.searchOnlyClips;
    changedActiveClips = changed.changedActiveClips;
    changedArchivedClips = changed.changedArchivedClips;
    moved = changed.moved;
  }, {
    verifier: async () => {
      const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
      const pool = [...(verification.clips || []), ...(verification.searchOnlyClips || [])];
      return ids.every((id) => {
        const clip = pool.find((item) => getClipIdKey(item?.id) === id);
        return clip && clip.category === targetCategory;
      });
    },
    backgroundSync: async () => {
      syncBulkReassignment(changedActiveClips, changedArchivedClips);
    },
    uiUpdater: () => {
      app.selectedChips.clear();
      app.updateQuickCopyButton();
      app.renderChips();
      app.renderSearchResults();
      app.renderCategories();
      app.updateCategoryFilter();
      app.hideCategoryModal();
    },
    errorMessage: 'Failed to move clips',
    showToast: (msg, type) => app.showToast(msg, type),
  });

  app.showToast(`Moved ${moved} clip${moved === 1 ? '' : 's'} to ${targetCategory}`);
}

function checkSingleReassignCapacity(app, currentClip, targetCategory) {
  if (targetCategory === CATEGORIES_DEFAULTS.UNCATEGORIZED) return true;
  if (currentClip.category === targetCategory) return true;
  const allClips = [...app.clips, ...app.searchOnlyClips];
  const inTarget = allClips.filter(c => c.category === targetCategory && c.id !== currentClip.id);
  return inTarget.length < CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY;
}

function reassignSingleClip(app, idKey, updatedAt) {
  let changedActiveClip = null;
  let changedArchivedClip = null;
  const ai = app.clips.findIndex(c => getClipIdKey(c?.id) === idKey);
  if (ai >= 0) {
    app.clips[ai] = { ...app.clips[ai], category: app.selectedCategoryForSave, updatedAt };
    changedActiveClip = window.PasteCraftCRUD.createSnapshot(app.clips[ai]);
  } else {
    const ri = app.searchOnlyClips.findIndex(c => getClipIdKey(c?.id) === idKey);
    if (ri >= 0) {
      app.searchOnlyClips[ri] = { ...app.searchOnlyClips[ri], category: app.selectedCategoryForSave, updatedAt };
      changedArchivedClip = window.PasteCraftCRUD.createSnapshot(app.searchOnlyClips[ri]);
    }
  }
  return { changedActiveClip, changedArchivedClip };
}

async function handleExistingClipReassignment(app) {
  const idKey = String(app.pendingClipId || '');
  const currentClip =
    app.clips.find(c => getClipIdKey(c?.id) === idKey) ||
    app.searchOnlyClips.find(c => getClipIdKey(c?.id) === idKey);
  if (!currentClip) {
    app.showToast('Clip not found', 'error');
    return;
  }

  if (!checkSingleReassignCapacity(app, currentClip, app.selectedCategoryForSave)) {
    app.showToast(`Category "${app.selectedCategoryForSave}" is full (${CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY} clips max). Remove some clips first.`);
    return;
  }

  const updatedAt = Date.now();
  let changedActiveClip = null;
  let changedArchivedClip = null;
  await mutateClipCollections(app, async (state) => {
    const draftApp = {
      ...app,
      clips: Array.isArray(state.clips) ? state.clips : [],
      searchOnlyClips: Array.isArray(state.searchOnlyClips) ? state.searchOnlyClips : [],
      selectedCategoryForSave: app.selectedCategoryForSave,
    };
    const changed = reassignSingleClip(draftApp, idKey, updatedAt);
    state.clips = draftApp.clips;
    state.searchOnlyClips = draftApp.searchOnlyClips;
    changedActiveClip = changed.changedActiveClip;
    changedArchivedClip = changed.changedArchivedClip;
  }, {
    verifier: async () => {
      const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
      const pool = [...(verification.clips || []), ...(verification.searchOnlyClips || [])];
      const clip = pool.find((item) => getClipIdKey(item?.id) === idKey);
      return !!clip && clip.category === app.selectedCategoryForSave;
    },
    backgroundSync: async () => {
      try {
        if (changedActiveClip) await window.pasteCraftSupabase.syncWithQueue('syncClips', [changedActiveClip], window.pasteCraftSupabase.syncClipsToSupabase);
        if (changedArchivedClip) await window.pasteCraftSupabase.syncWithQueue('syncArchivedClips', [changedArchivedClip], window.pasteCraftSupabase.syncArchivedClipsToSupabase);
      } catch (err) {
        console.error('⚠️ Failed to sync category update:', err);
      }
    },
    uiUpdater: () => {
      app.renderChips();
      app.renderSearchResults();
      app.renderCategories();
      app.updateCategoryFilter();
    },
    errorMessage: 'Failed to move clip',
    showToast: (msg, type) => app.showToast(msg, type),
  });

  app.showToast(`Moved to ${app.selectedCategoryForSave}!`);
}

async function handleNewClipSave(app) {
  const targetCategory = app.selectedCategoryForSave;
  if (targetCategory !== CATEGORIES_DEFAULTS.UNCATEGORIZED) {
    const allClips = [...app.clips, ...app.searchOnlyClips];
    if (allClips.filter(c => c.category === targetCategory).length >= CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY) {
      app.showToast(`Category "${targetCategory}" is full (${CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY} clips max). Remove some clips first.`);
      return;
    }
  }

  const now = Date.now();
  const newClip = {
    id: now + Math.random(),
    text: app.pendingText,
    category: targetCategory,
    timestamp: now,
    updatedAt: now,
  };

  const result = await createClips(app, [newClip], {
    successMessage: `Saved to ${targetCategory}!`,
    autoShowSavedClip: true,
  });

  if (!result.success) {
    app.showToast('Failed to save clip', 'error');
  }
}

export async function saveTextWithCategory(app) {
  const hasBulk = Array.isArray(app.pendingBulkClipIds) && app.pendingBulkClipIds.length > 0;
  const hasReassign = app.pendingClipId != null && app.pendingClipId !== '';
  const hasNewClip = typeof app.pendingText === 'string' && app.pendingText.length > 0;

  if (hasBulk) {
    try {
      await handleBulkReassignment(app);
    } catch (err) {
      console.error('[saveTextWithCategory] bulk reassignment failed:', err);
      app.showToast(err?.message || 'Failed to move clips', 'error');
    }
    return;
  }

  if (!hasReassign && !hasNewClip) {
    app.showToast('Nothing to save to that category', 'error');
    return;
  }

  try {
    if (hasReassign) {
      await handleExistingClipReassignment(app);
    } else {
      await handleNewClipSave(app);
    }
    app.hideCategoryModal();
  } catch (err) {
    console.error('[saveTextWithCategory] failed:', err);
    app.showToast(err?.message || 'Failed to save to category', 'error');
  }
}

// ── showCreateCategoryFromModal ────────────────────────────────────────────

export async function showCreateCategoryFromModal(app) {
  const name = prompt('Enter category name:');
  if (!name || !name.trim()) return;

  const iconInput = prompt('Enter category icon (emoji):');
  if (iconInput === null) return;

  const icon = iconInput.trim() || CATEGORIES_DEFAULTS.ICON;
  await app.createCategory(name.trim(), icon, { originButtonId: 'createNewCategory' });
  app.populateCategoryOptions();
}

export async function handleClipDelete(app) {
  if (!app.pendingClipId) return;

  if (confirm('Delete this clip permanently?')) {
    const result = await app.deleteClipsByIdKeys([app.pendingClipId], {
      includeArchived: true,
      reason: 'delete:handleClipDelete',
      closeCategoryModal: true,
      clearSelection: true,
      rerender: true,
    });
    app.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
  }
}
