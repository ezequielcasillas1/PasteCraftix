/** Merge chrome.storage categories with IndexedDB payloads — never let stale IDB shadow fresh local writes. */

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
 */
export function mergeActiveCategoriesSources(localCategories, idbCategories) {
  const local = Array.isArray(localCategories) ? localCategories : [];
  const idb = Array.isArray(idbCategories) ? idbCategories : [];

  if (idb.length === 0) return [...local];
  if (local.length === 0) return [...idb];

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
  return merged;
}
