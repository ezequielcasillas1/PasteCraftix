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

export function registerCategoryModalEvents(app) {
  document.getElementById('closeCategoryModal').addEventListener('click', () => {
    app.hideCategoryModal();
  });

  document.getElementById('cancelCategorization').addEventListener('click', () => {
    app.hideCategoryModal();
  });

  document.getElementById('createNewCategory').addEventListener('click', () => {
    app.showCreateCategoryFromModal();
  });

  document.getElementById('categoryOptions').addEventListener('click', (e) => {
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
      document.getElementById('addToCategory').disabled = false;
    } else if (option && option.classList.contains('category-full')) {
      app.showToast('This category is full (150 clips max). Remove some clips first.');
    }
  });

  document.getElementById('addToCategory').addEventListener('click', () => {
    app.saveTextWithCategory();
  });

  document.getElementById('categoryModal').addEventListener('click', (e) => {
    if (e.target.id === 'categoryModal') app.hideCategoryModal();
  });
}
