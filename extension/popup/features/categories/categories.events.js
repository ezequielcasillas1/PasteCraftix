import { CATEGORY_SEPARATOR_SELECTORS } from './categories.separators.constants.js';
import { getCategoryIdKey } from './categories.state.js';
import { setupCategorySeparatorDrag } from './categories.separators.drag.js';
import { toggleSeparatorSection } from './categories.separators.section.js';

export function showCategoryModal(app, isReassignment = false) {
  app.populateCategoryOptions();
  document.getElementById('categoryModal').style.display = 'flex';
  document.getElementById('addToCategory').disabled = true;

  const modalText = document.querySelector('.modal-text');
  if (modalText) {
    modalText.textContent = isReassignment
      ? 'Choose a new category for this clip:'
      : 'Where would you like to save this clip?';
  }
}

export function hideCategoryModal(app) {
  document.getElementById('categoryModal').style.display = 'none';
  app.pendingText = null;
  app.pendingClipId = null;
  app.pendingBulkClipIds = null;
  app.selectedCategoryForSave = 'Uncategorized';

  document.getElementById('addToCategory').disabled = true;
  document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
  app.setActionButtonLoading?.('createNewCategory', false);
}

function findCategoryById(app, categoryId) {
  const key = String(categoryId || '');
  if (!key) return null;
  return (app.categories || []).find((cat) => getCategoryIdKey(cat) === key || String(cat?.id) === key) || null;
}

async function handleSeparatorAction(app, event) {
  const editBtn = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.EDIT_BTN}`);
  const deleteBtn = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.DELETE_BTN}`);
  const focusToggleBtn = event.target.closest(
    `.${CATEGORY_SEPARATOR_SELECTORS.FOCUS_TOGGLE_BTN}, .${CATEGORY_SEPARATOR_SELECTORS.FOCUS_LEAD_BTN}`
  );
  const addBelowBtn = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.ADD_BELOW_BTN}`);
  const addHeaderBtn = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.ADD_BTN}`);

  if (!editBtn && !deleteBtn && !focusToggleBtn && !addBelowBtn && !addHeaderBtn) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  if (addHeaderBtn) {
    const item = addHeaderBtn.closest('.category-item');
    const category = findCategoryById(app, item?.dataset?.categoryId);
    if (category) await app.createCategorySeparator?.(category, { afterClipId: null });
    return true;
  }

  if (addBelowBtn) {
    const item = addBelowBtn.closest('.category-item');
    const category = findCategoryById(app, item?.dataset?.categoryId);
    const clipId = addBelowBtn.dataset.clipId;
    if (category) await app.createCategorySeparator?.(category, { afterClipId: clipId });
    return true;
  }

  const btn = editBtn || deleteBtn || focusToggleBtn;
  const category = findCategoryById(app, btn.dataset.categoryId);
  const separatorId = btn.dataset.separatorId;
  if (!category || !separatorId) return true;

  if (focusToggleBtn) {
    toggleSeparatorSection(app, category, separatorId);
    return true;
  }
  if (editBtn) await app.renameCategorySeparator?.(category, separatorId);
  else await app.deleteCategorySeparator?.(category, separatorId);
  return true;
}

export function setupCategorySeparatorDelegation(app) {
  if (app._categorySeparatorDelegationAttached) return;
  const container = document.getElementById('categoriesList');
  if (!container) return;

  container.addEventListener('click', async (event) => {
    await handleSeparatorAction(app, event);
  });

  app._categorySeparatorDelegationAttached = true;
  setupCategorySeparatorDrag(app);
}

export function registerCategoryModalEvents(app) {
  setupCategorySeparatorDelegation(app);

  document.getElementById('closeCategoryModal')?.addEventListener('click', () => {
    app.hideCategoryModal();
  });

  document.getElementById('cancelCategorization')?.addEventListener('click', () => {
    app.hideCategoryModal();
  });

  document.getElementById('createNewCategory')?.addEventListener('click', () => {
    app.showCreateCategoryFromModal();
  });

  document.getElementById('categoryOptions')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.category-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      app.handleClipDelete();
      return;
    }

    const option = e.target.closest('.category-option');
    if (option && !option.classList.contains('category-full')) {
      document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      app.selectedCategoryForSave = option.dataset.category;
      const addBtn = document.getElementById('addToCategory');
      if (addBtn) addBtn.disabled = false;
    } else if (option && option.classList.contains('category-full')) {
      app.showToast('This category is full (150 clips max). Remove some clips first.');
    }
  });

  document.getElementById('addToCategory')?.addEventListener('click', () => {
    app.saveTextWithCategory();
  });

  document.getElementById('categoryModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'categoryModal') app.hideCategoryModal();
  });
}
