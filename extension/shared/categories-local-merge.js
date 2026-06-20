/** Merge chrome.storage categories with IndexedDB payloads — never let stale IDB shadow fresh local writes. */

export function buildCategoryTombstoneMap(tombstones) {
  const deletedById = new Map();
  const list = Array.isArray(tombstones) ? tombstones : [];
  for (const tombstone of list) {
    const id = tombstone?.id != null ? String(tombstone.id) : '';
    if (!id) continue;
    const when = Number.isFinite(tombstone?.deletedAt) ? tombstone.deletedAt : Date.now();
    const prev = deletedById.get(id) || 0;
    if (when > prev) deletedById.set(id, when);
  }
  return deletedById;
}

export function isCategoryTombstoned(category, tombstoneMap) {
  if (!category || !tombstoneMap || tombstoneMap.size === 0) return false;
  const id = getCategoryMergeKey(category);
  if (!id) return false;
  const deletedAt = tombstoneMap.get(id);
  if (!deletedAt) return false;
  return deletedAt >= getCategorySortTime(category);
}

export function filterTombstonedCategories(categories, tombstones) {
  const tombstoneMap = buildCategoryTombstoneMap(tombstones);
  if (tombstoneMap.size === 0) return Array.isArray(categories) ? [...categories] : [];
  return (Array.isArray(categories) ? categories : []).filter(
    (category) => !isCategoryTombstoned(category, tombstoneMap),
  );
}

export function getCategoryMergeKey(category) {
  if (category == null) return '';
  const id = category.id ?? category.category_id ?? category.categoryId;
  return id != null ? String(id) : '';
}

export function getCategorySortTime(category) {
  if (!category || typeof category !== 'object') return 0;
  const updated = Number(category.updatedAt ?? category.updated_at);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const created = Number(category.createdAt ?? category.created_at ?? category.created);
  if (Number.isFinite(created) && created > 0) return created;
  const id = Number(category.id);
  return Number.isFinite(id) ? id : 0;
}

/**
 * Union categories by id; when both sources have the same id, keep the newer record.
 * Honors pc_deleted_categories tombstones so stale IndexedDB cannot resurrect deletes.
 */
export function mergeActiveCategoriesSources(localCategories, idbCategories, tombstones = []) {
  const local = Array.isArray(localCategories) ? localCategories : [];
  const idb = Array.isArray(idbCategories) ? idbCategories : [];
  const tombstoneMap = buildCategoryTombstoneMap(tombstones);

  if (idb.length === 0) {
    return filterTombstonedCategories(local, tombstones);
  }
  if (local.length === 0) {
    return filterTombstonedCategories(idb, tombstones);
  }

  const byId = new Map();

  for (const category of idb) {
    const key = getCategoryMergeKey(category);
    if (key) byId.set(key, category);
  }

  for (const category of local) {
    const key = getCategoryMergeKey(category);
    if (!key) continue;
    const existing = byId.get(key);
    if (!existing || getCategorySortTime(category) >= getCategorySortTime(existing)) {
      byId.set(key, category);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => getCategorySortTime(b) - getCategorySortTime(a));

  if (tombstoneMap.size === 0) return merged;
  return merged.filter((category) => !isCategoryTombstoned(category, tombstoneMap));
}
