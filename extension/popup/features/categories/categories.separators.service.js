import {
  CATEGORY_SEPARATOR_DEFAULTS,
  CATEGORY_SEPARATOR_TYPE,
} from './categories.separators.constants.js';
import { getCategoryIdKey } from './categories.state.js';

function normalizeName(name) {
  return String(name || '').trim().slice(0, CATEGORY_SEPARATOR_DEFAULTS.MAX_NAME_LENGTH);
}

function clipIdKey(clipId) {
  if (clipId == null || clipId === '') return null;
  return String(clipId);
}

function isSameSeparator(sep, separatorId) {
  return String(sep?.id) === String(separatorId);
}

function isActiveSeparator(sep) {
  return sep && !Number.isFinite(sep.deletedAt);
}

export function createSeparatorId() {
  return `sep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeSeparators(separators) {
  if (!Array.isArray(separators)) return [];
  return separators
    .filter((item) => item && typeof item === 'object' && item.id != null)
    .map((item) => ({
      id: String(item.id),
      type: CATEGORY_SEPARATOR_TYPE,
      name: normalizeName(item.name) || CATEGORY_SEPARATOR_DEFAULTS.NAME,
      afterClipId: clipIdKey(item.afterClipId),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
      ...(Number.isFinite(item.deletedAt) ? { deletedAt: item.deletedAt } : {}),
    }));
}

export function getActiveSeparators(category) {
  return normalizeSeparators(category?.separators).filter(isActiveSeparator);
}

function findCategoryIndex(categories, categoryId) {
  const key = String(categoryId);
  return (categories || []).findIndex((cat) => getCategoryIdKey(cat) === key || String(cat?.id) === key);
}

function getFullSeparatorList(category) {
  return normalizeSeparators(category?.separators);
}

function findActiveSeparator(list, separatorId) {
  return list.find((sep) => isSameSeparator(sep, separatorId) && isActiveSeparator(sep)) || null;
}

function patchSeparator(list, separatorId, patch) {
  const now = Date.now();
  return list.map((sep) => (
    isSameSeparator(sep, separatorId) ? { ...sep, ...patch, updatedAt: now } : sep
  ));
}

async function persistCategorySeparators(app, categoryId, nextSeparators) {
  const idx = findCategoryIndex(app.categories, categoryId);
  if (idx < 0) throw new Error('Category not found');

  const now = Date.now();
  const category = app.categories[idx];
  const categoryKey = getCategoryIdKey(category);
  if (categoryKey && app.expandedCategoryIds?.add) {
    app.expandedCategoryIds.add(categoryKey);
  }

  const nextCategories = app.categories.map((cat, i) => (
    i === idx
      ? { ...cat, separators: normalizeSeparators(nextSeparators), updatedAt: now }
      : cat
  ));

  app.categories = nextCategories;
  await chrome.storage.local.set({
    categories: nextCategories,
    pc_local_updatedAt: now,
  });
  app.renderCategories?.();

  try {
    await window.pasteCraftSupabase?.syncCategoriesToSupabase?.(app.categories);
  } catch (err) {
    console.error('[category-separators] sync failed:', err);
  }

  return nextCategories[idx];
}

export async function createCategorySeparator(app, category, options = {}) {
  if (!category?.id) return null;

  const nameInput = options.name != null
    ? String(options.name)
    : prompt('Separator name (study section):', CATEGORY_SEPARATOR_DEFAULTS.NAME);
  if (nameInput === null) return null;

  const name = normalizeName(nameInput) || CATEGORY_SEPARATOR_DEFAULTS.NAME;
  const now = Date.now();
  const separator = {
    id: createSeparatorId(),
    type: CATEGORY_SEPARATOR_TYPE,
    name,
    afterClipId: clipIdKey(options.afterClipId),
    createdAt: now,
    updatedAt: now,
  };

  await persistCategorySeparators(app, category.id, [...getFullSeparatorList(category), separator]);
  app.showToast?.(`Separator "${name}" added`, 'success');
  return separator;
}

export async function renameCategorySeparator(app, category, separatorId) {
  if (!category?.id || !separatorId) return null;
  const all = getFullSeparatorList(category);
  const target = findActiveSeparator(all, separatorId);
  if (!target) {
    app.showToast?.('Separator not found', 'error');
    return null;
  }

  const nameInput = prompt('Rename separator:', target.name);
  if (nameInput === null) return null;
  const name = normalizeName(nameInput) || CATEGORY_SEPARATOR_DEFAULTS.NAME;

  await persistCategorySeparators(app, category.id, patchSeparator(all, separatorId, { name }));
  app.showToast?.(`Separator renamed to "${name}"`, 'success');
  return name;
}

export async function moveCategorySeparator(app, category, separatorId, afterClipId) {
  if (!category?.id || !separatorId) return false;
  const all = getFullSeparatorList(category);
  const target = findActiveSeparator(all, separatorId);
  if (!target) return false;

  const nextAfter = clipIdKey(afterClipId);

  await persistCategorySeparators(
    app,
    category.id,
    patchSeparator(all, separatorId, {
      afterClipId: nextAfter,
      createdAt: Date.now(),
    }),
  );
  return true;
}

export async function deleteCategorySeparator(app, category, separatorId) {
  if (!category?.id || !separatorId) return false;
  const all = getFullSeparatorList(category);
  const target = findActiveSeparator(all, separatorId);
  if (!target) {
    app.showToast?.('Separator already removed', 'success');
    return true;
  }
  if (!confirm(`Delete separator "${target.name}"?`)) return false;

  await persistCategorySeparators(
    app,
    category.id,
    patchSeparator(all, separatorId, { deletedAt: Date.now() }),
  );
  app.showToast?.(`Separator "${target.name}" deleted`, 'success');
  return true;
}
