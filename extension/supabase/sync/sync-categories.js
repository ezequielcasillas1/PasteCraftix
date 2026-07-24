/** Vertical slice: sync-categories.js */
export const syncCategoriesMixin = {
// CATEGORIES SYNC METHODS
// =====================================================

/**
 * Sync categories to Supabase
 */
async syncCategoriesToSupabase(localCategories) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping category sync');
    return false;
  }

  try {
    const userId = await this.getSyncUserId();
    const deviceId = await this.getDeviceId();
    await this.setUserContext(userId);
    const normalizeName = (name) => String(name || '').trim().toLowerCase();

    let healedLocalCategories = Array.isArray(localCategories) ? localCategories.slice() : [];
    try {
      // Include soft-deleted rows: UNIQUE(user_id, name) still holds them, so local
      // categories with new IDs but the same name must adopt the remote category_id
      // (tombstone guard then skips revive instead of INSERT → 23505).
      const { data: remoteCategoryRows, error: remoteCategoriesError } = await this.client
        .from('categories')
        .select('category_id,name,icon,updated_at,deleted_at,device_id')
        .eq('user_id', userId);
      if (remoteCategoriesError) throw remoteCategoriesError;

      const remoteByName = new Map();
      (Array.isArray(remoteCategoryRows) ? remoteCategoryRows : []).forEach((row) => {
        const key = normalizeName(row?.name);
        if (!key) return;
        const candidate = {
          id: row.category_id,
          name: row.name,
          icon: row.icon,
          updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0,
          deviceId: row.device_id || null,
          deleted: !!row.deleted_at
        };
        const prev = remoteByName.get(key);
        // Prefer active rows; among same deleted-state, keep newest.
        if (!prev) {
          remoteByName.set(key, candidate);
          return;
        }
        if (prev.deleted && !candidate.deleted) {
          remoteByName.set(key, candidate);
          return;
        }
        if (prev.deleted === candidate.deleted && candidate.updatedAt >= prev.updatedAt) {
          remoteByName.set(key, candidate);
        }
      });

      let reconciledCount = 0;
      let reconciledSoftDeletedCount = 0;
      healedLocalCategories = healedLocalCategories.map((cat) => {
        const key = normalizeName(cat?.name);
        const remote = remoteByName.get(key);
        if (!remote) return cat;
        if (String(remote.id) === String(cat?.id)) return cat;
        reconciledCount += 1;
        if (remote.deleted) reconciledSoftDeletedCount += 1;
        return {
          ...cat,
          id: remote.id,
          updatedAt: Math.max(Number.isFinite(cat?.updatedAt) ? cat.updatedAt : 0, Number.isFinite(remote.updatedAt) ? remote.updatedAt : 0),
          ...(remote.deviceId ? { deviceId: remote.deviceId } : {})
        };
      });

      if (reconciledCount > 0) {
        await chrome.storage.local.set({
          categories: healedLocalCategories,
          pc_local_updatedAt: Date.now()
        });
        console.log(`♻️ Reconciled ${reconciledCount} local category id${reconciledCount === 1 ? '' : 's'} from remote name matches (${reconciledSoftDeletedCount} soft-deleted)`);
      }
    } catch (reconcileError) {
      console.warn('⚠️ Category ID reconciliation skipped:', reconcileError?.message || reconcileError);
    }

    const filteredCategories = (healedLocalCategories || []).filter(cat => {
      const originDeviceId = String(cat?.origin_device_id || '').trim();
      return !originDeviceId || originDeviceId === deviceId;
    });

    console.log(`📤 Syncing ${filteredCategories.length} categories to Supabase (skipped ${healedLocalCategories.length - filteredCategories.length} imported)...`);

    const dbCategories = filteredCategories.map(cat => {
      const updatedAtMs = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : Date.now();
      const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : null;
      return {
        user_id: userId,
        category_id: String(cat.id),
        name: cat.name,
        icon: cat.icon || '📁',
        updated_at: new Date(updatedAtMs).toISOString(),
        deleted_at: Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : null,
        device_id: deviceId || null
      };
    });

    if (dbCategories.length === 0) return true;

    // Deduplicate by category_id to avoid "cannot affect row a second time" error
    // Convert IDs to strings for reliable Set comparison
    const seen = new Set();
    const uniqueDbCategories = dbCategories.filter(cat => {
      const idStr = String(cat.category_id || '');
      if (!idStr || idStr === 'undefined' || idStr === 'null' || seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });

    if (uniqueDbCategories.length === 0) {
      console.log('⚠️ No valid categories to sync after filtering');
      return true;
    }

    const uniqueByName = new Map();
    uniqueDbCategories.forEach((cat) => {
      const nameKey = normalizeName(cat?.name);
      if (!nameKey) return;
      const prev = uniqueByName.get(nameKey);
      const catUpdatedAt = Date.parse(cat.updated_at || '') || 0;
      const prevUpdatedAt = Date.parse(prev?.updated_at || '') || 0;
      if (!prev || catUpdatedAt >= prevUpdatedAt) {
        uniqueByName.set(nameKey, cat);
      }
    });
    const dedupedDbCategories = Array.from(uniqueByName.values());

    // TOMBSTONE GUARD: never resurrect a category that another device soft-deleted.
    // Without this, a stale device's UP-sync would upsert deleted_at: null and undo the delete.
    const tombstoned = await this._fetchTombstonedIds('categories', 'category_id');
    const safeDbCategories = dedupedDbCategories.filter(cat => {
      const idStr = String(cat.category_id || '');
      const hasLocalTombstone = cat.deleted_at != null;
      if (tombstoned.has(idStr) && !hasLocalTombstone) {
        // Row is already tombstoned remotely; drop from upsert to preserve deleted_at.
        return false;
      }
      return true;
    });
    if (safeDbCategories.length !== dedupedDbCategories.length) {
      const skipped = dedupedDbCategories.length - safeDbCategories.length;
      console.log(`🛡️ Tombstone guard skipped ${skipped} already-deleted categor${skipped === 1 ? 'y' : 'ies'} from upsert`);
      // Self-heal: record the remote tombstones locally so loadData prunes them.
      await this._mergeTombstonesIntoLocal('pc_deleted_categories', tombstoned);
    }
    if (safeDbCategories.length === 0) {
      console.log('⚠️ All local categories were already tombstoned remotely; nothing to upsert');
      return true;
    }

    const { data, error } = await this.client
      .from('categories')
      .upsert(safeDbCategories, {
        onConflict: 'user_id,category_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;

    console.log(`✅ Synced ${data.length} categories to Supabase`);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync categories to Supabase:', error);
    return false;
  }
},

async syncDeletedCategoriesToSupabase(deletedCategories) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping deleted categories sync');
    return false;
  }

  const items = Array.isArray(deletedCategories) ? deletedCategories : [];
  if (items.length === 0) return true;

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);
    const deviceId = await this.getDeviceId();
    const normalizeName = (name) => String(name || '').trim().toLowerCase();

    const { data: remoteCategoryRows, error: remoteCategoriesError } = await this.client
      .from('categories')
      .select('category_id,name,updated_at,deleted_at')
      .eq('user_id', userId);
    if (remoteCategoriesError) throw remoteCategoriesError;

    const remoteByName = new Map();
    (Array.isArray(remoteCategoryRows) ? remoteCategoryRows : []).forEach((row) => {
      const key = normalizeName(row?.name);
      if (!key) return;
      const prev = remoteByName.get(key);
      const rowUpdatedAt = row?.updated_at ? Date.parse(row.updated_at) : 0;
      const prevUpdatedAt = prev?.updatedAt || 0;
      if (!prev || rowUpdatedAt >= prevUpdatedAt) {
        remoteByName.set(key, {
          id: row.category_id,
          updatedAt: rowUpdatedAt
        });
      }
    });

    const dedupedById = new Map();
    items.forEach((cat) => {
      const nameKey = normalizeName(cat?.name);
      const remote = nameKey ? remoteByName.get(nameKey) : null;
      const resolvedId = remote?.id != null ? String(remote.id) : (cat?.id != null ? String(cat.id) : '');
      if (!resolvedId) return;
      const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : Date.now();
      const prev = dedupedById.get(resolvedId);
      const prevDeletedAt = Number.isFinite(prev?.deletedAt) ? prev.deletedAt : 0;
      if (!prev || deletedAtMs >= prevDeletedAt) {
        dedupedById.set(resolvedId, { ...cat, id: resolvedId, deletedAt: deletedAtMs });
      }
    });

    const dedupedByName = new Map();
    Array.from(dedupedById.values()).forEach((cat) => {
      const key = normalizeName(cat?.name);
      if (!key) return;
      const prev = dedupedByName.get(key);
      const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : 0;
      const prevDeletedAt = Number.isFinite(prev?.deletedAt) ? prev.deletedAt : 0;
      if (!prev || deletedAtMs >= prevDeletedAt) {
        dedupedByName.set(key, cat);
      }
    });

    const dbCategories = Array.from(dedupedByName.values()).map(cat => {
      const updatedAtMs = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : Date.now();
      const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : Date.now();
      return {
        user_id: userId,
        category_id: cat.id,
        name: cat.name || 'Uncategorized',
        icon: cat.icon || '📁',
        updated_at: new Date(updatedAtMs).toISOString(),
        deleted_at: new Date(deletedAtMs).toISOString(),
        device_id: deviceId || null
      };
    });

    const { error } = await this.client
      .from('categories')
      .upsert(dbCategories, {
        onConflict: 'user_id,category_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    await this.insertAuditLogs(dbCategories.map(cat => ({
      user_id: userId,
      entity_type: 'category',
      entity_id: String(cat.category_id),
      action: 'soft_delete',
      data: { name: cat.name, icon: cat.icon },
      device_id: deviceId || null
    })));

    return true;
  } catch (error) {
    console.error('❌ Failed to sync deleted categories to Supabase:', error);
    return false;
  }
},

/**
 * Sync categories from Supabase (all devices for automatic cross-device sync)
 */
async syncCategoriesFromSupabase() {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping category sync');
    return null;
  }

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);

    console.log('📥 Fetching categories from Supabase (all devices)...');

    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    const localCategories = data.map(cat => ({
      id: cat.category_id,
      name: cat.name,
      icon: cat.icon,
      updatedAt: cat.updated_at ? Date.parse(cat.updated_at) : Date.now(),
      deletedAt: cat.deleted_at ? Date.parse(cat.deleted_at) : null,
      deviceId: cat.device_id || null
    }));

    console.log(`✅ Fetched ${localCategories.length} categories from Supabase (all devices)`);
    return localCategories;
  } catch (error) {
    console.error('❌ Failed to fetch categories from Supabase:', error);
    return null;
  }
},

/**
 * Soft-delete a category row from Supabase.
 */
async deleteCategoryFromSupabase(categoryId) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping category delete');
    return false;
  }

  const category_id = categoryId != null ? String(categoryId) : '';
  if (!category_id) return false;

  try {
    const userId = await this.getSyncUserId();
    const deviceId = await this.getDeviceId();
    await this.setUserContext(userId);

    const deletedAt = new Date().toISOString();
    const { error } = await this.client
      .from('categories')
      .update({ deleted_at: deletedAt, device_id: deviceId || null })
      .eq('user_id', userId)
      .eq('category_id', category_id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Failed to delete category from Supabase:', error);
    return false;
  }
},

/**
 * Merge local and remote categories (newest wins by ID).
 * Honors both remote tombstones (deleted_at) AND local pc_deleted_categories
 * so a stale remote alive-row cannot resurrect a category the user just deleted here.
 */
async mergeCategories(localCategories, remoteCategories) {
  const merged = new Map();
  const deletedById = new Map();
  const normalizeName = (name) => String(name || '').trim().toLowerCase();

  remoteCategories.forEach(cat => {
    const id = cat?.id != null ? String(cat.id) : '';
    if (!id || !cat?.deletedAt) return;
    deletedById.set(id, cat.deletedAt);
  });

  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_categories'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_categories) ? local.pc_deleted_categories : [];
    localTombs.forEach((t) => {
      const id = t?.id != null ? String(t.id) : '';
      if (!id) return;
      const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
      const prev = deletedById.get(id) || 0;
      if (when > prev) deletedById.set(id, when);
    });
  } catch (_) { /* non-fatal */ }

  const shouldDrop = (cat) => {
    if (!cat) return true;
    const id = cat?.id != null ? String(cat.id) : '';
    const deletedAt = id ? deletedById.get(id) : null;
    const updatedAt = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : 0;
    return deletedAt && deletedAt >= updatedAt;
  };

  localCategories.forEach(cat => {
    if (!shouldDrop(cat)) {
      merged.set(cat.id, cat);
    }
  });

  remoteCategories.forEach(remoteCat => {
    if (shouldDrop(remoteCat)) {
      merged.delete(remoteCat.id);
      return;
    }
    const localCat = merged.get(remoteCat.id);
    if (!localCat) {
      merged.set(remoteCat.id, remoteCat);
      return;
    }
    const localUpdatedAt = Number.isFinite(localCat?.updatedAt) ? localCat.updatedAt : 0;
    const remoteUpdatedAt = Number.isFinite(remoteCat?.updatedAt) ? remoteCat.updatedAt : 0;
    if (remoteUpdatedAt >= localUpdatedAt) {
      merged.set(remoteCat.id, remoteCat);
    }
  });

  const dedupedByName = new Map();
  Array.from(merged.values()).forEach((cat) => {
    const key = normalizeName(cat?.name);
    if (!key) return;
    const prev = dedupedByName.get(key);
    const catUpdatedAt = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : 0;
    const prevUpdatedAt = Number.isFinite(prev?.updatedAt) ? prev.updatedAt : 0;
    if (!prev || catUpdatedAt >= prevUpdatedAt) {
      dedupedByName.set(key, cat);
    }
  });

  return Array.from(dedupedByName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// =====================================================
};
