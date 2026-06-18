import { CATEGORIES_DEFAULTS } from './categories.constants.js';
import { getCategoryListElements, getCategoryDropdownElements } from './categories.selectors.js';

function getAllClips(app) {
  return [...(app.clips || []), ...(app.searchOnlyClips || [])];
}

function getUniqueClipCategories(app) {
  return [...new Set(getAllClips(app).map(c => c.category))];
}

/** Names from CRUD `app.categories` (newest first), always includes Uncategorized. */
function getActiveCategoryNames(app) {
  const names = [];
  const seen = new Set();

  const addName = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  addName(CATEGORIES_DEFAULTS.UNCATEGORIZED);

  const categories = Array.isArray(app.categories) ? app.categories : [];
  const sorted = [...categories]
    .filter((cat) => cat && !Number.isFinite(cat?.deletedAt))
    .sort((a, b) => {
      const aTs = Number(a?.updatedAt ?? a?.createdAt ?? a?.created ?? a?.id ?? 0);
      const bTs = Number(b?.updatedAt ?? b?.createdAt ?? b?.created ?? b?.id ?? 0);
      return bTs - aTs;
    });

  sorted.forEach((cat) => {
    if (cat.name && cat.name !== CATEGORIES_DEFAULTS.UNCATEGORIZED) {
      addName(cat.name);
    }
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

export function renderCategories(app) {
  const { categoriesList: container } = getCategoryListElements();
  if (!container) return;

  let categoriesToRender = app.categories || [];

  if (app.selectedFileId) {
    const fileCatIds = new Set((app.fileCategories || [])
      .filter(fc => fc.fileId === app.selectedFileId)
      .map(fc => String(fc.categoryId)));
    categoriesToRender = categoriesToRender.filter(cat => fileCatIds.has(String(cat.id)));
  }

  if (categoriesToRender.length === 0) {
    if (app.selectedFileId) {
      container.innerHTML = `
        <div class="empty-categories">
          <div class="empty-categories-icon"><i data-lucide="folder"></i></div>
          <h3>No categories in this file</h3>
          <p>Click "Manage Categories" on the file to add some</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-categories">
          <div class="empty-categories-icon"><i data-lucide="folder"></i></div>
          <h3>No categories yet</h3>
          <p>Create your first category to organize clips</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = '';
  const categoriesSorted = [...categoriesToRender].sort((a, b) => {
    const aTs = Number(a?.created ?? a?.id ?? 0);
    const bTs = Number(b?.created ?? b?.id ?? 0);
    return bTs - aTs;
  });

  categoriesSorted.forEach(category => {
    const categoryItem = createCategoryItem(app, category);
    container.appendChild(categoryItem);
  });
}

export function createCategoryItem(app, category) {
  const item = document.createElement('div');
  const categoryIdKey = app._categoryIdKey(category);
  const isExpanded = app.expandedCategoryIds?.has(categoryIdKey);
  item.className = `category-item${isExpanded ? ' expanded' : ''}`;
  item.dataset.categoryId = categoryIdKey;

  const allClips = getAllClips(app);
  const clipsInCategory = allClips.filter(clip => clip.category === category.name);
  const clipCount = clipsInCategory.length;
  const clipsHtml = isExpanded
    ? app.createCategoryClipsHTML(clipsInCategory, category.id)
    : '';

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
        <button class="category-btn edit-category" data-action="edit" title="Edit category">✏️</button>
        <button class="category-btn delete-category" data-action="delete" title="Delete category"><i data-lucide="trash-2"></i></button>
        <span class="category-expand-icon">▶</span>
      </div>
    </div>
    <div class="category-dropdown${isExpanded ? ' expanded' : ''}" id="dropdown-${category.id}">
      ${clipsHtml}
    </div>
  `;

  const header = item.querySelector('.category-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.category-header-actions button')) return;
    app.toggleCategoryDropdown(item, category);
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

export function toggleCategoryDropdown(app, categoryItem, category) {
  const dropdown = categoryItem.querySelector('.category-dropdown');
  const isExpanded = categoryItem.classList.contains('expanded');
  const categoryIdKey = app._categoryIdKey(category);

  document.querySelectorAll('.category-item.expanded').forEach(item => {
    if (item !== categoryItem) {
      item.classList.remove('expanded');
      item.querySelector('.category-dropdown').classList.remove('expanded');
      const otherId = item.dataset.categoryId ? String(item.dataset.categoryId) : '';
      if (otherId) app.expandedCategoryIds.delete(otherId);
    }
  });

  if (isExpanded) {
    categoryItem.classList.remove('expanded');
    dropdown.classList.remove('expanded');
    app.expandedCategoryIds.delete(categoryIdKey);
  } else {
    categoryItem.classList.add('expanded');
    dropdown.classList.add('expanded');
    if (categoryIdKey) app.expandedCategoryIds.add(categoryIdKey);
    if (!dropdown.children.length) {
      const allClips = getAllClips(app);
      const clipsInCategory = allClips.filter(clip => clip.category === category.name);
      dropdown.innerHTML = app.createCategoryClipsHTML(clipsInCategory, category.id);
    }
    app.attachClipHandlers(dropdown, category);
  }
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
  const uncategorizedCount = allClips.filter(c => c.category === CATEGORIES_DEFAULTS.UNCATEGORIZED).length;

  container.innerHTML = `
    <div class="category-option" data-category="${CATEGORIES_DEFAULTS.UNCATEGORIZED}">
      <div class="category-option-icon">${CATEGORIES_DEFAULTS.UNCATEGORIZED_ICON}</div>
      <span>${CATEGORIES_DEFAULTS.UNCATEGORIZED} (${uncategorizedCount}/∞)</span>
      <button class="category-delete-btn" title="Delete this clip"><i data-lucide="trash-2"></i></button>
    </div>
  `;

  app.categories.forEach(category => {
    const clipsInCategory = allClips.filter(c => c.category === category.name).length;
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
