import { CATEGORIES_DEFAULTS } from './categories.constants.js';
import { getCategoryListElements, getCategoryDropdownElements } from './categories.selectors.js';
import { renderCategoryCompositeHTML } from './categories.separators.render.js';
import { CATEGORY_SEPARATOR_SELECTORS } from './categories.separators.constants.js';

function getAllClips(app) {
  return [...(app.clips || []), ...(app.searchOnlyClips || [])];
}

function getUniqueClipCategories(app) {
  return [...new Set(getAllClips(app).map(c => c.category))];
}

export function indexClipsByCategory(clips) {
  const clipsByCategory = new Map();
  (clips || []).forEach((clip) => {
    const category = clip?.category;
    if (!clipsByCategory.has(category)) clipsByCategory.set(category, []);
    clipsByCategory.get(category).push(clip);
  });
  return clipsByCategory;
}

function normalizeCategoryName(name) {
  return String(name || '').trim();
}

function addUniqueCategoryName(names, seen, name) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return;
  const key = normalized.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  names.push(normalized);
}

function getCategoryRecency(category) {
  return Number(
    category?.updatedAt
    ?? category?.createdAt
    ?? category?.created
    ?? category?.id
    ?? 0
  );
}

function getSortedActiveCategories(app) {
  const categories = Array.isArray(app.categories) ? app.categories : [];
  return [...categories]
    .filter((category) => category && !Number.isFinite(category?.deletedAt))
    .sort((a, b) => getCategoryRecency(b) - getCategoryRecency(a));
}

/** Names from CRUD `app.categories` (newest first), always includes Uncategorized. */
function getActiveCategoryNames(app) {
  const names = [];
  const seen = new Set();
  addUniqueCategoryName(names, seen, CATEGORIES_DEFAULTS.UNCATEGORIZED);
  getSortedActiveCategories(app).forEach((category) => {
    addUniqueCategoryName(names, seen, category.name);
  });
  return names;
}

function buildSelectOptions(select, categories, defaultFirst = null) {
  if (defaultFirst !== null) select.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function getCategoriesForSelectedFile(app) {
  const categories = app.categories || [];
  if (!app.selectedFileId) return categories;
  const categoryIds = new Set((app.fileCategories || [])
    .filter((mapping) => mapping.fileId === app.selectedFileId)
    .map((mapping) => String(mapping.categoryId)));
  return categories.filter((category) => categoryIds.has(String(category.id)));
}

function renderEmptyCategories(container, selectedFileId) {
  if (selectedFileId) {
    container.innerHTML = `
      <div class="empty-categories">
        <div class="empty-categories-icon"><i data-lucide="folder"></i></div>
        <h3>No categories in this file</h3>
        <p>Click "Manage Categories" on the file to add some</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="empty-categories">
      <div class="empty-categories-icon"><i data-lucide="folder"></i></div>
      <h3>No categories yet</h3>
      <p>Create your first category to organize clips</p>
    </div>
  `;
}

function sortCategoriesForRender(categories) {
  return [...categories].sort((a, b) => {
    const aTs = Number(a?.created ?? a?.id ?? 0);
    const bTs = Number(b?.created ?? b?.id ?? 0);
    return bTs - aTs;
  });
}

function buildCategoryFragment(app, categories, clipsByCategory) {
  const fragment = document.createDocumentFragment();
  sortCategoriesForRender(categories).forEach((category) => {
    fragment.appendChild(createCategoryItem(app, category, clipsByCategory));
  });
  return fragment;
}

export function renderCategories(app) {
  const { categoriesList: container } = getCategoryListElements();
  if (!container) return;
  const categories = getCategoriesForSelectedFile(app);
  if (categories.length === 0) {
    renderEmptyCategories(container, app.selectedFileId);
    window.renderLucideIconsSync?.(container);
    return;
  }
  const clipsByCategory = indexClipsByCategory(getAllClips(app));
  container.replaceChildren(buildCategoryFragment(app, categories, clipsByCategory));
  window.renderLucideIconsSync?.(container);
}

export function createCategoryItem(app, category, clipsByCategory = null) {
  const item = document.createElement('div');
  const categoryIdKey = app._categoryIdKey(category);
  const isExpanded = app.expandedCategoryIds?.has(categoryIdKey);
  item.className = `category-item${isExpanded ? ' expanded' : ''}`;
  item.dataset.categoryId = categoryIdKey;

  const clipIndex = clipsByCategory || indexClipsByCategory(getAllClips(app));
  const clipsInCategory = clipIndex.get(category.name) || [];
  const clipCount = clipsInCategory.length;

  item.innerHTML = `
    <div class="category-header">
      <div class="category-info">
        <div class="category-icon">${app.escapeHtml(category.icon || '')}</div>
        <div class="category-details">
          <h4>${app.escapeHtml(category.name)}</h4>
          <p>${clipCount}/150 clips</p>
        </div>
      </div>
      <div class="category-header-actions">
        <button class="category-btn ${CATEGORY_SEPARATOR_SELECTORS.ADD_BTN}" data-action="add-separator" title="Add separator" aria-label="Add named separator">―</button>
        <button class="category-btn edit-category" data-action="edit" title="Edit category">✏️</button>
        <button class="category-btn delete-category" data-action="delete" title="Delete category"><i data-lucide="trash-2"></i></button>
        <span class="category-expand-icon">▶</span>
      </div>
    </div>
    <div class="category-dropdown${isExpanded ? ' expanded' : ''}" id="dropdown-${category.id}">
      ${renderCategoryCompositeHTML(app, category, clipsInCategory)}
    </div>
  `;

  const header = item.querySelector('.category-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.category-header-actions button')) return;
    app.toggleCategoryDropdown(item, category);
  });

  item.querySelector(`.${CATEGORY_SEPARATOR_SELECTORS.ADD_BTN}`)?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!item.classList.contains('expanded')) {
      app.toggleCategoryDropdown?.(item, category);
    }
    await app.createCategorySeparator?.(category, { afterClipId: null });
  });

  item.querySelector('.edit-category').addEventListener('click', (e) => {
    e.stopPropagation();
    app.editCategory(category);
  });

  item.querySelector('.delete-category').addEventListener('click', (e) => {
    e.stopPropagation();
    app.deleteCategory(category);
  });

  return item;
}

function collapseOtherCategoryItems(app, categoryItem) {
  document.querySelectorAll('.category-item.expanded').forEach(item => {
    if (item === categoryItem) return;
    item.classList.remove('expanded');
    item.querySelector('.category-dropdown').classList.remove('expanded');
    const otherId = item.dataset.categoryId ? String(item.dataset.categoryId) : '';
    if (otherId) app.expandedCategoryIds.delete(otherId);
  });
}

function collapseCategory(app, categoryItem, dropdown, categoryIdKey) {
  categoryItem.classList.remove('expanded');
  dropdown.classList.remove('expanded');
  app.expandedCategoryIds.delete(categoryIdKey);
}

function expandCategory(app, categoryItem, { dropdown, category, categoryIdKey }) {
  categoryItem.classList.add('expanded');
  dropdown.classList.add('expanded');
  if (categoryIdKey) app.expandedCategoryIds.add(categoryIdKey);
  app.attachClipHandlers(dropdown, category);
}

export function toggleCategoryDropdown(app, categoryItem, category) {
  const dropdown = categoryItem.querySelector('.category-dropdown');
  const categoryIdKey = app._categoryIdKey(category);
  collapseOtherCategoryItems(app, categoryItem);
  if (categoryItem.classList.contains('expanded')) {
    collapseCategory(app, categoryItem, dropdown, categoryIdKey);
    return;
  }
  expandCategory(app, categoryItem, { dropdown, category, categoryIdKey });
}

export function updateCategoryFilter(app) {
  const filterEl = document.getElementById('categoryFilter');
  if (!filterEl) return;

  const currentValue = filterEl.value;
  filterEl.innerHTML = '<option value="">All Categories</option>';

  const uniqueCategories = getUniqueClipCategories(app);
  buildSelectOptions(filterEl, uniqueCategories);
  filterEl.value = currentValue;
}

export function updateManualInputCategories(app) {
  const { manualInputCategory: select } = getCategoryDropdownElements();
  if (!select) return;

  const currentValue = select.value;
  const activeCategories = getActiveCategoryNames(app);

  select.innerHTML = '';
  buildSelectOptions(select, activeCategories);

  if (activeCategories.includes(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = CATEGORIES_DEFAULTS.UNCATEGORIZED;
  }
}

export function populatePdfCategoryDropdown(app) {
  const { pdfExtractCategory: select } = getCategoryDropdownElements();
  if (!select) return;

  const cats = getActiveCategoryNames(app);

  select.innerHTML = '';
  buildSelectOptions(select, cats);
  select.value = CATEGORIES_DEFAULTS.UNCATEGORIZED;
}

export function populateCategoryOptions(app) {
  const { categoryOptions: container } = getCategoryDropdownElements();
  if (!container) return;

  const allClips = getAllClips(app);
  const clipsByCategory = indexClipsByCategory(allClips);
  const uncategorizedCount = clipsByCategory.get(CATEGORIES_DEFAULTS.UNCATEGORIZED)?.length || 0;

  container.innerHTML = `
    <div class="category-option" data-category="${CATEGORIES_DEFAULTS.UNCATEGORIZED}">
      <div class="category-option-icon">${CATEGORIES_DEFAULTS.UNCATEGORIZED_ICON}</div>
      <span>${CATEGORIES_DEFAULTS.UNCATEGORIZED} (${uncategorizedCount}/∞)</span>
      <button class="category-delete-btn" title="Delete this clip"><i data-lucide="trash-2"></i></button>
    </div>
  `;

  app.categories.forEach(category => {
    const clipsInCategory = clipsByCategory.get(category.name)?.length || 0;
    const isFull = clipsInCategory >= CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY;

    const option = document.createElement('div');
    option.className = `category-option ${isFull ? 'category-full' : ''}`;
    option.dataset.category = category.name;
    option.innerHTML = `
      <div class="category-option-icon">${app.escapeHtml(category.icon || '')}</div>
      <span>${app.escapeHtml(category.name)} (${clipsInCategory}/${CATEGORIES_DEFAULTS.MAX_CLIPS_PER_CATEGORY})</span>
      ${isFull ? '<span class="full-indicator">FULL</span>' : ''}
      <button class="category-delete-btn" title="Delete this clip"><i data-lucide="trash-2"></i></button>
    `;
    container.appendChild(option);
  });
}

export async function showCreateCategoryDialog(app) {
  const name = prompt('Enter category name:');
  if (!name || !name.trim()) return;

  const iconInput = prompt('Enter category icon (emoji):');
  if (iconInput === null) return;

  const icon = iconInput.trim() || CATEGORIES_DEFAULTS.ICON;
  await app.createCategory(name.trim(), icon, { originButtonId: 'createCategoryBtn' });
}
