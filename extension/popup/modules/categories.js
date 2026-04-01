// PasteCraft Categories Module
// Handles category management

import { STORAGE_KEYS, DEFAULT_CATEGORY } from '../../shared/constants.js';
import { getStorageItems, setStorageItems, normalizeArray, touchLocalUpdatedAt } from '../../shared/storage-adapter.js';
import { toast } from '../components/toast.js';
import { confirm, showModal } from '../components/modal.js';

const DEFAULT_ICON = '📁';
const CATEGORY_ICONS = ['📁', '📂', '📋', '📝', '📄', '📑', '📌', '📍', '🔖', '🏷️', 
  '💼', '🗂️', '📚', '📖', '🎯', '⭐', '💡', '🔧', '🛠️', '💻', 
  '🌐', '📊', '📈', '🎨', '🎬', '🎵', '🎮', '🏠', '🏢', '✈️'];

/**
 * Load categories from storage
 * @returns {Promise<Array>}
 */
export async function loadCategories() {
  const result = await getStorageItems([STORAGE_KEYS.CATEGORIES]);
  return normalizeArray(result[STORAGE_KEYS.CATEGORIES]);
}

/**
 * Save categories to storage
 * @param {Array} categories
 */
export async function saveCategories(categories) {
  await setStorageItems({ [STORAGE_KEYS.CATEGORIES]: categories });
  await touchLocalUpdatedAt();
}

/**
 * Create a new category
 * Note: ID is generated locally. When syncing to server, 
 * the server will assign a proper UUID.
 * @param {string} name - Category name
 * @param {string} icon - Category icon
 * @returns {Promise<Object>} Created category
 */
export async function createCategory(name, icon = DEFAULT_ICON) {
  const trimmedName = String(name).trim();
  if (!trimmedName) {
    throw new Error('Category name is required');
  }

  const categories = await loadCategories();
  
  // Check for duplicate name
  if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Category already exists');
  }

  const timestamp = Date.now();
  const localId = `${timestamp}_${Math.random().toString(36).slice(2, 10)}`;

  const newCategory = {
    id: localId,
    name: trimmedName,
    icon: icon || DEFAULT_ICON,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  categories.push(newCategory);
  await saveCategories(categories);

  return newCategory;
}

/**
 * Update a category
 * @param {string} categoryId - Category ID
 * @param {Object} updates - { name?, icon? }
 * @returns {Promise<Object|null>} Updated category or null
 */
export async function updateCategory(categoryId, updates) {
  if (!categoryId) return null;

  const categories = await loadCategories();
  const index = categories.findIndex(c => String(c.id) === String(categoryId));
  
  if (index === -1) return null;

  // Check for duplicate name
  if (updates.name) {
    const trimmedName = String(updates.name).trim();
    const duplicate = categories.some((c, i) => 
      i !== index && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error('Category name already exists');
    }
    updates.name = trimmedName;
  }

  categories[index] = {
    ...categories[index],
    ...updates,
    updatedAt: Date.now()
  };

  await saveCategories(categories);
  return categories[index];
}

/**
 * Delete a category
 * @param {string} categoryId - Category ID
 * @param {boolean} moveClipsToUncategorized - Move clips to Uncategorized
 * @returns {Promise<boolean>}
 */
export async function deleteCategory(categoryId, moveClipsToUncategorized = true) {
  if (!categoryId) return false;

  const categories = await loadCategories();
  const category = categories.find(c => String(c.id) === String(categoryId));
  
  if (!category) return false;

  // Move clips to Uncategorized
  if (moveClipsToUncategorized) {
    const result = await getStorageItems([STORAGE_KEYS.CLIPS, STORAGE_KEYS.SEARCH_ONLY_CLIPS]);
    const clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);
    const archived = normalizeArray(result[STORAGE_KEYS.SEARCH_ONLY_CLIPS]);

    const updateClips = (arr) => arr.map(c => 
      c.category === category.name ? { ...c, category: DEFAULT_CATEGORY } : c
    );

    await setStorageItems({
      [STORAGE_KEYS.CLIPS]: updateClips(clips),
      [STORAGE_KEYS.SEARCH_ONLY_CLIPS]: updateClips(archived)
    });
  }

  // Remove category
  const newCategories = categories.filter(c => String(c.id) !== String(categoryId));
  await saveCategories(newCategories);

  return true;
}

/**
 * Get category by name
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export async function getCategoryByName(name) {
  const categories = await loadCategories();
  return categories.find(c => c.name.toLowerCase() === String(name).toLowerCase()) || null;
}

/**
 * Get category clip counts
 * @returns {Promise<Object>} { categoryName: count }
 */
export async function getCategoryClipCounts() {
  const result = await getStorageItems([STORAGE_KEYS.CLIPS]);
  const clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);

  const counts = {};
  clips.forEach(clip => {
    const cat = clip.category || DEFAULT_CATEGORY;
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return counts;
}

/**
 * Show category picker modal
 * @param {Object} options
 * @param {string} options.currentCategory - Currently selected category
 * @param {Function} options.onSelect - Callback (categoryName) => void
 */
export async function showCategoryPicker({ currentCategory, onSelect }) {
  const categories = await loadCategories();
  const counts = await getCategoryClipCounts();

  const content = `
    <div style="max-height: 300px; overflow-y: auto;">
      <div class="pc-category-item" data-category="${DEFAULT_CATEGORY}" 
           style="padding: 12px; cursor: pointer; border-radius: 6px; margin-bottom: 4px;
                  ${currentCategory === DEFAULT_CATEGORY ? 'background: var(--pc-primary-light, #e0f2fe);' : ''}">
        <span style="margin-right: 8px;">📋</span>
        <span>${DEFAULT_CATEGORY}</span>
        <span style="float: right; color: var(--pc-text-tertiary, #94a3b8);">${counts[DEFAULT_CATEGORY] || 0}</span>
      </div>
      ${categories.map(cat => `
        <div class="pc-category-item" data-category="${escapeHtml(cat.name)}"
             style="padding: 12px; cursor: pointer; border-radius: 6px; margin-bottom: 4px;
                    ${currentCategory === cat.name ? 'background: var(--pc-primary-light, #e0f2fe);' : ''}">
          <span style="margin-right: 8px;">${cat.icon || DEFAULT_ICON}</span>
          <span>${escapeHtml(cat.name)}</span>
          <span style="float: right; color: var(--pc-text-tertiary, #94a3b8);">${counts[cat.name] || 0}</span>
        </div>
      `).join('')}
    </div>
  `;

  const modal = showModal({
    title: 'Select Category',
    content,
    buttons: [{ label: 'Cancel', type: 'default' }]
  });

  // Handle clicks
  modal.getBody().querySelectorAll('.pc-category-item').forEach(el => {
    el.addEventListener('click', () => {
      const category = el.dataset.category;
      modal.close();
      if (onSelect) onSelect(category);
    });

    el.addEventListener('mouseenter', () => {
      el.style.background = 'var(--pc-bg-tertiary, #f1f5f9)';
    });
    el.addEventListener('mouseleave', () => {
      const isSelected = el.dataset.category === currentCategory;
      el.style.background = isSelected ? 'var(--pc-primary-light, #e0f2fe)' : '';
    });
  });
}

/**
 * Show create category modal
 * @returns {Promise<Object|null>} Created category or null
 */
export async function showCreateCategoryModal() {
  return new Promise((resolve) => {
    const content = `
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Name</label>
        <input type="text" id="pc-cat-name" placeholder="Category name" 
               style="width: 100%; padding: 8px 12px; border: 1px solid var(--pc-border, #e2e8f0); 
                      border-radius: 6px; font-size: 14px;" />
      </div>
      <div>
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Icon</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 120px; overflow-y: auto;">
          ${CATEGORY_ICONS.map((icon, i) => `
            <button class="pc-icon-btn" data-icon="${icon}" 
                    style="width: 36px; height: 36px; border: 1px solid var(--pc-border, #e2e8f0); 
                           border-radius: 6px; cursor: pointer; font-size: 18px; background: #fff;
                           ${i === 0 ? 'border-color: var(--pc-primary, #0ea5e9);' : ''}">
              ${icon}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    let selectedIcon = CATEGORY_ICONS[0];

    const modal = showModal({
      title: 'Create Category',
      content,
      buttons: [
        { label: 'Cancel', type: 'default', onClick: () => { resolve(null); } },
        { label: 'Create', type: 'primary', onClick: async () => {
          const nameInput = document.getElementById('pc-cat-name');
          const name = nameInput?.value?.trim();
          
          if (!name) {
            toast.error('Please enter a category name');
            return false; // Don't close modal
          }

          try {
            const category = await createCategory(name, selectedIcon);
            toast.success('Category created');
            resolve(category);
          } catch (err) {
            toast.error(err.message);
            return false;
          }
        }}
      ]
    });

    // Handle icon selection
    modal.getBody().querySelectorAll('.pc-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.getBody().querySelectorAll('.pc-icon-btn').forEach(b => {
          b.style.borderColor = 'var(--pc-border, #e2e8f0)';
        });
        btn.style.borderColor = 'var(--pc-primary, #0ea5e9)';
        selectedIcon = btn.dataset.icon;
      });
    });

    // Focus input
    setTimeout(() => document.getElementById('pc-cat-name')?.focus(), 100);
  });
}

/**
 * Confirm and delete category
 * @param {Object} category
 * @param {Function} onDelete - Callback after deletion
 */
export async function confirmDeleteCategory(category, onDelete) {
  const confirmed = await confirm({
    title: 'Delete Category',
    message: `Delete "${category.name}"? Clips will be moved to Uncategorized.`,
    confirmText: 'Delete',
    confirmType: 'danger'
  });

  if (!confirmed) return;

  const success = await deleteCategory(category.id);
  
  if (success) {
    toast.success('Category deleted');
    if (onDelete) onDelete(category);
  } else {
    toast.error('Failed to delete category');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { CATEGORY_ICONS, DEFAULT_ICON };
